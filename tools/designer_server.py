#!/usr/bin/env python3
"""
The glyph designer's local server.

    python3 tools/designer_server.py        # http://localhost:8792/

Serves designer/ and a small JSON API over it. This is deliberately a
separate site from site/: the main tool is a static page that has to run
off file:// and on the wiki, while the designer needs to write files, so
it can't be static and shouldn't be shipped.

It binds to 127.0.0.1 only and is not hardened — it writes files under
designs/ on request, which is the whole point, so don't expose it.

API
---
    GET    /api/catalog          every sound, with its underlays
    GET    /api/designs          every saved design, keyed by name
    PUT    /api/designs/<name>   save one (body: the design JSON)
    DELETE /api/designs/<name>   delete one
    POST   /api/render           design JSON in, SVG + python source out
    POST   /api/promote/<name>   write it into build_glyphs.py and rebuild
    POST   /api/resync           put the glyph set back to what is deployed
    GET    /api/block-feedback   notes on how each block looks (blocks.html)
    PUT    /api/block-feedback   save one block's note: {key, status, note}
    GET    /api/block-tweaks     per-block design tweaks (designs/blocks/tweaks.json)
    PUT    /api/block-tweaks     set one block's tweak: {key, dots}
    POST   /api/block-tweaks/ship  rebuild manifest.js and the wiki Lua/CSS with them

    GET    /site/...             the main site's own files, read-only

/api/catalog carries the traced key shape and the currently-drawn glyph
inline for every sound, so the designer gets its underlays in a single
request and works the same whether or not those files exist.

/api/render is what the designer's output panel uses. The canvas draws
with its own JavaScript port (designer/js/geom.js) because round-tripping
a drag would feel terrible, but anything you copy out of the designer is
rendered by tools/glyphspec.py, so the authority is always the Python.

/site/ is why the designer can show a glyph in a real block: it serves
the deployed site's render.js, blocks.css, g2p.js and sounds.js straight
off disk, so the live preview is drawn by the code that draws the actual
product rather than by a lookalike kept in the designer. Read-only, and
only for the handful of files the preview needs.

/api/promote is the "ship it" button — see tools/promote.py for what it
edits and what it deliberately leaves alone.
"""

import importlib
import json
import pathlib
import re
import subprocess
import sys
import urllib.parse
from datetime import datetime, timezone
from http.server import HTTPServer, SimpleHTTPRequestHandler

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import glyphspec                                        # noqa: E402
import build_glyphs as bg                               # noqa: E402
import promote as promote_mod                           # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "designer"
SITE = ROOT / "site"
DESIGNS = ROOT / "designs"
REF = ROOT / "site" / "assets" / "reference"
GLYPHS = ROOT / "site" / "assets" / "glyphs"
SOUNDS = ROOT / "site" / "js" / "sounds.js"

PORT = 8792

# Feedback on how two glyphs look stacked into a block — the review grid at
# /blocks.html writes it, keyed "top|bottom" in IPA. Deliberately NOT under
# designs/: it is notes about the drawing, not the drawing, and the resync
# button (which resets designs/) must never throw it away.
FEEDBACK = ROOT / "feedback" / "blocks.json"
TWEAKS = DESIGNS / "blocks" / "tweaks.json"

NAME_OK = re.compile(r"^[a-z0-9_]+$")

# The only files under site/ the designer may read. An allow-list rather
# than a path check: this server exists to write to designs/, and the
# less of the tree it will hand out, the less there is to get wrong.
SITE_FILES = {
    "js/manifest.js", "js/corpus.js", "js/render.js", "js/g2p.js",
    "js/sounds.js", "css/blocks.css",
}
SITE_TYPES = {".js": "application/javascript", ".css": "text/css",
              ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
              ".webp": "image/webp", ".gif": "image/gif"}
# The source images too (site/sources/*), for the block review's source
# tabs: one plain filename, no subfolders, an image suffix.
SOURCE_IMAGE = re.compile(r"sources/[A-Za-z0-9._-]+\.(png|jpe?g|webp|gif)")

