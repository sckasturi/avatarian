# Avatarian — session handoff

Read `README.md` for architecture and `CONTEXT.md` for the decoding rules
and open questions. Both are current. This file covers what changed across
the sessions that built the designer, plus sessions 4, 5 and 6 below, and
what to do next.

---

## Session 9 — the workbench, and drawing glyphs

Items **23** (transcription workbench), **25** (stylus recognition) and
most of **4** (fuzzy reverse-decode). Item 26 is superseded rather than
done — see below.

### The workbench

```
python3 tools/corpus_server.py     # http://localhost:8793/
```

`workbench/`, local-only like the glyph designer. The loop: **file a
reference image against a source, read the Avatarian off it and type the
spelling, let the reverse-decode say what English word that is, confirm,
save.**

**The image is provenance, not input** — nothing reads its pixels. That
was a correction from the user mid-build, and it made the feature
smaller and better: no underlay, no tracing surface, just a file stored
in `corpus/sources/` so the entry can be re-checked in a year. It is
also what makes this the tool for **B2** — cataloguing is now per
*source*, not per word, so seven images clears the whole corpus.

The part worth keeping is **"against the model"**: the attested spelling
beside what the pipeline would have predicted, and *which way* they
disagree. "Same sounds, different blocks" means the pairing rule is
wrong here (that is `appa`); "different sounds" means the pronunciation
is (that was `toph`). `CORPUS.md` §4 said the corpus would turn the open
questions into queries; this is that, while you type.

Saving calls `build_corpus.check()` — the same function the CLI uses — so
nothing can go in through the UI that `python3 tools/build_corpus.py`
would reject, and a rejected save writes **nothing**, not half.

### Drawing glyphs

`site/js/recognise.js` scores, `site/js/draw.js` is the pad. Both the
main page and the workbench mount it.

**It needed no new data, and no fitting step.** The plan was to reuse
`designer/js/fit.js` to snap a gesture to the lattice first. Two things
made that unnecessary:

1. `manifest.js` already carries every glyph's SVG inline, so the
   reference shapes can be sampled straight off the page with
   `getPointAtLength`. No Python build step, no second copy to drift.
2. Comparing raw point clouds is already tolerant of the wobble fitting
   would have removed — and skipping it kept the whole feature inside
   `site/`, which is what let the main page have it too.

Both sides normalise into a unit box **keeping the aspect ratio**; score
is a symmetric chamfer distance. Normalise the axes independently and
every glyph fills a square, at which point a wide flat cup looks like a
tall narrow one.

Measured, by tracing each glyph's own outline back through the matcher at
random scale and offset: 42/42 top-1 on a clean trace with ±9% jitter,
40/42 coarse and heavily jittered, 38/42 with all strokes merged into
one, and **24/42 (32/42 top-3) with a whole stroke forgotten**. That last
one is the honest limit and is barely a recogniser failure — half a glyph
is a different shape. It is why the pad ranks rather than answers, and
why a loose match is faded with its distance in the tooltip.

Stroke order and direction are deliberately unused: they record how the
*designer* drew a glyph, and somebody copying off a reference image has
no reason to take the same route.

### Reverse-decode

`site/js/reverse.js`. Phoneme edit distance against the corpus, then
`EXCEPTIONS`, then all ~126k CMU words. Nulls and `$`/`%` come off before
matching, so `AA 0 P 0 AA 0` reaches "appa".

The first version took **500 ms a query**, which is not usable as you
type. Two fixes got it to ~58 ms: reuse the edit-distance rows instead of
allocating two arrays per candidate (this was most of it), and bucket the
lexicon by pronunciation length so a four-phoneme word is never compared
against "unconstitutional".

### The bug worth remembering

**`K AH T AA R AH` does not spell Katara.** It gives /k ʌ t ɑ r ʌ/ —
`AH` is the STRUT vowel, not the "ah" of *father*. The correct spelling
is `K AX T AA R AX`.

That wrong example was in **three places**: the sounds-box placeholder,
the "how to write sounds" help, and `AVATARIAN.md` §9. All written by
people who knew the table. It was found only because the workbench's
reverse-decode ranked *qatar* above *katara* and the reason turned out to
be the query, not the ranking. All three fixed, and the help text now
names the trap.

**This is the strongest argument item 29 has.** If the people who built
the table get it wrong in the documentation, a visitor has no chance.

### Also

- Item 26 is **superseded, not done**. "Photo as an underlay" assumed the
  image was something to trace over; it is provenance. What is left of 26
  is only full photo OCR.
- `.claude/launch.json` gained an `avatarian-workbench` entry.
- The pad is square, so an uncapped width makes it as *tall* as its
  column is wide — a screen and a half of empty box on the stacked mobile
  layout. Capped in both stylesheets.

### The flips task, reverted

A background agent for item 30 finished before the instruction to hold
off reached it, and had already set `flips: false` on `designs/s.json`
and `designs/oi.json`, rebuilt the manifest, added a `FLIPS_BASE`
disagreement warning to `glyphspec.validate`, and edited four docs. **All
of it was reverted** — item 30 stays deferred behind the corpus, same as
B1, because the corpus is the instrument for settling it. The work is
kept as a patch if it is wanted later.

---

## Session 8 — the corpus is real

**Read `TODO.md` first**, then this. One item: **22**, the corpus in the
lookup chain. It was picked because everything else on the critical path
(20, 24, B1, B3) is waiting on reference material from the user, and 22
was the piece that needed nothing.

### What shipped

