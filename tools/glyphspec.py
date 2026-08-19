#!/usr/bin/env python3
"""
The glyph design format, and the one canonical way to turn it into SVG.

Avatarian characters are drawn on the script's native lattice: 5x5 cells
for a consonant, 5x4 for a vowel. A *design* records what was drawn in
those units — which lattice points a stroke visits, whether each segment
is straight, an arc, or part of a smooth run, and where the dots go. It
records intent, not final geometry. The smoothing, weighting and
proportioning all happen here, so a design stays readable and editable
long after it is drawn.

    designs/<name>.json  ->  glyphspec  ->  SVG body  ->  build_glyphs.py

This module is imported by tools/designer_server.py (which serves the
designer at designer/index.html) and by tools/designs_to_svg.py. The
designer also carries a JavaScript port in designer/js/geom.js for its
interactive canvas — see the note under "Two implementations" below.


The format
----------

    {
      "name":  "m",              # file stem, matches IPA_TO_NAME
      "ipa":   "m",              # the sound, or null for a mark
      "type":  "consonant",      # see "Height classes" below
      "grid":  [5, 5],           # [w, h] — 5x5 consonant, 5x4 vowel
      "flips": false,            # mirrors top-to-bottom in a bottom slot
      "rows":  4,                # vowels only: 3-row or 4-row form
      "notes": "ring, dot centred",
      "shapes": [ ... ],
      "updated": "2026-08-05T12:00:00Z"
    }

A shape is either a path or a dot. Keys this module doesn't recognise
are carried through untouched — a brushed stroke keeps the raw gesture
it was fitted from under `trace`, which the designer uses to re-read it
and nothing here needs to understand.

    {"kind": "dot", "x": 2.5, "y": 2.5, "size": "m"}

    {"kind": "path",
     "closed": false,
     "nodes": [
       {"x": 1, "y": 0},                          # first node: no segment
       {"x": 4, "y": 0, "seg": "line"},           # straight
       {"x": 4, "y": 3, "seg": "arc", "bulge": 1},# circular arc
       {"x": 1, "y": 3, "seg": "curve"}           # smooth run
     ],
     "closeSeg": {"seg": "line"}}                 # only when closed

`seg` describes the segment ARRIVING at that node from the previous one,
so a path of n nodes has n-1 segments (n with `closed`).

  line    straight, corner to corner.
  arc     circular arc. `bulge` is the signed sagitta in lattice units —
          how far the arc's midpoint is pushed off the chord. Positive
          bulges to the LEFT of travel, negative to the right, 0 is a
          line. A semicircle is bulge = half the chord length.
  curve   part of a smooth run. Consecutive `curve` segments are fitted
          with one Catmull-Rom spline through their nodes, so a stroke
          bends through its lattice points instead of cornering at them.
          Where a run meets a line or an arc, it leaves or arrives along
          THAT segment's own direction — at both ends — so a straight
          stroke flows into a curve and back out without a kink. (Taking
          the neighbouring node's position instead is close but not the
          same thing, and leaves a visible break wherever the node isn't
          square on to the join.) A run that closes a path all the way
          round joins to itself instead.

Coordinates are lattice units with y running DOWN, matching SVG: (0,0)
is top-left, (5,5) bottom-right of a consonant cell. Half-unit positions
are allowed and expected — several canon glyphs centre a mark between
lattice lines.

`flips` and `rows` are the two facts about a glyph that aren't its
shape, and they live here rather than in build_glyphs.py so the designer
can set them: `flips` says the glyph mirrors top-to-bottom in a bottom
slot (FLIPS), and `rows` says whether a vowel fills all 4 lattice rows
or leaves the top one empty (VOWEL_4ROW). Both are optional; a design
that omits them leaves build_glyphs.py's own sets alone.


Height classes
--------------

`type` names a height class, not a part of speech. There are two:

    consonant, mark_consonant   5x5 lattice, 100x100 box, no flat form
    vowel, mark                 5x4 lattice, 100x80 flat + stretched square

A *mark* stands for no sound but is still written at one of the two
heights — the rounded ∪ null is vowel-height (`mark`) and the squared ∪
is consonant-height (`mark_consonant`). Splitting them matters: a
consonant-height mark on a vowel frame comes out drawn on the wrong
lattice and carrying a flat form it should not have.


Geometry
--------

One lattice unit is UNIT svg units, and the lattice is centred in its box
with a margin wide enough that a stroke drawn along the outermost row is
not clipped by the viewBox (stroke 9 needs 4.5 of clearance, dots more).
The margin is drawing clearance only — it is not a gap in the writing.
Consonants and vowels stack flush, 5 units over 4.

Vowels are emitted TWICE, exactly as build_glyphs.py does today:

  flat    100x80. The native 5x4 drawing, used by proportional-height
          mode. Scale is uniform, so circles are circles.
  square  100x100. The same drawing stretched to fill an equal-height
          slot — y scaled by 1/FLAT. Arc radii stretch with it (rx and
          ry differ, which is what an SVG elliptical arc is for), but
          DOTS KEEP THEIR RADIUS and only move. That mirrors `flatten`
          in build_glyphs.py, which is the inverse operation, and is why
          dots stay round and stroke weight stays put in both modes.

Consonants have one form, square, and no flat copy.


Two implementations
-------------------

designer/js/geom.js is a port of the emit functions below, for the live
canvas — round-tripping every keystroke through the server would make
dragging a node feel awful. Anything the designer hands back to a human
or to a build script goes through THIS module instead: the designer's
output panel calls POST /api/render rather than using its own port, so
the SVG you copy is always the Python one. Keep the two in step, but
treat this file as the authority when they disagree.
"""

