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
  stroke       currentColor, width 9, round caps + joins
  fill         none for strokes; dots are filled circles r=6.5
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
DOT = 6.5       # dot radius

# Vowels are authored at the same weight as everything else. When the
# proportional-height mode is on they get stretched (full width, 3/5
# height), which scales stroke weight anisotropically — verticals keep
# the x-scale, horizontals thin out by the y-scale. That is compensated
# in CSS with a stroke-width override rather than a heavier authored
# weight, because the weight would then be wrong in the default
# equal-height mode, where there is no stretch at all.
VOWEL_SW = SW

HEADER = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 {h}" '
    'fill="none" stroke="currentColor" stroke-width="{sw}" '
    'stroke-linecap="round" stroke-linejoin="round">'
)


def svg(body, sw=SW, box=100):
    """Serialise a glyph body into a 100-wide viewBox `box` units tall."""
    return HEADER.format(sw=sw, h=box) + body + "</svg>"


# ---------------------------------------------------------------------------
# Flat (3/5-height) variants
# ---------------------------------------------------------------------------
# Proportional mode draws vowels at 3/5 the height of a consonant but the
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
# The result is emitted into a 100x60 viewBox, which the renderer then
# scales UNIFORMLY. Stroke weight and dot roundness therefore match the
# square set exactly, whichever height mode is on.

FLAT = 0.6          # 3/5
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
        cx, cy, r = m.group(1), float(m.group(2)) * f, m.group(3)
        return (f'<circle cx="{cx}" cy="{_num(cy)}" r="{r}" '
                'fill="currentColor" stroke="none"/>')

    body = re.sub(r'<path d="([^"]*)"/>', path_sub, body)
    body = re.sub(r'<circle cx="([^"]*)" cy="([^"]*)" r="([^"]*)"[^/]*/>',
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
    # m — ring with a centred dot
    "m": path("M 50 20 A 30 30 0 1 1 49.9 20 Z") + dot(50, 50),

    # n — squared spiral, open at the left, winding clockwise; dot inside
    "n": path("M 12 50 A 38 38 0 0 1 50 12 L 80 11 A 9 9 0 0 1 89 20 "
              "L 88 58 A 20 20 0 0 1 68 78 L 20 80") + dot(50, 42, 8),

    # b — arch: round left shoulder, square right, open foot, dot inside
    "b": path("M 13 80 L 13 56 A 43 43 0 0 1 56 13 L 87 12 L 85 88")
         + dot(50, 60, 8),

    # d — left stem and top rule sweeping down into a returning foot,
    #     leaving the lower left open. One continuous curve rather than
    #     an arc segment, so the shoulder doesn't kink.
    #     No dot: the key chart's tracing has one, but the reference
    #     drawing supplied for it does not, and that is the newer source.
    "d": path("M 13 56 L 13 13 L 36 13 C 67 17, 88 45, 88 86 L 14 86"),

    # p — diamond
    "p": path("M 50 18 L 82 50 L 50 82 L 18 50 Z"),

    # t — top rule turning down a long right leg, over a closed box
    "t": path("M 12 14 L 74 13 A 14 14 0 0 1 88 27 L 88 88")
         + path("M 17 44 L 70 44 L 70 88 L 17 88 Z"),

    # k — L-form (left stem, long foot) beside a closed box
    "k": path("M 14 14 L 14 80 L 93 79")
         + path("M 44 20 L 86 20 L 86 55 L 44 55 Z"),

    # g — open-foot box with dot
    "g": path("M 24 80 L 24 24 L 76 24 L 76 80") + dot(50, 48),

    # h — I-form: capped top and bottom, ring at the waist meeting both
    "h": path("M 12 20 L 91 20") + path("M 12 80 L 91 80")
         + path("M 50 29 A 21 21 0 1 1 49.9 29 Z"),

    # f — bowed saltire: the two strokes cross HIGH, about a third down,
    #     so the top arms are shallow and wide and the legs run long.
    #     Was a straight X, which the key tracing does not support.
    "f": path("M 14 22 C 32 28, 44 32, 50 41 C 58 54, 68 70, 79 86")
         + path("M 86 21 C 68 27, 56 32, 50 41 C 42 54, 30 70, 18 86"),

    # θ (thing) — crossbar over a stem splaying into two curved legs
    "th": path("M 13 20 L 91 20") + path("M 50 20 L 50 52")
          + path("M 17 84 C 15 64, 32 55, 50 52 C 68 55, 85 64, 87 86"),

    # ð (the) — top rule and right flank closed by a sagging diagonal
    "dh": path("M 14 21 L 87 20 L 85 79 C 62 73, 36 47, 14 21 Z"),

    # v — flag stroke turning back on itself, dot at the tail
    "v": path("M 20 28 L 76 28 C 76 56 48 52 30 74") + dot(72, 66),

    # s — chevron ∨ with a dot in the mouth (the top orientation).
    #   NOTE /s/ does not follow the slot: "students" writes both of its
    #   /s/ in top slots and uses a different orientation for each. Use
    #   the $/% override there.
    "s": path("M 20 24 L 50 74 L 80 24") + dot(50, 38),

    # z — upright stem dropping into two bowed legs, flanked by two dots.
    #     The key's tracing shows a bare chevron with no stem, but both
    #     the supplied reference drawing and the writing sample ("please"
    #     = /p l i z/) clearly carry the stem, so it is drawn.
    "z": path("M 50 12 L 50 44")
         + path("M 13 86 C 20 63, 34 50, 50 44 C 66 50, 76 65, 83 86")
         + dot(22, 24) + dot(78, 24),

    # w — L-form whose top corner also throws a slack arm out to the right
    "w": path("M 89 49 C 74 50, 62 48, 52 41 C 40 32, 30 18, 16 12 "
              "L 15 86 L 88 84"),

    # l — hook opening at the bottom. The key chart draws this and its
    # mirror stacked inside one cell, which is why they were once
    # extracted and drawn as a single two-hook figure; they are the top
    # and bottom orientations of one glyph.
    "l": path("M 24 72 L 24 18 L 86 16 C 82 40, 62 66, 44 72"),

    # r — top rule and right flank, with a hook curling in beneath
    "r": path("M 52 76 C 30 78, 15 68, 13 45 L 12 15 L 87 13 L 85 87"),

    # j (y-sound) — foot and right flank, closed by a swoop down to the left
    "y": path("M 11 52 C 36 49, 62 32, 84 13 L 85 78 L 12 86"),

    # ŋ (ng) — broken ring, gap at the foot
    "ng": path("M 34 78 A 32 32 0 1 1 66 78"),

    # ʔ — bare gate (the chart's "null" mark)
    "glot": path("M 26 80 L 26 26 L 74 26 L 74 80"),
}

