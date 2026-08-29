# Glyph designs

One file per character, `<name>.json`, drawn on the script's own lattice
— **5×5** cells for a consonant, **5×4** for a vowel, **1×9** (or **2×9**)
for a punctuation mark — in the designer:

```bash
python3 tools/designer_server.py     # http://localhost:8792/
```

Shapes are normally **brushed**: you draw freehand and
`designer/js/fit.js` reads the gesture into lattice-snapped corners,
straight runs and circular arcs. The fitter is an input method, not a
second geometry system — what it writes is the ordinary format below,
so nothing downstream knows or cares how a shape was made.

A design records **what was drawn**, not final geometry: which lattice
points a stroke visits, whether each segment runs straight, bows into an
arc, or belongs to a smooth run, and where the dots go. Curve fitting,
stroke weight, margins and the vowel's two heights all come out of
`tools/glyphspec.py` afterwards, so a design stays legible and editable
long after it was drawn — and a change to the drawing system rebuilds
every glyph rather than needing 40 paths re-authored.

`name` matches the file stem and `IPA_TO_NAME` in `tools/build_glyphs.py`.

## The format

```jsonc
{
  "name": "m",
  "ipa": "m",                 // null for a mark
  "type": "consonant",        // consonant | vowel | mark | mark_consonant | mark_full
  "grid": [5, 5],             // [w, h] — 5×5 consonant, 5×4 vowel,
                              //   1×9 (or 2×9) mark_full punctuation
  "notes": "ring, dot centred",
  "shapes": [
    {
      "kind": "path",
      "closed": false,
      "nodes": [
        { "x": 1, "y": 0 },                            // first: no segment
        { "x": 4, "y": 0, "seg": "line" },
        { "x": 4, "y": 3, "seg": "arc", "bulge": 1 },
        { "x": 1, "y": 3, "seg": "curve" }
      ],
      "closeSeg": { "seg": "line" },                   // only when closed
      "trace": [[1.02, 0.03], [1.41, 0.01], …]         // brushed only
    },
    { "kind": "dot", "x": 2.5, "y": 2.5, "size": "m" } // size: s | m | l
  ],
  "updated": "2026-08-05T09:14:02Z"
}
```

`trace` is the raw gesture a brushed stroke was read from, decimated to
64 points. Nothing renders it — `glyphspec.py` ignores keys it doesn't
know — but it lets the designer re-read a stroke at a different
tidiness, and it records what was actually drawn as against what was
made of it. Hand-placed shapes don't have one.

`seg` describes the segment **arriving** at that node from the previous
one, so *n* nodes carry *n−1* segments (*n* when `closed`).

A node may also carry **`"connect"`** — one of `up`, `down`, `left`,
`right`, or the four diagonals (`up-left`, `up-right`, `down-left`,
`down-right`). It grows a straight stroke *from* that node to the glyph's
edge in that direction, so the stroke reaches the block seam and meets the
partner glyph reaching the same seam — stroke-level fusion as one mark per
node, not a redraw (`connection_paths` in `glyphspec.py`, mirrored in
`geom.js`). In the designer, select a node and pick a direction from the
**connect** compass; the centre dot clears it.

| `connect` | the extension |
| --------- | ------------- |
| `up` / `down` | straight to the top / bottom edge — the block seams. |
| `left` / `right` | straight to the side edge. |
| diagonals | at 45° to whichever edge it reaches first. |

| `seg`   | what it means |
| ------- | ------------- |
| `line`  | straight, corner to corner. |
| `arc`   | circular arc. `bulge` is the signed sagitta in lattice units — how far the arc's midpoint sits off the chord. Positive bows to the **left of travel**, negative to the right, 0 is a line. A semicircle is `bulge` = half the chord. |
| `curve` | part of a smooth run. Consecutive `curve` segments are fitted with **one** Catmull-Rom spline through their nodes, so a stroke bends *through* its lattice points instead of cornering at them. Where a run meets a line or an arc it leaves or arrives along **that segment's own direction**, at both ends, so a straight stroke flows into a curve and back out without a kink. A run that closes a path all the way round joins to itself instead. |

Coordinates are lattice units with **y running down**, matching SVG:
`(0,0)` is top-left. Half-unit positions are allowed and expected —
several canon glyphs centre a mark between lattice lines.

## Getting one into the glyph set

```bash
python3 tools/designs_to_svg.py --report       # what's drawn, what isn't
python3 tools/designs_to_svg.py m              # the SVG
python3 tools/designs_to_svg.py m --python     # a build_glyphs.py entry
```

The last one is the handoff, and it is deliberately a copy-paste rather
than an automatic rebuild: a design is the drawing as it came off the
grid, and promoting it into `CONSONANTS` / `VOWELS` / `MARKS_VOWEL` /
`MARKS_CONSONANT` / `MARKS_FULL` (by height class) is a decision — usually
after smoothing something the lattice couldn't say precisely. `build_glyphs.py` stays the one place the shipped set is
defined, exactly as before.

Vowels are drawn **once**, in their native 5×4 form. The square 100×100
form that equal-height mode uses is the stretched one and is derived, so
there is nothing to keep in step. `--python` emits the square body,
because `build_glyphs.py` generates the flat copy itself.
