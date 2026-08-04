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

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "assets" / "glyphs"
MANIFEST_JSON = ROOT / "site" / "assets" / "glyph_manifest.json"

SW = 9          # stroke width
DOT = 6.5       # dot radius

HEADER = (
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" '
    'fill="none" stroke="currentColor" stroke-width="{sw}" '
    'stroke-linecap="round" stroke-linejoin="round">'
)


def svg(body, sw=SW):
    return HEADER.format(sw=sw) + body + "</svg>"


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
    #     leaving the lower left open; dot inside
    "d": path("M 13 58 L 13 13 L 34 12 A 60 72 0 0 1 92 84 L 15 86")
         + dot(50, 53, 8),

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

    # f — saltire
    "f": path("M 22 24 L 78 76") + path("M 78 24 L 22 76"),

    # θ (thing) — crossbar over a stem splaying into two curved legs
    "th": path("M 13 20 L 91 20") + path("M 50 20 L 50 52")
          + path("M 17 84 C 15 64, 32 55, 50 52 C 68 55, 85 64, 87 86"),

    # ð (the) — top rule and right flank closed by a sagging diagonal
    "dh": path("M 14 21 L 87 20 L 85 79 C 62 73, 36 47, 14 21 Z"),

    # v — flag stroke turning back on itself, dot at the tail
    "v": path("M 20 28 L 76 28 C 76 56 48 52 30 74") + dot(72, 66),

    # s — chevron with a dot in the mouth
    "s": path("M 20 76 L 50 26 L 80 76") + dot(50, 62),

    # z — chevron flanked by two dots
    "z": path("M 22 74 L 50 34 L 78 74") + dot(24, 34) + dot(76, 34),

    # tʃ (ch) — inverted chevron under a dot
    "ch": path("M 22 30 L 50 72 L 78 30") + dot(50, 24),

    # w — L-form whose top corner also throws a slack arm out to the right
    "w": path("M 89 49 C 74 50, 62 48, 52 41 C 40 32, 30 18, 16 12 "
              "L 15 86 L 88 84"),

    # l — a hook and its mirror image, stacked with a gap between
    "l": path("M 34 11 L 34 37 L 80 38 C 78 26, 69 15, 55 11")
         + path("M 34 85 L 34 59 L 80 58 C 78 70, 69 81, 55 85"),

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

    # ɪ (sit) — bracket opening left, with a stem rising off its top rule
    "ih": path("M 50 13 L 50 45")
          + path("M 12 48 L 86 46 L 86 82 L 12 84"),

    # e / eɪ (say) — crossed stem over a base rule
    "ei": path("M 50 22 L 50 58") + path("M 24 40 L 76 40")
          + path("M 16 72 L 84 72"),

    # ɛ (set) — two bowed strokes crossing, ends left open
    "eh": path("M 13 32 C 34 38, 43 45, 50 50 C 57 55, 66 62, 87 68")
          + path("M 13 68 C 34 62, 43 55, 50 50 C 57 45, 66 38, 87 32"),

    # æ (sat) — cup cradling a dot
    "ae": path("M 24 30 L 24 50 A 26 26 0 0 0 76 50 L 76 30") + dot(50, 44),

    # aɪ (tie) — paired dots beneath a hairline
    "ai": path("M 26 34 L 74 34") + dot(34, 62) + dot(66, 62),

    # ʌ (uh) — four short rules, two by two
    "uh": path("M 14 36 L 42 36") + path("M 58 36 L 86 36")
          + path("M 14 63 L 42 63") + path("M 58 63 L 86 63"),

    # ə (some) — recurve rising left to right, flanked by two dots
    "schwa": path("M 14 72 C 32 72, 40 60, 50 48 C 60 36, 68 25, 87 25")
             + dot(33, 36, 8) + dot(77, 62, 8),

    # u (too) — three uprights
    "uu": path("M 26 26 L 26 74") + path("M 50 26 L 50 74")
          + path("M 74 26 L 74 74"),

    # oʊ (toe) — box with a following colon
    "ow": path("M 18 32 L 18 68 L 54 68 L 54 32 Z") + dot(74, 38) + dot(74, 62),

    # aʊ (now) — colon opening into a crescent
    "au": path("M 84 30 A 26 26 0 1 0 84 70") + dot(20, 36) + dot(20, 64),

    # ɑ (father) — upside-down Y: three equal arms at 120 degrees off a
    # single junction (arm 44, so the mark centres in the box).
    "ah": path("M 50 17 L 50 61") + path("M 12 83 L 50 61 L 88 83"),
}

# Glyphs whose source is NOT reference/avatarian_key.svg, so the key tab
# can say why they have nothing to compare against. Without this they look
# identical to /tʃ/, which is drawn with no known source at all.
SOURCE_NOTES = {
    "ah": "from source material outside the key chart",
}

# Sounds with no symbol anywhere in the reference material yet.
PLACEHOLDERS = {
    "sh": "ʃ", "zh": "ʒ", "j_dz": "dʒ",
    "oi": "ɔɪ", "nurse": "ɜ", "kh": "x", "oo": "ʊ", "aw": "ɔ",
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
}

VOWEL_IPA = {"i", "ɪ", "e", "ɛ", "æ", "ʌ", "ə", "u", "ʊ", "oʊ", "ɔ",
             "ɑ", "aɪ", "aʊ", "ɔɪ", "ɜ"}


def main():
    OUT.mkdir(parents=True, exist_ok=True)

    # remove the old raster set so nothing stale is served
    removed = 0
    for old in OUT.glob("*.png"):
        old.unlink()
        removed += 1

    drawn = {}
    for name, body in {**CONSONANTS, **VOWELS}.items():
        (OUT / f"{name}.svg").write_text(svg(body), encoding="utf-8")
        drawn[name] = True

    for name in PLACEHOLDERS:
        (OUT / f"{name}.svg").write_text(PLACEHOLDER_SVG, encoding="utf-8")

    (OUT / "unknown.svg").write_text(PLACEHOLDER_SVG, encoding="utf-8")

    # Sweep out SVGs this run didn't write. Renaming a glyph otherwise
    # leaves the old stem behind, and a ghost file looks exactly like a
    # live one when you go looking for why a shape didn't change.
    current = {f"{n}.svg" for n in {**CONSONANTS, **VOWELS}} \
        | {f"{n}.svg" for n in PLACEHOLDERS} | {"unknown.svg"}
    stale = [p for p in OUT.glob("*.svg") if p.name not in current]
    for p in stale:
        p.unlink()

    manifest = {}
    for ipa, name in IPA_TO_NAME.items():
        manifest[ipa] = {
            "file": f"{name}.svg",
            "status": "drawn" if name in drawn else "PLACEHOLDER",
            "type": "vowel" if ipa in VOWEL_IPA else "consonant",
        }
        if name in SOURCE_NOTES:
            manifest[ipa]["note"] = SOURCE_NOTES[name]

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
