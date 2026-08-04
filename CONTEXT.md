# Context for continuing this project

Read `README.md` first for architecture and deployment. This file covers
what a fresh session needs to know that isn't obvious from the code.

## What this is

A static toolkit for **Avatarian**, the conscript introduced for the new
Avatar: The Last Airbender film. It converts English → IPA → Avatarian
glyphs, renders them as syllable blocks, and plugs into Avatar Wiki
(Fandom) via a `{{avatarian|word}}` template. No server, no build step,
no dependencies.

Avatarian is **phonetic** — it encodes IPA sounds, not English letters.
Every part of the pipeline is IPA-first; English is only ever an input
convenience that gets converted to IPA first.

## Build loop

```bash
python3 tools/build_glyphs.py     # redraws the glyph SVGs
python3 tools/build_manifest.py   # re-embeds them into site/js/manifest.js
open site/index.html              # works straight off disk, no server
```

Both must run in that order after any glyph change. `js/manifest.js` is
generated — never hand-edit it.

`python3 tools/extract_reference.py` re-cuts `reference/avatarian_key.svg`
into one traced SVG per sound; those ride along in `manifest.js` too. Only
needed when the key chart itself changes, and `build_manifest.py` must run
after it.

## Fixing a glyph

The **Glyph key & status** tab pairs each drawn glyph with the shape traced
straight out of the key, with an overlay toggle. That is the loop: compare
there, fix the path in `build_glyphs.py`, re-run the two build scripts,
reload. Hard-refresh — `file://` caches `manifest.js` aggressively and a
stale one looks exactly like an edit that didn't take.

## Non-obvious decisions (don't undo these by accident)

- **Glyphs are inlined into `js/manifest.js`, not loaded as image files.**
  This is deliberate: `fetch()` is CORS-blocked on `file://` origins, so a
  fetched manifest fails with nothing but console errors when someone
  double-clicks `index.html`. Inlining also means the wiki gadget needs no
  image hosting, and glyphs inherit text colour via `currentColor`.
- **`g2p.js` is a positional longest-match scanner, not chained
  `.replace()` calls.** Chained replacements corrupt their own output: a
  rule emitting `oʊ` gets its `o` rewritten by a later `o → ɑ` rule, so
  "hello" came out `/h ɛ l ɑ ʊ/`. Don't refactor it back.
- **Glyphs are drawn, not traced.** All shapes are geometric primitives on
  a shared 100×100 grid, one stroke weight, round caps/joins. Keep new
  glyphs consistent with that system.
- **This is not a font file.** Canon composes syllables into blocks
  (closer to Hangul than an alphabet), which no font format handles well,
  so composition happens in the DOM.
- **/ə/ is the recurve with two dots; /ʌ/ is the four short rules.** The
  set had these two backwards until the key was traced and compared. The
  key is unambiguous — the `ə` label sits on the recurve, `ʌ` on the
  rules — so don't swap them back on the strength of older material.

## Layout rule (derived from canon)

Verified against the canon note reading "Katara, please do not be mad":

- one block per syllable;
- **the vowel sits underneath the consonant** — in the first block of
  "Katara", the /ə/ mark sits directly below the /k/ glyph;
- both rows render at the same size;
- blocks pack tight; word spacing separates words.

The key chart's "Consonants 3/4 height, Vowels 1/4 height" note describes
bands inside a hand-lettered block, not a scale factor — every glyph is
drawn on one 100×100 grid, so scaling the lower row down shrank the whole
mark and vowels went too faint to read. Sizing lives in the CSS, and
`site/css/style.css` and `wiki/MediaWiki_Common.css.txt` both drive the
same `render.js`, so they have to change together.

## Open work, roughly in priority order

1. **Eight sounds have no glyph** and render as dashed "?" boxes:
   dʒ, ʃ, ʒ, x, ʊ, ɔ, ɔɪ, ɜ. The reference key has visible blanks next
   to "good" and "toy", and ɔ/ɜ aren't on it at all. Needs source
   material, not guessing — a wrong glyph propagates everywhere.
   /ɑ/ was filled in from material supplied outside the key chart; such
   glyphs go in `SOURCE_NOTES` so the key tab explains why they have no
   tracing to compare against.
2. **Positional vowel variants.** The key annotates several vowels
   (ɪ, e, æ, aɪ) "top/bottom", and æ appears as both a cup `∪` and a cap
   `∩`. Looks like the form flips depending on placement in the block, but
   the trigger condition is unconfirmed. Currently one form per vowel; the
   second æ form is extracted as `ae_alt` and parked in the key tab's
   "in the key, not in the set" row.
3. **Punctuation.** Comma, question mark, and apostrophe are documented in
   the source key (comma sits at the bottom next to the word; apostrophe is
   treated like a vowel; question mark is centred) but are currently
   stripped rather than rendered. Canon reference text uses a comma.
4. **Stroke-level fusion.** Canon is hand-lettered so adjacent glyphs
   interlock and share edges. This butts discrete SVGs together — correct
   structure, but not fused. Would need connection points designed into
   each glyph.
5. **Two loose ends the key extraction turned up.** There is no `tʃ`
   anywhere in the key chart, yet `build_glyphs.py` draws one — it either
   came from material not in `reference/` or is an invention. And the key
   has an unlabelled wedge sitting directly above the vowel-block "null"
   mark; `CELLS` maps it to `None` (skipped) pending a source.

6. **G2P accuracy.** Rule-based, not dictionary-grade. Unstressed-vowel
   reduction isn't modelled ("metalbending" → `/m ɛ t æ l .../` rather than
   `/m ɛ t ə l .../`). Upgrade path: bundle a CMU Pronouncing Dictionary
   lookup; the ARPAbet→IPA table is already in `g2p.js` as
   `ARPABET_TO_IPA`. Until then, extend `EXCEPTIONS` or use the template's
   `ipa=` parameter.

## Testing

There's no test suite. Verification so far has been Playwright driving
headless Chromium against `file://site/index.html`, checking for console
errors and asserting glyph//block counts per tab. Worth formalising if you
keep iterating. Quick manual check — this sentence should transcribe as:

```
katara please do not be mad
/k ə t ɑ r ə/ /p l i z/ /d u/ /n ɑ t/ /b i/ /m æ d/
```

## Wiki deployment

`wiki/MediaWiki_Common.js.txt` has a placeholder URL at the top that must
be replaced with the deployed site URL before pasting into
`MediaWiki:Common.js`. Requires wiki-admin / JS-editor rights on Fandom.
