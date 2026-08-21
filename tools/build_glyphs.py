#!/usr/bin/env python3
"""
Generate the Avatarian glyph set as clean, geometrically-constructed SVGs.

These are DRAWN, not traced. Every glyph is authored from primitives
(circles, arcs, straight segments, dots) on a shared 100x100 grid with a
single stroke weight, so the set reads as one coherent typeface rather
than a pile of scanned handwriting. Shapes are interpretations of the
reference key chart; the intent is a clean canonical form of each
symbol, not a facsimile of the hand-lettered original.

Design system
-------------
  viewBox      0 0 100 100 for every glyph (uniform metrics)
  stroke       currentColor, width 9, square caps + miter joins
  dots         filled circles at r = UNIT/2, so a dot fills one grid cell
  safe area    inset 16 from each edge for consonants
  vowels       drawn small/wide, they sit in the lower 1/4 of a block

Run:  python3 tools/build_glyphs.py
"""

import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "assets" / "glyphs"
MANIFEST_JSON = ROOT / "site" / "assets" / "glyph_manifest.json"

SW = 9          # stroke width

# A dot is the same weight as a stroke, so its radius is the stroke's
# half-width. Measured off the reference: in the /aɪ/ photo the rule and
# the dots either side of it are the same thickness to the pixel.
#
# Derived from SW so the two can't drift. They had: dots were authored
# at 6.5, with several at 7 and 8, against a stroke of 9 — up to nearly
# twice the weight, which reads as beads sitting on the writing rather
# than part of it. Don't reintroduce a per-glyph radius without a
# reference that actually shows a heavier dot.
UNIT = 16       # svg units per lattice cell
DOT = UNIT / 2  # circle fills one grid square

# Vowels are authored at the same weight as everything else. When the
# proportional-height mode is on they get stretched (full width, 4/5
# height), which scales stroke weight anisotropically — verticals keep
# the x-scale, horizontals thin out by the y-scale. That is compensated
# in CSS with a stroke-width override rather than a heavier authored
# weight, because the weight would then be wrong in the default
# equal-height mode, where there is no stretch at all.
VOWEL_SW = SW

HEADER = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" '
    'fill="none" stroke="currentColor" stroke-width="{sw}" '
    'stroke-linecap="square" stroke-linejoin="miter">'
)


def svg(body, sw=SW, box=100, w=100):
    """Serialise a glyph body into a `w`-wide viewBox `box` units tall.
    Letters are 100 wide; a full-height punctuation mark is 36."""
    return HEADER.format(sw=sw, w=w, h=box) + body + "</svg>"


# ---------------------------------------------------------------------------
# Flat (4/5-height) variants
# ---------------------------------------------------------------------------
# Proportional mode draws vowels at 4/5 the height of a consonant but the
# full width. Squashing a square drawing to fit is what the renderer used
# to do, via preserveAspectRatio="none", and it distorted everything the
# scale touched: dots turned into ellipses, and horizontal strokes thinned
# by the y-scale while verticals kept the x-scale.
#
# So the squash happens HERE instead, on the geometry only:
#
#   * path coordinates are scaled in y, and arc radii with them;
#   * dots keep their radius and just move — a dot is a dot at any height;
#   * stroke-width is untouched.
#
# The result is emitted into a 100x80 viewBox, which the renderer then
# scales UNIFORMLY. Stroke weight and dot roundness therefore match the
# square set exactly, whichever height mode is on.
#
# The script's own units: a consonant is 5 tall, a vowel 4, and the two
# stack flush, so a consonant over a vowel is 9 units. Kept in step with
# tools/glyphspec.py, which the designer and designs/ both go through.

FLAT = 0.8          # 4/5
FLAT_SUFFIX = "_flat"
FLAT_BOX = 100 * FLAT

_TOKEN = re.compile(r"[A-Za-z]|-?\d*\.?\d+(?:[eE][-+]?\d+)?")


def _num(v):
    return f"{round(v, 2):g}"


