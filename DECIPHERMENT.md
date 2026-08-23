# Reading Avatarian

*How a constructed script from a film was worked out from a handful of
images — what is known, how it is known, and what is still guesswork.*

This is a write-up, not a working document. `AVATARIAN.md` §12 states the
rules as they stand; this is the argument behind them: the evidence, the
reasoning, and — because it matters more than it usually gets to — the
places the reasoning went wrong first.

Avatarian is a **community decipherment**. The reference material is
other people's work, credited in `AVATARIAN.md`. What is original here is
the structural reading and the tooling built on it.

---

## The one thing that had to be right

Avatarian is phonetic. It encodes **sounds**, not letters, so "Katara" is
written from /k ə t ɑ r ə/ and any word that sounds the same is written
the same. That much was never in doubt.

The hard question was how sounds are arranged. The glyphs visibly group
into compact rectangular **blocks**, two glyphs each, and the obvious
guess — the one this project held for a long time — was that a block is a
**syllable**: consonants on top, the vowel beneath.

It is wrong. A block is just **the next two sounds**, in order, top slot
then bottom slot, with no regard for what kind of sound they are.

```
please  /p l i z/    (p,l) (i,z)
at      /æ t/        (æ,t)          vowel on top
not     /n ɑ t/      (n,ɑ) (t,∅)
me      /m i/        (m,i)
```

### Why the wrong model lasted

The syllable model survived because **it agrees with the right one on the
easiest words.** "Katara" is /k ə t ɑ r ə/ — consonant, vowel, consonant,
vowel, consonant, vowel. Pair them two at a time and you get (k,ə)(t,ɑ)
(r,ə). Group them into syllables and you get ka-ta-ra: the same three
blocks, the same contents, the same order.

Every simple CV word agrees. The models only diverge on words that start
with a vowel, or cluster two consonants, or have an odd number of sounds
— and those were exactly the words nobody had checked.

The break came from a **labelled writing sample**: a full line, *"please
do not be mad at me when you wake up, but"*, with each word glossed in
English beside it. Twelve words, and three of them settle it immediately.
`at` is /æ t/ written with the **vowel on top**, which no syllable model
permits. `up` is the same. `please` puts /p/ and /l/ — two consonants —
in one block and /i/ and /z/ in the next, splitting the syllable straight
down the middle.

One labelled line did more than every isolated name put together, and
that is the shape of the whole project: **glossed running text is worth
far more than a vocabulary list.**

There is a lesson in the failure mode too. The syllable model wasn't just
wrong, it was *confirmable* — it kept producing correct-looking output on
the words people happened to try. A model that fails loudly is a much
smaller problem than one that fails on the cases you didn't think of.

---

## What follows from pairing

Once blocks are pairs, several things that looked arbitrary become
mechanical.

### Odd words need a filler, and the filler is spelling

Pair up a five-sound word and the last block has an empty slot. Canon
does not leave it blank: a **null** is written in. Five of the sample's
twelve words carry one.

This matters more than it sounds. The null is **part of the spelling, not
padding** — it occupies a slot, it is drawn, and a reader sees it. A tool
that dropped it would be silently shortening words.

There are two nulls, distinguished by height, and which one is written
follows a rule that reads backwards at first:

> A **vowel** paired with a null takes the **consonant-height** null.
> A **consonant** paired with a null takes the **vowel-height** null.

The null takes the height its *partner* doesn't. That looked odd until
the reason showed up: it keeps every block exactly **nine rows** tall,
whatever is in it. Consonants are five rows, vowels four; 5+4 and 4+5
both come to nine, and a null that matched its own slot would give you
eight or ten.

The nine-row block is the load-bearing invariant of the whole layout, and
the null rule exists to protect it.

### Vowels come in two heights, and the gap is deliberate

A vowel occupies four of a block's nine rows, but its *drawing* fills
either three or four of them. The three-row vowels leave one row empty —
and that empty row is always on the vowel's **inner** side, between it
and its partner, never at the outer edge of the block.

So a four-row vowel touches its partner and reads as one merged figure,
and a three-row vowel sits a row clear of it. Which vowels are which is a
list, not a rule: `ɪ e u ʊ ɑ aʊ ɔɪ` fill all four.

### Some glyphs flip

A glyph is drawn once, in the form it takes in a top slot. Six of them
**mirror top-to-bottom** when they land in a bottom slot: æ's cup becomes
a cap, ɑ's Y inverts.

The bar for adding a glyph to that list is deliberately high — **both
forms attested, in known slots.** "at" shows /æ/ on top as a cup and
"mad" shows it underneath as a cap; that pair is what justifies æ. A
single sighting is not enough, for reasons the next section gets to.

---

## The words that don't fit

Three attested spellings resist the model, and they are the most
interesting things in the corpus.

### appa

Pairing predicts two blocks: `(ɑ,p)(ɑ,∅)`. Canon writes **three**, every
sound in its own block, each padded with its own null.

