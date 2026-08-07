# Avatarian Translator — project scaffold (v1)

## Credit

**See `AVATARIAN.md` § Credit** — the one place credits are
maintained. It covers the decipherment sources, the tool's author and
the pronunciation dictionary, and notes the two public-facing copies
(the site footer and the wiki files) that must stay in step with it.

A static, no-server toolkit for the Avatarian conscript: English → Avatarian,
a click-to-build/decode tool, glyph key, MediaWiki integration for Avatar
Wiki (Fandom).

> **What's next?** `TODO.md` is the one backlog.
>
> **New here?** `AVATARIAN.md` is the single reference for the *script itself* —
> the writing model, the full glyph inventory, and every open decoding
> question, gathered in one place. This README covers the *tool*: how it's
> built and deployed.

## What's in here

```
site/            <- deploy this folder to GitHub Pages / Cloudflare Pages
  index.html       the whole app: English↔Avatarian, glyph reference
  js/g2p.js        English -> IPA (rule-based, no server/dictionary needed)
  js/sounds.js     the ASCII sounds syntax, in and out (site + designer)
  js/render.js     IPA -> Avatarian glyphs (shared by site AND the wiki)
  js/manifest.js   generated — every glyph's SVG inlined (the whole "font")
  css/blocks.css   block layout (site + wiki + the designer's live preview)
  css/style.css    the page around it
  assets/glyphs/   one clean SVG per phoneme
  assets/glyph_manifest.json   generated index of glyph files + status
  assets/reference/            generated — traced shapes from the key
  assets/reference_manifest.json  generated index of those tracings

reference/
  avatarian_key.svg  the hand-lettered key chart, as exported from Inkscape

designer/        <- the glyph designer: a LOCAL-ONLY second site, not deployed
  index.html       draw a character on its 5×5 / 5×4 lattice
  js/fit.js        reads a freehand gesture into lines, arcs and dots
  js/import.js     takes a design/svg/python entry back in as a baseline
  js/geom.js       the design format's geometry, ported for the canvas
  js/editor.js     the lattice canvas: drawing, hit-testing, dragging
  js/store.js      state, undo, autosave to designs/
  js/live.js       the glyph in real blocks, drawn by the site's render.js
  js/app.js        sound list, previews, output panel

designs/         <- one JSON per character, as drawn on the lattice
  README.md        the format, in full
  <name>.json

tools/
  build_glyphs.py       DRAWS the glyph SVGs (edit shapes here)
  extract_reference.py  cuts the key chart into one traced SVG per sound
  build_manifest.py     re-embeds both sets into js/manifest.js
  glyphspec.py          the design format + the one way to render it
  designer_server.py    serves designer/ and writes designs/ (port 8792)
  designs_to_svg.py     a design -> SVG, or -> a build_glyphs.py entry
  promote.py            a design -> INTO build_glyphs.py, then rebuild
  check_geom.py         proves geom.js still matches glyphspec.py

wiki/            <- paste these into the Fandom wiki, once
  Template_Avatarian.wiki       wikitext for {{avatarian|hello}}
  MediaWiki_Common.js.txt       renders every {{avatarian}} on the page
  MediaWiki_Common.css.txt      sizing/positioning for the glyphs

```

## Testing locally

Just double-click `site/index.html` — it works straight off the filesystem,
no local server needed. (The glyph manifest is loaded as a plain `<script>`
rather than fetched as JSON specifically for this reason: browsers treat
every `file://` page as a unique opaque origin and CORS-block `fetch()`,
so a fetched manifest would fail with nothing but console errors.)

## Deploying the site (zero maintenance)

**GitHub Pages:** create a repo, push the contents of `site/` to it (root
or a `docs/` folder), enable Pages on that branch in repo Settings. Done —
no build step, it's plain HTML/JS.

**Cloudflare Pages:** connect the repo, set build command to *(none)* and
output directory to `site`. Done.

## Hooking up the wiki

