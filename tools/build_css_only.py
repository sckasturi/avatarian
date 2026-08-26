#!/usr/bin/env python3
"""
Generate the wiki's CSS-only Avatarian renderer (no JavaScript) from the glyph
manifest. This is what makes Avatarian render on Fandom mobile, which serves no
site JS (see DEVELOPMENT.md, "Rendering on the wiki"). Draws every glyph as a
-webkit-mask class filled with currentColor, plus the block layout as `av-*`
classes. It styles pre-structured markup; that markup is built from a sounds
string by Module:Avatarian (tools/build_lua_module.py).

Run:  python3 tools/build_css_only.py [out.css]   (default: wiki/Avatarian-css-only.css)
"""
import json, re, sys, urllib.parse, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
MANIFEST = ROOT / "site" / "js" / "manifest.js"
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "wiki" / "Avatarian-css-only.css"


def glyphs():
    src = MANIFEST.read_text(encoding="utf-8")
    i = src.index("{", src.index("AVATARIAN_GLYPHS"))
    depth = 0
    j = i
    while j < len(src):
        if src[j] == "{":
            depth += 1
        elif src[j] == "}":
            depth -= 1
            if depth == 0:
                break
        j += 1
    return json.loads(src[i:j + 1])


def mask_uri(svg):
    # opaque strokes/fills so the SVG's alpha is the mask; colour = the element
    svg = svg.replace('stroke="currentColor"', 'stroke="#000"').replace('fill="currentColor"', 'fill="#000"')
    # Thicken every stroke to 13 to read at small size (the authored weight is 9;
    # 13 is the canonical display weight). A -webkit-mask rasterizes the SVG as
    # authored and CSS can't reach inside it, so bake the 13 in here.
    svg = re.sub(r'stroke-width="[^"]*"', 'stroke-width="13"', svg)
    return "data:image/svg+xml," + urllib.parse.quote(svg, safe="")


# NOTE: -webkit-mask ONLY. Fandom's CSS sanitizer rejects the unprefixed
# mask-* ("Unknown property" warnings); -webkit-mask works in every current
# browser (Firefox 108+ aliases it).
LAYOUT = """/* ===== Avatarian — CSS-only renderer (no JavaScript) ========================
 * The wiki's glyph SHAPES + block LAYOUT, all in CSS. Paired with Module:Avatarian
 * (the Lua that builds the av-* markup from a sounds string); see DEVELOPMENT.md.
 * Paste into MediaWiki:Common.css AND MediaWiki:Fandommobile.css (mobile serves
 * no site JS). -webkit-mask only (Fandom rejects unprefixed mask-*). av- prefix
 * namespaces the classes. Word ~= 125% of surrounding text. */
.av-word{display:inline;vertical-align:middle;padding-right:.3em;color:inherit;font-size:calc(1.25em / 2.05)}
.av-word.av-solo{display:inline-flex;font-size:1.4em;padding-right:0;position:relative}
.av-word-part{display:inline-flex;align-items:flex-start;vertical-align:middle;position:relative}
.av-word-part+.av-word-part{margin-left:.5em}
.av-block{display:inline-flex;flex-direction:column;align-items:center;margin-right:.05em}
.av-slot{display:flex;justify-content:center}
.av-slot-bottom{margin-top:-.225em}
.av-block.av-cc .av-slot-bottom{margin-top:-.45em}
.av-glyph{display:inline-block;line-height:0;background-color:currentColor;-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:100% 100%}
.av-consonant,.av-null-c{width:1.25em;height:1.25em}
.av-vowel,.av-null-v{width:1.25em;height:1em}
.av-flipped{transform:scaleY(-1)}
.av-slot-top .av-vowel:not(.av-4row),.av-slot-top .av-null-v:not(.av-4row){transform:translateY(-20%)}
.av-slot-bottom .av-vowel.av-flipped:not(.av-4row),.av-slot-bottom .av-null-v.av-flipped:not(.av-4row){transform:scaleY(-1) translateY(-20%)}
.av-mark{display:inline-block;line-height:0;align-self:stretch;background-color:currentColor;height:calc(1.25em * 1.64);width:calc(1.25em * 1.64 / 9);-webkit-mask-repeat:no-repeat;-webkit-mask-position:center;-webkit-mask-size:100% 100%}
.av-mark.av-wide{width:calc(1.25em * 1.64 * 2 / 9)}
/* Copy/paste: the glyph spans are empty masks, so Module:Avatarian emits the
 * word's text in .av-copy — a transparent, selectable text layer covering the
 * word. The glyphs sit ABOVE it (z-index) and are click-through
 * (pointer-events:none), so a drag lands in .av-copy: the word highlights like
 * normal text (the selection paints behind the glyphs) and copies clean text
 * (the English caption, or the sounds) instead of nothing. */
.av-copy{position:absolute;left:0;top:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;color:transparent;white-space:nowrap;overflow:hidden;font-size:1.6em;-webkit-user-select:text;-moz-user-select:text;-ms-user-select:text;user-select:text}
.av-block,.av-slot,.av-glyph,.av-mark{position:relative;z-index:1;pointer-events:none;-webkit-user-select:none;-moz-user-select:none;-ms-user-select:none;user-select:none}

/* ===== glyph shapes ===== */
"""


def main():
    rules = []
    for g in glyphs().values():
        if g.get("status") == "PLACEHOLDER":
            continue
        svg = g.get("flat") or g.get("svg")     # vowels/null_v use the flat form
        if svg:
            rules.append(f'.g-{g["name"]}{{-webkit-mask-image:url("{mask_uri(svg)}")}}')
        cl = (g.get("variants") or {}).get("cluster")
        if cl and cl.get("svg"):
            rules.append(f'.g-{g["name"]}_c{{-webkit-mask-image:url("{mask_uri(cl["svg"])}")}}')
        # C-C redraw variants render.js makes at runtime (clusterForm in
        # render.js): /s/ insets its vertex where the point faces the one-row
        # overlap; /z/ drops the top dot(s) that the overlap rides into the
        # glyph above. The mask path can't mutate a baked SVG, so emit a class
        # per shape; Module_Avatarian.lua picks them by the same rule.
        name, base = g["name"], svg
        if name == "s" and base:
            rules.append(f'.g-s_inset{{-webkit-mask-image:url("{mask_uri(base.replace("L 50 18 L", "L 50 31 L"))}")}}')
        if name == "z" and base:
            drop = lambda cx: re.sub(rf'<circle cx="{cx}"[^>]*>', "", base)
            rules.append(f'.g-z_left{{-webkit-mask-image:url("{mask_uri(drop("74"))}")}}')   # right dot dropped, left kept
            rules.append(f'.g-z_right{{-webkit-mask-image:url("{mask_uri(drop("26"))}")}}')  # left dot dropped, right kept
            rules.append(f'.g-z_none{{-webkit-mask-image:url("{mask_uri(re.sub(r"<circle[^>]*>", "", base))}")}}')
    OUT.write_text(LAYOUT + "\n".join(rules) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} — {len(rules)} glyph classes, {round(OUT.stat().st_size / 1024, 1)} KB")


if __name__ == "__main__":
    main()