def _squash_path(d, f):
    """Scale a path's y coordinates by f. Absolute commands only, which is
    all this file authors. Arc ry scales with y; rx and the flags don't."""
    tokens = _TOKEN.findall(d)
    out, i, cmd = [], 0, None
    while i < len(tokens):
        t = tokens[i]
        if t.isalpha():
            cmd, i = t, i + 1
            out.append(t)
            continue
        if cmd in ("M", "L", "T"):
            out += [_num(float(tokens[i])), _num(float(tokens[i + 1]) * f)]
            i += 2
        elif cmd == "C":
            v = [float(x) for x in tokens[i:i + 6]]
            v[1] *= f; v[3] *= f; v[5] *= f
            out += [_num(x) for x in v]
            i += 6
        elif cmd in ("S", "Q"):
            v = [float(x) for x in tokens[i:i + 4]]
            v[1] *= f; v[3] *= f
            out += [_num(x) for x in v]
            i += 4
        elif cmd == "A":
            out += [_num(float(tokens[i])), _num(float(tokens[i + 1]) * f),
                    tokens[i + 2], tokens[i + 3], tokens[i + 4],
                    _num(float(tokens[i + 5])), _num(float(tokens[i + 6]) * f)]
            i += 7
        elif cmd in ("H",):
            out.append(_num(float(tokens[i]))); i += 1
        elif cmd in ("V",):
            out.append(_num(float(tokens[i]) * f)); i += 1
        else:
            out.append(t); i += 1
    return " ".join(out)


def flatten(body, f=FLAT):
    """Squash a glyph body in y, keeping dots round and strokes untouched."""
    def path_sub(m):
        return f'<path d="{_squash_path(m.group(1), f)}"/>'

    def circle_sub(m):
        cx, cy, r = m.group(1), _num(float(m.group(2)) * f), m.group(3)
        return f'<circle cx="{cx}" cy="{cy}" r="{r}" fill="currentColor" stroke="none"/>'

    body = re.sub(r'<path d="([^"]*)"/>', path_sub, body)
    body = re.sub(
        r'<circle cx="([^"]*)" cy="([^"]*)" r="([^"]*)"[^/]*/>',
        circle_sub, body)
    return body


def dot(x, y, r=DOT):
    return f'<circle cx="{x}" cy="{y}" r="{r}" fill="currentColor" stroke="none"/>'


def path(d):
    return f'<path d="{d}"/>'


def _hflip_d(d, box=100):
    """Mirror one path `d` horizontally (x -> box-x). M/L/A/Z only: an arc's
    sweep flag flips and its rotation negates."""
    toks = d.replace(",", " ").split()
    out, i = [], 0
    while i < len(toks):
        c = toks[i]; i += 1
        if c in ("M", "L"):
            x, y = float(toks[i]), float(toks[i + 1]); i += 2
            out += [c, _num(box - x), _num(y)]
        elif c == "A":
            rx, ry, rot, large, sweep, x, y = toks[i:i + 7]; i += 7
            out += ["A", rx, ry, _num(-float(rot) or 0.0), large,
                    str(1 - int(sweep)), _num(box - float(x)), _num(float(y))]
        else:                                   # Z, or anything with no coords
            out.append(c)
    return " ".join(out)


def hflip(body, box=100):
    """Mirror a whole glyph body horizontally — every <path> and <circle> in
    it. Lets /r/ be drawn as the mirror of /l/, so only /l/ is maintained: a
    new /l/ (even multi-stroke, promoted from the designer) re-flips for free."""
    body = re.sub(r'<path d="([^"]*)"/>',
                  lambda m: f'<path d="{_hflip_d(m.group(1), box)}"/>', body)
    body = re.sub(
        r'<circle cx="([^"]*)" cy="([^"]*)" r="([^"]*)"[^/]*/>',
        lambda m: (f'<circle cx="{_num(box - float(m.group(1)))}" '
                   f'cy="{m.group(2)}" r="{m.group(3)}" '
                   f'fill="currentColor" stroke="none"/>'),
        body)
    return body


def mark(cols, body):
    """A full-height punctuation mark and the number of lattice columns it
    spans. Most marks are one column; a wider one (a question mark) sets a
    higher count, which decides its viewBox width when it is emitted."""
    return {"cols": cols, "body": body}


# ---------------------------------------------------------------------------
# CONSONANTS
# ---------------------------------------------------------------------------

