# Context for continuing this project

Read `README.md` first for architecture and deployment. This file covers
what a fresh session needs to know that isn't obvious from the code.

## Credit

Avatarian is a community decipherment. The reference material this tool
encodes — the key chart, the writing samples, and the structural readings —
comes from:

* **BokerBigBanana** on Avatar Wiki —
  <https://avatar.fandom.com/wiki/User:BokerBigBanana>
* **u/DepressionDokkebi**, "Avatarian decipherment so far" —
  <https://www.reddit.com/r/TheLastAirbender/comments/1v4yalr/avatarian_decipherment_so_far/>
* **u/arienzio**, "New Avatar: The Last Airbender conscript" —
  <https://www.reddit.com/r/neography/comments/1slqce2/new_avatar_the_last_airbender_conscript/>

**Tool designed by TechFilmer** on Avatar Wiki —
<https://avatar.fandom.com/wiki/User:TechFilmer>.

The code here renders that decipherment work; the script itself is not this
project's research. Keep the credit in the site footer, the `wiki/` files,
and here.

## What this is

A static toolkit for **Avatarian**, the conscript introduced for the new
Avatar: The Last Airbender film. It converts English → IPA → Avatarian
glyphs, renders them as paired blocks, and plugs into Avatar Wiki
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

**Caching will lie to you.** Over `file://`, `manifest.js` and `style.css`
are cached hard enough that a rebuilt glyph or an edited rule silently
doesn't appear, and the stale page looks exactly like a change that didn't
work. `.claude/launch.json` defines an `avatarian-site` server on port 8791
for this reason — but note even that caches, so verify a change actually
landed before concluding it failed. Two reliable checks: read the built SVG
straight off disk, or in the console
`fetch('css/style.css',{cache:'reload'})`.

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
- **This is not a font file.** Canon composes sounds into blocks
  (closer to Hangul than an alphabet), which no font format handles well,
  so composition happens in the DOM.
- **/ə/ is the recurve with two dots; /ʌ/ is the four dots, two by two.**
  The set had these two backwards until the key was traced and compared,
  so don't swap them back on the strength of older material. /ʌ/ was
  drawn as four short *rules* for a while; the key tracing shows dots.
  /ə/'s recurve **descends** left to right — it was drawn rising, which
  is the mirror of the reference.

## Layout rule (derived from canon)

**Blocks are pairs, not syllables.** Phonemes are written in strict order,
two to a block, top slot then bottom slot, blocks left to right. Whether a
sound is a consonant or a vowel has no bearing on where it goes.

Read off the labelled writing sample "please do not be mad at me when you
wake up, but"; holds for all twelve words:

```
please /p l i z/  (p,l)(i,z)      at  /æ t/    (æ,t)    <- vowel on TOP
not    /n ɑ t/    (n,ɑ)(t,∅)      up  /ʌ p/    (ʌ,p)    <- vowel on TOP
mad    /m æ d/    (m,æ)(d,∅)      me  /m i/    (m,i)
```

Do not restore the old syllable model (consonants clustered on top, vowel
beneath). It agreed with canon on CV words like "katara", which is why it
survived so long, and disagreed on everything else. It is also what made
/ɑ/ look inverted between "katara" and "appa" — different slots, and /ɑ/
is one of the glyphs that takes a different form in each.

An odd phoneme count leaves the last bottom slot empty and the **∅ filler**
(`glot_v`, the ∪ cup) is written into it. It is part of the spelling — five
of the sample's words carry it. Distinct from `glot`, the ⊓ gate, which is
/ʔ/ and a real sound.

**Orientation: SOME glyphs mirror top-to-bottom.** A glyph is drawn once,
in its TOP-slot form. Those listed in `FLIPS` (`build_glyphs.py`) are
mirrored vertically when they land in a bottom slot — `avatarian-flipped`
in `render.js`, a `scaleY(-1)` in the CSS. Everything else keeps one
orientation in both slots.

| flips | evidence |
| --- | --- |
| æ | "at" (top, cup ∪) vs "mad" (bottom, cap ∩) |
| ɑ | "appa" (top, proper Y) vs "katara" (bottom, stem up) |
| l | "please" (bottom); the key chart draws both orientations |
| ɪ | "metalbending" |
| e | "Aang" (top) vs "wake" (bottom) |

