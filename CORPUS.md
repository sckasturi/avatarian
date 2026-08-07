# The corpus — attested Avatarian, and what to build on it

**Status: design note. Nothing here is implemented.** Written 2026-08-06,
at the end of the session that shipped the pronunciation dictionary and
rebuilt the site's front page.

This is about **provenance for WORDS**, which is a separate question from
provenance for glyphs. Glyph provenance is settled and closed (see
`HANDOFF.md`) — every glyph in the set is sourced. Word provenance is
wide open: for almost every word the site draws, nobody has ever seen it
written in Avatarian. The tool infers the spelling and shows the result
with exactly the same confidence as a word copied straight off a
reference image. That is the problem.

---

## 1. The problem, concretely

The pipeline the site ships today is:

```
English  ->  pronunciation  ->  phonemes  ->  pairUp()  ->  blocks
             (dictionary)                     (2 at a time,
                                               null on the odd end)
```

Two things in that chain are guesses, and the output doesn't distinguish
them from fact.

### The pronunciation can be wrong

`toph` is in `EXCEPTIONS` in `g2p.js` as `t oʊ f` — the natural English
reading, rhyming with "loaf". **The reference material shows `T AA F`**
(/t ɑ f/), rhyming with "off". The tool is confidently wrong, and there
was no way to know without checking a source.

This will not be the only one. Every in-world name is a guess unless
someone has seen it written.

### The spelling can be wrong even when the pronunciation is right

`appa` is the sharp case. Pairing predicts two blocks, `(ɑ,p)(ɑ,∅)`.
**Canon writes three**, which in the site's own sounds syntax is:

```
AA 0 P 0 AA 0        ->  (ɑ,∅) (p,∅) (ɑ,∅)
```

Every phoneme gets its own block, padded with a null. This matches what
`AVATARIAN.md` §10.3 already records from the reference art — "three
blocks (Y, /p/, Y each over a null)" — so the two independent readings
agree. It has sat in the docs as "appa breaks the pairing model,
unresolved" ever since.

**Why** it is written that way is still unknown. That is fine. The point
of a corpus is that we do not need to know why in order to be right.

### The same unknown, elsewhere

The two other long-standing open questions are the same shape:

- **Mid-word nulls.** `students` = `(s,t)(u,∅)(d,ə)(n,t)(s,∅)` and
  `metalbending` = `(m,ɛ)(t,ə)(l,∅)(b,ɛ)(n,d)(ɪ,ŋ)`. Both split into two
  units, each padded independently. What decides the split is unknown —
  it is not morpheme boundaries and not syllables (`CONTEXT.md` has the
  full argument).
- **/s/ orientation.** "students" writes both of its /s/ in top slots
  with different orientations, so no slot rule can select them. The
  `S$`/`S%` override exists purely to spell this out by hand.

A corpus records all three as data instead of deriving them.

---

## 2. What the corpus is

**One entry per attested word or phrase, recording the spelling actually
observed, and where it was observed.**

The spelling is stored as a **sounds-syntax string** — the same thing the
site's sounds box takes. That is deliberate: it already encodes
everything an attested spelling needs, including explicit nulls
(`AA 0 P 0 AA 0`) and forced orientations (`S$`), and it round-trips
through code that already exists. A corpus entry is literally a line
someone could paste into the site.

Sketch of an entry:

```
word:     appa
spelling: AA 0 P 0 AA 0
gloss:    Appa
source:   writing-sample-3.png, second line, third word
note:     three blocks where pairing predicts two; each phoneme
          padded with its own null. Reason unknown.
confidence: certain          # certain | probable | unclear
```

Notes on the shape of this:

- **`word` is the lookup key** and should be normalised the way
  `wordToIPA` normalises (lowercased, punctuation stripped).
- **Phrases matter too.** "Ba Sing Se" may be written as a unit. The key
  needs to allow multi-word entries, which means lookup has to try the
  longest match first rather than assuming one word at a time.
- **`source` must be specific enough to re-check.** A filename alone is
  not enough a year from now; line and position, or a crop, is.
- **`confidence`** because some samples are small, skewed, or partly
  obscured. An unclear reading should still be recorded, marked, and
  shown differently from a certain one.

