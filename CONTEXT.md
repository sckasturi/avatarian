# Context for continuing this project

Read `README.md` first for architecture and deployment. This file covers
what a fresh session needs to know that isn't obvious from the code.

## Credit

**See `AVATARIAN.md` § Credit** — the one place credits are
maintained. It covers the decipherment sources, the tool's author and
the pronunciation dictionary, and notes the two public-facing copies
(the site footer and the wiki files) that must stay in step with it.

## What this is

A static toolkit for **Avatarian**, the conscript introduced for the new
Avatar: The Last Airbender film. It converts English → IPA → Avatarian
glyphs, renders them as paired blocks, and plugs into Avatar Wiki
(Fandom) via an `{{Avatarian|k uh t ah r uh|Katara}}` template (or
`{{Avatarian|en=word}}` to auto-convert). No server, no build step, no
dependencies.

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

## Designing a glyph (the lattice, and designs/)

Editing path coordinates by hand is a bad way to work out what a shape
*is*, which is why several glyphs stayed wrong for so long. `designer/`
is a second, local-only site for that part:

```bash
python3 tools/designer_server.py     # http://localhost:8792/
```

A character is drawn on the script's **native lattice** — 5×5 cells for a
consonant, 5×4 for a vowel — with the key tracing and the currently-drawn
glyph as underlays. Each glyph autosaves to `designs/<name>.json`.

**You brush it; the tool reads it.** The normal way in is the brush:
draw the shape freehand in one drag and `designer/js/fit.js` works out
what it was — corners snapped to lattice points, straight runs left
straight, curves fitted as real circular arcs (snapped to exact quarter
and half circles), a small scribble read as a dot, a gesture that returns
to its start closed. Three tidiness levels (close / normal / clean) are
re-readable on a selected stroke with `R`, always from the raw gesture.
Node-by-node drawing still exists in the "by hand" tray for fixing
something the fit read wrong, but it isn't the workflow.

**"paste in…"**, by the output tabs, takes back any of the three things
the panel hands out — a design JSON, an SVG, or a `build_glyphs.py`
entry — so a letter that is nearly right can be the baseline for the
next one. The **mirror** toggles (`↔` left–right, `↕` top–bottom) in the
paste box reflect the incoming shape as it is loaded — the fastest way to
start from a mirror pair (e.g. copy /æ/ → paste with ↕ → get its
bottom-slot cap). This used to cite /ə/ → /ɜ/, which is exactly the
mistake that cost the project two sessions: a top-to-bottom mirror is
not a different LETTER, it is the same letter in the other slot, and ə
and ɜ turned out to be one glyph. A design JSON is already lattice data and comes in untouched;
an SVG or a Python entry is drawing coordinates, so it is sampled and
fitted like a brush stroke. Nothing is rescaled across grids: a
consonant shape on a vowel's shorter lattice hangs off the bottom and
the problems panel says so, which beats squashing it silently.

**In-place mirror** (`⇄` / `⇅` in the toolbar, or `Shift+H` /
`Shift+V`) reflects the current design without reloading — undoable with
`⌘Z`. Both mirror paths use `Importer.mirror()`, which negates arc bulge
on single-axis reflections (handedness flip) but preserves it on
dual-axis (180° rotation).

**"use it"**, next to the *current glyph* underlay, starts a design from
the glyph the set already ships rather than a blank lattice. It samples
that SVG back into a gesture and puts it through the fitter, rather than
transcribing it command by command — transcribing would carry the old
drawing's off-lattice coordinates and hand-tuned cubics straight into
the design, and those are exactly what the lattice exists to replace.

The fitter is an **input method, not a second geometry system**. It
writes ordinary `line`/`arc` segments in the format below, so the
exporter, `glyphspec.py` and the parity check are all untouched by it
and it has no Python counterpart. It also stores the raw gesture on the
shape as `trace`, so a stroke can be re-read at a different tidiness
(`R`) without compounding one fit on top of another; `glyphspec.py`
ignores the key.