CONSONANTS = {
    "p": path("M 50 18 L 18 50 L 50 82 L 82 50 L 66 34 L 50 18 Z"),
    "b": path("M 18 82 A 54.67 54.67 0 0 1 82 18 L 82 82") + dot(50, 58),
    "t": path("M 18 18 L 82 18 L 82 82")
         + path("M 18 50 L 18 82 L 50 82 L 50 50 L 18 50 Z"),
    "d": path("M 18 58 L 18 18 A 54.67 54.67 0 0 1 82 82 L 18 82"),
    "k": path("M 18 18 L 18 82 L 82 82")
         + path("M 50 18 L 50 50 L 82 50 L 82 18 L 50 18 Z"),
    "g": path("M 18 82 L 18 34 L 18 18")
         + path("M 18 18 L 82 18")
         + path("M 82 82 L 82 18")
         + dot(50, 50),
    "m": path("M 50 18 A 32 32 0 0 1 82 50 A 32 32 0 0 1 50 82 "
              "A 32 32 0 0 1 18 50 A 32 32 0 0 1 50 18 Z")
         + dot(50, 50),
    "n": path("M 18 82 L 58 82 A 27.09 27.09 0 0 0 82 58 L 82 18 L 42 18 "
              "A 28.28 28.28 0 0 0 18 50")
         + dot(50, 50),
    "ng": path("M 34 82 A 34 34 0 1 1 66 82"),
    "f": path("M 18 18 A 51.6 51.6 0 0 1 50 34 A 61.38 61.38 0 0 1 82 82")
         + path("M 82 18 A 51.6 51.6 0 0 0 50 34 A 61.38 61.38 0 0 0 18 82"),
    "v": path("M 18 18 L 82 18 A 36.22 36.22 0 0 1 50 58 A 52 52 0 0 0 18 82")
         + dot(74, 74),
    "th": path("M 18 18 L 82 18")
          + path("M 50 18 L 50 42")
          + path("M 18 82 A 36.22 36.22 0 0 1 50 42 A 36.22 36.22 0 0 1 82 82"),
    "dh": path("M 18 18 L 82 18 L 82 82 A 64 64 0 0 1 18 18 Z") + dot(18, 82),
    # Orientation is NOT by slot: /s/ appears both ways in the same slot, which
    # no flip rule can produce. It mirrors above another consonant (11 of 12
    # attested) and nowhere else (0 of 20). See render.js TURNS_ABOVE_CLUSTER.
    # TODO item 30.
    "s": path("M 18 82 L 50 18 L 82 82") + dot(50, 66),
    "z": path("M 50 18 L 50 50")
         + path("M 18 82 A 32 32 0 0 1 82 82")
         + dot(26, 26)
         + dot(74, 26),
    "h": path("M 18 18 L 82 18")
         + path("M 18 82 L 82 82")
         + path("M 50 26 A 24 24 0 0 1 74 50 A 24 24 0 0 1 50 74 "
                "A 24 24 0 0 1 26 50 A 24 24 0 0 1 50 26 Z"),
    "w": path("M 50 42 A 52 52 0 0 0 18 18 L 18 82 L 82 82")
         + path("M 82 58 A 42 42 0 0 1 50 42"),
    # One unbroken stroke each: the segments are already continuous, so
    # drawing them as a single path replaces the square-capped joins
    # between separate <path>s (which left a little tick, visible flipped)
    # with clean miter joins.
    "l": path("M 18 82 L 18 18 L 82 18 L 82 58 A 28.28 28.28 0 0 1 50 82"),
    "r": "",                            # derived below: the mirror of /l/
    "y": path("M 50 34 A 42 42 0 0 1 82 18 L 82 82 L 18 82")
         + path("M 18 58 A 36.46 36.46 0 0 0 50 34"),
    "sh": path("M 18 50 L 50 18 L 82 50") + path("M 18 82 L 50 50 L 82 82"),
    "ch": path("M 50 50 L 18 50 L 18 18 L 82 18 L 82 82 L 18 82"),
    "j_dz": path("M 82 18 L 82 82 L 18 82 L 18 18 L 50 18 L 50 58"),
    "zh": path("M 18 82 L 18 50 A 32 32 0 0 1 82 50 L 82 82"),
}

# /l/ and /r/ are a mirror pair: draw /l/ (edit its entry above, or promote a
# new drawing from the designer) and /r/ is its horizontal flip, always in
# step. Reassigning keeps /r/'s place in the dict, right after /l/.
CONSONANTS["r"] = hflip(CONSONANTS["l"])

