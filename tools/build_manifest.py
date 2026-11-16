#!/usr/bin/env python3
"""
Regenerate site/js/manifest.js from the glyph SVGs + glyph_manifest.json.

The generated file embeds each glyph's SVG source inline, so the entire
"font" travels as one small JS file. That means:

  * it works over file:// (fetch() is CORS-blocked on file:// origins);
  * the wiki's CSS + Lua are generated from this one file — no image hosting;
  * glyphs inherit the surrounding text colour via currentColor and stay
    crisp at any size.

The traced shapes cut out of the hand-lettered key by
tools/extract_reference.py ride along in the same file as
window.AVATARIAN_REFERENCE, so the key tab can show drawn against
original side by side.

Run after editing glyphs or statuses:

    python3 tools/build_glyphs.py     # redraw the SVGs
    python3 tools/build_manifest.py   # re-embed them here
"""

import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import glyphspec                                        # noqa: E402
import inkprofile                                       # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
GLYPHS = ROOT / "site" / "assets" / "glyphs"
SRC = ROOT / "site" / "assets" / "glyph_manifest.json"
REF_GLYPHS = ROOT / "site" / "assets" / "reference"
REF_SRC = ROOT / "site" / "assets" / "reference_manifest.json"
DST = ROOT / "site" / "js" / "manifest.js"
# Per-block tweaks set in the designer's block review page (render.js,
# BLOCK_TWEAKS), keyed "top|bottom" in IPA.
TWEAKS = ROOT / "designs" / "blocks" / "tweaks.json"
DESIGNS = ROOT / "designs"
EMIT_DIRS = {"up": -1, "down": 1}


