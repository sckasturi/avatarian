#!/usr/bin/env python3
"""
Regenerate site/js/manifest.js from the glyph SVGs + glyph_manifest.json.

The generated file embeds each glyph's SVG source inline, so the entire
"font" travels as one small JS file. That means:

  * it works over file:// (fetch() is CORS-blocked on file:// origins);
  * the wiki gadget needs no image hosting at all — one script tag;
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

ROOT = pathlib.Path(__file__).resolve().parent.parent
GLYPHS = ROOT / "site" / "assets" / "glyphs"
SRC = ROOT / "site" / "assets" / "glyph_manifest.json"
REF_GLYPHS = ROOT / "site" / "assets" / "reference"
REF_SRC = ROOT / "site" / "assets" / "reference_manifest.json"
DST = ROOT / "site" / "js" / "manifest.js"

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
    DST.write_text(
        f"{HEADER}window.AVATARIAN_GLYPHS = {body};\n\n"
        f"/* Traced shapes from the hand-lettered key — the comparison\n"
        f" * baseline, not what the tool renders. See\n"
        f" * tools/extract_reference.py. */\n"
        f"window.AVATARIAN_REFERENCE = {ref_body};\n",
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
