# Avatarian — the script, in one place

This is the reference for **Avatarian itself** — how the writing system
works, everything the project currently knows about it, and everything it
doesn't. It gathers what was scattered across `README.md` (architecture),
`CONTEXT.md` (rules + open questions), and `HANDOFF.md` (session history)
into one document about the script rather than the code.

- **How the tool is built and deployed** → `README.md`
- **Non-obvious code decisions and the running open questions** → `CONTEXT.md`
- **What changed session to session** → `HANDOFF.md`
- **The glyph design/lattice format** → `designs/README.md`

When this document and the code disagree, the code wins — `tools/build_glyphs.py`
is the single definition of the shipped glyph set, and `tools/glyphspec.py`
is the authority on geometry. Treat the tables here as a readable snapshot,
regenerated from those files.

---

## 1. What Avatarian is

Avatarian is the **conscript** (constructed script) introduced for the new
*Avatar: The Last Airbender* film. It is **phonetic**: it encodes IPA
*sounds*, not English letters. "Katara" is written from its pronunciation
/k ə t ɑ r ə/, and any spelling that sounds the same is written the same.

Everything in this project's pipeline is IPA-first — English is only ever an
input convenience that gets converted to IPA before anything is drawn.

This is a **community decipherment**, not official documentation. The reading
of the script below is assembled from labelled writing samples and a
hand-lettered key chart; the parts that are solid and the parts that are still
guesses are both called out.

### Credit

The reference material — the key chart, the writing samples, the structural
readings — comes from:

- **BokerBigBanana** on Avatar Wiki — <https://avatar.fandom.com/wiki/User:BokerBigBanana>
- **u/DepressionDokkebi**, "Avatarian decipherment so far" — <https://www.reddit.com/r/TheLastAirbender/comments/1v4yalr/avatarian_decipherment_so_far/>
- **u/arienzio**, "New Avatar: The Last Airbender conscript" — <https://www.reddit.com/r/neography/comments/1slqce2/new_avatar_the_last_airbender_conscript/>

Tool designed by **TechFilmer** on Avatar Wiki — <https://avatar.fandom.com/wiki/User:TechFilmer>.

---

## 2. The writing model: blocks are PAIRS, not syllables

This is the single most important structural fact, and it took a wrong model
being discarded to find it.

**Phonemes are written in strict order, two to a block, top slot then bottom
slot, with blocks running left to right.** Nothing about the layout depends on
a sound being a consonant or a vowel — a block is just the *next two sounds*
in the word.

```
please  /p l i z/    (p,l) (i,z)
at      /æ t/        (æ,t)          <- vowel on TOP
up      /ʌ p/        (ʌ,p)          <- vowel on TOP
me      /m i/        (m,i)
not     /n ɑ t/      (n,ɑ) (t,∅)
mad     /m æ d/      (m,æ) (d,∅)
wake    /w eɪ k/     (w,eɪ) (k,∅)
```

Read off a labelled writing sample — *"please do not be mad at me when you
wake up, but"* — and it holds for all twelve of its words.

### Why the old model was wrong

The earlier reading was a **syllable model**: consonants clustered on top, the
vowel beneath. It agreed with the pairing model on simple CV words like
"katara", which is why it survived so long, and disagreed on essentially
everything else. It's also what made /ɑ/ look "inverted" between "katara" and
"appa" — it wasn't inverting arbitrarily, it was landing in different *slots*
(and /ɑ/ is one of the glyphs that flips by slot; see §6).

**Do not reintroduce the syllable model.**

### The null filler

An odd number of phonemes leaves the final bottom slot empty. It is not left
blank — a **null filler** is written into it, and it is part of the spelling,
not padding. Five of the sample's words carry one (`not`, `mad`, `when`,
`wake`, `but` — every word with an odd phoneme count).

There are **two** nulls, by height (see §7). Neither is a sound. Which one is
used is picked by the null's **pairing partner**, not its own slot (§7).

---

## 3. The lattice and the geometry

Every glyph is **drawn, not traced** — constructed from geometric primitives
(arcs, straight segments, dots) on a shared grid with one stroke weight, so
the set reads as a single coherent script rather than scanned handwriting.
They are clean canonical interpretations of the key chart, not facsimiles.

The script's native design surface is a **lattice**:

