# Avatarian Translator — project scaffold (v1)

A static, no-server toolkit for the Avatarian conscript: English → Avatarian,
a click-to-build/decode tool, glyph key, MediaWiki integration for Avatar
Wiki (Fandom), and TTS for pronunciation checking.

## What's in here

```
site/            <- deploy this folder to GitHub Pages / Cloudflare Pages
  index.html       English↔Avatarian app, builder/decoder, glyph key, TTS
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

tools/
  build_glyphs.py       DRAWS the glyph SVGs (edit shapes here)
  extract_reference.py  cuts the key chart into one traced SVG per sound
  build_manifest.py     re-embeds both sets into js/manifest.js

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

Canon reference art (the "Katara, please do not be mad" note) shows
syllables composing into compact blocks, closer to Hangul than to an
alphabet. No font format does that kind of dynamic composition well, so
composition happens in the DOM instead.

Layout is derived from that reference art:

- each syllable is one block;
- **the vowel sits underneath the consonant** — verified against the first
  block of "Katara", where the /ə/ squiggle-and-dots mark sits directly
  below the /k/ glyph;
- both rows render at the same size;
- blocks pack tight with no borders; word spacing separates words.

The key chart notes "Consonants take up 3/4 height, Vowels take 1/4
height", which describes bands within a hand-lettered block rather than a
scale factor. Every glyph is drawn on one 100×100 grid, so shrinking the
lower row shrinks the whole mark instead of just its band, and vowels came
out too faint to read against their consonant. Sizing lives in the CSS —
`site/css/style.css` and `wiki/MediaWiki_Common.css.txt`, which have to
stay in step because both drive the same `render.js`.

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

Eight sounds have no symbol anywhere in the reference material and render as
a dashed "?" box throughout: **dʒ, ʃ, ʒ, x, ʊ, ɔ, ɔɪ, ɜ**. To fill one
in, add its path to `build_glyphs.py`, move its name out of the
`PLACEHOLDERS` dict, and re-run both scripts.

Not every glyph comes from `reference/avatarian_key.svg` — /ɑ/ was supplied
separately, so it has no tracing to sit beside. Add such a glyph to
`SOURCE_NOTES` in `build_glyphs.py` and the key tab will say where it came
from instead of flagging it the way it flags /tʃ/, which has no known
source at all.

`ɜ`'s file stem is `nurse`, not `er`. The rest of the stems are ARPAbet
codes, and ARPAbet's ER is the r-coloured ɝ — but `g2p.js` emits ɜ with
/r/ as a separate segment ("bird" → `ɜ r`), so the vowel carries no
r-colouring. It is named for its lexical set, the way ə is named `schwa`.

### Known open questions

The key chart shows several vowels (ɪ, e, æ, aɪ) with *two* positional
forms — the notes say "top/bottom", and æ appears as both a cup and a cap.
This renders one form per vowel. If the rule is that the form flips
depending on where the vowel sits in the block, that is a real feature
still to be implemented. The second æ form is extracted as `ae_alt` and
shows in the key tab under "in the key, not in the set".

Two more loose ends surfaced by the extraction:

* **/tʃ/ is drawn but has no source.** There is no tʃ anywhere in the key
  chart, yet `build_glyphs.py` has a shape for it. Either it came from
  material not in `reference/`, or it is an invention that should be
  demoted to a placeholder.
* **Two unassigned marks in the key.** The chart labels a "null" in the
  vowel block (extracted as `glot_v`, the cup) and carries an unlabelled
  wedge directly above it, which `CELLS` maps to `None` so it is skipped.
  Whether those are two forms of one null-vowel mark, or two different
  things, needs source material rather than a guess.

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

## TTS

Uses the browser's built-in Web Speech API (`speechSynthesis`) — no server,
no API key. "Hear English" speaks your input text normally, for checking
that the IPA/Avatarian actually matches what you meant. There's no reliable
cross-browser way to have TTS engines read raw IPA aloud, so this checks
pronunciation by round-tripping through the English word rather than by
literally vocalizing IPA symbols.

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
- Nine phonemes have no glyph yet (see above).
- Positional vowel variants ("top/bottom" forms) are not implemented.
- Punctuation (comma, question mark, apostrophe) is stripped, not rendered,
  though the key chart documents how each should behave.
- Reverse decode (clicked IPA → English) only matches the built-in
  exception dictionary; anything else shows as raw IPA.
