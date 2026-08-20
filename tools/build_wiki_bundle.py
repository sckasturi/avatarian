#!/usr/bin/env python3
"""
Assemble the self-contained MediaWiki bundle.

The wiki gadget used to load five scripts from an externally deployed copy
of the site. This bundles everything it needs into ONE file that lives on
the wiki as [[MediaWiki:Avatarian.js]], so nothing is fetched from an
outside server. The glyphs are inline SVG in manifest.js, so there are no
external images either.

The wiki template draws a word from its SOUNDS ({{Avatarian|k uh t ah r
uh|Katara}}) — you spell it yourself — so the bundle is deliberately lean:

  * manifest.js    the glyphs, with the hand-lettered reference tracings
                   (AVATARIAN_REFERENCE) STRIPPED — the wiki renders only
                   AVATARIAN_GLYPHS; the tracings are a designer aid.
  * sounds.js      parses the readable / IPA codes (standalone, no g2p).
  * render.js      draws the glyphs (no corpus or g2p dependency).
  * wiki/gadget.js finds the {{Avatarian}} spans and renders them.

corpus.js and g2p.js are left out entirely: the corpus and the English
converter only matter when GUESSING the spelling of an English word, and
there is no English input here — the sounds are given exactly.

Run:  python3 tools/build_wiki_bundle.py
Then paste wiki/MediaWiki_Avatarian.js.txt into [[MediaWiki:Avatarian.js]].
Re-run whenever manifest.js, sounds.js, render.js, or wiki/gadget.js changes.
"""

import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
SITE_JS = ROOT / "site" / "js"
GADGET = ROOT / "wiki" / "gadget.js"
OUT = ROOT / "wiki" / "MediaWiki_Avatarian.js.txt"

HEADER = (
    "/* Avatarian glyph renderer for MediaWiki. Generated — do not edit. */\n"
    "/* Rebuild: tools/build_wiki_bundle.py. Sources/credits: AVATARIAN.md. */\n"
)


def strip_comments(js):
    """Drop whole-line // and /* */ comments so the published bundle carries
    very little documentation. Conservative: only lines that are ENTIRELY a
    comment are removed, so strings, regexes and inline comments are never
    touched. The source files keep their comments — this is only the copy
    pasted onto the wiki."""
    out, in_block = [], False
    for line in js.split("\n"):
        s = line.strip()
        if in_block:
            if "*/" in line:
                in_block = False
                rest = line.split("*/", 1)[1]
                if rest.strip():
                    out.append(rest)
            continue
        if s.startswith("//"):
            continue
        if s.startswith("/*"):
            if "*/" in s:
                rest = s.split("*/", 1)[1]
                if rest.strip():
                    out.append(rest)
            else:
                in_block = True
            continue
        out.append(line)
    return re.sub(r"\n[ \t]*\n(?:[ \t]*\n)+", "\n\n", "\n".join(out))


def section(name, text):
    return f"\n/* {name} */\n{strip_comments(text).rstrip()}\n"


def strip_reference(manifest_src):
    """Cut AVATARIAN_REFERENCE (the hand-lettered tracings) from the
    manifest. It is the last block and the wiki never reads it — only
    AVATARIAN_GLYPHS is rendered. Removes the comment that introduces it
    too, so nothing dangling is left."""
    i = manifest_src.index("window.AVATARIAN_REFERENCE")
    head = manifest_src[:i]
    # drop a trailing /* ... */ comment (the "Traced shapes …" note)
    head = re.sub(r"\s*/\*(?:(?!\*/).)*\*/\s*$", "", head, flags=re.S)
    return head.rstrip() + "\n"


def main():
    manifest = strip_reference((SITE_JS / "manifest.js").read_text(encoding="utf-8"))

    parts = [HEADER]
    parts.append(section("site/js/manifest.js (glyphs only — tracings stripped)", manifest))
    parts.append(section("site/js/sounds.js", (SITE_JS / "sounds.js").read_text(encoding="utf-8")))
    parts.append(section("site/js/render.js", (SITE_JS / "render.js").read_text(encoding="utf-8")))
    parts.append(section("wiki/gadget.js", GADGET.read_text(encoding="utf-8")))

    bundle = "".join(parts).rstrip() + "\n"
    OUT.write_text(bundle, encoding="utf-8")

    kb = len(bundle.encode("utf-8")) / 1024
    print(f"Wrote {OUT.relative_to(ROOT)} — {kb:.0f} KB.")


if __name__ == "__main__":
    main()