```
attested   (ɑ,∅) (p,∅) (ɑ,∅)
predicted  (ɑ,p) (ɑ,∅)
```

No explanation fits. It isn't the odd sound count — "not" is also three
sounds and pairs normally. It isn't intervocalic consonants — other words
of the same shape behave. **Why appa is written this way is unknown.**

What makes it useful anyway is that it is *recorded*. The project stores
the spelling somebody observed rather than one it derives, so the tool
writes appa correctly without anybody understanding it. Being right does
not require knowing why, and a decipherment that only records what it can
explain will quietly discard its most informative data.

appa also produced the one genuine prediction this project has made and
then tested. The null-height rule — read off a single sample — implies
that appa's three nulls should be **mixed**: tall beside the vowels,
short beside /p/. Checked against art the rule was never derived from,
that is exactly what it shows. A rule inferred from one example survived
contact with independent evidence, which is not something any other part
of this model can yet claim.

### students, metalbending

Both carry a null **inside** the word, not at the end.

```
students      (s,t) (u,∅) (d,ə) (n,t) (s,∅)
metalbending  (m,ɛ) (t,ə) (l,∅) (b,ɛ) (n,d) (ɪ,ŋ)
```

Each divides into two units that are paired independently, each padded if
it comes out odd. What decides the division is **unknown**. It is not
morpheme boundaries — `stu|dents` is not one. It is not syllables, which
would force nulls canon does not have.

Two examples is not enough to find the rule, and the rule is worth
finding: it is the difference between a tool that can write any English
word and one that can write short ones.

### /s/, which refuses to follow the slot

"students" contains two /s/. Both land in **top** slots. They are drawn
**differently** — one a caret, one its mirror.

No rule that reads the slot can produce that, because the slot is the
same both times. So /s/'s orientation is not derivable at all: it is part
of the spelling and has to be recorded per word. That is why the notation
has an explicit override for it, and why /s/ is the one glyph the tool
refuses to guess about.

---

## What is still unknown

Stated plainly, because a decipherment's open questions are as much a
result as its answers:

1. **What places mid-word nulls.** Two attested examples, no rule.
2. **How much two consonants overlap** when they share a block. Ten rows
   of content in a nine-row block means they must, and by how much is
   unresolved. Four attested C-C blocks exist; four is not enough.
3. **What selects /s/'s orientation.** Not the slot. Possibly nothing
   systematic.
4. **Why appa is written as three blocks.**
5. **Whether /x/ has a glyph at all.** No source shows one.
6. **One mark in the key chart is unassigned** — a wedge with no label
   and no attested use.

---

## Method, and the mistakes worth naming

Three failures shaped how this project now works. All three are the same
failure in different clothes: **treating a single observation as a
rule.**

**One correction is not a rule.** /e/ was turned into a positional
variant pair on the strength of one example. The next word showed the
same orientation in the opposite slot, and the change had to be reverted.
The bar became "both forms attested in known slots", and several
candidate rules have died against it since.

**Confidently wrong is worse than absent.** `toph` sat in the tool's
dictionary as /t oʊ f/ — rhyming with "loaf", the natural English reading
— until a reference showed /t ɑ f/, rhyming with "off". The tool had been
wrong for months and looked exactly as authoritative as when it was
right. Of the first four in-world names checked against sources, **two
were wrong.**

**Documentation drifts from the thing it documents.** The tool's own help
text taught a spelling of "Katara" that produced the wrong vowel, in
three separate places, written by people who knew the notation. It was
caught only when an unrelated feature ranked a different word first and
the reason turned out to be the example.

The response to all three is the same, and it is the project's main
methodological commitment:

> **Record what was observed, separately from what was inferred from it.**

Every attested spelling is stored as it was seen, with a note saying
where. The model's predictions are computed fresh and compared against
that record rather than folded into it. When a rule changes, the record
does not move — which is how the appa prediction could be checked at all,
and why confirming it required changing nothing.

It also turns arguments into queries. "Does this rule reproduce every
attested spelling?" is a script that either passes or names the words it
fails on. The alternative — deciding by recollection of which words
looked right — is how the syllable model survived as long as it did.

---

## What would move this forward

More **glossed running text**, in that order of preference:

1. **Labelled sentences.** One line of glossed text settled the pairing
   model. Isolated names are worth a fraction as much, because a name
   gives you one spelling while a sentence gives you spellings *and* the
   relationships between them.
2. **Any word with a mid-word null.** Two examples cannot distinguish
   the competing explanations; a third or fourth probably can.
3. **C-C blocks**, for the overlap question.
4. **Any occurrence of /s/**, with its slot and orientation noted.
5. **Anything containing /x/**, which may not exist.

The tooling is built to absorb this cheaply: a reference image and a
transcription go in, and every open question above gets re-checked
against the enlarged evidence automatically. The bottleneck is not the
software. It is images.