```
corpus/attested.json     the corpus — edit this
tools/build_corpus.py    validates it, generates the JS
site/js/corpus.js        generated; site + wiki gadget + designer load it
```

23 entries from 7 sources, consulted above `EXCEPTIONS`. Three words now
draw spellings the pipeline could not previously express at all:

```
appa          (ɑ,∅) (p,∅) (ɑ,∅)                       three blocks, not two
students      (s%,t) (u,∅) (d,ə) (n,t) (s$,∅)         mid-word null
metalbending  (m,ɛ) (t,ə) (l,∅) (b,ɛ) (n,d) (ɪ,ŋ)     mid-word null
```

`appa` renders **tall, short, tall** — so B3 is now a straight look at
the art beside the screen rather than a thought experiment.

### Two things the design got wrong, and they made it smaller

`CORPUS.md` proposed both and is corrected in place.

1. **Store IPA, not the sounds syntax.** The syntax is ARPAbet, item 29
   wants to replace ARPAbet, and every entry would have needed migrating.
   The site turned out to be **already IPA internally** — `normaliseSound`
   converts on the way in, `IPA_TO_CODE` on the way out — so ARPAbet was
   only ever a display layer. **Item 29 is no longer coupled to the
   corpus** and can land whenever.

2. **`pairUp()` did not need bypassing**, which was stated as the whole
   difficulty. A finished spelling with its nulls written out has an
   **even** token count, and pairing an even list two at a time is the
   exact inverse of flattening the blocks. So a corpus entry is an
   ordinary symbol list that happens to have been observed, needs no
   second render path, and `render.js` was not touched. What actually
   gets bypassed is the *pronunciation* lookup above it.

   `build_corpus.py` rejects an odd token count for this reason: an odd
   count means somebody recorded a phoneme list instead of a spelling,
   which is the one mistake that would quietly poison the data.

### Bugs found on the way

- **The "you've edited these sounds by hand" banner was shown to
  everyone, always.** `.tune-note { display: flex }` beats the `[hidden]`
  attribute's UA `display: none`, so the JS setting `.hidden = true` had
  no effect. Session 7 shipped it. One line: `.tune-note[hidden]
  { display: none }`. Worth remembering as a class of bug — **`hidden`
  is only a default, and any `display` rule silently defeats it.**
- **An orientation override didn't survive the round trip to the sounds
  box.** `wordsToSoundText` looked the whole token up in `IPA_TO_CODE`,
  and `s%` is not a key, so it wrote raw IPA into a box that otherwise
  speaks ARPAbet. Nothing upstream produced an override until the corpus
  did (`students` spells both its /s/ by hand), which is why a
  round-trip bug sat there unnoticed. Split the suffix, then look up.

### Surfaced, not acted on — new TODO item 30

**Two glyphs flip that the docs say don't.** `designs/s.json` and
`designs/oi.json` carry `flips: true`, so the shipped manifest mirrors
/s/ and /ɔɪ/ by slot — but `FLIPS_BASE` is `{æ, ɑ, l, ɪ, e, aɪ}` and
`AVATARIAN.md` §6 says outright that **/s/ deliberately does not flip**,
which is the entire reason the `$`/`%` override exists. /ɔɪ/ has no
evidence recorded anywhere.

Since session 6 made the designs authoritative for `flips`, a checkbox
tick silently overrides the documented table.

**Deferred behind the corpus on the user's call**, same as B1 — the point
of the corpus is that orientation questions get read off attested glyphs
in known slots rather than argued from the docs. Don't pick this up
early.

### Where things stand

**B2 is now the top blocker**, ahead of everything. The corpus format is
settled and adding a word is a row in a file — but every one of the 23
entries cites a source ending "not yet catalogued". The spellings are
right and nobody can re-check them. Cataloguing the images is what turns
item 20 from blocked into typing.

Item 21's plumbing came along free: `lookupWord()` returns
`{ipa, tier, entry}` with tier in attested / derived / guessed, carried
onto every word by `sentenceToIPA`. Nothing displays it — that is B4.

---

## Session 7 — dictionary, page rebuild, export, backlog

**Read `TODO.md` first** — it is now the single backlog, and this session
created it. Then this section for what changed and why.

### The three big ones

1. **A real pronunciation dictionary.** `site/js/lexicon.js` bundles the
   CMU Pronouncing Dictionary (~126k words) ahead of the rules. Order is
   `EXCEPTIONS` → lexicon → `RULES`. Before this the guesser got 13 of 22
   words wrong on a test sentence; now typing three sentences of English
   produces all 42 glyphs with no unknown sounds. It also gave the site
   **unstressed-vowel reduction** for free, since CMU marks stress and
   unstressed `AH` maps to schwa — a limitation the docs had listed as
   unmodelled. ~1.6 MB inline, ~650 KB gzipped, index built lazily on
   first use. Generated by `tools/build_lexicon.py`; the raw dictionary
   is not committed. **The wiki gadget deliberately does not load it.**

2. **The front page was rebuilt around English in, Avatarian out.** It
   renders on load, converts live with no button, and the drawing is the
   thing the page is built around — sizeable, and saveable as PNG/SVG or
   to the clipboard. The sounds box is still what actually gets drawn and
   sits right under your text. English overwrites it until you edit by
   hand, then stops and says so, with a button to put it back.

3. **`TODO.md`.** The backlog used to live in this file, which has
   several other numbered lists, so "item 12" was ambiguous. It also had
   rivals in `CONTEXT.md` and `CORPUS.md`. One file now, stable numbers,
   blocked items separated from ready ones.