# A word that puts the sound somewhere obvious, for the picker. Canon
# spellings where there is one, since those are the shapes being matched.
EXAMPLES = {
    "p": "please", "b": "be", "t": "not", "d": "do", "k": "wake",
    "g": "gone", "m": "mad", "n": "not", "ng": "Aang", "f": "fire",
    "v": "of", "th": "thing", "dh": "the", "s": "some", "z": "please",
    "h": "hello", "w": "when", "y": "you", "r": "really", "l": "please",
    "ch": "chase", "j_dz": "just", "sh": "she",
    "zh": "vision",
    "i": "please", "ih": "metalbending", "ei": "wake", "eh": "set",
    "ae": "mad", "uh": "up", "schwa": "katara / earth", "uu": "do", "oo": "good",
    "ow": "toe", "aw": "thought", "ah": "appa", "ai": "tie", "au": "now",
    "oi": "toy",
    "null_c": "(null, consonant height)", "null_v": "(null, vowel height)",
    "hyphen": "well-known", "possessive": "Zuko's",
}


def code_map():
    """
    IPA -> the readable code to show, read out of sounds.js's own READABLE
    table so the designer teaches the same scheme the main tool does.
    Reading it rather than restating it means the two can't drift.

    Falls back to nothing if READABLE stops being a plain object literal,
    which shows up as a sound list with no codes rather than wrong ones.
    """
    # The null is typed `-`; the numerals, zero included, as themselves.
    out = {bg.NULL_IPA: "-", **{d: d for d in bg.NUMERAL_TO_NAME},
           # Marks are typed as themselves (`--` for the hyphen).
           **{m: m for m in {**bg.PUNCT_TO_NAME, **bg.WORD_MARKS}}}
    try:
        src = SOUNDS.read_text(encoding="utf-8")
    except OSError:
        return out
    block = re.search(r"READABLE\s*=\s*\{(.*?)\n\};", src, re.S)
    if block:
        for code, ipa in re.findall(r'"?([\w\']+)"?\s*:\s*"([^"]+)"', block.group(1)):
            out.setdefault(ipa, code)
    return out


def read(path):
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return None