# ---------------------------------------------------------------------------
# VOWELS — smaller, wider marks; they sit under the consonant
# ---------------------------------------------------------------------------

VOWELS = {
    "i": path("M 18 40 L 82 40") + path("M 18 80 L 82 80"),
    "ih": path("M 50 80 L 50 60") + path("M 18 60 L 82 60 L 82 20 L 18 20"),
    "ei": path("M 50 80 L 50 20")
          + path("M 18 60 L 82 60")
          + path("M 18 20 L 82 20"),
    "eh": path("M 18 40 A 42 52.5 0 0 1 50 60 A 42 52.5 0 0 0 82 80")
          + path("M 82 40 A 42 52.5 0 0 0 50 60 A 42 52.5 0 0 1 18 80"),
    "ae": path("M 26 40 L 26 70 A 33.94 42.43 0 0 0 74 70 L 74 40")
          + dot(50, 50),
    "ai": dot(26, 70) + path("M 74 40 L 26 40") + dot(74, 70),
    "uh": path("M 18 80 L 34 80")
          + path("M 18 40 L 34 40")
          + path("M 66 40 L 82 40")
          + path("M 66 80 L 82 80"),
    "schwa": path("M 82 80 A 25.3 31.62 0 0 1 50 60 A 25.3 31.62 0 0 0 18 40")
             + dot(82, 40)
             + dot(18, 80),
    "uu": path("M 18 40 L 18 80")
          + path("M 50 20 L 50 80")
          + path("M 82 40 L 82 80"),
    "ow": path("M 18 40 L 18 80 L 50 80 L 50 40 L 18 40 Z")
          + dot(74, 40)
          + dot(74, 80),
    "au": path("M 82 50 A 20 25 0 0 0 42 50 A 20 25 0 0 0 82 50")
          + dot(26, 30)
          + dot(26, 70),
    "aw": path("M 82 40 A 32 40 0 0 1 50 80 L 18 80") + dot(26, 40),
    "ah": path("M 50 80 L 50 50")
          + path("M 18 20 L 50 50")
          + path("M 82 20 L 50 50"),
    "oi": path("M 18 60 L 18 20 L 82 20 L 82 60 L 18 60 Z")
          + path("M 50 80 L 50 60"),
    "oo": path("M 50 20 L 50 80")
          + dot(18, 40)
          + dot(18, 80)
          + dot(82, 80)
          + dot(82, 40),
}

# ---------------------------------------------------------------------------
# MARKS — written like vowels (wide, flat) but standing for no sound
# ---------------------------------------------------------------------------

MARKS_CONSONANT = {
    # 5-row null filler (consonant height) — a square-cornered ∪.
    # Both nulls are cups; this one is squared off and stands 5 rows
    # against null_v's rounded 3.
    "null_c": path("M 18 18 L 18 82 L 82 82 L 82 18"),
}

MARKS_VOWEL = {
    # 3-row null filler (vowel height) — the ∪ cup shape.
    "null_v": path("M 18 40 L 18 60 A 42 52.5 0 0 0 50 80 "
                   "A 42 52.5 0 0 0 82 60 L 82 40"),
}

NULL_IPA = "∅"    # manifest key for the vowel-height filler
NULL_C_IPA = "∅c"  # manifest key for the consonant-height filler

# ---------------------------------------------------------------------------
# MARKS_FULL — punctuation. A THIRD height class: one lattice column wide,
# nine rows tall (mark_full, 36x164), standing beside the writing rather
# than in a slot. Drawn on the 1x9 lattice like every other glyph — the
# designer can edit them — and keyed in the manifest by the character you
# type, the way the nulls are keyed by ∅. render.js reads them from the
# manifest, falling back to its own copy only if the build hasn't run.
#
# 9 rows of 16 run y=10..154; row centres are 18 + 16n.
# ---------------------------------------------------------------------------

MARKS_FULL = {
    # A dot on the baseline (bottom row), beside the word's last block.
    "period": mark(1, dot(18, 114)),
    "comma": mark(1, path("M 18 114 L 18 146")),
    "exclamation": mark(1, dot(18, 82) + path("M 18 18 L 18 58") + path("M 18 146 L 18 106")),
    "question": mark(2, path("M 34 74 A 10 10 0 1 0 34 90")),
}