### Corrections to the script itself

- **Four names were wrong or unconfirmed.** `aang` is `EY NG` (not
  /ɑ ŋ/), `toph` is `T AA F` (not /t oʊ f/); `zuko` and `momo` were
  already right. `aang` also resolves an inconsistency that had been in
  the docs all along — the `FLIPS` table cites "Aang" as evidence /e/
  takes a top-slot form, which needs the word to contain an /e/.
- **`appa` is `AA 0 P 0 AA 0`** — three blocks, each phoneme padded with
  its own null. Only its vowels could be fixed in `EXCEPTIONS` (both /ɑ/,
  not /ə/); the structure needs the corpus, and is the reason `CORPUS.md`
  wants finished spellings rather than phoneme lists.
- **`beifong` removed** — no transcription, so the tool shouldn't assert
  one.
- **"fanny is missing"**, off a poster, is the first attested *sentence*,
  and the pipeline already produced it exactly. Corrections say where the
  model is wrong; this says where it is right.

### Bugs worth remembering

- **The exporter dropped stroke attributes.** It took each glyph SVG's
  `innerHTML`, leaving behind `stroke-width="9"` and the caps/joins,
  which live on the glyph's own `<svg>`. Exports were hairlines. It
  clones the element now.
- **A lattice row is 20% of a vowel's box, not 25%.** The box is an
  80-unit viewBox: 64 of lattice plus 16 of clearance margin. One row is
  **8.32px** at default size, not the 10.4px you get dividing 41.6 by 4.
  Every row figure quoted earlier in the session was inflated by 1.25×.
- **Measure the lattice, not the ink.** A dot's radius is 0.5 row against
  a stroke's 0.28, so two glyphs on the same lattice line differ by 0.22
  rows at their edges.
- **`event.currentTarget` is null after the first `await`** in an async
  handler.
- **Pushing a branch you are not on** exits 0 and looks like success.
  Five commits sat unpushed behind that.

### Where things stand

Non-corpus backlog is nearly clear: items 6, 10, 11, 12, 13, 14, 15 done
this session, plus 5 and the g2p item. **Left: 4 (fuzzy reverse-decode),
9 (public spec section), 16 (punctuation — probably blocked, the glyphs
don't exist), 27 (test suite), 17/18/19 (glyph work needing your
judgement or source material), 28 (doc rewrite, waits on the 9-row
model).**

**The corpus (20–24) is the critical path**, and item 3's last question
(C-C block layout) is deliberately deferred behind it — the plan is to
build the corpus and read the answer off every attested C-C block at
once, rather than reasoning from a couple of samples.

**Item 29 is new and couples to the corpus**: ARPAbet is unintuitive
(`AH` is /ʌ/ while `AA` is /ɑ/), and a friendlier scheme is wanted. If
that lands after the corpus is built, every entry needs migrating —
unless the corpus stores IPA and treats ASCII as a display layer, which
is the recommendation.

---

## Session 6 — the designer/site bridge (implemented)

**Read this first.** Session 5's backlog items 1 and 2 are done, and
three of its open decoding items closed along the way: **null selection
by pairing partner** and the **V-C layout tension** are now implemented,
and the **4-row vowel set** is applied per-glyph. What remains open from
the 9-row model is **C-C** — whether two consonants overlap by a shared
row — which the user will come back to.

### What changed

1. **The designer shows the glyph in the real product.** A new **in a
   block** strip renders it in actual blocks at product size (V-C, C-V,
   C-C and against the null, or against any partner you pick), and **in
   a word** takes the same ASCII sounds syntax the app does, opening on
   the sound's example word. Both are drawn by `site/js/render.js`
   against `site/css/blocks.css` — the designer links the real files
   over a read-only `/site/` route on its own server rather than
   restating them, so the preview cannot drift from the product. The
   glyph being edited is swapped into `window.AVATARIAN_GLYPHS`, and the
   SVG it is swapped in from is the one `POST /api/render` returns, i.e.
   `glyphspec.py`'s. New file: `designer/js/live.js`.

   This makes the open issues visible where they actually live. The
   T+ɑ gap measures **8.32px in the designer's own preview** — one
   lattice row, the same number the section below reports.

2. **Two files split out of the site so three surfaces can share them:**
   `site/css/blocks.css` (block layout, out of `style.css`) and
   `site/js/sounds.js` (the sounds syntax, out of `index.html`). The
   site, the wiki gadget and the designer all have to agree on both.
   Site cache-buster bumped to `?v=4`.

3. **`flips` and `rows` moved into the design.** They are set from a
   checkbox and a row toggle beside the previews, saved into
   `designs/<name>.json`, and read back by `build_glyphs.py` at build
   time. `FLIPS` / `VOWEL_4ROW` are now `FLIPS_BASE` / `VOWEL_4ROW_BASE`
   and act as the fallback for anything undrawn; the effective sets are
   still exported under the old names, so nothing downstream changed.
   Overriding is explicit both ways.

4. **"ship it" and "ship all…"** — `tools/promote.py`, also a CLI
   (`promote.py m`, `--dry-run`, `--all`, `--force`). Writes the entry
   into the right dict in `build_glyphs.py` in the layout a human would
   use, drops the name from `PLACEHOLDERS` if it was there, and runs
   both build scripts. `build_glyphs.py` is still the single definition
   of what ships — what changed is who types it.

   **ship all…** is in the header (whole-set action, so not beside the
   per-glyph button) and reports into a strip below it. Two presses: the
   first lists which glyphs differ and writes nothing, the second ships
   them. It edits every entry against the running source and rebuilds
   once at the end.