def catalog():
    codes = code_map()
    rows = []
    for ipa, name in bg.IPA_TO_NAME.items():
        # `type` is the design's HEIGHT CLASS (glyphspec's TALL_KINDS),
        # `group` is the heading it is filed under in the sound list.
        # They differ for the two nulls: both read as marks, but one is
        # written at a consonant's height and one at a vowel's.
        kind = bg.design_type(ipa)
        numeral = ipa in bg.NUMERAL_TO_NAME
        if numeral:
            group = "numeral"
        elif kind.startswith("mark"):
            group = "mark"
        else:
            group = kind
        rows.append({
            "name": name,
            "ipa": None if ipa in (bg.NULL_IPA, bg.NULL_C_IPA) else ipa,
            "key": ipa,
            "type": kind,
            "group": group,
            # A full-height mark opens at whatever width it ships (the
            # question mark may be wider than one column); one not yet drawn
            # opens at its default width (a numeral 3, the possessive 5);
            # every other glyph has a fixed grid.
            "grid": ([bg.MARKS_FULL[name]["cols"], 9]
                     if kind == "mark_full" and name in bg.MARKS_FULL
                     else [bg.DEFAULT_MARK_COLS.get(name, 1), 9] if kind == "mark_full"
                     else glyphspec.grid_for(kind)),
            "code": codes.get(ipa),
            "example": EXAMPLES.get(name),
            "placeholder": name in bg.PLACEHOLDERS,
            # Both as the BUILD currently sees them — base set overlaid
            # with whatever designs/ says. The designer's checkbox and
            # row toggle write back into the design, so these are what
            # they show when a glyph is opened.
            "flips": ipa in bg.FLIPS,
            "rows": (4 if ipa in bg.VOWEL_4ROW else 3)
                    if kind == "vowel" else None,
            "note": bg.SOURCE_NOTES.get(name),
            # Underlays: the shape traced out of the hand-lettered key,
            # and whatever the glyph set currently draws. Both optional.
            #
            # The key is only ever traced square, so a vowel's tracing has
            # to be squashed to sit on a 5x4 lattice. The drawn glyph does
            # not: vowels already ship an exact 100x80 copy, and using it
            # keeps the underlay's dots round instead of squashing them
            # into ellipses under the very shape being lined up.
            "reference": read(REF / f"{name}.svg"),
            "current": None if name in bg.PLACEHOLDERS else read(GLYPHS / f"{name}.svg"),
            "currentFlat": None if name in bg.PLACEHOLDERS
            else read(GLYPHS / f"{name}{bg.FLAT_SUFFIX}.svg"),
        })
    # Cluster (C-C) forms drawn independently (see CLUSTERS in build_glyphs).
    # Each is one of a mirror pair: only the master is drawn here, and its
    # partner's cluster is the horizontal flip. /l/ is drawn (the key traces a
    # distinct cluster /l/, l_b) and /r/'s mirrors it; /w/ is drawn and /y/'s
    # mirrors it. `mirror` names the partner the note should point at.
    for base, ref_stem, mirror in (("l", "l_b", "r"), ("w", None, "y")):
        name = f"{base}{bg.CLUSTER_SUFFIX}"
        rows.append({
            "name": name, "ipa": None, "key": name,
            "type": "consonant", "group": "cluster",
            "grid": glyphspec.grid_for("consonant"),
            "code": None, "example": None,
            "placeholder": not (GLYPHS / f"{name}.svg").exists(),
            "flips": False, "rows": None,
            "note": f"cluster (C-C) form of /{base}/ — drawn, not flipped "
                    f"(/{mirror}/'s mirrors it)",
            "reference": read(REF / f"{ref_stem}.svg") if ref_stem else None,
            "current": read(GLYPHS / f"{name}.svg"),
            "currentFlat": None,
        })

    order = {"consonant": 0, "vowel": 1, "mark": 2, "numeral": 3, "cluster": 4}
    # Numerals sort by value, not alphabetically by their spelled-out names.
    rows.sort(key=lambda r: (order[r["group"]],
                             r["key"] if r["group"] == "numeral" else r["name"]))

    # Extra tracings the key has that aren't a sound of their own — the
    # second /l/ and /æ/ cells, which are the bottom-slot orientations.
    extra = {}
    for stem in ("l_b", "ae_b"):
        svg = read(REF / f"{stem}.svg")
        if svg:
            extra[stem] = svg

    return {
        "sounds": rows,
        "extraReferences": extra,
        "geometry": {
            "unit": glyphspec.UNIT,
            "marginX": glyphspec.MARGIN_X,
            "marginYSquare": glyphspec.MARGIN_Y_SQUARE,
            "marginYFlat": glyphspec.MARGIN_Y_FLAT,
            "flat": glyphspec.FLAT,
            "strokeWidth": glyphspec.SW,
            "dotSizes": glyphspec.DOT_SIZES,
        },
    }


# What "deployed" means: the website is built from main on GitHub, so the
# deployed glyph set is origin/main. These are every path the designer and
# its ship button write — the designs, the shipped set, and the build it
# makes — and nothing else, so a resync can't touch unrelated work.
DEPLOYED_REF = "origin/main"
GLYPH_PATHS = [
    "designs", "tools/build_glyphs.py", "site/assets/glyphs",
    "site/assets/glyph_manifest.json", "site/js/manifest.js",
]


def git(*args, check=True):
    return subprocess.run(["git", *args], cwd=ROOT, capture_output=True,
                          text=True, check=check).stdout