**A design records intent, not geometry.** Which lattice points a stroke
visits; whether each segment is straight, a circular arc, or part of a
smooth run. Everything else — curve fitting, stroke weight, margins, the
vowel's two heights — is applied by `tools/glyphspec.py` at render time,
so the drawing system can be changed once and every glyph follows,
instead of 40 paths needing re-authoring.

The lattice maps onto the existing boxes exactly, which is why it fits:
5×5 at 20 svg units a cell is the 100×100 consonant box, and 5×4 is the
100×80 flat box vowels ship. **Vowels are drawn once, in their
native 5×4 form**; the square form used by equal-height mode is the
stretched one and is derived, so there is no second drawing to keep in
step. Ink sits at 16 units a cell inside a 10-unit margin, so a stroke on
the outermost row isn't clipped by the viewBox.

**The live preview is the product, not a copy of it.** The designer
links `site/css/blocks.css` and loads `site/js/render.js`, `g2p.js` and
`sounds.js` over a read-only `/site/` route on its own server, then
swaps the glyph being edited into `window.AVATARIAN_GLYPHS` and calls
`renderAvatarian()` exactly as `index.html` and the wiki gadget do. So
"in a block" and "in a word" are laid out by the code that lays out the
real thing. The SVG swapped in is the one `POST /api/render` returns,
i.e. `glyphspec.py`'s, not the canvas port's.

That is why `blocks.css` and `sounds.js` exist as separate files at all:
three surfaces have to agree on block layout and on what `AX` or `S$`
means, and three copies would drift. Don't fold them back into
`style.css` / `index.html`.

Promotion into the shipped set is still **deliberate**, but it is a
button rather than a copy-paste:

```bash
python3 tools/designs_to_svg.py --report      # what's drawn, what isn't
python3 tools/designs_to_svg.py m --python    # a build_glyphs.py entry
python3 tools/promote.py m --dry-run          # what shipping would change
python3 tools/promote.py m                    # write it in and rebuild
python3 tools/promote.py --all --dry-run      # which glyphs differ at all
python3 tools/promote.py --all                # ship every one that does
```

`tools/promote.py` writes the entry into the right dict in
`build_glyphs.py` (in the layout a human would use — `glyphspec.to_python`
already emits it that way), drops the name from `PLACEHOLDERS` if it was
there, and runs both build scripts. `build_glyphs.py` stays the single
definition of what ships; what changed is who types it.

Two guards worth keeping:

* **Placeholders take two presses.** A sound with no symbol in any
  reference material is refused unless `--force` / `allowInvented`.
  A drawing of one is an invention that then looks exactly as
  authoritative as the sourced glyphs — which is how /tʃ/ shipped on
  nothing. `--all` skips them entirely, and several of them *do* have a
  design drawn, so this is not hypothetical.
* **A design with no matching sound is refused**, so a stray file can't
  ship as a dead entry.
* **`ship all…` takes two presses**, and the first is the useful one: it
  lists which glyphs would change and writes nothing. A good number of
  designs have drifted from the glyph they ship, and which direction is
  right is a decision. `promote_all` edits every entry against the
  running source and rebuilds once at the end, so a failure part-way
  can't leave the tree half-built.

Comment lines above an entry are regenerated from the design's `notes`
when it has any and left alone when it doesn't — so a note written in
the designer lands beside its shape, and a comment hand-written in
`build_glyphs.py` isn't eaten by a design with nothing to say.

**Two implementations of the same geometry.** `designer/js/geom.js` is a
port of `tools/glyphspec.py`, because round-tripping every pointermove
through the server would make dragging a node feel awful. Anything the
designer hands back — the SVG, the Python snippet — comes from the
server, so the Python is always the authority. `python3
tools/check_geom.py` renders ~200 generated designs through both and
diffs them; run it after touching either file. Don't let them drift.