import json
import math
import re

# --- the drawing system, shared with build_glyphs.py -----------------------

SW = 9                  # stroke width, all glyphs
UNIT = 16               # svg units per lattice cell

# A dot, default size `m`, fills one grid cell: radius UNIT/2, so its
# diameter is a whole lattice square. This is the big circular dot the
# shipped set uses (build_glyphs.py DOT = UNIT/2); keep the two in step.
#
# `s` and `l` are an escape hatch for a source that clearly shows a
# smaller or larger mark (e.g. /ɔ/'s small dot). They are not a style
# choice — reach for `m` unless a reference makes you.
DOT_SIZES = {"s": SW * 0.42, "m": UNIT / 2, "l": SW * 0.62}
DEFAULT_DOT = "m"

CONS_GRID = (5, 5)
VOWEL_GRID = (5, 4)
# A full-height mark (punctuation): one lattice column wide, nine rows
# tall — the height of a whole block rather than a slot, so it stands
# beside the writing and pairs with nothing. Its own geometry, neither
# consonant nor vowel; frame_for and grid_for special-case it.
MARK_FULL_GRID = (1, 9)

# Which `type` values are written at a consonant's height. Everything
# else takes the vowel's shorter lattice and its flat form. See "Height
# classes" in the module docstring: `mark` and `mark_consonant` are both
# soundless fillers, and the only thing separating them is this.
# `mark_full` is neither — it is handled explicitly, not through is_tall.
TALL_KINDS = {"consonant", "mark_consonant"}


def is_tall(kind):
    return kind in TALL_KINDS

# Vowel height as a fraction of a consonant's. They stack flush in a
# block, so a consonant over a vowel is 5 + 4 = 9 units tall.
FLAT = VOWEL_GRID[1] / CONS_GRID[1]         # 4/5

# The lattice is centred in its box with enough margin that a stroke
# drawn along the outermost row isn't clipped — stroke 9 needs 4.5.
MARGIN_X = (100 - CONS_GRID[0] * UNIT) / 2                  # 10
MARGIN_Y_SQUARE = (100 - CONS_GRID[1] * UNIT) / 2           # 10
MARGIN_Y_FLAT = (100 * FLAT - VOWEL_GRID[1] * UNIT) / 2     # 8

# A full-height mark keeps the same 10-unit clearance margins as a letter,
# so a 1x9 lattice sits in a 36x164 box (16 + 20 wide, 144 + 20 tall).
MARK_FULL_BOX_W = MARK_FULL_GRID[0] * UNIT + 2 * MARGIN_X   # 36
MARK_FULL_BOX_H = MARK_FULL_GRID[1] * UNIT + 2 * MARGIN_Y_SQUARE  # 164

EPS = 1e-9

# Width is a template field too: a letter is 100 wide, a full-height mark
# only 36. Everything before was 100, so the field defaults to it below.
HEADER = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
    'fill="none" stroke="currentColor" stroke-width="{sw}" '
    'stroke-linecap="square" stroke-linejoin="miter">'
)


