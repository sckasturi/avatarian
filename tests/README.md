# Tests

```bash
python3 tools/run_tests.py
```

Runs everything that can run headless. **No dependencies to install** —
Python's `unittest` and node's built-in `--test`, both stdlib. That is
deliberate: a suite you have to set up is a suite that stops being run.

One thing it can't cover, and prints a reminder about:

```
tests/recognise.html      open it in a browser
```

---

## What is here

| file | covers |
| --- | --- |
| `harness.js` | loads `site/js/*` into one context, the way a page does |
| `blocks.test.js` | pairing, nulls, the nine-row model |
| `sounds.test.js` | the ASCII syntax, captions, the round trip |
| `g2p.test.js` | the lookup chain and its order |
| `reverse.test.js` | fuzzy reverse-decode |
| `test_build_corpus.py` | the corpus validator and the save path |
| `recognise.html` | draw-to-recognise accuracy (browser only) |

`tools/check_geom.py` predates all of this and proves
`designer/js/geom.js` still matches `tools/glyphspec.py`. It is folded
into the runner so there is one command rather than two.

---

## The cases are real evidence, not invented

**The corpus is the fixture.** Nearly every structural assertion runs
against `corpus/attested.json` — the words somebody has actually seen
written — rather than examples made up to suit the code. That is what
`CORPUS.md` §4 means by the corpus being a research instrument: a change
to pairing, nulls or heights gets checked against every attested spelling
at once, and a failure names the word it broke.

It also means **the suite grows on its own.** Transcribe a source in the
workbench and every test here gets more evidence to run against, with no
test written.

The rest of the cases are mostly *remembered bugs* — the specific inputs
that broke an earlier version, recorded in the comments of the file they
test. An unclosed bracket, a caption spreading across word groups, an
orientation override that didn't survive the round trip. A suite written
after the fact earns its keep by remembering what already went wrong.

---

## Two tests that behave unusually

**C-C blocks are reported, not failed on.** The nine-row invariant holds
for V-C and C-V, but two consonants would be ten rows, and whether they
overlap by a shared row is genuinely unresolved (TODO **B1**). Asserting
either answer would be inventing one. So the test collects them and
prints the inventory:

```
ℹ 4 attested C-C blocks (TODO B1 — unresolved):
ℹ   please: (p,l)
ℹ   students: (s%,t)
ℹ   students: (n,t)
ℹ   metalbending: (n,d)
```

That list is exactly what B1 says it needs, and it will grow as the
corpus does. When the answer arrives, this test is where it gets encoded.

**V-V blocks DO fail.** "Only three block types occur: V-C, C-V, C-C —
V-V never happens, a null substitutes." That is a claim about the script,
so a V-V block in attested material contradicts it outright and should
stop the build.

---

## Why a `vm` context and not `require`

Everything in `site/js/` is a classic script, not a module, and the
shared global scope is load-bearing: `sounds.js` reads `ARPABET_TO_IPA`
off `g2p.js`, `reverse.js` calls `lexicon()` and `corpusWords()`.
`require`ing them would give each file its own scope and none of it would
resolve. A shared `vm` context reproduces the browser's arrangement,
including the load order.

Two things that cost time when writing it, both noted in `harness.js`:

- **A top-level `const` does not land on the global object.** Functions
  do; `const NULL_IPA` goes into the global *lexical* scope, invisible
  from outside the context. A test comparing against `ctx.NULL_IPA` would
  have been comparing `undefined` to `undefined` and passing. The harness
  folds each file's `module.exports` onto the context to get them back.
- **A `vm` context has its own intrinsics**, so an array made inside it
  fails `deepStrictEqual` against an identical one made outside — with a
  diff that shows them as equal. Anything crossing that boundary goes
  through `plain()` first.

---

## No DOM

Nothing loaded needs one, and the tests are written against the parts
that don't need one when called either — `resolveBlocks` rather than
`renderAvatarian`. That is why `resolveBlocks` exists: the null-resolution
decision used to be three lines inside the render loop, so the structural
rules of the script could only be checked by building elements and
reading them back. The model is the thing worth asserting and it should
not need an element tree.

What is therefore **not** covered: the DOM `renderAvatarian` produces —
class names, the flip class, `data-glyph`. Those are checked by eye and
by the CSS, and a jsdom dependency to assert them would cost more than it
would catch.

---

## The recogniser, and why it's a page

`recognise.js` samples its reference shapes with `getPointAtLength`,
which is browser geometry with no node equivalent. So `recognise.html` is
the test: it traces each glyph's own outline back through the matcher at
a random scale and offset, under four kinds of degradation, and checks it
still recognises itself.

The numbers are **floors, not targets**, set below what was measured when
the recogniser was written, and averaged over three passes because one
pass at a random scale is noisy enough to flake. They exist to catch a
scoring change that quietly makes things worse.

The weakest case — a whole stroke forgotten — sits around 25/42 top-1 and
32/42 top-3, and that is honest rather than a defect: draw half a glyph
and you have drawn a different shape. It is why the pad offers a ranked
list instead of one answer.

The sixth case is **exact, not a floor**: all eight flipping glyphs, drawn
the way they appear in a *bottom* slot, must come back as the right glyph
*and* as `flipped`. Getting `æ` with `flipped: false` from a drawn cap
would put the wrong orientation into a corpus entry, which is worse than
no match at all.

**The scripts are loaded with a cache-busting query.** This page reported
0/8 on a change that was actually correct, because the browser had held
on to the previous `recognise.js`. A test that silently runs against a
stale copy of its subject is worse than no test — and "caching lies" is
already the first entry under Traps in `HANDOFF.md`.
