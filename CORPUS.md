# The corpus — attested Avatarian, and what to build on it

**Status: §2, §5 and the stylus half of §6 are built. §3 is still a
design note; §4 is what the workbench now shows you.** Written 2026-08-06
at the end of the session that shipped the pronunciation dictionary; §2
implemented the session after, §5 and §6 the session after that.

What exists now:

```
corpus/attested.json     the corpus itself — edit this
corpus/sources/          the reference images, kept as provenance
tools/build_corpus.py    validates it and generates the JS
tools/corpus_server.py   the workbench's server        (port 8793)
workbench/               the transcription workbench
site/js/corpus.js        generated; loaded by the site, wiki and designer
site/js/recognise.js     draw a glyph, get ranked matches
site/js/reverse.js       sounds -> likely English words, fuzzy
```

**One correction runs through §5 and §6: the reference image is
provenance, not input.** Both sections below assumed it was something to
show *behind* the transcription surface and read through. It isn't. It is
filed against a source so the entry can be re-checked later, and the
reading is done by eye. That removed the underlay, and with it most of
what made §6's "photo as a middle option" look attractive.

23 entries from 7 sources. `appa` now draws as three blocks, and
`students` and `metalbending` draw their mid-word nulls — none of which
the pipeline could express before. Adding a word is a row in the JSON
and a re-run of the build script.

**Two things came out differently from the design below**, and the
sections are corrected in place:

- **Spellings are stored in IPA, not in the sounds syntax** (§2). The
  syntax is ARPAbet-flavoured and TODO item 29 proposes replacing it;
  storing codes would have tied every entry to a scheme that is expected
  to move. IPA is canonical, and the site is already IPA internally —
  the codes are only an input and display layer.
- **`pairUp()` does not need to be bypassed** (§2). A finished spelling
  written with its nulls always has an even token count, and pairing an
  even list two at a time reproduces the blocks exactly. The thing that
  has to be bypassed is the *pronunciation* lookup, not the pairing.

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

**One entry per *sighting*, recording the spelling actually observed, and
where it was observed.** A word seen in three sources is three entries.

*(This was originally "one entry per attested word", and a duplicate key
was a validation error. That turned out to be exactly backwards: the only
way to record a second sighting was to overwrite the first, so a file
whose entire job is preserving observations was built to destroy them.
The unique thing is `(key, source, spelling)`, not `key`.)*

Entries sharing a key are grouped at build time, and which of two things
happened matters:

| | |
| --- | --- |
| **same spelling, another source** | **Corroboration.** Counted, and the count is the point — a word seen on three posters is stronger evidence than one seen once. This is the case the old model could not record at all. |
| **a different spelling** | **A conflict.** Both are kept as alternates. Two sources disagreeing is a *finding about the script*, and deleting either side destroys it. |
| same spelling, repeated *within* one source | One entry carrying **`times`**. The word really was written that many times, and three renderings rule out a slip of the pen — so it raises the count rather than being discarded. |
| same spelling, same source, entered twice | The same observation recorded twice. Rejected — use `times`. |

**Repetition is not corroboration, and the ranking says so.** A spelling
written five times on one poster is one hand agreeing with itself; written
once each on two posters, it is two independent witnesses. So candidates
are ranked by **distinct sources first** and total sightings only after
that. Ranking on the raw total would let a single repetitive source
outvote genuine corroboration, which is the failure this file exists to
prevent.

A contested word renders as its **most-attested** spelling (ties broken by
confidence, then by source order, so a rebuild is deterministic), and the
generated record carries `count`, `sources`, `alternates` and `contested`
alongside the `ipa` the lookup chain already used. The site marks such a
word visibly rather than picking a winner in silence — see §3.

The spelling is stored **in IPA**, as the finished block structure
flattened — read the blocks left to right, each one top slot then bottom
slot, with the nulls written out.