def resync(dry_run):
    """Bring the glyph set back to what is deployed (origin/main).

    The dry run lists what differs. The real run first STASHES every local
    change under GLYPH_PATHS (untracked new designs included), so nothing is
    lost — `git stash list` shows it, `git stash pop` brings it back — then
    restores those paths from origin/main, deleting anything origin/main
    doesn't have. The modules are reloaded so the next catalogue request
    reports the restored set without a server restart.
    """
    git("fetch", "--quiet", "origin")
    deployed = git("rev-parse", "--short", DEPLOYED_REF).strip()
    changed = sorted(set(
        git("diff", "--name-only", DEPLOYED_REF, "--", *GLYPH_PATHS).split()
        + git("ls-files", "--others", "--exclude-standard", "--", *GLYPH_PATHS).split()))
    designs = sorted({pathlib.PurePath(f).stem for f in changed
                      if f.startswith("designs/") and f.endswith(".json")})
    out = {"deployed": deployed, "files": changed, "designs": designs,
           "setChanged": "tools/build_glyphs.py" in changed}
    if dry_run or not changed:
        return out

    # Back up first: anything not yet committed goes into a stash.
    if git("status", "--porcelain", "--", *GLYPH_PATHS).strip():
        stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        git("stash", "push", "--include-untracked",
            "-m", f"designer resync {stamp}", "--", *GLYPH_PATHS)
        out["stashed"] = True
    # Then match origin/main exactly on these paths (this also removes files
    # origin/main doesn't have).
    git("restore", f"--source={DEPLOYED_REF}", "--staged", "--worktree",
        "--", *GLYPH_PATHS)
    importlib.reload(bg)
    importlib.reload(promote_mod)
    bg.refresh()
    return out