class Frame:
    """How lattice coordinates land in a viewBox.

    sx/sy are svg units per lattice unit; ox/oy are where lattice (0,0)
    sits. sx != sy only for the stretched square form of a vowel.
    """

    def __init__(self, sx, sy, ox, oy, box_h, box_w=100):
        self.sx, self.sy, self.ox, self.oy = sx, sy, ox, oy
        self.box_h, self.box_w = box_h, box_w

    def x(self, gx):
        return self.ox + gx * self.sx

    def y(self, gy):
        return self.oy + gy * self.sy

    def pt(self, node):
        return self.x(node["x"]), self.y(node["y"])


def frame_for(kind, form):
    """kind: any of TALL_KINDS, else vowel-height.  form: square | flat.

    The vowel-height null shares a vowel's frames; the consonant-height
    one shares a consonant's.
    """
    if kind == "mark_full":
        # 1x9, unit-square like a consonant, in its own narrow tall box.
        return Frame(UNIT, UNIT, MARGIN_X, MARGIN_Y_SQUARE,
                     MARK_FULL_BOX_H, MARK_FULL_BOX_W)
    if is_tall(kind):
        return Frame(UNIT, UNIT, MARGIN_X, MARGIN_Y_SQUARE, 100)
    if form == "flat":
        return Frame(UNIT, UNIT, MARGIN_X, MARGIN_Y_FLAT, 100 * FLAT)
    # A vowel in an equal-height slot: the 5x4 drawing stretched to 5x5.
    return Frame(UNIT, UNIT / FLAT, MARGIN_X, MARGIN_Y_FLAT / FLAT, 100)


def grid_for(kind):
    if kind == "mark_full":
        return list(MARK_FULL_GRID)
    return list(CONS_GRID if is_tall(kind) else VOWEL_GRID)


# --- number formatting -----------------------------------------------------

def num(v):
    """Trim to 2dp and drop trailing zeros, so paths read like the
    hand-authored ones rather than like float noise."""
    v = round(v + 0.0, 2)
    if v == 0:
        v = 0.0                      # kill -0
    return f"{v:g}"


# --- segment emitters ------------------------------------------------------

def _arc_params(p0, p1, bulge):
    """Circular arc through p0 and p1 whose midpoint sits `bulge` off the
    chord. Returns (r, large_arc, sweep) in LATTICE units, or None when
    the bulge is too small to be an arc.

    r follows from the sagitta: r = (b^2 + (c/2)^2) / 2b. The arc is more
    than a semicircle exactly when the sagitta exceeds half the chord.
    """
    b = float(bulge or 0)
    if abs(b) < 1e-4:
        return None
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    c = math.hypot(dx, dy)
    if c < EPS:
        return None
    r = (b * b + (c / 2) ** 2) / (2 * abs(b))
    large = 1 if abs(b) > c / 2 else 0
    # y runs down, so a positive bulge — left of travel — is a clockwise
    # sweep in SVG's coordinate sense.
    sweep = 1 if b > 0 else 0
    return r, large, sweep


def _tangent_at(a, b, meta, end):
    """Which way a segment is travelling at one of its ends, as a unit
    vector: `end` 0 for where it leaves `a`, 1 for where it reaches `b`.

    A line travels the same way throughout. An arc's tangent makes the
    tangent-chord angle with its chord — half the central angle, which
    is asin(half-chord / r), or its supplement once the arc is past a
    semicircle — leaning toward the bulge on the way out and away from
    it on the way in.
    """
    dx, dy = b["x"] - a["x"], b["y"] - a["y"]
    c = math.hypot(dx, dy)
    if c < EPS:
        return None
    ux, uy = dx / c, dy / c
    meta = meta or {}
    if meta.get("seg") != "arc":
        return ux, uy

    got = _arc_params((a["x"], a["y"]), (b["x"], b["y"]), meta.get("bulge", 0))
    if not got:
        return ux, uy
    r, large, _sweep = got
    beta = math.asin(min(1.0, (c / 2) / r))
    if large:
        beta = math.pi - beta
    nx, ny = uy, -ux                       # left of travel
    lean = math.sin(beta) * (1 if meta.get("bulge", 0) > 0 else -1)
    lean = lean if end == 0 else -lean
    return (math.cos(beta) * ux + lean * nx,
            math.cos(beta) * uy + lean * ny)