**`type` is a HEIGHT CLASS, not a part of speech.** `glyphspec.TALL_KINDS`
= `{consonant, mark_consonant}` take the 5×5 lattice, the 100×100 box and
no flat form; `vowel` and `mark` take 5×4 and ship flat as well. The two
nulls differ on exactly this — the rounded ∪ is vowel-height (`mark`), the
squared ∪ consonant-height (`mark_consonant`) — and before the split every
mark was routed through the vowel frame, so designing `null_c` drew it on
the wrong lattice and gave it a flat form it should not have. The sound
list files by a separate `group` field, so both still read as "marks".

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
- **A dot is the same weight as a stroke.** `DOT = SW / 2`, derived so
  the two can't drift, and the designer's `m` size class is the same
  thing. Confirmed against the reference: in the /aɪ/ photo the rule and
  the dots either side of it are the same thickness to the pixel. Dots
  used to be authored at 6.5, with several at 7 and 8, against a stroke
  of 9 — up to nearly twice the weight, reading as beads sitting on the
  writing rather than part of it. Don't reintroduce a per-glyph radius
  without a source that actually shows a heavier dot.
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

**Pairs, but never across a syllable boundary.** Sounds are taken two at
a time *within one syllable*; where a syllable ends the block ends, and a
null holds the leftover slot open. Syllables divide by **maximum onset**
— a consonant, or a cluster English allows at the start of a syllable,
goes with the vowel that *follows* it:

```
found    f aʊ n d             /nd/ closes one syllable      one block
panda    p æ n ∅ d ə          pan-da: the same pair, split  two
free     f r i ∅              /fr/ opens one syllable       one block
academy  ə ∅ k æ d ə m i      a-ca-de-my
```

Read off 255 attested spellings, this reproduces 234 of them exactly,
nulls and all, from the sounds alone. `padToBlocks` in `g2p.js`; full
statement in `AVATARIAN.md` §5. Before it, 45 of the 51 attested
mid-word nulls had no account at all.

Note `festival` is *fe-sti-val*, not *fes-ti-val*: maximum onset is
phonological, not dictionary hyphenation, and that is why its /s/ and /t/
share a block. Reasoning from hyphenation is what kept this rule wrong
for two sessions.

An odd phoneme count leaves the last bottom slot empty and the same
**null filler** is written into it. It is part of the spelling — five of
the sample's words carry it. There are two nulls, `null_v` (a rounded ∪)
and `null_c` (a squared ∪, type `null_consonant`). **Neither is a sound.**
(Session 4 rename: these were `glot_v`/`glot`, and `glot` was mistakenly
documented as /ʔ/, a glottal stop — it never was.)

**Which null is used is picked by what it's paired with**, not by the
null's own height class: **a vowel paired with a null takes the 5-height
null; a consonant paired with a null takes the 3-height null.** Implemented
in `render.js` as `nullFor`, and applied to any null — the one auto-inserted
into a trailing empty slot and one typed as `0` mid-word alike, since `0`
means "a null" and the sound beside it says which. It is also what keeps a
block nine rows tall whatever is in it; the renderer used to write the cup
everywhere, leaving vowel-plus-null blocks eight rows tall.

**Orientation: SOME glyphs mirror top-to-bottom.** A glyph is drawn once,
in its TOP-slot form. Those listed in `FLIPS` (`build_glyphs.py`) are
mirrored vertically when they land in a bottom slot — `avatarian-flipped`
in `render.js`, a `scaleY(-1)` in the CSS. Everything else keeps one
orientation in both slots.

`FLIPS_BASE` is **æ ɑ l ɪ e aɪ ə**, and every one of them turns on the
slot alone:

| flips by slot | evidence |
| --- | --- |
| æ | "at" (top, cup ∪) vs "mad" (bottom, cap ∩) |
| ɑ | "appa" (top, proper Y) vs "katara" (bottom, stem up) |
| l | "please" (bottom); the key chart draws both orientations |
| ɪ | "metalbending" |
| e | "Aang" (top) vs "wake" (bottom) |
| aɪ | key chart (rule above, dots below) vs "fire" (dots above the rule) |
| ə | one letter with ɜ; `nurse` was its top form and `schwa` its bottom |

