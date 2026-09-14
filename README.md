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
site/            the web app — translator, glyph reference, drawing pad, contribute page (static, no server)
wiki/            the Fandom renderer (no JS): template, Lua module, CSS — all generated
corpus/          attested.json — words seen written, with their source images; incoming/ — public submissions awaiting review
designs/         one JSON per glyph, as drawn on the lattice
tools/           the build scripts and the two local editor servers
contrib-worker/  the Cloudflare Worker behind the public contribute page
tests/           block model, sounds syntax, corpus validator (no deps)
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

## Contribute to the corpus (the public path)

The workbench writes files, so it is local-only. The public
[contribute page](https://avatarian.techfilmer.com/contribute.html) reuses
the same client-side transcription tooling but cannot write to the repo —
Pages is static. Instead it posts to a small Cloudflare Worker
(`contrib-worker/`) that opens a **pull request**, staging the sighting as
one file under `corpus/incoming/` with its image in `site/sources/`.

The flow, and where authority stays:

1. A visitor reads the glyphs off an image and submits. Anyone can — no
   GitHub account needed.
2. The Worker does cheap sanity + anti-spam checks and opens the PR. It
   **cannot** write to the corpus; it can only propose.
3. CI (`.github/workflows/validate-contrib.yml`) folds the staged
   submission into the corpus in memory and runs the **same**
   `build_corpus.check` that guards every other write. A bad submission
   fails here and cannot be merged.
4. You review and merge, then promote it:

```bash
python3 tools/promote_corpus.py --list          # what's waiting
python3 tools/promote_corpus.py <file>.json      # fold it into attested.json + rebuild
```

Promotion routes through the same `build_corpus.save` as every other write,
so a community submission is held to exactly the corpus's rules. Setting up
the Worker (bot token, Turnstile, deploy) is a one-time job — see
[`contrib-worker/README.md`](contrib-worker/README.md).

**Have a GitHub account?** You don't need the Worker. The contribute page has
a *"Open the pull request yourself"* option that builds the same staged file
and hands it to GitHub's new-file editor prefilled — you upload the image,
commit, and open the PR under your own name. Or do it entirely by hand: drop
the image in `site/sources/`, add a submission file under `corpus/incoming/`
(shape in [`corpus/incoming/README.md`](corpus/incoming/README.md)), and open
a PR. CI validates it identically either way.

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