1. Deploy `site/` first and copy its public URL.
2. Open `wiki/MediaWiki_Common.js.txt`, replace the placeholder URL at the
   top with your deployed site's URL, then paste the whole file into
   **MediaWiki:Common.js** on Avatar Wiki (needs wiki-admin/JS-editor rights).
3. Paste `wiki/MediaWiki_Common.css.txt` into **MediaWiki:Common.css**.
4. Create **Template:Avatarian** using `wiki/Template_Avatarian.wiki`.
5. Use it in any article: `{{avatarian|hello}}` or, when you already know
   the exact pronunciation, `{{avatarian|hello|ipa=h ɛ l oʊ}}`.

No font upload, no Lua/Scribunto module, no server needed — the template
just tags the text, and the wiki's Common.js renders the real glyphs
client-side using the same code as the standalone site. If a reader has
JavaScript off, they see the plain English text instead of nothing.

## Why this isn't a literal font

Canon reference art shows sounds composing into compact blocks, closer to
Hangul than to an alphabet. No font format does that kind of dynamic
composition well, so composition happens in the DOM instead.

### Blocks are pairs, not syllables

Phonemes are written **in strict order, two to a block**, top slot then
bottom slot, with blocks running left to right. Nothing about the layout
depends on a sound being a consonant or a vowel — a block is just the next
two sounds in the word.

```
please  /p l i z/    (p,l) (i,z)
at      /æ t/        (æ,t)          <- vowel on TOP
up      /ʌ p/        (ʌ,p)          <- vowel on TOP
not     /n ɑ t/      (n,ɑ) (t,∅)
mad     /m æ d/      (m,æ) (d,∅)
```

This was read off a labelled writing sample — "please do not be mad at me
when you wake up, but" — and holds for all twelve of its words. It replaced
an earlier syllable model (consonants clustered on top, vowel beneath),
which happened to agree on CV words like "katara" and disagreed on
everything else. It also explains why /ɑ/ looked inverted between "katara"
and "appa": it was in different slots.

An odd number of phonemes leaves the final bottom slot empty, and a **null**
filler is written there — part of the spelling, not padding. Five of the
sample's words need it. Which null goes in depends on what it's paired
with: **a vowel paired with a null takes the 5-height null; a consonant
paired with a null takes the 3-height null.** Neither null is a sound.

This is what `render.js` does: `nullFor(partner)` picks the tall `∅c`
beside a vowel and the short `∅` beside a consonant, which is also what
keeps a block nine rows tall whatever is in it (4+5 or 5+4). It applies
to a null you type as well as one the renderer inserts, so `0` means "a
null" and the sound beside it decides which — including mid-word, where
canon puts nulls the renderer can't yet derive.

Blocks pack tight with no borders; word spacing separates words.

### Heights are the script's native units — always on

Consonants render 52×52, vowels 52×41.6 — 5 units tall against 4, stacked
flush (9-row blocks). This used to be an off-by-default "Proportional
heights" checkbox; as of session 4 it is the only mode, so the checkbox and
the `avatarian-proportional` body class are gone and the proportional values
are the base CSS rules.