def _spline(points, m0=None, mn=None):
    """A Catmull-Rom spline through `points`, as cubic Bezier control
    pairs — ((c1x,c1y), (c2x,c2y), (px,py)) per segment.

    Interior tangents are the usual (P[i+1] − P[i−1]) / 2. The ends take
    `m0`/`mn` when given, which is how a run picks up the direction of
    the line or arc it joins; without them the end tangent falls back to
    the end chord, the ordinary natural-end treatment.
    """
    pts = list(points)
    n = len(pts)
    tang = []
    for i in range(n):
        if i == 0 and m0 is not None:
            tang.append(m0)
        elif i == n - 1 and mn is not None:
            tang.append(mn)
        elif i == 0:
            tang.append((pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]))
        elif i == n - 1:
            tang.append((pts[-1][0] - pts[-2][0], pts[-1][1] - pts[-2][1]))
        else:
            tang.append(((pts[i + 1][0] - pts[i - 1][0]) / 2,
                         (pts[i + 1][1] - pts[i - 1][1]) / 2))
    out = []
    for i in range(n - 1):
        c1 = (pts[i][0] + tang[i][0] / 3, pts[i][1] + tang[i][1] / 3)
        c2 = (pts[i + 1][0] - tang[i + 1][0] / 3,
              pts[i + 1][1] - tang[i + 1][1] / 3)
        out.append((c1, c2, pts[i + 1]))
    return out


def _end_tangent(seg, pts, at_start):
    """The tangent to hand `_spline` where a run meets `seg`.

    Direction comes from the neighbouring segment so the join is smooth;
    length comes from the run's own end chord, so the curve keeps its
    own proportions rather than being pulled about by how long its
    neighbour happens to be.
    """
    if seg is None:
        return None
    direction = _tangent_at(seg[0], seg[1], seg[2], 1 if at_start else 0)
    if direction is None:
        return None
    a, b = (pts[0], pts[1]) if at_start else (pts[-1], pts[-2])
    length = math.hypot(b[0] - a[0], b[1] - a[1])
    return direction[0] * length, direction[1] * length


def _segments_of(shape):
    """Normalise a path into (from_node, to_node, seg_dict) triples,
    including the closing segment when the path is closed."""
    nodes = shape.get("nodes") or []
    segs = []
    for i in range(1, len(nodes)):
        segs.append((nodes[i - 1], nodes[i], nodes[i]))
    if shape.get("closed") and len(nodes) > 2:
        close = shape.get("closeSeg") or {"seg": "line"}
        segs.append((nodes[-1], nodes[0], close))
    return segs


def path_d(shape, frame):
    """Emit one path shape's `d` attribute."""
    nodes = shape.get("nodes") or []
    if len(nodes) < 2:
        return None
    segs = _segments_of(shape)
    xy = [(n["x"], n["y"]) for n in nodes]

    start = frame.pt(nodes[0])
    d = ["M", num(start[0]), num(start[1])]

    i = 0
    while i < len(segs):
        a, b, meta = segs[i]
        kind = (meta or {}).get("seg", "line")

        if kind == "curve":
            # Gather the whole run so it is fitted as one spline.
            run_start = i
            while i < len(segs) and (segs[i][2] or {}).get("seg") == "curve":
                i += 1
            run = segs[run_start:i]
            pts = [(run[0][0]["x"], run[0][0]["y"])] + \
                  [(s[1]["x"], s[1]["y"]) for s in run]

            closed = bool(shape.get("closed")) and len(nodes) > 2
            if closed and len(run) == len(segs):
                # The run goes all the way round: no neighbour to borrow
                # from, so close the spline on itself instead. The first
                # and last points are the same node, and this is the
                # tangent that carries through it.
                m = ((pts[1][0] - pts[-2][0]) / 2, (pts[1][1] - pts[-2][1]) / 2)
                m0 = mn = m
            else:
                # Wrap round a closed path to find the neighbours.
                prev_seg = segs[run_start - 1] if run_start > 0 else \
                    (segs[-1] if closed else None)
                next_seg = segs[i] if i < len(segs) else \
                    (segs[0] if closed else None)
                m0 = _end_tangent(prev_seg, pts, True)
                mn = _end_tangent(next_seg, pts, False)

            for c1, c2, p in _spline(pts, m0, mn):
                d += ["C",
                      num(frame.x(c1[0])), num(frame.y(c1[1])),
                      num(frame.x(c2[0])), num(frame.y(c2[1])),
                      num(frame.x(p[0])), num(frame.y(p[1]))]
            continue

        if kind == "arc":
            p0 = (a["x"], a["y"])
            p1 = (b["x"], b["y"])
            got = _arc_params(p0, p1, (meta or {}).get("bulge", 0))
            if got:
                r, large, sweep = got
                # Anisotropic frames turn the circle into an axis-aligned
                # ellipse, which is exactly what rx != ry describes.
                d += ["A", num(r * frame.sx), num(r * frame.sy), "0",
                      str(large), str(sweep),
                      num(frame.x(p1[0])), num(frame.y(p1[1]))]
                i += 1
                continue
            kind = "line"       # a flat arc is a line

        d += ["L", num(frame.x(b["x"])), num(frame.y(b["y"]))]
        i += 1

    if shape.get("closed") and len(nodes) > 2:
        d.append("Z")
    return " ".join(d)