Two things to hold on to:

* **One drawing per glyph.** `ae_alt`, `l1`/`l2`, `ih_alt`, `ah_alt`,
  `ei_alt`, `s_alt` are gone — draw the top form and the bottom comes
  free. The chart's second /l/ and /æ/ cells are still traced as `l_b`
  and `ae_b`, tied to the same sound.
* **Don't generalise `FLIPS` to every glyph.** That was tried and is
  wrong: most glyphs hold one orientation. Only add a sound on the
  strength of a word that actually shows it flipped.

**/s/ is not slot-driven** and is why the `$`/`%` override exists:
"students" writes both of its /s/ in TOP slots with a different
orientation for each. Spell those `S$` and `S%`.

**Heights are a toggle, currently OFF.** Every slot renders 52×52 by
default. The "Proportional heights" checkbox adds `avatarian-proportional`
to `<body>`, which takes vowels to 52×31 — the script's native units,
consonants 5 tall against vowels 3. It is off because the rule still has
unresolved nuance; don't make it the default without new evidence.

The ratio has moved three times now (1:4 → 1:1 → 3:5 → optional), so don't
"fix" it back by accident. The key chart's "Consonants 3/4 height, Vowels
1/4 height" note describes bands inside a hand-lettered block, not a scale
factor — every glyph is drawn on one 100×100 grid, so scaling a mark down
shrinks the whole thing, and at 1:4 vowels went too faint to read.

In proportional mode **nothing is stretched**. Vowels get the wide-flat
shape by swapping to a separate 100x60 drawing, generated in
`build_glyphs.py` by squashing the geometry only — path coordinates and arc
radii scale in y, dots keep their radius and merely move, and stroke-width
is untouched. Both drawings ship in the manifest (`svg` and `flat`) and CSS
shows one; every glyph is then scaled **uniformly**, height from the slot
and width from its own viewBox aspect.

That replaced a `preserveAspectRatio="none"` squash plus a CSS stroke-width
fudge, which distorted everything the scale touched: dots became ellipses,
and horizontal strokes thinned by the y-scale while verticals kept the
x-scale. Don't reintroduce it. Two invariants worth keeping, both
measurable in the browser: for every glyph `sx === sy`, and a vowel's
rendered stroke is the same in either height mode (4.68px at the default
size). The proportional block is 83.2px so a unit is exactly 10.4px, and
the default mode's 1px slot overlap is zeroed there — handed to the flex
algorithm it would skew the 5:3 split by ~1% and with it the scale.

**Known consequence:** a consonant sharing a block with another consonant
gets 4 units rather than 5, so it renders at 4/5 scale with a
correspondingly lighter stroke (3.74px vs 4.68px). That follows directly
from the rule that a C+C block must total the same height as a V+C block.
It is a design question, not a bug.

## Open work, roughly in priority order

1. **Seven sounds have no glyph** and render as dashed "?" boxes:
   tʃ, dʒ, ʃ, ʒ, x, ʊ, ɔɪ. The reference key has visible blanks next
   to "good" and "toy". Needs source material, not guessing — a wrong
   glyph propagates everywhere. /ɑ/ and /ɔ/ were filled in from material
   supplied outside the key chart; such glyphs go in `SOURCE_NOTES` so the
   key tab explains why they have no tracing to compare against.
2. **The remaining positional variants.** æ, /l/ and /e/ are done (see the
   layout section). ɪ and u are numbered as pairs in the source but only
   one form each is drawn, so they render identically in both slots. To
   fill one in, you need sample words putting that vowel in each slot —
   i.e. one where it is at an even index in the phoneme sequence and one
   where it is odd.

   **/s/ rotates and the trigger is NOT slot position.** "students"
   writes *both* of its /s/ in TOP slots and uses a different form for
   each — ∨ first, ∧ last — so no slot rule can select them. "some" also
   has /s/ in a top slot and uses ∧. So the general mirror-by-slot rule
   produces the wrong orientation for at least one of them, and `S$` /
   `S%` has to spell it out. Do not invent a rule for /s/ without one
   that explains all four observations.

3. **appa is a genuine exception to the pairing model.** Canon writes it
   as three blocks — Y, /p/, Y each over a null — where pairing predicts
   two, `(ɑ,p)(ɑ,∅)`. It is not about phoneme count ("not" is also three
   and pairs normally) and not about intervocalic consonants ("hurry" and
   "really" render correctly with the plain model). Unresolved; the
   renderer does not special-case it.

