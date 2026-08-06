# Avatarian Translator — project scaffold (v1)

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

A static, no-server toolkit for the Avatarian conscript: English → Avatarian,
a click-to-build/decode tool, glyph key, MediaWiki integration for Avatar
Wiki (Fandom).

## What's in here

```
site/            <- deploy this folder to GitHub Pages / Cloudflare Pages
  index.html       the whole app: English↔Avatarian, glyph reference
  js/g2p.js        English -> IPA (rule-based, no server/dictionary needed)
  js/render.js     IPA -> Avatarian glyphs (shared by site AND the wiki)
  js/manifest.js   generated — every glyph's SVG inlined (the whole "font")
  css/style.css
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

An odd number of phonemes leaves the final bottom slot empty, and the **∅
filler** — the ∪ cup, `null_v` — is written there. It is part of the
spelling, not padding. Five of the sample's words need it. (A taller
consonant-height null, `null_c`, the ⊓ gate, fills an empty consonant-height
slot. Neither null is a sound.)

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

**4-row vs 3-row vowels:** ɑ, e, ɪ, u fill the top lattice row and connect
upward (`VOWEL_4ROW` → `rows: 4` → `avatarian-4row` class); every other
vowel leaves the top row empty, so it sits with a gap below the consonant.

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

Getting a design into the shipped set is a deliberate copy-paste, not an
automatic rebuild — `build_glyphs.py` stays the one place the set is
defined:

    python3 tools/designs_to_svg.py --report      # what's drawn, what isn't
    python3 tools/designs_to_svg.py m --python    # a build_glyphs.py entry

The designer's canvas uses a JavaScript port of the geometry so dragging
redraws at pointer speed, but everything it hands back — the SVG, the
snippet above — is rendered by the Python, so what you paste is what the
build will draw. `python3 tools/check_geom.py` proves the two still agree.

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

Seven sounds have no symbol anywhere in the reference material and render as
a dashed "?" box throughout: **tʃ, dʒ, ʃ, ʒ, x, ʊ, ɔɪ**. To fill one
in, add its path to `build_glyphs.py`, move its name out of the
`PLACEHOLDERS` dict, and re-run both scripts.

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

  The vowel-block null itself is settled: it is `null_v`, the ∪ cup, and
  it fills an empty vowel-height slot. That resolved the old "two nulls"
  question — **neither** null is a sound. The ⊓ gate (`null_c`) is just the
  consonant-height filler for an empty consonant-height slot; it was briefly
  mis-labelled `glot` /ʔ/, which it never was. The writing sample shows the
  ∪ cup under "not", "mad", "when", "wake" and "but", every one of which has
  an odd phoneme count.

## The English → IPA converter (g2p.js)

This is a compact, dependency-free, rule-based letter-to-sound converter —
not a full pronouncing-dictionary lookup, so it's solid on regular English
spelling and rougher on irregular words and names. A small hand-written
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
- Seven phonemes have no glyph yet (tʃ, dʒ, ʃ, ʒ, x, ʊ, ɔɪ — see above).
- Positional vowel variants ("top/bottom" forms) are not implemented.
- Punctuation (comma, question mark, apostrophe) is stripped, not rendered,
  though the key chart documents how each should behave.
- Reverse decode (clicked IPA → English) only matches the built-in
  exception dictionary; anything else shows as raw IPA.