5. **Marks got a height class.** `glyphspec.TALL_KINDS =
   {consonant, mark_consonant}`. Previously every `mark` went through
   the vowel frame, so designing `null_c` drew it on a 5×4 lattice and
   gave it a flat form it should not have; it only appeared to work
   because `designs/glot.json` still carried the pre-rename
   `type: "consonant"`. The sound list files by a new `group` field so
   both nulls still read as marks.

6. **The `glot` designs renamed** — `designs/glot.json` → `null_c.json`
   (type `mark_consonant`, 5×5), `glot_v.json` → `null_v.json` (type
   `mark`, 5×4), with `ipa` nulled on both since neither is a sound.
   That closes the session-4 loose end; `--report` no longer lists
   orphans.

7. **A row-count check** in `glyphspec.validate`: declaring 4-row with
   nothing drawn above `y=1`, or 3-row with ink inside the top row, is
   now reported. The toggle deliberately does **not** move ink — a
   4-row vowel is *taller* than a 3-row one (0.5–3.5 against 1.5–3.5),
   not the same shape shifted, so which form a drawing is stays a
   drawing decision.

8. **`glyphspec.to_python` indent fix.** Continuations were hardcoded to
   9 spaces, which only lined up for one-character names, so promoting
   an unchanged design produced a spurious diff. Now aligned to the
   head. This is why 20 designs round-trip byte-identical.

9. **V-C layout implemented.** A 3-row vowel is drawn bottom-aligned in
   its 4-row box — right for the bottom slot, where the empty row is the
   gap under the consonant, but wrong on top, where it put the empty row
   at the block's outer edge and left the vowel flush against its
   partner. `blocks.css` now pulls a top-slot 3-row vowel up one lattice
   row, which is `translateY(-20%)`. 4-row vowels are excluded — they
   fill their box and abut directly.

   **20%, not 25% — a trap worth naming.** A lattice row is NOT a
   quarter of a vowel's box. The box is an 80-unit viewBox: 64 units of
   lattice (4 rows x 16) plus 16 units of clearance margin outside it.
   So a row is 16/80 = 20%, and one row is **8.32px** at the default
   size, not the 10.4px you get by dividing the 41.6px box by 4. The
   first attempt used 25% and over-shifted by a quarter of a row, which
   showed up as V-C gaps being wider than C-V ones when the two should
   match. The glyph-independent check is the lattice seam: C-V blocks
   measure 0 rows between the two lattices (they meet), V-C blocks
   measure exactly 1 (the gap row).

   Beware measuring this with ink extents — they vary by drawing. A dot
   has radius 8 units (0.5 row) against a stroke's half-width of 4.5
   (0.28), so a glyph whose lowest ink is a dot reaches 0.22 rows
   further than one ending in a stroke. Measure the lattice, not the
   ink.

10. **The wiki CSS had drifted badly** and is brought back in step. It was
    missing `.avatarian-flipped` entirely, so every glyph in `FLIPS`
    rendered unmirrored in a bottom slot on the wiki, and missing the C+C
    4.5-unit shrink, so consonant-pair blocks were 10 units instead of 9.
    Both added, along with the new row shift and `.avatarian-missing`.
    `site/css/blocks.css` is the file to diff it against.

11. **Null selection by pairing partner** (session-5 correction, was
    still only a doc note). `render.js` wrote the vowel-height cup into
    every empty slot regardless; it now picks by the partner —
    `nullFor()` returns the tall `∅c` beside a vowel and the short `∅`
    beside a consonant. That is also what keeps a block nine rows tall
    whatever is in it: a vowel+null block was 8 rows before, now 4+5.
    It applies to a null you TYPE as well as one the renderer inserts,
    so `0` means "a null" and the sound beside it decides which —
    including mid-word, where canon puts nulls the renderer can't derive.

12. **The 3-row/4-row set is applied, not just plumbed.** Every vowel
    design carries an explicit `rows`, set from the session-5 list read
    as **ARPAbet** — AA AW EY IH OY UH UW are 4-row. The stem names do
    NOT track the codes, and reading the list as stems gets two wrong in
    both directions: stem `uh` is /ʌ/ (ARPAbet AH, 3-row) while ARPAbet
    UH is /ʊ/ (stem `oo`, 4-row); stem `aw` is /ɔ/ (ARPAbet AO, 3-row)
    while ARPAbet AW is /aʊ/ (stem `au`, 4-row). `VOWEL_4ROW_BASE` was
    updated to match, as the fallback for anything undrawn.

### What this surfaced, and hasn't been acted on

- **A number of designs differ from the glyph they ship** — the design
  and `build_glyphs.py` had drifted apart, on 14 glyphs when the session
  started. Some were deliberate later work in the designer (`nurse` and
  `schwa` carry notes and a different construction), some were trivial
  (`z` was only line-packing). Several were shipped during the session;
  run `python3 tools/promote.py --all --dry-run` for the current list
  rather than trusting a number written here. **Deciding which direction
  is right is still a per-glyph judgement**, which is why `ship all…`
  shows the list before it does anything.