# The character you type -> the mark's name, i.e. its manifest key -> stem.
# Kept beside IPA_TO_NAME (spread into it below) so every consumer that
# walks that map — the manifest, the designer catalogue — sees the marks.
PUNCT_TO_NAME = {".": "period", ",": "comma", "?": "question", "!": "exclamation"}
MARK_FULL_BOX = 164   # viewBox height, every mark (9*16 + 2*10)
MARK_FULL_UNIT = 16   # one lattice column
MARK_FULL_MARGIN = 10  # clearance either side
def mark_width(cols):  # viewBox width for a mark that many columns wide
    return cols * MARK_FULL_UNIT + 2 * MARK_FULL_MARGIN


# Glyphs whose source is NOT reference/avatarian_key.svg, so the key tab
# can say why they have nothing to compare against. Without this they look
# identical to /tʃ/, which is drawn with no known source at all.
SOURCE_NOTES = {
    "ah": "from source material outside the key chart",
    "aw": "from source material outside the key chart",
    # These six were placeholders until they were drawn in the designer
    # and shipped. They are NOT inventions — they come from reference
    # material, just not from reference/avatarian_key.svg, which is why
    # the key chart has nothing to compare them against. Recorded here
    # for the same reason ah and aw are: without it they look identical
    # to a glyph drawn from nothing, which is the mistake /tʃ/ already
    # cost this project once.
    "sh": "from source material outside the key chart",
    "zh": "from source material outside the key chart",
    "ch": "from source material outside the key chart",
    "j_dz": "from source material outside the key chart",
    "oi": "from source material outside the key chart",
    "oo": "from source material outside the key chart",
}

# ---------------------------------------------------------------------------
# ORIENTATION
# ---------------------------------------------------------------------------
# Glyphs that MIRROR top-to-bottom depending on which slot they land in.
# Each is drawn once, in its top-slot form; render.js flips it for the
# bottom slot, so there is no second drawing to keep in step.
#
# This is a list, NOT a rule applied to everything: most glyphs keep one
# orientation in both slots. Only add a sound here on the strength of a
# word that actually shows it flipped.
#
#   æ   "at" (top, cup ∪) vs "mad" (bottom, cap ∩)
#   ɑ   "appa" (top, proper Y) vs "katara" (bottom, stem up)
#   l   "please" (bottom); the key chart draws both orientations
#   ɪ   "metalbending"
#   e   "Aang" (top) vs "wake" (bottom)
#   aɪ  key chart (rule above, dots below) vs "fire" (dots above the
#       rule). "fire" is /f aɪ ə r/, so aɪ is the second phoneme and
#       lands in a BOTTOM slot — and what canon writes there is the
#       vertical mirror of the chart's citation form. Both forms
#       attested, which is the bar for adding anything here.
#
# /s/ is deliberately absent: "students" writes both of its /s/ in TOP
# slots with a different orientation for each, so the slot cannot decide
# it. Spell those with the $/% override instead.
FLIPS_BASE = {"æ", "ɑ", "l", "ɪ", "e", "aɪ", "ə"}

# Vowels whose design spans all 4 rows of the vowel grid. These bridge
# the gap between consonant and vowel in the 9-row block model.
# All other vowels use only 3 rows, leaving a 1-row gap.
#
# The confirmed 4-row set, in IPA: ɪ e u ʊ ɑ aʊ ɔɪ. Beware the stem
# names, which do NOT track the sounds — stem `oo` is /ʊ/ (4-row) while
# stem `ow` is /oʊ/ (3-row), and stem `uh` is /ʌ/ (3-row). Read the set
# off the IPA, never off the stems.
#
# This is only the FALLBACK. Every vowel that has a design carries its
# own `rows`, and that wins — see design_overrides below.
VOWEL_4ROW_BASE = {"ɑ", "aʊ", "e", "ɪ", "ɔɪ", "ʊ", "u"}

# Sounds with no symbol anywhere in the reference material yet.
#
# "ch" was drawn (an inverted chevron under a dot) but no source for it
# was ever found — it is in no reference material seen so far, so it was
# an invention wearing the same clothes as the sourced glyphs. Demoted
# rather than left shipping: a wrong glyph propagates everywhere.
PLACEHOLDERS = {
    "kh": "x",
}