**But the slot is not the only thing that turns a glyph, and that is why
this list never quite fit.** Two rules were read off the corpus in
session 11 and are in `render.js`, not in `FLIPS`:

* **The approximants turn inside a CLUSTER.** /r l w j/ — exactly the
  English approximants, and no other consonant — mirror in the bottom of
  a block that holds **two consonants**, 28 times against 1. Under a
  vowel they stay upright: /r/ is plain in all six such blocks (*are,
  ear, fire, choir, organic, warrior*). Of seventeen consonants ever seen
  in a bottom slot, those four are the only ones that ever mirror.
  `TURNS_IN_CLUSTER` is `{r, j, w}` — **`l` is deliberately left in
  `FLIPS` instead**, because its evidence under a vowel is mixed (2
  mirrored against 3 plain) and moving it would trade three known
  exceptions for two. It wants more attested `l` in V-C blocks.
* **/s/ turns on top of a cluster** — mirrored in 11 of the 12 blocks
  where it sits above another consonant, and in none of the 20 where it
  does not. `TURNS_ABOVE_CLUSTER`.

Both are read from what SHARES the block, which is why `makeSlot` is
handed the other slot's symbol.

Two glyphs, **u** and **ɔ**, are stored as their bottom-slot drawing
rather than their top one — /u/ is plain in all 18 of its bottom slots
and mirrored in 7 of its 9 top ones. The slot test is inverted for them;
the art was not redone.

/aɪ/ is worth spelling out because it is the cleanest case in the set.
"fire" is /f aɪ ə r/, so pairing puts aɪ at index 1 — a **bottom** slot —
and canon writes it there as the vertical mirror of the chart's citation
form. Measured off the tracing: the chart's bar sits at y 23–39 with the
dots at y 53–76, and the photo of "fire" has that the other way up. Both
forms attested, in known slots, which is the bar. The drawing itself was
already right; only the flag was missing.

Two things to hold on to:

* **One drawing per glyph.** `ae_alt`, `l1`/`l2`, `ih_alt`, `ah_alt`,
  `ei_alt`, `s_alt` are gone — draw the top form and the bottom comes
  free. The chart's second /l/ and /æ/ cells are still traced as `l_b`
  and `ae_b`, tied to the same sound.
* **Don't generalise `FLIPS` to every glyph.** That was tried and is
  wrong: most glyphs hold one orientation. Only add a sound on the
  strength of a word that actually shows it flipped.

**You no longer spell /s/ by hand.** The rule above derives it, including
for "students" — both /s/ in TOP slots with a different orientation for
each, the word the override was built for. `designs/s.json` carried
`flips: true` as an undocumented by-slot override; that could not have
been right for a glyph taking both orientations in one slot, and the flag
is gone.

`$`/`%` still exist and still win over the derivation, but they are now a
**recording** tool rather than a spelling one. A corpus entry writes what
the source shows; the site's sounds box needs no marker to draw a word
correctly. Checked: of the 53 markers in `corpus/attested.json`, the
derivation reproduces 50. The three misses are all `l$` — `school`,
`stillness`, `always` — which is the known `l` exemption above, and no
/s/ marker disagrees.

**Heights are the script's native units — always on, no toggle** (as of
session 4). Consonants render 52×52, vowels 52×41.6 — 5 units tall against
4, **stacked flush**. The old "Proportional heights" checkbox and the
`avatarian-proportional` body class are gone; the proportional values are
now the base CSS rules and the flat vowel SVG is always shown. Vowels are
4×5 and consonants 5×5 by design, so there is nothing left to toggle
between.

**The two glyphs in a block share a lattice edge.** A consonant's bottom
row line IS the vowel's top row line. But each SVG carries a clearance
margin outside its lattice (10svg on a 100 box = 5.2px for a consonant,
8svg on an 80 box = 4.16px for a flat vowel), so stacking the boxes flush
would leave both margins as a visible gap. `.avatarian-slot-bottom {
margin-top: -9.36px }` (`-0.18 × av-size`) pulls the bottom slot up by the
two margins' sum so the lattices actually meet (`-0.225em` in the wiki CSS
— keep them in step). A **C-C** block overrides this: its bottom slot uses
`-0.36 × av-size`, the clearance sum plus one full lattice row, because
its two consonants overlap by a row (see below).