- **Provenance is closed — stop raising it.** Six of the seven
  placeholders were shipped this session (`sh`, `zh`, `ch`, `j_dz`,
  `oi`, `oo`), leaving `kh` (/x/) as the only one. Every glyph in the
  set is sourced; nothing is invented, and /x/ has no glyph precisely
  because no source for it exists. `SOURCE_NOTES` and the reference
  tracings stay as **archive**, but provenance is not an open question
  and should not be surfaced in reports or treated as a reason to
  hesitate. The older passages calling `tʃ` "an invention drawn from
  nothing" are superseded.
- **`null_c` is a squared ∪, not a ⊓ gate** — confirmed by the user in
  session 6. Both nulls are cups; `null_c` is squared off and 5 rows
  tall, `null_v` rounded and 3. Docs that called it a "⊓ gate" were
  wrong and are corrected.
- ~~Two vowel drawings disagree with the confirmed row list.~~
  **Both resolved.**
  - **`uh` (/ʌ/, ARPAbet AH)** was drawn a full row high, y 0.5–2.5 —
    neither convention. Once top-slot 3-row vowels started being pulled
    up a row, that pushed its ink *above* the block (−0.2 rows, visible
    in "of"). **Moved down one row to 1.5–3.5**, exactly the 3-row
    convention, and re-shipped. AH stays off the 4-row list.
  - **`au` (/aʊ/, ARPAbet AW)** sits at y=1.0 and **cannot come down to
    1.5 without its curves leaving the grid**, so it is declared 4-row
    and left as drawn. `glyphspec.validate` deliberately tolerates a
    centre-line exactly on y=1: the stroke is 9 wide, so half of it lies
    inside the top row even though the path does not. (An earlier,
    stricter `>= 1` check was reverted for this reason.)

  All 16 vowels now agree across drawing, declaration and manifest.

---

## Session 5 — 9-row block model (design discussion; not yet implemented)

**Read this first if you're picking the project back up.** This session was
verbal design discussion with the user only — no code was touched. It
produced a more detailed structural model than what session 4 shipped, two
confirmed corrections to session-4 behavior, an open tension that isn't
resolved yet, and a feature/task backlog. Confidence varies per item and is
marked below — don't treat the unconfirmed parts as settled.

### Two confirmed corrections to the session-4 code (already applied to README.md and CONTEXT.md)

1. **Null height is picked by pairing partner, not by the null's own height
   class.** Confirmed from a reference sample: a vowel paired with a null
   takes the **5-height** null; a consonant paired with a null takes the
   **3-height** null. The shipped `null_c`/`null_v` currently do the
   opposite — `null_c` (consonant-height/5-row) is used for an empty
   consonant-height slot, `null_v` (vowel-height/4-row) for an empty
   vowel-height slot. **Fixed in code in session 6** (`render.js`,
   `nullFor`); it also restored the 9-row block invariant, since a
   vowel-plus-null block used to come out 8 rows tall.
2. **The 4-row vowel set is AA, AW, EY, IH, OY, UH, UW** — not the code's
   old `VOWEL_4ROW = {ɑ, e, ɪ, u}`. Every other vowel is 3-row. **Applied
   in session 6**, once OY/ɔɪ and UH/ʊ had glyphs: every vowel design now
   carries an explicit `rows` and the build reads it. The list is
   **ARPAbet codes** — reading it as file stems flips two of the seven,
   since stem `uh` is /ʌ/ (AH) and stem `aw` is /ɔ/ (AO). See session 6.

### The 9-row block model, as described this session

- Every block is a fixed **9-row grid**. This matches what session 4
  already ships (9-row blocks via the 5:4 consonant:vowel ratio), but the
  rules below go further than what's currently coded.
- Consonants are always **5 rows**. Vowels are **3 or 4 rows** depending on
  the specific vowel (see the corrected list above).
- Only three block types occur: **V-C, C-V, C-C**. V-V never happens — a
  null substitutes for the missing second vowel.
- **V-C blocks** (vowel on top): **resolved in session 6.** A 3-row vowel
  takes rows 1–3, row 4 is the gap, and the consonant takes rows 5–9. The
  empty row falls BETWEEN the two glyphs, not at the block's top edge —
  which is what the open tension below was worried about. (A 4-row vowel
  in the top slot therefore fills rows 1–4 and abuts the consonant with
  no gap; that mirrors the C-V rule exactly but is inferred, not stated.)
- **C-V blocks** (vowel on bottom):
  - 3-row vowel: rows 1–5 consonant, row 6 empty (gap), rows 7–9 vowel —
    consonant and vowel do **not** touch.
  - 4-row vowel: rows 1–5 consonant, rows 6–9 vowel — they **touch**, and
    should visually merge into one glyph rather than render as two
    separate touching shapes.
- **C-C blocks**: working guess is the two consonants **overlap by one
  shared row** (10 rows of content packed into 9). **Still unconfirmed as
  of session 6** — the user has this open and will come back to it. Needs
  reference examples before treating as fact.
- **Null height**: see correction #1 above — confirmed from a reference
  sample.
- **Mid-word null placement is still unsolved.** Same open problem as the
  session-4/CONTEXT item ("students"/"metalbending" split rule unknown).
  Working plan for now: manually specify/include mid-word nulls rather than
  deriving a placement rule algorithmically.

### Open tension — RESOLVED in session 6

The worry was that unifying every vowel to a 4-row shape with an empty top
row would put that empty row at the very top edge of the block — visible
dead space rather than a gap between two glyphs.

**It doesn't.** A 3-row vowel in the top slot occupies rows 1–3 and the
gap is row 4, i.e. between the vowel and the consonant below it. So V-C
gets the same gap-vs-touch split C-V does, and the vowel always sits
flush against the block's outer edge with the gap on its inner side:

```
V-C, 3-row vowel:  1-3 vowel · 4 gap  · 5-9 consonant
V-C, 4-row vowel:  1-4 vowel          · 5-9 consonant   (inferred)
C-V, 3-row vowel:  1-5 consonant · 6 gap · 7-9 vowel
C-V, 4-row vowel:  1-5 consonant        · 6-9 vowel
```

The 4-row V-C line is the symmetric completion, not something stated
outright — worth confirming. **C-C is still open** (see below); the user
will come back to it.

### Flip/orientation reframing

The existing `FLIPS` table (`build_glyphs.py`, README, CONTEXT) records
*which* glyphs flip, with word evidence. This session offered an
explanation for *why*, at least for one glyph: a flipping glyph's
connecting stem should point toward whatever it's touching. Example —
**IH**: in a V-C block (vowel on top) the stem connects toward the bottom,
toward the consonant below; in a C-V block (vowel on bottom) it connects
toward the top, toward the consonant above. Whether "stem points at
neighbor" generalizes to every entry in `FLIPS`, or is specific to IH, is
**unconfirmed** — worth checking each entry against it before assuming it's
a general rule.

### Feature / task backlog

**Moved to `TODO.md`** — the one backlog. It used to live here, which was
a mistake: this file has several other numbered lists, so "item 12" was
ambiguous depending on which one you meant. `TODO.md` also absorbed the
"open work" list from `CONTEXT.md`, the open questions from `CORPUS.md`,
and the loose ends that used to sit under "what this surfaced" below.

Numbers there are stable and never reused.

---

## Session 4 — height model made permanent, block gap, null rename

**Read this first if you're picking the project back up.**

### What changed

1. **Proportional heights is now the ONLY mode — the checkbox is gone.**
   Every vowel renders at 4/5 a consonant's height (52px vs 41.6px), 9-row
   blocks, always. `index.html` lost the `#proportionalHeights` checkbox and
   its `applyHeightMode()` JS; `style.css` lost every `body.avatarian-proportional`
   rule (the proportional values are now the base rules) and always shows the
   flat vowel SVG. Cache-buster bumped to `?v=3`.

2. **`glot`/`glot_v` renamed to `null_c`/`null_v`, and `glot` is no longer
   /ʔ/.** That glyph is not a glottal stop — it's a *consonant-height* null
   filler (`null_c`, type `null_consonant`). The ∪ cup is the *vowel-height*
   null filler (`null_v`, type `null`). Neither is a sound. `Q` was removed
   from `EXTRA_CODES`. `build_glyphs.py` splits these into `MARKS_CONSONANT`
   (written 100×100, no flat) and `MARKS_VOWEL` (100×80 + flat). **Note:**
   the docs still contain a few stale passages calling `glot` "/ʔ/, a real
   sound" — treat those as wrong; this rename supersedes them.

3. **4-row vs 3-row vowel distinction.** `VOWEL_4ROW = {ɑ, e, ɪ, u}` in
   `build_glyphs.py`; these carry `rows: 4` through the manifest and get an
   `avatarian-4row` class in the DOM. Their designs fill lattice rows 0–3
   (content starts at `y=0.5`); every other vowel starts at `y=1.5`, leaving
   the top row empty. This is a **design convention**, verified consistent
   across all shipped vowel designs — see the table under "the gap" below.

4. **Block gap fix (partial — see open issue).** The two glyphs in a block
   are meant to share a lattice edge ("stack flush, 5 units over 4"), but each
   SVG carries a clearance margin outside its lattice, so stacking the boxes
   flush left both margins as a gap (~9.4px). Fixed by pulling the bottom slot
   up by the sum of the two margins: `.avatarian-slot-bottom { margin-top:
   -9.36px }` in `style.css`, `-0.225em` in the wiki CSS. The 4.5-unit shrink
   on C+C blocks keeps that sum constant across the common pairings.

5. **`designs_to_svg.py` crash fixed.** `catalog()` blew up with
   `KeyError: 'null_consonant'` because its sort-order dict only knew
   `null`. Now maps both `null` and `null_consonant` to `"mark"`. This was
   the "issue" that was blocking `--report`.

6. **`glyphspec.py` brought back in step (parity fix).** It was stale on two
   things `build_glyphs.py` and `geom.js` had already moved to: dots at
   `SW/2` (4.5) instead of `UNIT/2` (8, the big cell-filling circle), and
   `round`/`round` caps instead of `square`/`miter`. Both fixed, so
   `check_geom.py` again passes **all 203 cases** (it was failing on every
   dot and every header before). This matters because `glyphspec.py` is what
   `designs_to_svg.py --python` and the designer server emit — without the
   fix, promoting a design would produce old-style small dots and round caps
   that don't match the shipped set.

### Also this session

- **`AVATARIAN.md` written** — a consolidated reference for the *script
  itself* (writing model, lattice/geometry, height model + block types,
  orientation, nulls, full glyph inventory, sounds syntax, open decoding
  questions), gathering what was scattered across README/CONTEXT/HANDOFF.
  Reconciled with the Session 5 corrections and flags where shipped code
  lags them. Committed to `main` in `c3d2e59` (which, note, also swept in the
  uncommitted Session 5 edits to CONTEXT/HANDOFF).
- **Committed and merged.** The Session 4 code went out as PR #1 (merged to
  `main`, `141e438`); `AVATARIAN.md` followed on `main` directly.