# ---------------------------------------------------------------------------
# VOWELS — smaller, wider marks; they sit under the consonant
# ---------------------------------------------------------------------------

VOWELS = {
    # i (see) — two rules
    "i": path("M 16 38 L 84 38") + path("M 16 62 L 84 62"),

    # ɪ (sit) — TWO POSITIONAL VARIANTS, see VARIANTS.
    # ih — bracket opening left, stem rising off its top rule. Written in
    #   the bottom slot.
    "ih": path("M 50 13 L 50 45")
          + path("M 12 48 L 86 46 L 86 82 L 12 84"),
    # ih_alt — the same mark mirrored top-to-bottom: the bracket still
    #   opens LEFT, and the stem hangs below instead of rising above.
    #   Not a 180° rotation, which would flip the opening to the right.
    #   Written in the top slot ("metalbending" = /m ɛ t ə l ∅ b ɛ n d ɪ
    #   ŋ/, where ɪ is the eleventh phoneme — an even index, so a top
    #   slot). Same vertical-mirror relationship as ae/ae_alt and l1/l2.
    "ih_alt": path("M 50 87 L 50 55")
              + path("M 12 52 L 86 54 L 86 18 L 12 16"),

    # e / eɪ (say) — rule across the top, stem hanging from it through a
    #   shorter crossbar. ONE form, in both slots.
    #
    #   This was drawn the other way up for a long time, then briefly
    #   treated as a positional pair after "wake" (/w e k/) turned out to
    #   need the rotated form in a bottom slot. "Aang" (/e ŋ/) then
    #   showed the SAME rotated form in a top slot, so there is no
    #   evidence for the original orientation anywhere — it was simply
    #   upside down, not a variant. Don't re-split it without a word that
    #   actually shows the other form.
    "ei": path("M 50 86 L 50 20") + path("M 22 60 L 78 60")
          + path("M 14 20 L 86 20"),

    # ɛ (set) — two bowed strokes crossing, ends left open
    "eh": path("M 13 32 C 34 38, 43 45, 50 50 C 57 55, 66 62, 87 68")
          + path("M 13 68 C 34 62, 43 55, 50 50 C 57 45, 66 38, 87 32"),

    # æ (sat) — cup cradling a dot, opening upward. Top orientation
    #   ("at" = /æ t/); "mad" shows the mirrored cap in a bottom slot.
    "ae": path("M 24 30 L 24 50 A 26 26 0 0 0 76 50 L 76 30") + dot(50, 44),

    # aɪ (tie) — paired dots beneath a hairline
    "ai": path("M 26 34 L 74 34") + dot(34, 62) + dot(66, 62),

    # ʌ (uh) — four dots, two by two. Was four short rules; the
    # reference reading of "up" is unambiguously dots.
    "uh": dot(28, 34, 8) + dot(72, 34, 8)
          + dot(28, 66, 8) + dot(72, 66, 8),

    # ə (some) — recurve ASCENDING left to right; dot ABOVE on the left,
    # dot BELOW on the right.
    "schwa": path("M 14 72 C 32 72, 40 60, 50 48 C 60 36, 68 25, 87 25")
             + dot(33, 36, 8) + dot(77, 62, 8),

    # ɜ (nurse) — the mirror of ə: recurve DESCENDING left to right, dot
    # BELOW on the left, dot ABOVE on the right. These are two distinct
    # glyphs, not one shared mark — an earlier reference screenshot
    # labelled a single glyph "ə/ɜ" and they were merged on that basis.
    "nurse": path("M 14 25 C 32 25, 40 37, 50 49 C 60 61, 68 72, 87 72")
             + dot(33, 61, 8) + dot(77, 35, 8),

    # u (too) — three uprights
    "uu": path("M 26 26 L 26 74") + path("M 50 26 L 50 74")
          + path("M 74 26 L 74 74"),

    # oʊ (toe) — box with a following colon
    "ow": path("M 18 32 L 18 68 L 54 68 L 54 32 Z") + dot(74, 38) + dot(74, 62),

    # aʊ (now) — colon opening into a crescent
    "au": path("M 84 30 A 26 26 0 1 0 84 70") + dot(20, 36) + dot(20, 64),

    # ɔ (thought) — right stem curling into a long foot, dot in the crook
    "aw": path("M 86 26 L 86 50 A 24 24 0 0 1 62 74 L 12 76")
          + dot(29, 36, 7),

    # ɑ (father) — two arms up off a junction, stem hanging down: a
    #   proper Y. Top orientation ("appa"); "katara" shows the mirror in
    #   a bottom slot. Three equal arms at 120 degrees.
    "ah": path("M 50 83 L 50 39") + path("M 12 17 L 50 39 L 88 17"),
}