| | grid | rendered box |
| --- | --- | --- |
| consonant | 5 × 5 cells | 100 × 100 |
| vowel | 5 × 4 cells | 100 × 80 (flat) |

Constants (in `tools/glyphspec.py` / `tools/build_glyphs.py`, kept in step):

- `UNIT = 16` — svg units per lattice cell.
- `SW = 9` — stroke width, every glyph, `square` caps + `miter` joins.
- `DOT = UNIT / 2 = 8` — a dot is a filled circle whose **diameter fills one
  grid cell**. A dot is the same visual weight as a stroke; this was measured
  off the /aɪ/ reference photo, where the rule and the dots beside it are the
  same thickness to the pixel. (Dots were once authored per-glyph at 6.5–8
  radius against a 9 stroke — nearly double weight, reading as beads on top of
  the writing. Don't reintroduce a per-glyph radius without a reference that
  actually shows a heavier dot. `s`/`l` size classes exist as an escape hatch;
  reach for `m` unless a source makes you.)
- Margin: the lattice is centred in its box with a 10-unit (consonant) /
  8-unit (flat vowel) margin, so a stroke on the outermost row isn't clipped.
  **This margin is drawing clearance, not writing space** — see §5.

Glyphs are **inlined into `site/js/manifest.js`** (~71 KB for the whole set),
not loaded as image files. That is deliberate: `fetch()` is CORS-blocked on
`file://` origins, so double-clicking `index.html` would fail with only
console errors; inlining also lets the wiki gadget run with no image hosting,
and lets glyphs inherit text colour via `currentColor`.

### Two geometry implementations

- `tools/glyphspec.py` — Python, **the authority**. The design format, frame
  system, curve fitting, SVG output.
- `designer/js/geom.js` — a JS **port**, for the designer's live canvas
  (round-tripping every pointer-move through the server would feel awful).

Anything the designer hands back to a human or a build script goes through the
Python. `python3 tools/check_geom.py` renders ~200 generated designs through
both and diffs them — run it after touching either file; they must not drift.

---

## 4. Height model — 9-row blocks (always on)

Sizing follows the **sound, not the slot**. A consonant is 5 units tall, a
vowel 4, and they stack flush, so a consonant-over-vowel block is **9 rows**
tall. At 52px per consonant that's 10.4px a row, so a vowel renders 41.6px.

A vowel in the *top* slot is still short — which happens whenever a word
starts with a vowel ("at", "up").