### Where it sits in the lookup chain

```
corpus     attested spelling, block structure and all   <- new, wins
EXCEPTIONS hand-written pronunciations (Avatar vocab)
lexicon    CMU, ~126k words
RULES      letter-to-sound guesser
```

The corpus differs from the three below it in kind, not just priority:
**the others produce phonemes and let `pairUp()` decide the blocks; the
corpus supplies the finished spelling and `pairUp()` must not run.** That
is the whole point — `appa` cannot be expressed as a phoneme list plus
the pairing rule.

So the renderer needs to accept a pre-spelled word, not just a phoneme
sequence. It nearly does already: the sounds box is exactly that path.

### One syntax gap this exposes

The corpus has to record *which* null, and the sounds syntax currently
cannot say. `0` is the vowel-height null (`∅`); the consonant-height one
(`∅c`) has no typeable code — the renderer picks it automatically from
the pairing partner.

For `appa`, the automatic rule gives `(ɑ,∅c)(p,∅)(ɑ,∅c)` — tall, short,
tall — because ɑ is a vowel and p is a consonant. **Whether the reference
art actually shows mixed null heights there needs checking against the
image.** If it does, the automatic rule is confirmed and no syntax change
is needed. If it doesn't, the corpus needs a way to write the other null,
and `0c` should be added.

Do not guess this one. It is checkable.

---

## 3. Showing confidence in the UI

The user's framing was red-squiggly underlines on words that aren't in
the confirmed dictionary. The intent is right; the polarity needs
thought.

### Three tiers, matching the lookup chain

| tier | means | source |
| --- | --- | --- |
| **attested** | someone has seen this written | corpus |
| **derived** | pronunciation is known, spelling is inferred by the pairing rule | EXCEPTIONS / lexicon |
| **guessed** | even the pronunciation is a guess from spelling | RULES |

The distinction between the bottom two is worth surfacing, because they
fail differently. A *derived* word is probably right in sound and
possibly wrong in block structure. A *guessed* word may be wrong about
what it even sounds like.

### Mark the exception, not the rule

A corpus realistically holds tens to low hundreds of words. **Almost
everything anyone types will be unattested.** Squiggling all of it means
the normal case looks like a page full of errors, which teaches people to
ignore the marking — and it would be actively misleading, because
"unattested" does not mean "wrong". Most derived spellings are probably
fine.

The calmer inversion: **mark attested words as attested** — a small,
positive marker — and leave the rest plain, with the tier available on
hover and in a legend. That way the signal appears rarely and means
something when it does.

Worth building both behind one switch and looking at them, because this
is a judgement call about how the page *feels* and I may be wrong about
which reads better with real content.

If squiggles are used, **don't use red and don't use the spell-check
squiggle** — both read as "you made a mistake", and the user hasn't. A
dotted underline in a muted colour, plus a tooltip saying what it means,
carries the information without the accusation.

### Other places the tier should show

- Hovering a word: "attested — writing-sample-3, line 2" or "spelling
  inferred; pronunciation from the dictionary".
- The status line already says "13 words, 21 blocks"; it could say how
  many are attested.
- The exported PNG/SVG should probably **not** carry the marks — an
  exported image is the artwork, not the analysis. Possibly an option.

---

## 4. The corpus is also the research instrument

This is the part that makes it worth more than an accuracy patch.

Once attested spellings are machine-readable, the open decoding questions
become **queries**, not arguments:

- **Null placement.** Take every attested word, run the current pairing
  model, and diff. Every disagreement is a data point about where nulls
  really go. With enough of them, hypotheses about the split rule can be
  tested automatically instead of debated — "does rule X reproduce all 40
  attested spellings?" is a script, and it either passes or names the
  words it fails on.
- **Orientation.** Every attested glyph in a known slot is evidence for
  or against a `FLIPS` entry. The current table cites one or two words per
  glyph from memory; this would make it exhaustive and re-checkable.
- **The pairing model itself.** If `appa` turns out to be one of a class
  rather than a lone exception, the corpus is what reveals the pattern.