The ratio applies to **height only**: vowels keep the full block width,
because canon draws them wide and flat, spanning their partner. They get
that shape by swapping to a separately generated 100×80 drawing rather than
by being squashed at render time, so every glyph is scaled **uniformly** —
stroke weight is identical for every glyph and dots stay round. (An earlier
version stretched a square drawing with `preserveAspectRatio="none"` and
patched the weight back in CSS; that distorted everything the scale touched.
Don't reintroduce it.)

Sizing follows the **sound**, not the slot, so a vowel in the top slot is
still short — which happens whenever a word starts with one.

**The two glyphs in a block share a lattice edge**, so the bottom slot is
pulled up (`.avatarian-slot-bottom { margin-top: -9.36px }`) by the sum of
the two SVGs' clearance margins, or the lattices wouldn't meet. A residual
one-row gap for 4-row vowels (e.g. T+ɑ) is a design-convention question, not
a rendering one — see `HANDOFF.md` and `CONTEXT.md`.

**4-row vs 3-row vowels:** the confirmed set, in ARPAbet, is **AA, AW,
EY, IH, OY, UH, UW**; every other vowel is 3-row. Every vowel design now
carries its own `rows`, set from the designer's **rows** toggle, and
`build_glyphs.py` reads it — `VOWEL_4ROW_BASE` is only the fallback for a
vowel with no design.

**Read that list as ARPAbet codes, not file stems.** The two do not track
each other and reading it wrong gets two of the seven backwards: stem
`uh` is /ʌ/ (ARPAbet **AH**, 3-row) while ARPAbet **UH** is /ʊ/ (stem
`oo`, 4-row); stem `aw` is /ɔ/ (ARPAbet **AO**, 3-row) while ARPAbet
**AW** is /aʊ/ (stem `au`, 4-row).

A 4-row vowel's ink spans lattice `y` 0.5–3.5; a 3-row vowel's spans
1.5–3.5. `glyphspec.validate` checks a design's declared `rows` against
where its ink actually starts, so declaring one and drawing the other is
reported in the designer rather than riding silently through the
manifest.

The key chart's own note, "Consonants take up 3/4 height, Vowels take 1/4
height", describes bands within a hand-lettered block rather than a scale
factor; rendering it literally left vowels unreadable. Every glyph is drawn
on one 100×100 grid, so shrinking a mark shrinks the whole thing instead of
just its band — keep the ratio and the base size legible
together. Sizing lives in the CSS — `site/css/style.css` and
`wiki/MediaWiki_Common.css.txt`, which have to stay in step because both
drive the same `render.js`.

**What still differs from canon:** in the reference, adjacent glyphs are
hand-lettered so their strokes interlock and share edges, and blocks are
visibly skewed/organic. This renders glyphs as discrete raster images
butted together, so it reproduces the *structure* correctly but not the
stroke-level fusion. Getting that would need the glyphs redrawn as vectors
with defined connection points — a worthwhile v2, but a different kind of
project (real type design) rather than a layout tweak.

## The glyphs

They are **drawn, not traced.** Each is constructed from geometric
primitives (arcs, straight segments, dots) on a shared 100×100 grid with
one stroke weight, round caps and joins, so the set reads as a single
coherent script rather than a pile of scanned handwriting. They are clean
interpretations of the reference key chart — a canonical form of each
symbol, not a facsimile of the hand-lettered original.

Everything lives in `tools/build_glyphs.py`, one labelled entry per sound.
To adjust a shape, edit its path there and re-run:

    python3 tools/build_glyphs.py     # redraw the SVGs
    python3 tools/build_manifest.py   # re-embed them into js/manifest.js

### Designing a glyph on the lattice

Writing path coordinates by hand is a poor way to work out what a shape
*is*. The designer is for that part — a local-only site where a character
is drawn on the script's own lattice, **5×5** cells for a consonant and
**5×4** for a vowel, with the traced key shape and the current glyph
available as underlays to line up against:

    python3 tools/designer_server.py     # http://localhost:8792/

**Draw the shape freehand and it gets tidied up.** A brushed stroke is
read against the lattice: corners land on lattice points, runs meant to be
straight come out straight, curves come out as real circular arcs (snapped
to exact quarters and halves), a small scribble becomes a dot, and a
gesture that returns to its start closes itself. Weights, margins and the
vowel's two heights come out of `tools/glyphspec.py` afterwards.

`R` re-reads the same gesture at a different tidiness — every brushed
stroke keeps the raw gesture it was fitted from, so re-reading always goes
back to what you drew rather than compounding one fit on another.

**paste in…**, by the output tabs, takes back any of the three things the
panel hands out — a design JSON, an SVG, or a `build_glyphs.py` entry — so a
letter that's nearly right can be the baseline for the next one. **or copy
from** fills it straight from another glyph. The **mirror** toggles (`↔`
left–right, `↕` top–bottom) in the paste box reflect the incoming shape as
it is loaded — the fastest way to start from a mirror pair. A design JSON is
already lattice data and comes in untouched; an SVG or a Python entry is
sampled and fitted like a brush stroke.

**In-place mirror** (`⇄` / `⇅` in the toolbar, or `Shift+H` / `Shift+V`)
reflects the current design without reloading — undoable with `⌘Z`.

**use it**, next to the *current glyph* underlay, starts from the glyph the
set already ships instead of a blank lattice — it samples that drawing back
into a gesture and runs it through the same fitter, so you get an editable
lattice design rather than a copy of the old path.

The fitter is an input method, not a second geometry system: it writes the
ordinary line-and-arc format, so nothing downstream knows how a shape was
made. Node-by-node drawing is still there, in the **by hand** tray, for
fixing something the fit read wrong. Each glyph autosaves to
`designs/<name>.json`; `designs/README.md` documents the format.

### Seeing it in the actual product

The three small previews show a glyph on its own, which is the one place
none of the interesting questions live. Whether a vowel's connecting
stroke reaches the consonant above it, whether a 3-row vowel leaves the
gap it should, whether a flipped glyph points its stem at its neighbour —
all of that only shows up with the glyph's **partner** next to it.

So **in a block** renders it in real blocks, at product size, and **in a
word** takes the same ASCII sounds syntax the app does (it opens on the
sound's example word). Both are drawn by `site/js/render.js` against
`site/css/blocks.css` — the designer links the real files over `/site/`
rather than restating them, so the preview can't drift from the product.
The glyph being edited is swapped into the manifest first, and the SVG it
is swapped in from comes back from `glyphspec.py`, so what you see is
what the build would draw and not what the canvas thinks.

### Flips, and 3-row vs 4-row

Two facts about a glyph aren't its shape: whether it **flips by slot**,
and whether a vowel is **3-row or 4-row**. Both used to be hand-edited
sets in `build_glyphs.py`, which meant the designer — where you actually
find these out — couldn't record them. They now live in the design:

    designs/<name>.json   "flips": true,  "rows": 4

set from the checkbox and the row toggle beside the previews, and read
back by `build_glyphs.py` at build time. `FLIPS` and `VOWEL_4ROW` stay
there as `FLIPS_BASE` / `VOWEL_4ROW_BASE`, the fallback for anything with
no design. Overriding is explicit both ways — `"flips": false` turns a
base entry off, so absence and false are not the same thing.

Declaring `rows` doesn't move ink: a 4-row vowel is *taller* than a
3-row one (0.5–3.5 against 1.5–3.5), not the same shape shifted, so
which one a drawing is is a drawing decision. What the toggle does give
you is a check — declare 4-row with nothing drawn above `y=1` and the
problems panel says the top row is empty and it won't reach the
consonant above.

### Getting it into the set

`build_glyphs.py` stays the one place the set is defined, and promotion
stays a deliberate act — but it is one button now rather than a
copy-paste:

    python3 tools/designs_to_svg.py --report      # what's drawn, what isn't
    python3 tools/designs_to_svg.py m --python    # a build_glyphs.py entry
    python3 tools/promote.py m --dry-run          # what shipping would change
    python3 tools/promote.py m                    # write it in and rebuild
    python3 tools/promote.py --all --dry-run      # which glyphs differ at all
    python3 tools/promote.py --all                # ship every one that does

**ship it**, by the live preview, does the single-glyph one: it writes the
entry into the right dict in `build_glyphs.py` in the layout a human would
use, drops the name from `PLACEHOLDERS` if it was there, and runs both
build scripts. Reload the site and the glyph is the one you just drew.

**ship all…** in the header does the whole set — it is a whole-set
action, which is why it sits up there rather than beside the per-glyph
button. Two presses: the first reports, in a strip under the header,
which glyphs actually differ from what ships and changes nothing; the
second ships them. The list is the useful half — designs and the shipped
set have drifted apart on a good number of glyphs, and which direction is
right is a decision rather than a build step. Every entry is edited
against the running source and the build runs once at the end, so it
can't leave the tree half-built. Placeholders are skipped; ship those one
at a time, deliberately.

Shipping a sound that is still a **placeholder** takes saying so twice —
that ADDS a glyph the set doesn't have, rather than adjusting one it
does, which is a bigger step. The first press says so; a **ship anyway**
button appears for going ahead. `--all` skips them entirely.

The designer's canvas uses a JavaScript port of the geometry so dragging
redraws at pointer speed, but everything it hands back — the SVG, the
snippet, the live preview, what `ship it` writes — is rendered by the
Python, so what lands is what the build will draw. `python3
tools/check_geom.py` proves the two still agree.

Glyphs are inlined into `js/manifest.js` (~16 KB for the whole set) rather
than loaded as image files. That is what lets the site work over `file://`,
lets the wiki gadget run with no image hosting at all, and lets glyphs
inherit the surrounding text colour and scale crisply at any size.

### Comparing a glyph against the key

`reference/avatarian_key.svg` is the hand-lettered chart the drawn set is
interpreting: one Inkscape export in which every glyph lives inside a
single giant filled `<path>`, with the IPA labels alongside as `<text>`.
`tools/extract_reference.py` splits that path into subpaths, clusters
neighbouring subpaths back into glyphs, and writes each one out on the same
100×100 grid the drawn set uses:

    python3 tools/extract_reference.py   # re-cut the key into per-sound SVGs

Which cluster is which sound is an explicit table (`CELLS`) keyed on each
cluster's centroid in the chart's own coordinate space, hand-verified
against the chart — the chart's labels sit inconsistently (some left of
their glyph, some right) and two marks carry no label at all, so proximity
matching is not trustworthy here. The script warns loudly if a cluster
falls outside the table or a table entry matches nothing, so a bad edit to
the key can't silently drop a glyph.

The output only needs regenerating when the key itself changes. It feeds
the **Glyph key & status** tab, where every cell shows the drawn glyph
beside its traced original, with a toggle to overlay one on the other.
That tab is the working surface for this: compare, note which shapes have
drifted, fix them in `build_glyphs.py`, re-run, look again.

### Still unresolved

**/x/ is the only sound left with no glyph**, and it renders as a dashed
"?" box. To fill it in, draw it in the designer and press **ship it** —
that writes the path into `build_glyphs.py`, moves the name out of the
`PLACEHOLDERS` dict and re-runs both scripts in one go.

The other six — tʃ, dʒ, ʃ, ʒ, ʊ and ɔɪ — were placeholders until they
were drawn in the designer and shipped. They come from **source material
outside the key chart**, which is why they were never in
`reference/avatarian_key.svg` and have no tracing to sit beside; they are
listed in `SOURCE_NOTES` for that reason, as `/ɑ/` and `/ɔ/` are. Nothing
in the set is invented — /x/ has no glyph precisely because no source for
one has been found.

Not every glyph comes from `reference/avatarian_key.svg` — /ɑ/ and /ɔ/ were
supplied separately, so they have no tracing to sit beside. Add such a glyph
to `SOURCE_NOTES` in `build_glyphs.py` and the key tab will say where it came
from.

`ɜ` and `ə` are **mirror images, and separate glyphs**. `ə` (`schwa`) has its
recurve ascending left to right with the dot above on the left; `ɜ` (`nurse`)
descends with the dot below on the left. They were briefly merged onto one
file because a reference screenshot labelled a single mark `ə/ɜ` — that was
wrong. The stem is `nurse`, never `er`: the rest of the stems are ARPAbet
codes and ARPAbet's ER is the r-coloured ɝ, but `g2p.js` emits ɜ with /r/ as
a separate segment, "bird" → `ɜ r`, so the vowel carries no r-colouring.

### Orientation

Each glyph is drawn once, in its **top-slot form**. Some glyphs mirror
top-to-bottom when they land in a bottom slot; most don't. The ones that do
are listed in `FLIPS` in `tools/build_glyphs.py`:

| sound | evidence |
| --- | --- |
| æ | "at" (top, cup ∪) vs "mad" (bottom, cap ∩) |
| ɑ | "appa" (top, proper Y) vs "katara" (bottom, stem up) |
| l | "please" (bottom); the key chart draws both orientations |
| ɪ | "metalbending" |
| e | "Aang" (top) vs "wake" (bottom) |
| aɪ | key chart (rule above, dots below) vs "fire" (dots above the rule) |

This replaced a table of hand-drawn variant pairs — every pair in it was an
exact vertical mirror, so one drawing plus a flip does the same job with
half the assets. It is deliberately a list rather than a blanket rule: most
glyphs keep one orientation, so only add a sound here against a word that
actually shows it flipped.

The table above is `FLIPS_BASE`. A glyph is added or removed from the
designer, with the **flips by slot** checkbox — it saves into that
glyph's design and the build reads it back, so the evidence and the flag
get recorded in the same sitting rather than one of them being forgotten
in a Python set.

**/s/ is the exception**: "students" writes both of its /s/ in top slots and
uses a different orientation for each, so no slot rule can select them. Use
the `$` / `%` override there.

### The sounds syntax

The app is one page: type English and convert, or type sounds directly.
The **sounds box** is what actually gets drawn, and it is always editable —
`g2p.js` is rule-based and gets words wrong ("wake" comes out `/w æ k/`), so
rather than misspelling the English to trick it ("waike") you fix the sounds.

It is **ASCII-first, typeable on a plain QWERTY keyboard**. Sounds are
separated by spaces, words by `/`:

```
S$ T UW 0 D AX N T S 0   /   M EH T AX L 0 B EH N D IH NG
students                     metalbending
```

* **ARPAbet codes** are the primary spelling — the table `g2p.js` already
  converts through, extended with `AX` (schwa) and `NUL`, which ARPAbet has
  no codes for. Case-insensitive.
* **IPA is accepted too**, plus aliases: `eɪ` for `e`, `ɝ`/`ɜr` for `ɜ`.
* **`0`** (or `_`, `-`) is the `∅` empty-slot filler.
* **`$` / `%`** suffixes force a glyph's top or bottom orientation — `S$`.
  Needed where the slot doesn't decide it, currently only /s/.
* **`(parentheses)`** caption a word rather than being read as sounds, so
  `M EH T AX L 0 B EH N D IH NG (metalbending)` draws captioned. Converting
  from English emits these automatically, and since the label is part of the
  text it survives any later editing.

The drawing updates as you type — there is no draw button. **Insert sounds**
appends to the box rather than replacing it, so a line can be built a piece
at a time (convert what `g2p` handles, then fix or type the rest). Anything
that maps to no glyph is named in a warning rather than silently dropped. The glyph reference below the output doubles as a palette: clicking
a glyph appends its code to the box, and each cell shows the code you type.
The traced key shapes are hidden behind a checkbox, so the chart reads as a
plain reference until you want to compare against the source.

Two more loose ends surfaced by the extraction:

* **/tʃ/ was drawn from nothing.** There is no tʃ anywhere in the key
  chart, yet `build_glyphs.py` carried a shape for it — an invention that
  looked exactly as authoritative as the sourced glyphs. It is now a
  placeholder. Restore it only against real source material.
* **One unassigned mark in the key.** An unlabelled wedge sits directly
  above the vowel-block null; `CELLS` maps it to `None` so it is skipped.
  It needs source material rather than a guess.

  The vowel-block null itself is settled as a concept: `null_v` (the ∪ cup)
  and `null_c` (a squared ∪) are the two null fillers, and **neither is a
  sound** — that resolved the old "two nulls" question, and `null_c` was
  briefly mis-labelled `glot` /ʔ/, which it never was. Which one is used
  where is corrected in session 5, above — the shipped code currently picks
  by the null's own height class; the confirmed rule instead picks by what
  the null is paired with. The writing sample shows a null under "not",
  "mad", "when", "wake" and "but", every one of which has an odd phoneme
  count.

## The English → IPA converter (g2p.js + lexicon.js)

Three layers, in order:

1. **`EXCEPTIONS`** in `g2p.js` — the hand list. Avatar vocabulary and the
   coined compounds no dictionary has (`metalbending`, `waterbender`,
   `Kyoshi`, `Omashu`). Anything here wins.
2. **`js/lexicon.js`** — the CMU Pronouncing Dictionary, ~126k words,
   mapped onto this project's phoneme set. Generated by
   `tools/build_lexicon.py`; see that file for the mapping decisions.
3. **`RULES`** — the original letter-to-sound scanner, now the fallback
   for anything the first two don't cover.

The dictionary is what made the site usable by someone who doesn't know
IPA. On a 22-word test sentence the rules alone got 13 words wrong
(`measure` → /m i s j ʊ r/, `good` → /g u d/, `that` → /θ æ t/); with the
lexicon the same sentence comes out right. It also finally gives
**unstressed-vowel reduction** — CMU marks stress, and unstressed `AH`
maps to schwa, so "students" is /s t u d ə n t s/ rather than
/s t u d ɛ n t s/. That was a standing known-limitation.

It costs ~1.6 MB of inline JS (~650 KB gzipped, which is what a host
actually serves). It has to be inline for the same reason the glyph
manifest is: `fetch()` is CORS-blocked on `file://`. The index is built
lazily on the first word converted — ~60 ms once, then ~0.0002 ms a
lookup — so a visitor who never converts anything never pays for it.

**The wiki gadget does not load it.** 1.6 MB on every article that uses
`{{avatarian}}` is not a reasonable trade; the template's `ipa=`
parameter is the answer there.

The rule layer, for reference — it is still what handles anything the
other two miss: A small hand-written
exception dictionary (`EXCEPTIONS` in `g2p.js`) already covers a few
Avatar-relevant words (world, water, fire, earth, avatar...) — extend that
list first for anything that comes out wrong. For production-grade
accuracy, swap it for a bundled CMU Pronouncing Dictionary lookup (the
ARPAbet→IPA table is already included in `g2p.js` as `ARPABET_TO_IPA`,
ready for that upgrade) — that's a v2 item too, since a full dictionary is
a few MB and worth deciding on deliberately rather than shipping by default.

The template also accepts an explicit `ipa=` parameter for exactly this
reason — use it whenever you already know the correct pronunciation and
don't want to rely on the guesser.

## Known limitations (v1)

- Glyphs are butted together, not stroke-level fused/interlocking like
  hand-lettered canon (see "Why this isn't a literal font").
- G2P is rule-based, not dictionary-grade. It now handles the full canon
  sentence correctly (`katara please do not be mad` →
  /k ə t ɑ r ə/ /p l i z/ /d u/ /n ɑ t/ /b i/ /m æ d/), but unusual words
  and names still need `ipa=` or an EXCEPTIONS entry.
- Unstressed-vowel reduction isn't modelled, so some interior vowels come
  out as full vowels where canon would use a schwa
  (e.g. "metalbending" → /m ɛ t æ l .../ rather than /m ɛ t ə l .../).
- /x/ has no glyph yet; six others were drawn and shipped without a
  recorded source (see above).
- Positional vowel variants ("top/bottom" forms) are not implemented.
- Punctuation (comma, question mark, apostrophe) is stripped, not rendered,
  though the key chart documents how each should behave.
- Reverse decode (clicked IPA → English) only matches the built-in
  exception dictionary; anything else shows as raw IPA.