**Residual gap for 4-row vowels is a DESIGN issue, not a rendering one.**
After the margin fix, T+ɑ still shows ~8.3px (one lattice row) between the
inks, because T's ink ends at lattice y=4.5 and ɑ's connecting stroke
reaches only y=0.5 — half a row each. Closing it means deciding where a
consonant's bottom edge and a 4-row vowel's connecting edge sit, then
nudging both design conventions to touch. See HANDOFF.md "THE OPEN ISSUE."

**4-row vs 3-row vowels.** A 4-row vowel fills the top lattice row
(ink spanning y 0.5–3.5) and carries `rows: 4` → `avatarian-4row` in the
DOM; a 3-row vowel leaves that row empty (y 1.5–3.5). The confirmed set,
in **ARPAbet**, is **AA, AW, EY, IH, OY, UH, UW**.

**That list is ARPAbet codes, NOT file stems**, and the two are actively
misleading: stem `uh` is /ʌ/ = ARPAbet **AH** (3-row), while ARPAbet
**UH** is /ʊ/ = stem `oo` (4-row); stem `aw` is /ɔ/ = ARPAbet **AO**
(3-row), while ARPAbet **AW** is /aʊ/ = stem `au` (4-row). Reading it as
stems flips two of the seven, in both directions. Every vowel design now
carries an explicit `rows`; `VOWEL_4ROW_BASE` matches the list and is
only the fallback for a vowel with no design.

`glyphspec.validate` cross-checks declared `rows` against where the ink
starts, so a mismatch shows up in the designer's problems panel. Note the
top row spans y=0 to y=1, so ink sitting exactly ON y=1 has not entered
it — a 4-row vowel has to reach above y=1.

**A 3-row vowel is pulled up one row when it sits in the TOP slot.** It
is drawn bottom-aligned in its 4-row box, which is what the bottom slot
wants — the empty row is the gap under the consonant. In the top slot
that same drawing puts the empty row at the block's outer edge as dead
space and leaves the vowel flush against the consonant with no gap. The
V-C rule is rows 1-3 vowel, row 4 gap, rows 5-9 consonant, so
`blocks.css` shifts it with `translateY(-20%)` — one lattice row is 20%
of the 80-unit viewBox (64 of lattice plus 16 of margin), not 25%, so it
holds at any size. Only the ink moves; the row it vacates was empty, so
nothing overflows. 4-row vowels are excluded: they fill their box and
abut directly, which is right in either slot.