# ---------------------------------------------------------------------------
# MARKS — written like vowels (wide, flat) but standing for no sound
# ---------------------------------------------------------------------------

MARKS = {
    # The ∪ cup that fills an empty second slot. Phonemes are written two
    # to a block, so a word with an odd number of them leaves the last
    # bottom slot empty and this fills it. Confirmed in the writing
    # sample under "not", "mad", "when", "wake" and "but" — all of which
    # have an odd phoneme count. Traced from the key chart's vowel-block
    # "null" (extracted as glot_v), distinct from the ⊓ gate at /ʔ/.
    "glot_v": path("M 22 26 L 22 52 A 28 28 0 0 0 78 52 L 78 26"),
}

NULL_IPA = "∅"   # manifest key for the filler; not a phoneme


# Glyphs whose source is NOT reference/avatarian_key.svg, so the key tab
# can say why they have nothing to compare against. Without this they look
# identical to /tʃ/, which is drawn with no known source at all.
SOURCE_NOTES = {
    "ah": "from source material outside the key chart",
    "aw": "from source material outside the key chart",
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
#
# /s/ is deliberately absent: "students" writes both of its /s/ in TOP
# slots with a different orientation for each, so the slot cannot decide
# it. Spell those with the $/% override instead.
FLIPS = {"æ", "ɑ", "l", "ɪ", "e"}

# Sounds with no symbol anywhere in the reference material yet.
#
# "ch" was drawn (an inverted chevron under a dot) but no source for it
# was ever found — it is in no reference material seen so far, so it was
# an invention wearing the same clothes as the sourced glyphs. Demoted
# rather than left shipping: a wrong glyph propagates everywhere.
PLACEHOLDERS = {
    "sh": "ʃ", "zh": "ʒ", "j_dz": "dʒ",
    "oi": "ɔɪ", "kh": "x", "oo": "ʊ", "ch": "tʃ",
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
    "l": "l", "ʔ": "glot", "x": "kh",
    "i": "i", "ɪ": "ih", "e": "ei", "ɛ": "eh", "æ": "ae", "ʌ": "uh",
    "ə": "schwa", "u": "uu", "ʊ": "oo", "oʊ": "ow", "ɔ": "aw",
    # ɜ is NOT ARPAbet's ER: g2p emits it with /r/ as a separate segment
    # ("bird" -> ɜ r), so the vowel carries no r-colouring. Named for its
    # lexical set instead, the way ə is named schwa.
    "ɑ": "ah", "aɪ": "ai", "aʊ": "au", "ɔɪ": "oi", "ɜ": "nurse",
    NULL_IPA: "glot_v",
}

VOWEL_IPA = {"i", "ɪ", "e", "ɛ", "æ", "ʌ", "ə", "u", "ʊ", "oʊ", "ɔ",
             "ɑ", "aɪ", "aʊ", "ɔɪ", "ɜ"}


def glyph_type(ipa):
    if ipa == NULL_IPA:
        return "null"
    return "vowel" if ipa in VOWEL_IPA else "consonant"


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    # remove the old raster set so nothing stale is served
    removed = 0
    for old in OUT.glob("*.png"):
        old.unlink()
        removed += 1

    drawn = {}
    for name, body in CONSONANTS.items():
        (OUT / f"{name}.svg").write_text(svg(body), encoding="utf-8")
        drawn[name] = True
    # Vowels and marks ship twice: the square drawing for equal-height
    # mode, and a geometrically flattened 100x60 copy for proportional
    # mode. Both are scaled uniformly at render time, so stroke weight
    # and dot roundness are identical in either.
    flat = {}
    for name, body in {**VOWELS, **MARKS}.items():
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
    current = {f"{n}.svg" for n in {**CONSONANTS, **VOWELS, **MARKS}} \
        | {f"{n}{FLAT_SUFFIX}.svg" for n in {**VOWELS, **MARKS}} \
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
