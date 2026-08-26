# Avatarian

**Avatarian** is the writing system seen in the *Avatar Legends* film. This
repo is the toolkit around it: a web translator that types English into
Avatarian, a JavaScript-free renderer for the [Avatar Wiki](https://avatar.fandom.com)
(a Lua module + CSS, so it works on mobile),
an attested corpus of every word anyone has been seen to write, and the
build tools that generate all of it from one glyph source.

**Try it:** [avatarian.techfilmer.com](https://avatarian.techfilmer.com) — type
anything and watch it appear in Avatarian. Avatarian spells *sounds*, not
letters, so it works on names and made-up words too.

Avatarian writes two sounds per stacked *block* (closer to Hangul than an
alphabet), so composition happens in code that emits positioned markup:
`render.js` on the site, and a Lua port of it on the wiki. Both are generated
from the same glyph source and checked byte-for-byte against each other, so
they draw identically.

## What's here

```
site/       the web app — translator, glyph reference, drawing pad (static, no server)
wiki/       the Fandom renderer (no JS): template, Lua module, CSS — all generated
corpus/     attested.json — words seen written, with their source images
designs/    one JSON per glyph, as drawn on the lattice
tools/      the build scripts and the two local editor servers
tests/      block model, sounds syntax, corpus validator (no deps)
```

Deeper docs:

- **`AVATARIAN.md`** — the script itself: the writing model, the full glyph
  inventory, and every open question. Start here for *how Avatarian works*.
- **`DEVELOPMENT.md`** — the full build/deploy/glyph-design walkthrough.
- **`DECIPHERMENT.md`** — how the script was worked out, and from what evidence.

## Run it locally

The site is static — just open `site/index.html` off the filesystem, or:

```bash
python3 -m http.server 8791 --directory site       # the translator      :8791
python3 tools/designer_server.py                   # the glyph designer  :8792
python3 tools/corpus_server.py                     # the workbench       :8793
```

The **designer** draws glyphs on their lattice; the **workbench** records
attested words a source at a time. Both write files back into the repo and
are local-only — they never deploy.

## Build

The manifest, corpus, and wiki renderer are all generated from source:

```bash
python3 tools/build_glyphs.py && python3 tools/build_manifest.py   # glyph SVGs -> site/js/manifest.js
python3 tools/build_corpus.py                                      # attested.json -> site/js/corpus.js
python3 tools/build_lua_module.py                                  # -> wiki/Module_Avatarian.lua
python3 tools/build_css_only.py                                    # -> wiki/Avatarian-css-only.css
python3 tools/build_corpus_wikitable.py                            # the corpus as a wiki table
```

## Test

```bash
python3 tools/run_tests.py
```

No dependencies — Python's `unittest` and node's built-in `--test`. Much of
the suite is the corpus itself, so coverage grows every time a word is
transcribed.

## Deploy

- **Site** → GitHub Pages, automatically on push to `main` (`.github/workflows`
  ships `site/`). Live at avatarian.techfilmer.com.
- **Wiki** → the `wiki/` files are pasted into the Avatar Wiki once, with **no
  JavaScript**: `Module:Avatarian` (Lua) renders the glyphs server-side and a
  CSS-only stylesheet draws them, so it works on the mobile skin (which runs no
  site JS). See `DEVELOPMENT.md` → "Rendering on the wiki" for the four-step
  setup, and re-run the two generators whenever a glyph or the render logic
  changes.

## Credit

See **`AVATARIAN.md` § Credit** — the single place credits are maintained
(the decipherment sources, the author, and the pronunciation dictionary).