### THE OPEN ISSUE — the residual T+AA gap (what to solve next)

The user's complaint: **"when you have something like T AA, there should not
be a gap."** After the margin fix above, the gap between T's ink and ɑ's ink
dropped from 17.7px to **8.3px — exactly one lattice row.** It is *not* gone.

Why it remains, measured and confirmed:

- The margin fix collapsed the ~9.4px of *clearance margin*. Correct and done.
- The remaining 8.3px is **built into the designs**: the consonant T's ink
  ends at lattice `y=4.5` (half a row above its bottom edge), and the 4-row
  vowel ɑ's connecting stroke reaches only lattice `y=0.5` (half a row below
  the vowel's top edge). Half a row + half a row = one full row = 8.3px, even
  with the lattices perfectly flush.

So the last row of gap is a **design question, not a rendering one**, and it's
what "you're not getting it" was about. To close it, one (or both) of:

- **4-row vowels' connecting stroke should reach lattice `y=0`** (the very top
  edge), not `y=0.5`, so it meets the consonant. Edit the designs in the
  designer, or their `build_glyphs.py` entries.
- **Consonants should reach lattice `y=5`** at the bottom, not `y=4.5`.

Vowel design y-extents (grid is 5 wide × 4 tall; `y=0` is the top edge):

```
4-row (fill top row):  ah 0.5–3.5   ei 0.5–3.5   ih 0.5–3.5   uu 0.5–3.5
3-row (leave top row): i/schwa/ae/eh/uh/nurse/ow/aw/ai  start 1.5   au 1.0
```

The designs are internally consistent — the fix is to decide where the
*connecting edge* of a 4-row vowel and the *bottom edge* of a consonant
actually sit, then nudge both conventions so they touch. Do that in
`designs/*.json` (the designer) and re-promote via
`python3 tools/designs_to_svg.py <name> --python`.

### Loose ends left open

- ~~`designs/glot.json` and `designs/glot_v.json` still carry the old
  names.~~ **Renamed in session 6** to `null_c.json` (type
  `mark_consonant`) and `null_v.json` (type `mark`). Note `null_c.json`
  carries the `glot` *drawing*, which is the correct squared ∪ (confirmed
  in session 6) — the "⊓ gate" description in older docs was wrong.
- Wiki CSS was brought in step with the site (null_consonant sizing + the
  gap-collapse margin), but the wiki JS/template weren't touched this session.
  Still true after session 6 — and note the site's block rules now live in
  `site/css/blocks.css`, so that is the file to diff the wiki CSS against.

---

## 1. The big structural finding (session 1)

**Blocks are pairs, not syllables.** Phonemes are written in strict order,
two to a block, top slot then bottom slot. Nothing depends on a sound being
a consonant or a vowel.

This replaced a syllable model (consonants clustered on top, vowel beneath)
that happened to agree on CV words like "katara" and disagreed on
everything else. It was read off a labelled writing sample — "please do not
be mad at me when you wake up, but" — and holds for all twelve of its
words. An odd phoneme count leaves the last bottom slot empty and the ∅
filler (the ∪ cup, `glot_v`) is written into it.

Everything else in session 1 followed from that.

## 2. The glyph designer (session 2 + 3)

The designer (`designer/`, served by `tools/designer_server.py` on port
8792) is the main deliverable of sessions 2 and 3. It is a local-only
website for drawing characters on the script's native lattice.

### What it does

- **Brush drawing**: draw freehand and `designer/js/fit.js` reads the
  gesture — corners land on lattice points, straight runs stay straight,
  curves become real circular arcs (snapped to exact quarter and half
  circles), a small scribble becomes a dot, and a gesture that returns to
  its start closes itself.
- **Three tidiness levels** (close / normal / clean) — re-readable on a
  selected stroke with `R`, always from the raw gesture, never compounding.
- **"use it"** button: samples the currently-shipped glyph back into a
  gesture and puts it through the fitter, so you get an editable lattice
  design rather than raw coordinates.
- **"paste in…"** box: takes any of the three output formats (design JSON,
  SVG, or `build_glyphs.py` entry) back in. The "or copy from" dropdown
  fills from another glyph's design. A design JSON is taken as-is; an SVG
  or Python entry is sampled and fitted like a brush stroke.
- **Mirror controls**: two places.
  - **Paste box** (`↔` / `↕`): toggle buttons that reflect the incoming
    shape left–right and/or top–bottom as it is loaded. Useful for starting
    from a mirror pair (e.g. /ə/ → /ɜ/).
  - **Toolbar** (`⇄` / `⇅`, or `Shift+H` / `Shift+V`): mirror the current
    design in-place. Undoable with `⌘Z`.
- **Select / drag**: after fitting, every node is draggable. Arc handles
  bow a segment; dragging back onto the chord straightens it.
- **Undo / redo**: full history, including multi-step drags as one undo.
- **Autosave**: to `designs/<name>.json`, with a race-condition fix
  (captured-at-schedule, not read-at-fire).
- **Previews**: top slot, bottom slot (with flip if applicable), and the
  5×4 flat form for vowels.
- **Output tabs**: for `build_glyphs.py`, SVG, and design JSON — all
  rendered by the Python server, not the browser, so what you copy is what
  the build will draw.

### Architecture

- **Two geometry implementations** kept in sync:
  - `tools/glyphspec.py` (Python, authority) — the design format, frame
    system, path rendering, curve fitting, SVG output.
  - `designer/js/geom.js` (JS port) — for canvas speed. Must match Python
    exactly.
  - `tools/check_geom.py` — proves parity, ~203 generated test designs.
    Run after touching either file.