4. **Nulls appear mid-word, not only at odd ends.** The current model
   only inserts a null to fill a trailing empty slot, so it cannot
   produce these. Two confirmed spellings:

   ```
   students      s$ t u ∅ d ə n t s ∅     (s,t)(u,∅)(d,ə)(n,t)(s,∅)
   metalbending  m ɛ t ə l ∅ b ɛ n d ɪ ŋ  (m,ɛ)(t,ə)(l,∅)(b,ɛ)(n,d)(ɪ,ŋ)
   ```

   Both words divide into exactly **two units**, each paired
   independently, each padded with a trailing null if it has an odd
   phoneme count:

   ```
   [s t u] [d ə n t s]        3 odd -> null,  5 odd -> null
   [m ɛ t ə l] [b ɛ n d ɪ ŋ]  5 odd -> null,  6 even -> none
   ```

   **What determines the split is unknown.** It is not morpheme
   boundaries: "metal|bending" is one, but "stu|dents" is not (and
   "student|s" would put the null after /t/, which is wrong). It is not
   syllables either: metalbending's four syllables would force nulls
   after /n/ and /ŋ/ too, and canon has neither — its (n,d) pairs
   straight across the ben|ding boundary. Needs more multi-null words
   before implementing anything.

5. **The UI is one page, and the input is ASCII.** No tabs: English box,
   sounds box, output, then a glyph reference that doubles as the palette
   (clicking a cell appends its code). The sounds box takes ARPAbet codes
   so the whole script is typeable on QWERTY — `S$ T UW 0 D AX N T S 0` —
   with IPA accepted as an alternative. `EXTRA_CODES` in `index.html`
   covers sounds ARPAbet has no code for (`AX`, `Q`, `NUL`).

   `render.js` accepts a `$` (top form) or `%` (bottom form) suffix on any
   symbol. That is the escape hatch for glyphs whose variant rule isn't
   known — currently only /s/.

   The key tracings are hidden behind a checkbox rather than overlaid.

   **The sounds box is live and additive.** It redraws on input
   (debounced 120ms), so there is no draw button. "Insert sounds"
   *appends* the English conversion rather than replacing the box, so a
   line can be assembled a piece at a time.

   **Captions live in the text**: anything in `(parentheses)` inside a
   word labels that word instead of being read as a sound, and the
   converter emits them — `P L IY Z (please)`. Because the label is part
   of the source text it survives hand-editing, which an earlier
   positional label array did not.

   Layout is two columns with the working column **sticky**, so the
   sounds box and the drawing stay on screen while the long glyph
   reference scrolls. Below 900px it stacks and the sticky is dropped,
   where it would otherwise eat the viewport.

   **Colours all go through CSS variables** (`--ink`, `--paper`,
   `--surface`, …) so the dark theme can swap the palette wholesale.
   Don't reintroduce hardcoded hex values. Glyph SVGs use `currentColor`
   and inherit `--ink`, so they follow the theme with no change to the
   generated manifest. The toggle has three states — auto (follows the
   OS), light, dark — and only an explicit choice is persisted, so "auto"
   keeps tracking the system setting.
6. **Punctuation.** Comma, question mark, and apostrophe are documented in
   the source key (comma sits at the bottom next to the word; apostrophe is
   treated like a vowel; question mark is centred) but are currently
   stripped rather than rendered. Canon reference text uses a comma.
7. **Stroke-level fusion.** Canon is hand-lettered so adjacent glyphs
   interlock and share edges. This butts discrete SVGs together — correct
   structure, but not fused. Would need connection points designed into
   each glyph.
8. **Loose ends the key extraction turned up.** `tʃ` **was** drawn, but
   no source for it was ever found in any reference material — it was an
   invention indistinguishable from the sourced glyphs, so it is now a
   placeholder. Restore it only against a real source. The key also has
   an unlabelled wedge sitting directly above the vowel-block "null"
   mark; `CELLS` maps it to `None` (skipped) pending a source — it is the
   one traced mark still unassigned.

9. **G2P accuracy.** Rule-based, not dictionary-grade. Unstressed-vowel
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