The ratio is **height only**. Vowels keep the full block width, because canon
draws them wide and flat, spanning their partner. They get that shape by
swapping to a **separately generated 100×80 drawing**, not by being squashed
at render time — so every glyph is scaled *uniformly*, stroke weight is
identical everywhere, and dots stay round. (An earlier version stretched a
square drawing with `preserveAspectRatio="none"` and patched the weight back
in CSS; it distorted everything the scale touched. Don't reintroduce it.)

> **History:** this used to be an off-by-default "Proportional heights"
> checkbox. As of the session that produced this doc, **it is the only mode** —
> the checkbox and the `avatarian-proportional` body class are gone, the
> proportional values are the base CSS, and the flat vowel SVG is always shown.
> The ratio itself has moved four times during decipherment (1:4 → 1:1 → 3:5 →
> 4:5); **4:5 is the current reading**, encoded in `FLAT` (build_glyphs.py),
> `VOWEL_GRID` (glyphspec.py), `style.css`, and the wiki CSS. Change them
> together or the flat drawings stop matching their boxes.

### Two glyphs in a block share a lattice edge

A consonant's bottom lattice line *is* the vowel's top lattice line. But each
SVG carries its clearance margin *outside* the lattice, so stacking the boxes
flush leaves both margins as a visible gap. The bottom slot is pulled up by
the sum of the two margins:

- site: `.avatarian-slot-bottom { margin-top: -9.36px }`
- wiki: `-0.225em` (keep the two in step)

The 4.5-unit C+C shrink (below) keeps that sum constant across the common
pairings, so one constant covers them.

### Block types and the gap/touch rule

Only **three** block types occur — **V-C**, **C-V**, **C-C**. A block of two
vowels (**V-V**) never happens: a null substitutes for the missing second
vowel (see §7). Within the 9-row grid (from the Session 5 design discussion;
parts still unconfirmed, marked):

- **V-C**, **3-row vowel**: rows 1–3 vowel, row 4 empty (**gap**), rows 5–9
  consonant — the empty row sits between the two glyphs, not at the block's
  top edge.
- **V-C**, **4-row vowel**: rows 1–4 vowel, rows 5–9 consonant — they
  **touch**. *(Symmetric completion of the rule above; inferred, not stated.)*
- **C-V**, **3-row vowel**: rows 1–5 consonant, row 6 empty (**gap**), rows
  7–9 vowel — they do **not** touch.
- **C-V**, **4-row vowel**: rows 1–5 consonant, rows 6–9 vowel — they
  **touch**, and should visually merge into one glyph rather than read as two
  touching shapes.
- **C-C**: working guess is the two consonants **overlap by one shared row**
  (10 rows of content in 9). *Unconfirmed — needs reference examples.*

**Resolved:** V-C blocks get the same 3-row/4-row split C-V blocks do. The
vowel always sits flush against the block's outer edge and the gap, when there
is one, falls on its inner side — so a 3-row vowel on top never leaves dead
space at the very top of the block. **C-C remains open.**

### 4-row vs 3-row vowels

A vowel is **4-row** (fills the top lattice row, connects upward) or **3-row**
(leaves the top row empty, sits with a gap). The confirmed set:

> **Confirmed 4-row set, in ARPAbet: AA, AW, EY, IH, OY, UH, UW** —
> /ɑ, aʊ, e, ɪ, ɔɪ, ʊ, u/. Every other vowel is 3-row.

⚠️ **Read those as ARPAbet codes, not file stems.** The stems do not track the
codes, and reading the list as stems flips two of the seven — in both
directions:

| ARPAbet | IPA | stem | rows |  | stem | IPA | is ARPAbet | rows |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| **UH** | ʊ | `oo` | 4 | but | `uh` | ʌ | **AH** | 3 |
| **AW** | aʊ | `au` | 4 | but | `aw` | ɔ | **AO** | 3 |

Every vowel design carries an explicit `rows`, set from the designer's row
toggle; `build_glyphs.py` reads it, and `VOWEL_4ROW_BASE` is only the fallback
for a vowel with no design. 4-row vowels carry `rows: 4` through the manifest
and get an `avatarian-4row` class in the DOM.

A 4-row vowel's ink spans lattice y **0.5–3.5**; a 3-row vowel's spans
**1.5–3.5**. `glyphspec.validate` checks the declaration against the drawing —
the top row runs y=0 to y=1, so ink resting exactly on y=1 has not entered it.

### Known consequence: C+C blocks shrink

A consonant sharing a block with another consonant gets 4.5 units instead of
5, rendering at 9/10 scale with a correspondingly lighter stroke. That follows
directly from the rule that a C+C block must total the same height as a V+C
block. It is a design consequence, not a bug.

### ⚠️ Open: the residual one-row gap

After the margin fix, a block like **T + ɑ** still shows ~8.3px — *exactly one
lattice row* — between the two inks. This is **built into the designs, not the
rendering**: the consonant's ink ends at lattice `y=4.5` (half a row above its
bottom edge) and a 4-row vowel's connecting stroke reaches only `y=0.5` (half
a row below the vowel's top edge). Half + half = one full row, even with the
lattices flush.

Closing it is a **design-convention decision**: move a 4-row vowel's
connecting edge to `y=0`, or a consonant's bottom edge to `y=5`, then re-promote
the affected designs. Full write-up under "THE OPEN ISSUE" in `HANDOFF.md`.

---

## 5. Sizing lives in CSS (two stylesheets, kept in step)

The same `render.js` drives both the standalone site and the wiki gadget, so
sizing is duplicated and must match:

- `site/css/style.css`
- `wiki/MediaWiki_Common.css.txt`

The site sizes in px (52 / 41.6); the wiki sizes in `em` (1.25em / 1em) so
Avatarian scales with the surrounding wiki text. Both encode the same 5:4
ratio, the same margin-collapse, and the same "show the flat vowel SVG" rule.

---

## 6. Orientation — some glyphs flip by slot

A glyph is drawn **once**, in its top-slot form. Some glyphs mirror
top-to-bottom when they land in a bottom slot; `render.js` applies a
`scaleY(-1)` (class `avatarian-flipped`) rather than shipping a second
drawing. **Most glyphs do not flip** — this is a list, not a blanket rule.