def dot_svg(shape, frame):
    r = DOT_SIZES.get(shape.get("size", DEFAULT_DOT), DOT_SIZES[DEFAULT_DOT])
    cx, cy = frame.x(shape["x"]), frame.y(shape["y"])
    # Radius is deliberately NOT scaled: a dot is a dot at any height, and
    # scaling it in the stretched square form would make it an ellipse.
    return (f'<circle cx="{num(cx)}" cy="{num(cy)}" r="{num(r)}" '
            'fill="currentColor" stroke="none"/>')


# --- assembly --------------------------------------------------------------

def body(design, form="square"):
    """The inside of the <svg> for one design, in the requested form."""
    frame = frame_for(design.get("type", "consonant"), form)
    out = []
    for shape in design.get("shapes", []):
        if shape.get("kind") == "dot":
            out.append(dot_svg(shape, frame))
        else:
            d = path_d(shape, frame)
            if d:
                out.append(f'<path d="{d}"/>')
    return "".join(out)


def to_svg(design, form="square"):
    frame = frame_for(design.get("type", "consonant"), form)
    return (HEADER.format(sw=SW, w=num(frame.box_w), h=num(frame.box_h))
            + body(design, form) + "</svg>")


def forms_for(design):
    """Which forms this design ships. Vowel-height glyphs ride along
    flat as well; consonant-height ones (and full-height marks) have only
    the square box."""
    kind = design.get("type", "consonant")
    return ["square", "flat"] if (kind != "mark_full" and not is_tall(kind)) \
        else ["square"]


# --- emitting source for build_glyphs.py -----------------------------------

LINE = 79          # build_glyphs.py is written to fit in 79 columns


def to_python(design):
    """A ready-to-paste entry for CONSONANTS / VOWELS / MARKS.

    Laid out the way the hand-authored entries are: on one line when it
    fits, otherwise continuation lines aligned under the opening quote,
    with the `+ dot(...)` terms hanging off the left.

    build_glyphs.py generates the flat form itself by squashing, so only
    the square body is emitted — same as every hand-authored glyph.
    """
    name = design.get("name", "?")
    frame = frame_for(design.get("type", "consonant"), "square")

    calls = []          # (kind, payload) — payload is a path `d` or dot args
    for shape in design.get("shapes", []):
        if shape.get("kind") == "dot":
            r = DOT_SIZES.get(shape.get("size", DEFAULT_DOT))
            args = f'{num(frame.x(shape["x"]))}, {num(frame.y(shape["y"]))}'
            if r != DOT_SIZES[DEFAULT_DOT]:
                args += f", {num(r)}"
            calls.append(("dot", args))
        else:
            d = path_d(shape, frame)
            if d:
                calls.append(("path", d))

    lines = []
    for line in _fold((design.get("notes") or "").strip(), LINE - 6):
        lines.append(f"    # {line}")
    if not calls:
        lines.append(f'    # "{name}": nothing drawn yet')
        return "\n".join(lines)

    head = f'    "{name}": '
    flat = " + ".join(f'path("{d}")' if k == "path" else f"dot({d})"
                      for k, d in calls)
    if len(head + flat) + 1 <= LINE:
        lines.append(head + flat + ",")
        return "\n".join(lines)

    # Continuations align under the opening `path(`, i.e. one indent of
    # the head itself — `    "th": path(...)` hangs its `+` at column 10,
    # not at a fixed 9. Hardcoding 9 only ever lined up for one-character
    # names, which made promoting an unchanged design produce a diff.
    body_lines = []
    for i, (kind, payload) in enumerate(calls):
        lead = head if i == 0 else " " * len(head) + "+ "
        if kind == "dot":
            body_lines.append(f"{lead}dot({payload})")
        else:
            body_lines.append(lead + "path(" + _wrap(payload, len(lead) + 5) + ")")
    return "\n".join(lines + body_lines) + ","


