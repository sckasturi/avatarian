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

/api/catalog carries the traced key shape and the currently-drawn glyph
inline for every sound, so the designer gets its underlays in a single
request and works the same whether or not those files exist.

/api/render is what the designer's output panel uses. The canvas draws
with its own JavaScript port (designer/js/geom.js) because round-tripping
a drag would feel terrible, but anything you copy out of the designer is
rendered by tools/glyphspec.py, so the authority is always the Python.
"""

import json
import pathlib
import re
import sys
from datetime import datetime, timezone
from http.server import HTTPServer, SimpleHTTPRequestHandler

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import glyphspec                                        # noqa: E402
import build_glyphs as bg                               # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
WEB = ROOT / "designer"
DESIGNS = ROOT / "designs"
REF = ROOT / "site" / "assets" / "reference"
GLYPHS = ROOT / "site" / "assets" / "glyphs"
G2P = ROOT / "site" / "js" / "g2p.js"

PORT = 8792

NAME_OK = re.compile(r"^[a-z0-9_]+$")

# A word that puts the sound somewhere obvious, for the picker. Canon
# spellings where there is one, since those are the shapes being matched.
EXAMPLES = {
    "p": "please", "b": "be", "t": "not", "d": "do", "k": "wake",
    "g": "gone", "m": "mad", "n": "not", "ng": "Aang", "f": "fire",
    "v": "of", "th": "thing", "dh": "the", "s": "some", "z": "please",
    "h": "hello", "w": "when", "y": "you", "r": "really", "l": "please",
    "ch": "chase", "j_dz": "just", "sh": "she",
    "zh": "vision", "kh": "loch",
    "i": "please", "ih": "metalbending", "ei": "wake", "eh": "set",
    "ae": "mad", "uh": "up", "schwa": "katara", "uu": "do", "oo": "good",
    "ow": "toe", "aw": "thought", "ah": "appa", "ai": "tie", "au": "now",
    "oi": "toy", "nurse": "bird",
    "null_c": "(null, consonant height)", "null_v": "(null, vowel height)",
}


def arpabet_map():
    """IPA -> ARPAbet, read out of g2p.js so the designer shows the same
    codes the main tool accepts. Falls back to nothing if the table ever
    stops being a plain object literal."""
    # EXTRA_CODES from site/index.html: sounds ARPAbet has no code for.
    out = {"ə": "AX", "ʔ": "Q", bg.NULL_IPA: "NUL"}
    try:
        src = G2P.read_text(encoding="utf-8")
        block = re.search(r"ARPABET_TO_IPA\s*=\s*\{(.*?)\n\};", src, re.S)
        if block:
            for code, ipa in re.findall(r'(\w+)\s*:\s*"([^"]+)"', block.group(1)):
                out.setdefault(ipa, code)
    except OSError:
        pass
    return out


def read(path):
    try:
        return path.read_text(encoding="utf-8").strip()
    except OSError:
        return None


def catalog():
    arpa = arpabet_map()
    rows = []
    for ipa, name in bg.IPA_TO_NAME.items():
        kind = bg.glyph_type(ipa)
        grid_kind = kind
        if kind == "null":
            kind = "mark"
            grid_kind = "vowel"
        elif kind == "null_consonant":
            kind = "mark"
            grid_kind = "consonant"
        rows.append({
            "name": name,
            "ipa": None if ipa in (bg.NULL_IPA, bg.NULL_C_IPA) else ipa,
            "key": ipa,
            "type": kind,
            "grid": glyphspec.grid_for(grid_kind),
            "arpabet": arpa.get(ipa),
            "example": EXAMPLES.get(name),
            "placeholder": name in bg.PLACEHOLDERS,
            "flips": ipa in bg.FLIPS,
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
    order = {"consonant": 0, "vowel": 1, "mark": 2}
    rows.sort(key=lambda r: (order[r["type"]], r["name"]))

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
        return super().do_GET()

    def do_POST(self):
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

    def do_PUT(self):
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