`FLIPS = {æ, ɑ, l, ɪ, e, aɪ}`

| sound | evidence |
| --- | --- |
| æ  | "at" (top, cup ∪) vs "mad" (bottom, cap ∩) |
| ɑ  | "appa" (top, proper Y) vs "katara" (bottom, stem up) |
| l  | "please" (bottom); the key chart draws both orientations |
| ɪ  | "metalbending" |
| e  | "Aang" (top) vs "wake" (bottom) |
| aɪ | key chart (rule above, dots below) vs "fire" (dots above the rule) |

/aɪ/ is the cleanest case: "fire" is /f aɪ ə r/, so aɪ is the second phoneme
and lands in a **bottom** slot, where canon writes it as the vertical mirror
of the chart's citation form. Both forms attested in known slots — that is the
bar for adding anything to `FLIPS`.

**Why a glyph flips (Session 5, unconfirmed as a general rule):** a flipping
glyph's connecting stem should point toward whatever it touches. For **ɪ**: in
a V-C block (vowel on top) the stem points down toward the consonant below; in
a C-V block (vowel on bottom) it points up toward the consonant above. Whether
"stem points at neighbour" generalises to every `FLIPS` entry or is specific
to ɪ is unverified — check each entry against it before assuming.

**/s/ is deliberately NOT in the list**, and is why the `$`/`%` override
exists. "students" writes *both* of its /s/ in top slots and uses a different
orientation for each (∨ first, ∧ last), so no slot rule can select them. Spell
those `S$` and `S%`. Any rule for /s/ must explain all observed cases at once,
not just one.

---

## 7. The nulls

Two fillers, distinguished by height. **Neither is a sound.**

| name | shape | height | manifest type | design type | manifest key |
| --- | --- | --- | --- | --- | --- |
| `null_v` | rounded ∪ | vowel-height (3-row) | `null` | `mark` | `∅` (code `0`) |
| `null_c` | squared ∪ | consonant-height (5-row) | `null_consonant` | `mark_consonant` | `∅c` |

**Which null is used is decided by the pairing PARTNER, not the empty slot's
own height** (confirmed, Session 5):

- a **vowel** paired with a null takes the **5-row** (consonant-height) null;
- a **consonant** paired with a null takes the **3-row** (vowel-height) null.

This is what `render.js` does (`nullFor`): any null, whether auto-inserted
into a trailing empty slot or typed as `0` mid-word, takes its height from
the sound beside it. It is also what keeps every block **nine rows** tall —
4 + 5 for a vowel and its null, 5 + 4 for a consonant and its null. The
renderer used to write the cup into every empty slot regardless, which left
a vowel-plus-null block eight rows tall.

The two differ by **height class**, which is what `type` means in a design:
`mark_consonant` takes a consonant's 5×5 lattice, `mark` a vowel's 5×4 (see
§3). Routing both through the vowel frame — which is what happened before
the split — draws the taller null on the wrong lattice.

> **History / correction:** these were called `glot_v` and `glot`, and `glot`
> was mistakenly documented as **/ʔ/, a glottal stop**. It never was — it is
> just the taller null filler. The `Q` code for /ʔ/ was removed from the
> input syntax. If you find "glot", "⊓ = /ʔ/", or "Q → ʔ" anywhere, it is
> stale — including any description of `null_c` as a ⊓ gate, which it is not.
> The design files were renamed to `null_c.json` / `null_v.json` with
> matching fields.

---

## 8. The glyph inventory

Snapshot of `tools/build_glyphs.py`. **CODE** is the ARPAbet code you type in
the app; **STEM** is the SVG file stem in `site/assets/glyphs/`. Regenerate
this table from the build script rather than trusting it blind.

### Consonants (5×5)