def _wrap(d, indent):
    """Break a long path string across quoted lines at command
    boundaries, continuations aligned under the opening quote — the way
    the hand-authored paths are laid out."""
    width = max(24, LINE - indent - 3)
    chunks = [c.strip() for c in re.findall(r"[A-Za-z][^A-Za-z]*", d)]
    out, cur = [], ""
    for c in chunks:
        if cur and len(cur) + len(c) + 1 > width:
            out.append(cur)
            cur = c
        else:
            cur = f"{cur} {c}".strip()
    if cur:
        out.append(cur)
    if len(out) == 1:
        return f'"{out[0]}"'
    return ("\n" + " " * indent).join(
        f'"{s} "' if i < len(out) - 1 else f'"{s}"' for i, s in enumerate(out))


def _fold(text, width):
    words, lines, cur = text.split(), [], ""
    for w in words:
        if cur and len(cur) + len(w) + 1 > width:
            lines.append(cur)
            cur = w
        else:
            cur = f"{cur} {w}".strip()
    if cur:
        lines.append(cur)
    return lines


# --- validation ------------------------------------------------------------

def validate(design):
    """Problems worth telling the user about, as a list of strings.

    Out-of-bounds is a warning rather than an error: the lattice is the
    design surface, and a stroke that leaves it is more likely a slip
    than a decision, but it still renders.
    """
    problems = []
    kind = design.get("type", "consonant")
    gw, gh = grid_for(kind)
    tops = []
    for i, shape in enumerate(design.get("shapes", [])):
        where = f"shape {i + 1}"
        if shape.get("kind") == "dot":
            pts = [(shape.get("x"), shape.get("y"))]
        else:
            nodes = shape.get("nodes") or []
            if len(nodes) < 2:
                problems.append(f"{where}: path with fewer than 2 nodes")
            pts = [(n.get("x"), n.get("y")) for n in nodes]
        for x, y in pts:
            if x is None or y is None:
                problems.append(f"{where}: node missing a coordinate")
            elif not (0 <= x <= gw and 0 <= y <= gh):
                problems.append(
                    f"{where}: ({num(x)},{num(y)}) is outside the {gw}x{gh} grid")
            elif y is not None:
                tops.append(y)

    # Does the drawing agree with the form it claims to be? A 4-row vowel
    # is the one that fills the top lattice row and so bridges up to the
    # consonant above it; a 3-row vowel leaves that row empty, which is
    # the gap. Declaring one and drawing the other is silent otherwise —
    # the flag rides through the manifest and the ink doesn't match it.
    # The convention puts 4-row ink at y=0.5 and 3-row ink at y=1.5, half
    # a row either side of the y=1 line. A centre-line sitting exactly ON
    # y=1 is genuinely ambiguous and is left alone: the stroke is 9 units
    # wide, so half of it lies inside the top row even though the path
    # does not. `au` is the live case — it sits at y=1 and cannot be
    # brought down to 1.5 without its curves leaving the grid.
    rows = design.get("rows")
    if rows in (3, 4) and tops and not is_tall(kind):
        highest = min(tops)
        if rows == 4 and highest > 1:
            problems.append(
                f"says 4-row, but nothing is drawn above y={num(highest)} — "
                f"the top row is empty, so it won't reach the consonant above")
        if rows == 3 and highest < 1:
            problems.append(
                f"says 3-row, but ink reaches y={num(highest)}, inside the top "
                f"row — a 3-row vowel leaves that row empty")
    return problems


def blank(name, ipa, kind):
    return {
        "name": name,
        "ipa": ipa,
        "type": kind,
        "grid": grid_for(kind),
        "notes": "",
        "shapes": [],
    }


def dumps(design):
    """Stable, diffable JSON — key order fixed, 2-space indent."""
    order = ["name", "ipa", "type", "grid", "flips", "rows",
             "notes", "shapes", "updated"]
    ordered = {k: design[k] for k in order if k in design}
    for k in design:
        if k not in ordered:
            ordered[k] = design[k]
    return json.dumps(ordered, ensure_ascii=False, indent=2) + "\n"