**A 3-row vowel that also FLIPS needs the same shift in the BOTTOM slot,
and it was missing until session 12.** The flipping 3-row vowels are æ,
ə and aɪ. The flip is `scaleY(-1)` on the SVG, which mirrors the
bottom-aligned drawing into a top-aligned one — so the empty row lands on
the block's outer (bottom) edge and the ink floats up off the baseline,
flush against the consonant. "fire" showed it plainly: /f aɪ ə r/ has aɪ
in a flipped bottom slot, and its bar sat mid-slot with a full empty row
beneath instead of on the baseline. The fix is the exact counterpart of
the top-slot pull-up — `translateY(20%)` on the span (so it composes with
the SVG's `scaleY(-1)` rather than fighting it), pushing the ink back
down one row so the gap returns to the inner side. Verified: aɪ's bar now
lands at the same baseline as a plain 3-row vowel like /i/.

**`flips` and `rows` are per-design now.** Both are set from the designer
(checkbox and row toggle) into `designs/<name>.json`, and
`build_glyphs.py` overlays them onto `FLIPS_BASE` / `VOWEL_4ROW_BASE` at
build time via `design_overrides()`. Absence means "use the base"; an
explicit `false` / `3` turns a base entry off, so the two are not the
same. `bg.refresh()` re-reads them, which the server calls after every
save so `/api/catalog` doesn't serve values from startup.

A 4-row vowel is **taller** than a 3-row one (0.5–3.5 against 1.5–3.5),
not the same shape shifted up, so the toggle deliberately does NOT move
ink — which form a drawing is is a drawing decision. `glyphspec.validate`
cross-checks the two instead: declaring 4-row with nothing above y=1, or
3-row with ink inside the top row, is reported in the problems panel.
Running that check over the current designs says `oi` and `oo` disagree
with what the build assumes (both placeholders).

The ratio has moved four times now (1:4 → 1:1 → 3:5 → 4:5), so don't
"fix" it back by accident. 4:5 is the current reading and it is what
`FLAT` in `build_glyphs.py`, `VOWEL_GRID` in `glyphspec.py`, the
proportional block in `style.css` and the wiki CSS all encode — change
them together or the flat drawings stop matching the boxes they go in.
The key chart's "Consonants 3/4 height, Vowels
1/4 height" note describes bands inside a hand-lettered block, not a scale
factor — every glyph is drawn on one 100×100 grid, so scaling a mark down
shrinks the whole thing, and at 1:4 vowels went too faint to read.

In proportional mode **nothing is stretched**. Vowels get the wide-flat
shape by swapping to a separate 100x80 drawing, generated in
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
size). The proportional block is 93.6px so a unit is exactly 10.4px, and
the default mode's 1px slot overlap is zeroed there — handed to the flex
algorithm it would skew the 5:4 split and with it the scale.

**C-C blocks overlap by one row (B1, settled session 12).** Two
consonants in a block are full size and share one lattice row — the top
glyph's bottom row is the bottom glyph's top row — so their ten rows
total nine. This replaced an earlier reading that **shrank** each
consonant to 4.5 rows (9/10 scale, lighter stroke) to make the sum nine;
shrinking kept the arithmetic but thinned the stroke and never matched
the art, where the glyphs interlock at full weight. In CSS it is the
bottom-slot pull-up above, `-0.36 × av-size` for a C-C block, not a size
change. Stroke-level fusion of the shared edges is still TODO item 19 —
the rows coincide, the inks butt rather than truly interlock.

## Open work

**See `TODO.md`** — the single backlog. This section used to carry its
own numbered list, which drifted out of step with the one in `HANDOFF.md`
and made item numbers ambiguous.

Questions about the *script* rather than the code stay in `AVATARIAN.md`
§10, and the settled answers in §12. **Mid-word nulls, /s/ orientation
and the C-C row overlap are no longer among the open ones** — the corpus
answered the first two in session 11 (§12.5, §12.6), and B1's one-row
overlap was measured off the art in session 12. What is still open there:
/x/ has no glyph, why `appa` takes three blocks, the remaining positional
variants (ɪ and u), whether /ɔɪ/ mirrors by slot, and the unassigned mark
in the key.

## Testing

`python3 tools/run_tests.py` runs everything: the geometry cross-check,
the Python corpus builder tests, and the Node suite over the site's own
JS (`tests/*.test.js`, loaded through `tests/harness.js`, which stubs
just enough DOM). `tests/recognise.html` is opened by hand — Node cannot
do SVG geometry.

Read `tests/README.md` before adding one. Two things that bite:

* **A test that names a real word will break when that word becomes
  attested**, because the corpus wins the lookup chain and the tier
  changes under it. Six currently fail exactly this way (TODO item 35).
  Pick a specimen the corpus is unlikely ever to hold, or have the test
  insert its own fixture.
* The suite loads the real 1.6 MB `lexicon.js` where it needs it. A test
  asserting the dictionary layer against a stub is asserting the stub.

Quick manual check — this sentence should transcribe as:

```
katara please do not be mad
/k ə t ɑ r ə/ /p l i z/ /d u/ /n ɑ t/ /b i/ /m æ d/
```

## Wiki deployment

`wiki/MediaWiki_Common.js.txt` has a placeholder URL at the top that must
be replaced with the deployed site URL before pasting into
`MediaWiki:Common.js`. Requires wiki-admin / JS-editor rights on Fandom.