def load_feedback():
    try:
        return json.loads(FEEDBACK.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_feedback(entry):
    """Merge one block's feedback in. An empty status and note removes it,
    so clearing a cell leaves no stub behind."""
    key = str(entry.get("key") or "")
    if "|" not in key:
        raise ValueError("key must be 'top|bottom'")
    data = load_feedback()
    status = entry.get("status") if entry.get("status") in ("good", "bad") else None
    note = str(entry.get("note") or "").strip()
    if not status and not note:
        data.pop(key, None)
    else:
        data[key] = {"status": status, "note": note,
                     "updated": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")}
    FEEDBACK.parent.mkdir(exist_ok=True)
    FEEDBACK.write_text(json.dumps(dict(sorted(data.items())), ensure_ascii=False, indent=2) + "\n",
                        encoding="utf-8")
    return data.get(key)


def load_tweaks():
    try:
        return json.loads(TWEAKS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}


def save_tweak(entry):
    """Set one block's tweaks (render.js BLOCK_TWEAKS). Only `dots` for now,
    a whole number of viewBox units; 0 removes it, and a block left with no
    tweaks is dropped. Saved here, shipped by ship_tweaks()."""
    key = str(entry.get("key") or "")
    if "|" not in key:
        raise ValueError("key must be 'top|bottom'")
    data = load_tweaks()
    t = dict(data.get(key) or {})
    if "dots" in entry:
        dots = int(round(float(entry["dots"] or 0)))
        if not -16 <= dots <= 16:
            raise ValueError("dots must be between -16 and 16")
        if dots:
            t["dots"] = dots
        else:
            t.pop("dots", None)
    if t:
        data[key] = t
    else:
        data.pop(key, None)
    TWEAKS.parent.mkdir(parents=True, exist_ok=True)
    TWEAKS.write_text(json.dumps(dict(sorted(data.items())), ensure_ascii=False, indent=2) + "\n",
                      encoding="utf-8")
    return data.get(key)


def ship_tweaks():
    """Bake the tweaks into site/js/manifest.js, then regenerate the wiki's
    Lua module and CSS from it (both read the manifest)."""
    import build_manifest
    import build_lua_module
    import build_css_only
    for mod in (build_manifest, build_lua_module, build_css_only):
        mod = importlib.reload(mod)
        if mod is build_css_only:
            # It reads its output path off sys.argv at import, which here
            # is the server's own command line.
            mod.OUT = ROOT / "wiki" / "Avatarian-css-only.css"
        mod.main()
    return {"shipped": load_tweaks()}


def load_designs():
    DESIGNS.mkdir(exist_ok=True)
    out = {}
    for p in sorted(DESIGNS.glob("*.json")):
        try:
            out[p.stem] = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            out[p.stem] = {"name": p.stem, "error": str(e)}
    return out


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(WEB), **kw)

    # --- plumbing ---------------------------------------------------------

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def read_json(self):
        length = int(self.headers.get("Content-Length") or 0)
        if not length:
            return None
        return json.loads(self.rfile.read(length).decode("utf-8"))

    def end_headers(self):
        # The main site is bitten regularly by aggressive caching of its
        # generated files; a designer that serves a stale editor after an
        # edit would waste the same afternoon.
        if not self.path.startswith("/api/"):
            self.send_header("Cache-Control", "no-store")
        super().end_headers()

    def log_message(self, fmt, *args):
        if self.path.startswith("/api/") and self.command != "GET":
            sys.stderr.write("%s %s\n" % (self.command, self.path))

    def stem(self, prefix):
        name = self.path[len(prefix):].strip("/")
        return name if NAME_OK.match(name) else None

    # --- routes -----------------------------------------------------------

    def do_GET(self):
        if self.path == "/api/catalog":
            return self.send_json(catalog())
        if self.path == "/api/designs":
            return self.send_json(load_designs())
        if self.path == "/api/block-feedback":
            return self.send_json(load_feedback())
        if self.path == "/api/block-tweaks":
            return self.send_json(load_tweaks())
        if self.path.startswith("/site/"):
            return self.send_site(self.path[len("/site/"):].split("?")[0])
        return super().do_GET()

    def send_site(self, rel):
        """One of the main site's own files, so the live preview is drawn
        by the product's code rather than a copy of it."""
        rel = urllib.parse.unquote(rel)
        if rel not in SITE_FILES and not (SOURCE_IMAGE.fullmatch(rel) and ".." not in rel):
            return self.send_error(404)
        path = SITE / rel
        try:
            body = path.read_bytes()
        except OSError:
            return self.send_error(404)
        self.send_response(200)
        ctype = SITE_TYPES.get(path.suffix.lower(), "text/plain")
        self.send_header("Content-Type", ctype if ctype.startswith("image/") else ctype + "; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_POST(self):
        # Checked before the per-name route: "-all" is not a valid stem,
        # so the order matters rather than being cosmetic.
        if self.path == "/api/promote-all":
            return self.promote_all()
        if self.path == "/api/block-tweaks/ship":
            try:
                return self.send_json(ship_tweaks())
            except Exception as e:                   # noqa: BLE001
                return self.send_json({"error": f"{type(e).__name__}: {e}"}, 500)
        if self.path == "/api/resync":
            body = self.read_json() or {}
            try:
                return self.send_json(resync(dry_run=bool(body.get("dryRun"))))
            except subprocess.CalledProcessError as e:
                return self.send_json({"error": (e.stderr or str(e)).strip()}, 500)
        if self.path.startswith("/api/promote/"):
            return self.promote(self.stem("/api/promote"))
        if self.path != "/api/render":
            return self.send_error(404)
        try:
            design = self.read_json() or {}
            forms = glyphspec.forms_for(design)
            return self.send_json({
                "square": glyphspec.to_svg(design, "square"),
                "flat": glyphspec.to_svg(design, "flat") if "flat" in forms else None,
                "python": glyphspec.to_python(design),
                "problems": glyphspec.validate(design),
            })
        except Exception as e:                       # noqa: BLE001
            return self.send_json({"error": f"{type(e).__name__}: {e}"}, 400)

    def promote(self, name):
        """Ship the design into the glyph set, then rebuild.

        The design is read off DISK rather than taken from the request
        body: the designer autosaves, and shipping something the files
        don't agree with is the one way this could put a shape into the
        set that nobody can find again.
        """
        if not name:
            return self.send_json({"error": "bad name"}, 400)
        body = self.read_json() or {}
        # A cluster form isn't pasted into build_glyphs — the build reads its
        # design (designs/<name>.json) straight off disk. So "promote" for one
        # is just a rebuild; nothing edits the source.
        if name.endswith(bg.CLUSTER_SUFFIX):
            log = promote_mod.rebuild()
            return self.send_json({"action": "rebuilt", "dict": "CLUSTERS",
                                   "name": name, "log": log})
        try:
            res = promote_mod.promote(
                name, allow_invented=bool(body.get("allowInvented")))
        except promote_mod.PromoteError as e:
            return self.send_json({"error": str(e),
                                   "placeholder": name in bg.PLACEHOLDERS}, 400)
        except Exception as e:                       # noqa: BLE001
            return self.send_json({"error": f"{type(e).__name__}: {e}"}, 500)
        # promote() reloads build_glyphs in place, so `bg` here already
        # sees the new PLACEHOLDERS and the rebuilt flag sets — the next
        # /api/catalog reports the glyph as shipped without a restart.
        return self.send_json(res)

    def promote_all(self):
        """Ship every design that differs from what ships.

        `dryRun` is what the button's first press uses: it reports which
        glyphs would change without touching anything, so a bulk edit to
        the set is something you agree to after seeing the list rather
        than something one click does.
        """
        body = self.read_json() or {}
        try:
            return self.send_json(
                promote_mod.promote_all(dry_run=bool(body.get("dryRun"))))
        except Exception as e:                       # noqa: BLE001
            return self.send_json({"error": f"{type(e).__name__}: {e}"}, 500)

    def do_PUT(self):
        if self.path == "/api/block-tweaks":
            try:
                return self.send_json({"saved": save_tweak(self.read_json() or {})})
            except Exception as e:                   # noqa: BLE001
                return self.send_json({"error": f"{type(e).__name__}: {e}"}, 400)
        if self.path == "/api/block-feedback":
            try:
                return self.send_json({"saved": save_feedback(self.read_json() or {})})
            except Exception as e:                   # noqa: BLE001
                return self.send_json({"error": f"{type(e).__name__}: {e}"}, 400)
        name = self.stem("/api/designs")
        if not name:
            return self.send_json({"error": "bad name"}, 400)
        try:
            design = self.read_json()
            if not isinstance(design, dict):
                raise ValueError("expected an object")
            design["name"] = name
            design["updated"] = datetime.now(timezone.utc).strftime(
                "%Y-%m-%dT%H:%M:%SZ")
            DESIGNS.mkdir(exist_ok=True)
            (DESIGNS / f"{name}.json").write_text(
                glyphspec.dumps(design), encoding="utf-8")
            # `flips` and `rows` live in the design now, so saving one
            # can change what the build would do. Re-read them here or
            # /api/catalog keeps reporting the values from startup.
            bg.refresh()
            return self.send_json({
                "saved": name,
                "problems": glyphspec.validate(design),
                "updated": design["updated"],
            })
        except Exception as e:                       # noqa: BLE001
            return self.send_json({"error": f"{type(e).__name__}: {e}"}, 400)

    def do_DELETE(self):
        name = self.stem("/api/designs")
        if not name:
            return self.send_json({"error": "bad name"}, 400)
        p = DESIGNS / f"{name}.json"
        if p.exists():
            p.unlink()
        return self.send_json({"deleted": name})


def main():
    DESIGNS.mkdir(exist_ok=True)
    server = HTTPServer(("127.0.0.1", PORT), Handler)
    n = len(list(DESIGNS.glob("*.json")))
    print(f"Glyph designer on http://localhost:{PORT}/")
    print(f"Designs in {DESIGNS.relative_to(ROOT)}/ — {n} saved.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nstopped")


if __name__ == "__main__":
    main()