- **Regression safety.** Any future change to pairing, nulls or flips can
  be checked against every attested word at once. That is the test suite
  this project has never had, and it would be made of real evidence
  rather than invented cases.

**Build the corpus so this is easy.** Concretely: keep the raw attested
spelling separate from any derived interpretation, so a later change to
the model can be re-run against untouched source data.

---

## 5. Digitising the material

This is manual work, and the tooling should make it fast rather than
pretend it can be automated.

**A transcription workbench** — the reference image on one side, the
spelling being built on the other, and a live Avatarian rendering of that
spelling underneath to compare against the image.

Most of this exists. The designer already has:

- the live block preview, drawn by the site's own `render.js` and
  `blocks.css`, so what it shows is the product;
- a glyph palette;
- the sounds syntax shared through `site/js/sounds.js`;
- a local server that can read and write files.

What it needs is an image underlay, a corpus-entry form (source, note,
confidence) and a save route. That is a much smaller job than it sounds
because the comparison surface is already built.

**Do the highest-value words first**: the ones already cited in the docs
as evidence (`appa`, `students`, `metalbending`, `fire`, `at`, `mad`,
`katara`, and the twelve words of the "please do not be mad at me when
you wake up, but" sample), since those are the words the current rules
were derived from and the ones most likely to contradict them.

---

## 6. Handwriting input

The question asked: how hard is handwriting-to-text, photo versus stylus?

**They are very different problems, and the project is already most of
the way to one of them.**

### Stylus / draw-to-recognise — tractable, mostly built

Drawing a glyph and having the tool name it is close at hand, because
`designer/js/fit.js` already exists. It reads a freehand gesture and
snaps it to the lattice — corners to lattice points, straight runs
straight, curves to real arcs, small scribbles to dots. That is precisely
the normalisation step a stroke recogniser needs, and it was built for a
different reason.

Recognition on top of that is a nearest-neighbour match: fit the gesture,
then compare against the 43 shipped designs and rank. Comparison is
tractable because both sides are already normalised to the same lattice —
candidates include lattice-cell occupancy overlap, per-node distance, and
stroke-count/type agreement.

Why this is the easy direction:

- **Strokes carry far more information than pixels** — order, direction,
  count, where the pen lifted. A photo throws all of that away.
- **No model, no training data, no page weight.** It is geometry against
  43 known shapes, and it runs client-side like everything else.
- **Graceful failure.** Ranked candidates with the top few offered is a
  perfectly good interaction; it doesn't have to be certain to be useful.
- **The lattice constrains the problem.** Avatarian glyphs are
  geometric and built from a small vocabulary of primitives on a 5×5 or
  5×4 grid. This is a far easier recognition problem than cursive Latin.

The natural first version: **draw one glyph, get ranked matches, click to
accept.** Then: draw a block (two slots), then a word.

### Photo upload — a genuinely large project

Recognising a photograph of hand-lettered Avatarian needs, in order:

1. **Image conditioning** — deskew, threshold, handle paper texture,
   lighting, and the fact that reference material is often a screenshot
   of stylised in-world art rather than clean writing.
2. **Layout segmentation** — find words, then blocks, then the two slots
   within each block. This is the hard part, and it is harder here than
   for Latin text: blocks pack tight with no borders, canon lettering is
   deliberately skewed and organic, and **adjacent glyphs interlock and
   share strokes** (`AVATARIAN.md` §11 says so explicitly). Where one
   glyph ends and the next begins is genuinely ambiguous.
3. **Classification** — 43 classes. The easiest of the three steps, and
   still needs training data that does not currently exist.
4. **Shipping a model** — the site is static, works over `file://`, and
   has no server. A bundled classifier means hundreds of KB to megabytes
   on top of the 1.6 MB dictionary, or giving up one of those properties.

And the training data problem is circular: a photo recogniser needs many
labelled examples of hand-written Avatarian, which is exactly what the
corpus digitisation would produce. **So the corpus is a prerequisite for
the photo path, not a parallel effort.**

### Recommendation

1. **Stylus recognition first.** Small, self-contained, reuses `fit.js`,
   no new dependencies, and immediately useful for the transcription
   workbench — drawing a glyph you can see in a reference image is faster
   than hunting for it in a 43-cell palette.
2. **Photo recognition much later, if at all**, and only once the corpus
   has enough labelled material to train and evaluate against. Treat it
   as a research project with a real chance of not working well, not as a
   feature.

A useful middle option: **photo as an underlay, not as input.** Upload
the image, show it behind the transcription surface, and let a human do
the reading with the stylus recogniser helping. That captures most of the
practical value of the photo path for a fraction of the effort, and it is
the same underlay the workbench needs anyway.

---

## 7. The first confirmed entries

Five words are now checked against reference material. Until the corpus
proper exists they live in `EXCEPTIONS` in `g2p.js`, under an `ATTESTED`
heading that says not to "correct" them back toward the natural English
reading — which is exactly how two of them were wrong.

| word | attested | had been | |
| --- | --- | --- | --- |
| aang | `EY NG` | `ɑ ŋ` | wrong |
| toph | `T AA F` | `t oʊ f` | wrong |
| zuko | `Z UW K OW` | `z u k oʊ` | already right |
| momo | `M OW M OW` | `m oʊ m oʊ` | already right |
| appa | `AA 0 P 0 AA 0` | `ɑ p ə` | vowels wrong, structure still unreachable |

Two things fell out of these:

**`aang` resolves an inconsistency that has been in the docs all along.**
The `FLIPS` table cites "Aang" as the evidence that /e/ takes a top-slot
form — but with the old reading `/ɑ ŋ/` the word contains no /e/ at all,
so the evidence was incoherent. `EY NG` is `(e,ŋ)`, /e/ in a top slot,
and the table makes sense again. Two independent records agreeing is
worth more than either alone.

**`appa` now makes a precise, checkable prediction.** Rendering the
attested spelling gives:

```
attested  AA 0 P 0 AA 0  ->  (ɑ,∅c) (p,∅) (ɑ,∅c)     three blocks
derived   AA P AA        ->  (ɑ,p)  (ɑ,∅c)           two blocks
```

The nulls come out **tall, short, tall** — which is exactly what the
pairing-partner rule predicts, since ɑ is a vowel and p is a consonant.
So §2's open question has an answer to check rather than a guess to make:
**if the reference art shows tall-short-tall, the null-height rule is
confirmed on a third word and no `0c` code is needed.** If it shows
anything else, the rule is wrong and the syntax needs extending. Either
way it is one look at the image.

Only the vowels of `appa` could be fixed in `EXCEPTIONS` (both /ɑ/, not
the /ə/ it used to guess). The three-block structure cannot be expressed
as a phoneme list, because `pairUp()` would still make two blocks of it.
That is the corpus's job, and `appa` is the reason the corpus has to
store finished spellings rather than phonemes.

### The first attested sentence

```
F AE N IY (fanny)  /  IH Z (is)  /  M IH S IH NG (missing)
```

From a poster (link to follow). It is the first attested **sentence**
rather than an isolated name, and it is interesting for the opposite
reason to the corrections above: **all three words already matched what
the pipeline derives.** Nothing needed fixing.

That is the first end-to-end confirmation the chain produces canon output
on ordinary English — dictionary pronunciation, pairing, and the trailing
null on `missing` (five phonemes, so `(m,ɪ)(s,ɪ)(ŋ,∅)`). Corrections tell
you where the model is wrong; agreements tell you where it is right, and
a corpus needs both. Worth recording that this one was checked and
passed, so nobody re-derives it later wondering if it was ever verified.

### Still to audit

Every other in-world name in `EXCEPTIONS` is a guess from English
spelling until someone checks it: `katara`, `sokka`, `iroh`, `azula`,
`korra`, `omashu`, `kyoshi`, `sozin`, `roku`, `ozai`, `suki`,
`yue`, `haru`. Given two of the first four checked were wrong, expect
more. They are grouped under a "not yet checked" heading so the split is
visible in the file.

---

## 8. Open questions

**Tracked in `TODO.md`** — the corpus work is items 20–24, the
handwriting work 25–26, and the decisions it is waiting on are B2
(what reference material exists), B3 (does `appa` show tall-short-tall
nulls) and B4 (squiggle or badge). The reasoning for each is above; the
scheduling lives there.