PLACEHOLDER_SVG = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">'
    '<rect x="14" y="14" width="72" height="72" rx="10" '
    'stroke="currentColor" stroke-width="6" stroke-dasharray="10 9" opacity="0.75"/>'
    '<text x="50" y="50" text-anchor="middle" dominant-baseline="central" '
    'font-family="Georgia,serif" font-size="40" fill="currentColor" opacity="0.75">?</text>'
    "</svg>"
)

# IPA -> filename stem
IPA_TO_NAME = {
    "p": "p", "b": "b", "t": "t", "d": "d", "k": "k", "g": "g",
    "m": "m", "n": "n", "ŋ": "ng", "tʃ": "ch", "dʒ": "j_dz",
    "f": "f", "v": "v", "θ": "th", "ð": "dh", "s": "s", "z": "z",
    "ʃ": "sh", "ʒ": "zh", "h": "h", "w": "w", "j": "y", "r": "r",
    "l": "l", "x": "kh",
    "i": "i", "ɪ": "ih", "e": "ei", "ɛ": "eh", "æ": "ae", "ʌ": "uh",
    "ə": "schwa", "u": "uu", "ʊ": "oo", "oʊ": "ow", "ɔ": "aw",
    # There is no ɜ. It was carried as a separate sound until the two
    # drawings turned out to be one letter flipped by slot; everything
    # that emitted ɜ now emits ə.
    "ɑ": "ah", "aɪ": "ai", "aʊ": "au", "ɔɪ": "oi",
    NULL_IPA: "null_v",
    NULL_C_IPA: "null_c",
    # Punctuation, keyed by the character. mark_full height class.
    **PUNCT_TO_NAME,
}

VOWEL_IPA = {"i", "ɪ", "e", "ɛ", "æ", "ʌ", "ə", "u", "ʊ", "oʊ", "ɔ",
             "ɑ", "aɪ", "aʊ", "ɔɪ"}


def glyph_type(ipa):
    if ipa in PUNCT_TO_NAME:
        return "mark_full"
    if ipa == NULL_IPA:
        return "null"
    if ipa == NULL_C_IPA:
        return "null_consonant"
    return "vowel" if ipa in VOWEL_IPA else "consonant"


def design_type(ipa):
    """The `type` a design carries for this sound — a height class, not a
    part of speech. See "Height classes" in tools/glyphspec.py."""
    return {"null": "mark", "null_consonant": "mark_consonant"}.get(
        glyph_type(ipa), glyph_type(ipa))


# ---------------------------------------------------------------------------
# FLIPS / VOWEL_4ROW: the two facts about a glyph that aren't its shape
# ---------------------------------------------------------------------------
# Both used to be hand-edited sets here, which meant the designer — the
# place you actually find out that a glyph flips, or that it wants its
# top row — couldn't record it. A design may now carry `flips` (bool) and
# `rows` (3 or 4), and those win for that sound.
#
# The sets above stay as the baseline, so a sound with no design, or a
# design that says nothing about either, keeps the value it always had.
# Overriding is explicit in both directions: `"flips": false` turns a
# base entry OFF, which is why absence and false are not the same thing.

DESIGNS = ROOT / "designs"

NAME_TO_IPA = {name: ipa for ipa, name in IPA_TO_NAME.items()}


