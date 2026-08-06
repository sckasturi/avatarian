# Avatarian — session handoff

Read `README.md` for architecture and `CONTEXT.md` for the decoding rules
and open questions. Both are current. This file covers what changed across
the sessions that built the designer, plus session 4 below, and what to do
next.

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
   /ʔ/.** The ⊓ gate is not a glottal stop — it's a *consonant-height* null
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

- `designs/glot.json` and `designs/glot_v.json` still carry the old names;
  `designs_to_svg.py --report` lists them as "designs with no matching sound"
  and `null_c`/`null_v` as "not yet designed". Rename the files (and their
  `name`/`ipa`/`type` fields) when convenient. `null_c` type is
  `null_consonant`, grid 5×5; `null_v` type is `null` (mark), grid 5×4.
- Wiki CSS was brought in step with the site (null_consonant sizing + the
  gap-collapse margin), but the wiki JS/template weren't touched this session.

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

4. **Seven sounds have no glyph**: tʃ, dʒ, ʃ, ʒ, x, ʊ, ɔɪ.

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