| IPA | CODE | stem | status | notes |
| --- | --- | --- | --- | --- |
| p  | P  | p  | drawn | |
| b  | B  | b  | drawn | |
| t  | T  | t  | drawn | |
| d  | D  | d  | drawn | |
| k  | K  | k  | drawn | |
| g  | G  | g  | drawn | |
| m  | M  | m  | drawn | |
| n  | N  | n  | drawn | |
| ŋ  | NG | ng | drawn | |
| f  | F  | f  | drawn | designed from a reference photo (bowed X, high crossing) |
| v  | V  | v  | drawn | |
| θ  | TH | th | drawn | |
| ð  | DH | dh | drawn | |
| s  | S  | s  | drawn | flips, but NOT by slot — use `S$`/`S%` (see §6) |
| z  | Z  | z  | drawn | |
| h  | HH | h  | drawn | |
| w  | W  | w  | drawn | |
| j  | Y  | y  | drawn | |
| r  | R  | r  | drawn | |
| l  | L  | l  | drawn | **flips** by slot |
| tʃ | CH | ch | **placeholder** | was drawn from no source; demoted |
| dʒ | JH | j_dz | **placeholder** | |
| ʃ  | SH | sh | **placeholder** | |
| ʒ  | ZH | zh | **placeholder** | e.g. the /ʒ/ in "treasure" |
| x  | —  | kh | **placeholder** | ARPAbet has no /x/ code |

### Vowels (5×4)

| IPA | CODE | stem | status | flips | 4-row | notes |
| --- | --- | --- | --- | --- | --- | --- |
| i  | IY | i     | drawn | | | |
| ɪ  | IH | ih    | drawn | ✓ | ✓ | |
| e  | EY | ei    | drawn | ✓ | ✓ | alias `eɪ`/`ej` |
| ɛ  | EH | eh    | drawn | | | |
| æ  | AE | ae    | drawn | ✓ | | |
| ʌ  | AH | uh    | drawn | | | four dots, two-by-two (not four rules) |
| ə  | AX | schwa | drawn | | | recurve **descends** L→R, two dots |
| u  | UW | uu    | drawn | | ✓ | |
| oʊ | OW | ow    | drawn | | | |
| ɔ  | AO | aw    | drawn | | | from source **outside** the key chart |
| ɑ  | AA | ah    | drawn | ✓ | ✓ | from source **outside** the key chart |
| aɪ | AY | ai    | drawn | ✓ | | cleanest attested flip pair |
| aʊ | AW | au    | drawn | | | |
| ɜ  | ER | nurse | drawn | | | descending recurve, dot below-left |
| ʊ  | UH | oo    | **placeholder** | | | the vowel in "good" |
| ɔɪ | OY | oi    | **placeholder** | | | the vowel in "toy" |

Notes worth holding onto:

- **The "4-row" column above may lag the designs** — `rows` now lives in
  `designs/<name>.json` and the build reads it from there. The confirmed set
  is ARPAbet AA, AW, EY, IH, OY, UH, UW; see §4 on why that must not be read
  as file stems.
- **/ə/ vs /ʌ/ were once backwards.** /ə/ (schwa) is the recurve-with-two-dots
  and its recurve *descends* L→R; /ʌ/ is the four dots, two-by-two. The set had
  them swapped and /ʌ/ drawn as four short *rules* until the key was traced.
  Don't swap them back on the strength of older material.
- **/ɜ/ is not ARPAbet's ER.** ARPAbet's ER is r-coloured /ɝ/, but `g2p.js`
  emits /ɜ/ with /r/ as a *separate* segment ("bird" → `ɜ r`), so the vowel
  carries no r-colouring. Named `nurse` for its lexical set, the way ə is
  `schwa`. `ɝ`/`ɜr` are accepted as aliases.
- **/ɑ/ and /ɔ/ have no key tracing** — they came from material outside the
  chart, so they're listed in `SOURCE_NOTES` and the key tab explains why they
  have nothing to compare against.

### Placeholders (no glyph anywhere yet)