def design_overrides():
    """(flips, rows) read out of designs/*.json, keyed by IPA. Missing or
    unreadable designs are simply not overrides — this is a build script
    for a drawing tool, and half a JSON file shouldn't stop the build."""
    flips, rows = {}, {}
    if not DESIGNS.is_dir():
        return flips, rows
    for p in sorted(DESIGNS.glob("*.json")):
        ipa = NAME_TO_IPA.get(p.stem)
        if ipa is None:
            continue                      # a design with no matching sound
        try:
            d = json.loads(p.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if isinstance(d.get("flips"), bool):
            flips[ipa] = d["flips"]
        if d.get("rows") in (3, 4):
            rows[ipa] = d["rows"]
    return flips, rows


def effective_flags():
    """The sets the build actually uses, base overlaid with designs/."""
    flip_over, row_over = design_overrides()
    flips = {ipa for ipa in IPA_TO_NAME
             if flip_over.get(ipa, ipa in FLIPS_BASE)}
    four = {ipa for ipa in IPA_TO_NAME
            if glyph_type(ipa) == "vowel"
            and row_over.get(ipa, 4 if ipa in VOWEL_4ROW_BASE else 3) == 4}
    return flips, four


# Applied at import so designer_server.py and designs_to_svg.py, which
# read bg.FLIPS / bg.VOWEL_4ROW, see the same values the build does.
# Call refresh() after writing a design to pick the change up in a
# long-running process.
FLIPS, VOWEL_4ROW = effective_flags()


def refresh():
    global FLIPS, VOWEL_4ROW
    FLIPS, VOWEL_4ROW = effective_flags()
    return FLIPS, VOWEL_4ROW


def main():
    refresh()
    OUT.mkdir(parents=True, exist_ok=True)

    # remove the old raster set so nothing stale is served
    removed = 0
    for old in OUT.glob("*.png"):
        old.unlink()
        removed += 1

    drawn = {}
    for name, body in {**CONSONANTS, **MARKS_CONSONANT}.items():
        (OUT / f"{name}.svg").write_text(svg(body), encoding="utf-8")
        drawn[name] = True
    # Full-height punctuation marks: a tall box, one form only, as many
    # lattice columns wide as the mark declares (period 1, a question mark
    # perhaps 2 or 3).
    for name, m in MARKS_FULL.items():
        (OUT / f"{name}.svg").write_text(
            svg(m["body"], box=MARK_FULL_BOX, w=mark_width(m["cols"])),
            encoding="utf-8")
        drawn[name] = True
    # Vowels and vowel-height marks ship twice: the square drawing for
    # equal-height mode, and a geometrically flattened 100x80 copy for
    # proportional mode.
    flat = {}
    for name, body in {**VOWELS, **MARKS_VOWEL}.items():
        (OUT / f"{name}.svg").write_text(svg(body), encoding="utf-8")
        (OUT / f"{name}{FLAT_SUFFIX}.svg").write_text(
            svg(flatten(body), box=FLAT_BOX), encoding="utf-8"
        )
        drawn[name] = True
        flat[name] = True

    for name in PLACEHOLDERS:
        (OUT / f"{name}.svg").write_text(PLACEHOLDER_SVG, encoding="utf-8")

    (OUT / "unknown.svg").write_text(PLACEHOLDER_SVG, encoding="utf-8")

    # Sweep out SVGs this run didn't write. Renaming a glyph otherwise
    # leaves the old stem behind, and a ghost file looks exactly like a
    # live one when you go looking for why a shape didn't change.
    all_marks = {**MARKS_CONSONANT, **MARKS_VOWEL, **MARKS_FULL}
    current = {f"{n}.svg" for n in {**CONSONANTS, **VOWELS, **all_marks}} \
        | {f"{n}{FLAT_SUFFIX}.svg" for n in {**VOWELS, **MARKS_VOWEL}} \
        | {f"{n}.svg" for n in PLACEHOLDERS} | {"unknown.svg"}
    stale = [p for p in OUT.glob("*.svg") if p.name not in current]
    for p in stale:
        p.unlink()

    manifest = {}
    for ipa, name in IPA_TO_NAME.items():
        manifest[ipa] = {
            "file": f"{name}.svg",
            "status": "drawn" if name in drawn else "PLACEHOLDER",
            "type": glyph_type(ipa),
        }
        if name in SOURCE_NOTES:
            manifest[ipa]["note"] = SOURCE_NOTES[name]
        if name in flat:
            manifest[ipa]["flat"] = f"{name}{FLAT_SUFFIX}.svg"
        if ipa in FLIPS:
            manifest[ipa]["flips"] = True
        if ipa in VOWEL_4ROW:
            manifest[ipa]["rows"] = 4


    MANIFEST_JSON.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    n_ph = sum(1 for v in manifest.values() if v["status"] == "PLACEHOLDER")
    print(f"Removed {removed} old PNG(s), {len(stale)} stale SVG(s)"
          f"{': ' + ', '.join(p.name for p in stale) if stale else ''}.")
    print(f"Drew {len(drawn)} glyphs, {n_ph} placeholder(s).")
    print(f"Manifest: {len(manifest)} entries -> {MANIFEST_JSON.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