def emitters(stem):
    """The JOIN emitters of designs/<stem>.json: every node marked
    `connect: up|down`, as [x, y, dir] in the viewBox of the form that is
    actually displayed (the flat one for a vowel-height glyph), dir -1 for
    up and +1 for down. render.js `joinsFor` grows a stroke from each one to
    the block partner's ink. See tools/inkprofile.py."""
    try:
        design = json.loads((DESIGNS / f"{stem}.json").read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return []
    kind = design.get("type", "consonant")
    if kind == "mark_full":
        return []
    frame = glyphspec.frame_for(kind, "flat")
    out = []
    for shape in design.get("shapes", []):
        for node in shape.get("nodes", []) if shape.get("kind") != "dot" else []:
            d = EMIT_DIRS.get(node.get("connect"))
            if d:
                e = [round(frame.x(node["x"])), round(frame.y(node["y"])), d]
                if e not in out:
                    out.append(e)
    return out


def load_tweaks():
    try:
        return json.loads(TWEAKS.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError):
        return {}

HEADER = (
    "/* Auto-generated — do not edit by hand.\n"
    " * Regenerate with: python3 tools/build_manifest.py\n"
    " * Embeds each glyph's SVG inline so the whole set is one file that\n"
    " * works over file://, needs no image hosting on the wiki, and\n"
    " * inherits text colour via currentColor. */\n"
)


def main():
    manifest = json.loads(SRC.read_text(encoding="utf-8"))
    out = {}
    missing = []
    for ipa, info in manifest.items():
        svg_path = GLYPHS / info["file"]
        if not svg_path.exists():
            missing.append(info["file"])
            continue
        out[ipa] = {
            "name": svg_path.stem,
            "status": info["status"],
            "type": info["type"],
            "svg": svg_path.read_text(encoding="utf-8").strip(),
        }
        if info.get("note"):
            out[ipa]["note"] = info["note"]
        if info.get("flips"):
            out[ipa]["flips"] = True
        if info.get("rows"):
            out[ipa]["rows"] = info["rows"]

        emit = emitters(svg_path.stem)
        if emit:
            out[ipa]["emit"] = emit
        # The flattened copy used by proportional-height mode.
        if info.get("flat"):
            fpath = GLYPHS / info["flat"]
            if fpath.exists():
                out[ipa]["flat"] = fpath.read_text(encoding="utf-8").strip()
            else:
                missing.append(info["flat"])
        # Positional variants ride along inline too, so render.js can pick
        # a form by slot without a second fetch. See VARIANTS in
        # tools/build_glyphs.py for what decides which.
        if info.get("variants"):
            variants = {}
            for slot, fname in info["variants"].items():
                vpath = GLYPHS / fname
                if not vpath.exists():
                    missing.append(fname)
                    continue
                variants[slot] = {
                    "name": vpath.stem,
                    "svg": vpath.read_text(encoding="utf-8").strip(),
                }
                # An alternate drawing carries its own emitters (a cluster
                # form leaves its long side to the rail and has none).
                if slot != "cluster" and emitters(vpath.stem):
                    variants[slot]["emit"] = emitters(vpath.stem)
                fname = (info.get("variantsFlat") or {}).get(slot)
                fpath = GLYPHS / fname if fname else None
                if fpath and fpath.exists():
                    variants[slot]["flat"] = fpath.read_text(encoding="utf-8").strip()
            if variants:
                out[ipa]["variants"] = variants
                if info.get("variantsManual"):
                    out[ipa]["variantsManual"] = True

    # Ink profiles: where each DISPLAYED form's strokes sit on every column
    # an emitter uses, so a join can be worked out for any pairing without a
    # drawing per pair (tools/inkprofile.py). Marks never share a block.
    cols = sorted({e[0] for g in out.values()
                   for f in [g, *(g.get("variants") or {}).values()]
                   for e in f.get("emit", [])})
    def profile(form):
        svg = form.get("flat") or form["svg"]
        form["ink"] = {str(x): inkprofile.column_hits(svg, x) for x in cols}
        # Dots a join would have to pass through — they block it.
        dots = {str(x): d for x in cols for d in [inkprofile.column_dots(svg, x)] if d}
        if dots:
            form["dots"] = dots
        # Mouths a stem closes when it arrives (/g/'s foot).
        gaps = {str(x): g for x in cols for g in [inkprofile.column_gaps(svg, x)] if g}
        if gaps:
            form["gaps"] = gaps

    for g in out.values():
        if g["type"].startswith("mark"):
            continue
        profile(g)
        for v in (g.get("variants") or {}).values():
            profile(v)

    ref = {}
    if REF_SRC.exists():
        for name, info in json.loads(REF_SRC.read_text(encoding="utf-8")).items():
            svg_path = REF_GLYPHS / info["file"]
            if not svg_path.exists():
                missing.append(info["file"])
                continue
            ref[name] = {
                "ipa": info["ipa"],
                "svg": svg_path.read_text(encoding="utf-8").strip(),
            }

    body = json.dumps(out, ensure_ascii=False, indent=2)
    ref_body = json.dumps(ref, ensure_ascii=False, indent=2)
    tweaks_body = json.dumps(load_tweaks(), ensure_ascii=False, indent=2, sort_keys=True)
    DST.write_text(
        f"{HEADER}window.AVATARIAN_GLYPHS = {body};\n\n"
        f"/* Traced shapes from the hand-lettered key — the comparison\n"
        f" * baseline, not what the tool renders. See\n"
        f" * tools/extract_reference.py. */\n"
        f"window.AVATARIAN_REFERENCE = {ref_body};\n\n"
        f"/* Per-block tweaks from designs/blocks/tweaks.json (render.js BLOCK_TWEAKS). */\n"
        f"window.AVATARIAN_BLOCK_TWEAKS = {tweaks_body};\n",
        encoding="utf-8",
    )

    n_ph = sum(1 for v in out.values() if v["status"] == "PLACEHOLDER")
    ph = ", ".join(k for k, v in out.items() if v["status"] == "PLACEHOLDER")
    print(f"Wrote {DST.relative_to(ROOT)} — {len(out)} glyphs + "
          f"{len(ref)} reference tracings "
          f"({DST.stat().st_size // 1024} KB), {n_ph} placeholder(s): {ph or 'none'}")
    if missing:
        print("WARNING missing SVG files:", ", ".join(missing))


if __name__ == "__main__":
    main()
