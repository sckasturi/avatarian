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
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 {h}" '
    'fill="none" stroke="currentColor" stroke-width="{sw}" '
    'stroke-linecap="square" stroke-linejoin="miter">'
)


def svg(body, sw=SW, box=100):
    """Serialise a glyph body into a 100-wide viewBox `box` units tall."""
    return HEADER.format(sw=sw, h=box) + body + "</svg>"


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
    "l": path("M 18 82 L 18 18 L 82 18") + path("M 82 18 A 84 84 0 0 1 50 82"),
    "r": path("M 82 82 L 82 18 L 18 18") + path("M 18 18 A 84 84 0 0 0 50 82"),
    "y": path("M 50 34 A 42 42 0 0 1 82 18 L 82 82 L 18 82")
         + path("M 18 58 A 36.46 36.46 0 0 0 50 34"),
    "sh": path("M 18 50 L 50 18 L 82 50") + path("M 18 82 L 50 50 L 82 82"),
    "ch": path("M 50 50 L 18 50 L 18 18 L 82 18 L 82 82 L 18 82"),
    "j_dz": path("M 82 18 L 82 82 L 18 82 L 18 18 L 50 18 L 50 58"),
    "zh": path("M 18 82 L 18 50 A 32 32 0 0 1 82 50 L 82 82"),
}

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
          + path("M 66 80 L 82 80")
          + path("M 66 80 L 74 60"),
    "schwa": dot(18, 40)
             + dot(82, 80)
             + path("M 18 80 A 29.77 37.21 0 0 0 50 60 "
                    "A 29.77 37.21 0 0 1 82 40"),
    "nurse": path("M 82 80 A 25.3 31.62 0 0 1 50 60 A 25.3 31.62 0 0 0 18 40")
             + dot(82, 40)
             + dot(18, 80),
    "uu": path("M 18 40 L 18 80")
          + path("M 50 20 L 50 80")
          + path("M 82 40 L 82 80"),
    "ow": path("M 18 40 L 18 80 L 50 80 L 50 40 L 18 40 Z")
          + dot(74, 40)
          + dot(74, 80),
    "au": path("M 82 30 A 25.33 31.67 0 0 0 42 50 A 25.33 31.67 0 0 0 82 70")
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
FLIPS_BASE = {"æ", "ɑ", "l", "ɪ", "e", "aɪ"}

# Vowels whose design spans all 4 rows of the vowel grid. These bridge
# the gap between consonant and vowel in the 9-row block model.
# All other vowels use only 3 rows, leaving a 1-row gap.
#
# The confirmed set, in ARPAbet: AA AW EY IH OY UH UW. Beware the stem
# names, which do NOT track the codes — stem `uh` is /ʌ/ (ARPAbet AH,
# 3-row) while ARPAbet UH is /ʊ/ (stem `oo`, 4-row), and stem `aw` is
# /ɔ/ (ARPAbet AO, 3-row) while ARPAbet AW is /aʊ/ (stem `au`, 4-row).
# Reading the list as stems instead of codes gets two of the seven
# wrong, in both directions.
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
    # ɜ is NOT ARPAbet's ER: g2p emits it with /r/ as a separate segment
    # ("bird" -> ɜ r), so the vowel carries no r-colouring. Named for its
    # lexical set instead, the way ə is named schwa.
    "ɑ": "ah", "aɪ": "ai", "aʊ": "au", "ɔɪ": "oi", "ɜ": "nurse",
    NULL_IPA: "null_v",
    NULL_C_IPA: "null_c",
}

VOWEL_IPA = {"i", "ɪ", "e", "ɛ", "æ", "ʌ", "ə", "u", "ʊ", "oʊ", "ɔ",
             "ɑ", "aɪ", "aʊ", "ɔɪ", "ɜ"}


def glyph_type(ipa):
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
    all_marks = {**MARKS_CONSONANT, **MARKS_VOWEL}
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