**/x/** is the only sound still rendering as a dashed "?" box. Draw it in the
designer and press **ship it** to fill it in.

The other six — tʃ, dʒ, ʃ, ʒ, ʊ and ɔɪ — have since been drawn and shipped
from **source material outside the key chart**. That is why they appear
nowhere in the chart and have no tracing to compare against, and they are
listed in `SOURCE_NOTES` alongside `/ɑ/` and `/ɔ/` so the key tab says so.
Nothing in the set is invented: /x/ is still a placeholder precisely because
no source for it has been found.

---

## 9. The sounds syntax (how you type it)

The app is one page: type English and convert, or type sounds directly into
the **sounds box**, which is what actually gets drawn and is always editable
(`g2p.js` is rule-based and gets words wrong — you fix the sounds, not the
English). It is **ASCII-first**, typeable on a plain QWERTY keyboard.

- **ARPAbet codes** are the primary spelling: `K AH T AA R AH`. Case-insensitive.
  Extended with `AX` (schwa) and `NUL`, which ARPAbet has no code for.
- **IPA is accepted too**, plus aliases: `eɪ`→`e`, `ɝ`/`ɜr`→`ɜ`, `ɑː`→`ɑ`,
  `iː`→`i`, `uː`→`u`.
- **Sounds are separated by spaces, words by `/`.**
- **`0`** (or `_`, `-`) is the `∅` empty-slot filler.
- **`$` / `%`** suffixes force a glyph's top or bottom orientation (`S$`),
  for glyphs whose variant rule isn't known — currently only /s/.
- **`(parentheses)`** caption a word instead of being read as sounds:
  `M EH T AX L 0 B EH N D IH NG (metalbending)`. Converting from English emits
  these automatically, and since the label is part of the text it survives
  hand-editing.

The drawing updates live as you type (debounced 120ms) — no draw button.
**Insert sounds** *appends* the conversion rather than replacing the box, so a
line can be assembled a piece at a time. Anything mapping to no glyph is named
in a warning rather than silently dropped. The glyph reference doubles as a
palette — click a cell to append its code.

---

## 10. Open decoding questions

These are the live unknowns about the *script*, roughly by priority. Fuller
notes in `CONTEXT.md`.

1. **/x/ has no glyph** (§8), and six sounds that had none were drawn and
   shipped without a recorded source — provenance needed, not guesses.

2. **Mid-word nulls.** Nulls appear inside words, not only at odd ends, and
   the renderer can't currently produce these. Two confirmed spellings:
   ```
   students      (s,t)(u,∅)(d,ə)(n,t)(s,∅)
   metalbending  (m,ɛ)(t,ə)(l,∅)(b,ɛ)(n,d)(ɪ,ŋ)
   ```
   Each divides into **two units**, paired independently, each padded with a
   trailing null if odd. **What determines the split is unknown** — it's not
   morpheme boundaries (`stu|dents` isn't one) and not syllables (would force
   extra nulls canon doesn't have). Needs more multi-null words.

3. **"appa" breaks the pairing model.** Canon writes it as **three** blocks
   (Y, /p/, Y each over a null) where pairing predicts two, `(ɑ,p)(ɑ,∅)`. Not
   explained by phoneme count ("not" is also three and pairs normally) or by
   intervocalic consonants ("hurry", "really" render fine). Unresolved; the
   renderer does not special-case it.

4. **/s/ orientation** (§6) — rotates, but not by slot. Four observations
   (both /s/ in "students", plus "some") that no single slot rule satisfies.

5. **The remaining positional variants.** æ, l, e are settled (§6). ɪ and u
   are numbered as pairs in the source but only one form each is drawn, so
   they render identically in both slots. Needs words placing that vowel at
   both an even and an odd phoneme index.

6. **One unassigned mark in the key** — an unlabelled wedge sitting directly
   above the vowel-block null; `CELLS` maps it to `None` (skipped) pending a
   source.

7. **Punctuation.** Comma, question mark, and apostrophe are documented in the
   key chart (comma at the bottom next to the word; apostrophe treated like a
   vowel; question mark centred) but are currently stripped, not rendered.

8. **G2P accuracy.** Rule-based, not dictionary-grade. Unstressed-vowel
   reduction isn't modelled ("metalbending" → `/m ɛ t æ l …/` where canon
   reduces to `/m ɛ t ə l …/`). Upgrade path: bundle a CMU Pronouncing
   Dictionary; the ARPAbet→IPA table is already in `g2p.js`.

---

## 11. What differs from canon (and probably always will at v1)

In the reference, glyphs are hand-lettered so adjacent strokes **interlock and
share edges**, and blocks are visibly skewed and organic. This project renders
each glyph as a discrete vector butted against its neighbours — so it
reproduces the *structure* correctly (the pairing, the heights, the flips) but
not the stroke-level fusion. Getting that would mean redrawing every glyph
with defined connection points: a genuine type-design project, a v2, not a
layout tweak.