*(The original plan here was to store the sounds-syntax string the box
takes, `AA 0 P 0 AA 0`. That syntax is ARPAbet, and TODO item 29 wants to
replace ARPAbet with something guessable; every entry would then have
needed migrating. IPA does not move, the site is already IPA internally,
and `wordsToSoundText` renders an entry into whatever the current codes
are — so a corpus entry is still literally a line you could paste into
the site, it just isn't stored that way.)*

An entry, as it appears in `corpus/attested.json`:

```json
{
  "key": "appa",
  "spelling": "ɑ ∅ p ∅ ɑ ∅",
  "gloss": "Appa",
  "source": "appa-art",
  "confidence": "certain",
  "note": "Three blocks where pairing predicts two — every phoneme
           padded with its own null. Why is unknown."
}
```

`source` names an entry in the file's `sources` map, so the description
of an image is written once however many words come off it.

**A source's `what` holds its full reading, not just a label.** Words come
off a source one at a time, so without somewhere to keep the whole text
the only record of what the source *says* is scattered across its entries
with the order lost. Describe the object and then quote it in full.

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
corpus supplies the finished spelling.** That is the whole point — `appa`
cannot be expressed as a phoneme list plus the pairing rule.

**But `pairUp()` does not have to be turned off**, which is what this
section originally assumed. A finished spelling with its nulls written
out always has an **even** token count, and pairing an even list two at a
time reproduces exactly the blocks it was flattened from — `pairUp` is
the inverse of the flattening, not a rival to it. So a corpus entry needs
no special path through the renderer at all; it is an ordinary symbol
list that happens to have been observed rather than derived. What gets
bypassed is the *pronunciation* lookup above it.

That is why the whole feature is one lookup at the top of `wordToIPA`
plus a data file, and why `build_corpus.py` rejects an odd token count:
an odd count means somebody recorded a phoneme list instead of a
spelling, which is the exact mistake the corpus exists to prevent.

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

**Checked, session 10: the art shows mixed null heights** — tall beside
the vowels, short beside /p/. The pairing-partner rule predicted exactly
that, so **the automatic rule is confirmed and no `0c` is needed.** `0`
means "a null" and the partner says which one; a second code would add
nothing.

**How this is handled in the built version:** entries record the generic
`∅` and let `nullFor` choose. Recording `∅c` would have been recording an
*interpretation* — the height is derived, not observed — and §4 depends
on the raw observation staying separate from the model applied to it.
That discipline paid: the interpretation has now been confirmed, and not
one corpus line had to change.

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

**The plumbing is built.** `lookupWord()` in `g2p.js` returns
`{ ipa, tier, entry }`, and `sentenceToIPA` carries both onto every word
group, so the page already knows the tier of every word it draws — plus
the source and confidence for an attested one. **Nothing displays it
yet**, because which of the two treatments below reads better is a
judgement about how the page feels with real content (TODO B4), and the
answer wants looking at rather than deciding.

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

  **Built in session 10** — `python3 tools/run_tests.py`, and the corpus
  is the fixture for nearly every structural assertion. The suite gains
  coverage each time a source is transcribed, with no test written. It
  also does the null-placement query above in the one case where the
  answer is unknown: the nine-row check **reports** every attested C-C
  block instead of asserting a layout for it, so B1's evidence prints
  itself and grows with the data.

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

**Built — `workbench/`, served by `tools/corpus_server.py` on 8793.** It
reuses all four of those through a read-only `/site/` route, exactly as
the designer does.

Three things came out differently from the sketch above:

- **No image underlay.** The image is *provenance*, not something to
  trace over: it is filed in `corpus/sources/` against a source, and the
  reading is done by eye. Nothing in the tool reads its pixels.
- **The word is suggested, not typed.** Transcribing runs backwards —
  you can read the glyphs and what you don't know is which word they
  spell. So the spelling drives a fuzzy reverse-decode (`reverse.js`)
  and you pick from ranked candidates. That is what §4's "the corpus is
  also the research instrument" feels like in practice.
- **The unit is a SOURCE, not an entry.** This section is written as
  "one entry per attested word", which is right for the *data* and wrong
  for the *work*: an image holds a line or a poster, so an entry-at-a-time
  tool means re-picking the same source for every word on it. The
  workbench takes a whole transcription at once — `/` between words,
  `(brackets)` for a word you already know — and produces the entries
  together. Both syntaxes are the site's own, so nothing new had to be
  invented for it.

It also shows the attested spelling **beside what the model would have
predicted**, and names which of the two ways they disagree — see §4.

**Do the highest-value words first**: the ones already cited in the docs
as evidence (`appa`, `students`, `metalbending`, `fire`, `at`, `mad`,
`katara`, and the twelve words of the "please do not be mad at me when
you wake up, but" sample), since those are the words the current rules
were derived from and the ones most likely to contradict them. **All but
`katara` are already in**, from session 8 — what they are missing is the
images, which is what a pass through the workbench adds.

---

## 6. Handwriting input

> **Status: the stylus half shipped (item 25); the photo half is
> dropped (item 26).** Photo OCR still needs segmentation of interlocking
> hand-lettered blocks and training data only the corpus can produce, and
> the "underlay" middle option was superseded once the reference image
> turned out to be provenance rather than something to trace. The
> reasoning below is kept for anyone who revisits it.

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

~~A useful middle option: **photo as an underlay, not as input.**~~
**Superseded.** This assumed the image wanted showing *behind* the
transcription surface so it could be traced. It doesn't: it is filed as
provenance and read by eye, beside the work rather than under it. The
practical value the underlay was reaching for is delivered by the
workbench without it, and what remains of the photo path is only full
OCR — still gated on training data the corpus has yet to produce.

### The stylus recogniser, as built

`site/js/recognise.js`. The one thing this section got wrong was
assuming `fit.js` was needed: **it isn't.** `manifest.js` already carries
every glyph's SVG on the page, so reference shapes are sampled straight
off it with `getPointAtLength`, and comparing raw point clouds is already
tolerant of the wobble fitting would have removed. Skipping it kept the
whole feature inside `site/`, which is what let the main page have it too
rather than it being a designer-only tool.

Both sides normalise into a unit box keeping the aspect ratio; score is a
symmetric chamfer distance. Measured against the shipped set at random
scale and offset: 42/42 top-1 on a clean trace with ±9% jitter, 38–40/42
when merged or heavily jittered, 24/42 (32/42 top-3) with a whole stroke
missing. That last case is the honest limit and is barely a recogniser
failure — half a glyph is a different shape. It is why the pad ranks
rather than answers.

---

## 7. The first confirmed entries

Five words were checked against reference material in session 7. They
lived in `EXCEPTIONS` under an `ATTESTED` heading until the corpus
existed; **they are now in `corpus/attested.json` and out of
`EXCEPTIONS` entirely**, along with the twelve words of the wake-up note,
`students`, `metalbending`, the poster sentence and `fire` — 23 entries.

The `ATTESTED` heading was a warning not to "correct" those readings back
toward natural English, which is exactly how two of them got wrong in the
first place. That warning is no longer needed: the two kinds of knowledge
now live in different files. `EXCEPTIONS` is readings, and every line of
it is provisional; the corpus is observations, and none of it is.

| word | attested | had been | |
| --- | --- | --- | --- |
| aang | `EY NG` | `ɑ ŋ` | wrong |
| toph | `T AA F` | `t oʊ f` | wrong |
| zuko | `Z UW K OW` | `z u k oʊ` | already right |
| momo | `M OW M OW` | `m oʊ m oʊ` | already right |
| appa | `AA 0 P 0 AA 0` | `ɑ p ə` | vowels wrong, structure unreachable — now drawn |

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

**Confirmed in session 10.** The art shows mixed null heights, matching
the prediction. So:

- the null-height rule holds on a **third** word, and this time on
  material it was not derived from;
- **no `0c` code is needed** — §2's open syntax question closes;
- the prediction was made by a rule read off *one* sample in session 5,
  and it survived contact with independent evidence. That is the first
  time anything in this model has been tested that way rather than
  fitted.

This is also the cleanest demonstration of why the corpus stores finished
spellings. `appa` could not be reached from a phoneme list, its structure
was recorded before anyone knew why, and the record then answered a
question nobody had asked it.

Before the corpus, only the vowels could be fixed (in `EXCEPTIONS`: both
/ɑ/, not the /ə/ it used to guess). The three-block structure cannot be
expressed as a phoneme list, because pairing would make two blocks of it
whatever phonemes you supply. `appa` is the reason the corpus stores
finished spellings rather than phonemes, and it is the one entry that
could not have been faked by fixing a pronunciation.

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