- **Brush fitter** (`designer/js/fit.js`) — resample → smooth → find
  corners → snap to lattice → describe as lines/arcs. An input method, not
  a second geometry system. Writes the same format, no Python counterpart.
- **Import/mirror** (`designer/js/import.js`) — parses all three formats,
  optionally mirrors. `Importer.mirror()` handles single-axis (negates
  bulge for handedness flip) and dual-axis (preserves bulge as rotation).
- **Frame system** — `Frame(sx, sy, ox, oy, box_h)` maps lattice → SVG.
  Vowels have flat (native 5×4, uniform scale) and square (stretched to
  5×5) frames. `UNIT = 16`, margins derived.
- **Dot weight** — `DOT = SW / 2` (4.5 radius against 9 stroke). Derived,
  not per-glyph. Confirmed from the /aɪ/ reference photo.

### Files

```
designer/
  index.html           the app shell
  css/designer.css     all styling
  js/geom.js           JS port of glyphspec.py geometry
  js/fit.js            brush stroke fitter
  js/import.js         paste/copy/mirror
  js/store.js          state, undo/redo, autosave
  js/editor.js         canvas: drawing, hit-testing, dragging
  js/app.js            UI wiring: sound list, toolbar, output

tools/
  glyphspec.py         the design format + geometry (canonical)
  designer_server.py   HTTP server for designer/ (port 8792)
  designs_to_svg.py    design → SVG or → build_glyphs.py entry
  check_geom.py        JS/Python geometry parity test

designs/
  README.md            the format, in full
  <name>.json          one per character
```

## 3. Other changes across sessions 2–3

- **Vowel grid corrected**: 5×3 → 5×4, updated in `glyphspec.py`,
  `build_glyphs.py` (`FLAT = 0.8`, `FLAT_BOX = 80`), `style.css`,
  `MediaWiki_Common.css.txt`, and `index.html`.
- **Dot weight corrected**: was 6.5–8 radius per glyph, now `DOT = SW/2`
  (4.5) everywhere. Confirmed from reference photo of /aɪ/.
- **/aɪ/ added to `FLIPS`** — confirmed from "fire" photo showing
  bottom-slot mirror. The drawing was already right; only the flag was
  missing.
- **Glyph designs**: /f/ (bowed X with high crossing) and /ɜ/ (descending
  recurve with dot below-left) designed from reference photos.
- **Curve fitting fixed**: end tangents now match the direction of adjoining
  lines/arcs, not just the neighbouring node's position, eliminating kinks
  at curve-to-line junctions.
- **Reference tracings** styled as outlines (`fill:none`) so the lattice
  shows through.
- **Editor dot handles** draw at exact ink radius with external selection
  ring, so dots read the same weight as strokes on canvas.

## 4. Traps that cost real time

* **Caching lies.** `manifest.js` and `style.css` are cached hard over both
  `file://` and the dev server. Verify from disk.
* **`confirm()` silently returns false** in some embedded browsers. The
  clear button was a permanent no-op. Removed; undo is the guard.
* **Autosave race condition**: timer fired on `this.design` (current), not
  the edited design. Switching glyphs inside the 600ms window wrote to the
  wrong file. Fixed by capturing `_queued` at schedule time and flushing on
  switch.
* **`setPointerCapture` throws for synthetic events**: wrapped in try/catch.
* **False arcs from endpoint snapping**: `describe()` was measuring sagitta
  against snapped chord, which tilted the chord under straight runs. Fixed
  by measuring against raw gesture endpoints.
* **Closed-shape closing segment always read as line**: the sample range for
  the closing run wrapped past the end of the point list, giving an empty
  range. Fixed by tracking `i0/i1` sample indices separately.
* **One correction is not a rule.** /e/ was turned into a positional variant
  pair from one example; the next word showed the same orientation in the
  opposite slot. Wait for both forms attested, in known slots, before
  splitting.

## 5. Open questions, in priority order

These are the live decoding problems. `CONTEXT.md` has fuller notes.

1. **Where do mid-word nulls come from?** Two confirmed spellings:
   `students` = `(s,t)(u,∅)(d,ə)(n,t)(s,∅)`,
   `metalbending` = `(m,ɛ)(t,ə)(l,∅)(b,ɛ)(n,d)(ɪ,ŋ)`.
   Both divide into two units, each paired independently. The split rule is
   unknown.

2. **appa breaks the pairing model.** Canon writes three blocks where
   pairing predicts two. Not explained by phoneme count or intervocalic
   consonants.

3. **/s/ doesn't follow the slot.** "students" uses different orientations
   for both /s/ in top slots. No slot rule can select them; use `S$`/`S%`.

4. **/x/ has no glyph.** The other six (tʃ, dʒ, ʃ, ʒ, ʊ and ɔɪ) were
   shipped from designer drawings with no recorded source.

5. **One unassigned mark** in the key.

6. **G2P accuracy** — rule-based, not dictionary-grade.

## 6. Working agreement

The user (TechFilmer on Avatar Wiki) supplies reference images and canon
spellings. Two things that have paid off:

* **Say when an image is too small to read** rather than guessing.
* **Don't over-generalise from one example.** Several corrections were
  turned into rules too early and had to be reverted.
* **Brush-first UX**: the user explicitly said "i really dont want to fuck
  around with curves and splines" — the brush fitter exists because of
  that. Node-by-node editing is the fallback, not the workflow.
