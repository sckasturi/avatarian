# TODO — the one backlog

**This is the only task list.** It used to be scattered: a numbered
backlog inside `HANDOFF.md` (which also had three *other* numbered lists,
so "item 12" was ambiguous), an "Open work" section in `CONTEXT.md`, open
questions at the end of `CORPUS.md`, and things "surfaced but not acted
on" in the session log. Those are now pointers to here.

**Numbers are stable and never reused.** A finished item is struck
through and kept, not deleted and not renumbered — other documents and
commit messages refer to these by number.

Two things deliberately live elsewhere, because they are questions about
the *script* rather than work to be done:

- **Open decoding questions** → `AVATARIAN.md` §10. Mid-word nulls, /s/
  orientation, the remaining positional variants, the unassigned mark.
- **The corpus design** → `CORPUS.md`. Items 20–24 below are its
  execution; the reasoning is there, not repeated here.

---

## Blocked — needs a decision or material from the user

**B1. C-C block layout.** Whether two consonants in one block overlap by
a shared row. The last piece of the 9-row model (item 3); everything else
in that model is implemented. Session 5's working guess was a one-row
overlap, unconfirmed.

**Deliberately deferred until the corpus exists (20).** Rather than
reason about it from one or two samples, the plan is to build the corpus
first and then *look* — with attested spellings machine-readable, every
C-C block in the material can be pulled up at once and the answer read
off real examples. So this is not waiting on a decision so much as
waiting on 20, and item 3 is downstream of both.

**B2. What reference material exists, and where.** Needed for the corpus
(20–24), the catalogue page (7), and any handwriting work (25–26). An
inventory of the images, and what words each contains.

**The top blocker, and now the only one that costs you anything.** All 23
entries cite a source that reads "not yet catalogued — see TODO B2": the
spellings are right and nobody can re-check them.

**There is a tool for it now** (item 23). Start the workbench, pick a
source, drop its image on it, and write the two sentences saying what it
is and where it came from. That is per *source*, not per word — seven
images clears every entry in the corpus. From then on a new word is: drop
the image, read it, take the suggested English, save.

**B3. Does `appa` show tall-short-tall nulls?** One look at the art.
**The site now draws the prediction** — type `appa` and it comes out
tall, short, tall, which is what the pairing-partner rule gives since ɑ
is a vowel and p is a consonant. So this is a straight comparison against
the image, not a thought experiment. Confirm and the null-height rule
holds on a third word with no syntax change; contradict it and the sounds
syntax needs a `0c` code. See `CORPUS.md` §7.

**B4. Squiggle or badge?** How to mark unattested spellings (item 21).
`CORPUS.md` §3 argues for marking the *attested* exception rather than
squiggling the unattested majority, since almost everything anyone types
will be unattested and a page of squiggles teaches people to ignore them.
Wants a look at real content before committing.

**B5. Extra credits links.** Contributors plus source material read or
transcribed. Item 6 is done, so these just get added to `AVATARIAN.md`
§ Credit when they arrive.

---

## Ready to build

### The corpus (see `CORPUS.md`)

**20. Digitise the attested writing samples** into a confirmed
dictionary: one entry per attested word or phrase, storing the spelling
actually observed, plus where it was observed. The biggest open
workstream — and also the **prerequisite for item 3 and B1**, since the
C-C question is going to be answered by looking at attested blocks
rather than by reasoning from a couple of samples.

**The file exists and 23 entries are in it** (item 22, session 8): the
twelve words of the wake-up note, `students`, `metalbending`, `appa`,
the four names, the poster sentence and `fire`. Adding a word is now a
row in `corpus/attested.json` and a re-run of `tools/build_corpus.py`.
What is left is the material this repo does not have — **which is B2,
not a design problem.**

Every entry's `source` currently ends in "not yet catalogued — see TODO
B2". That is the honest state and it is deliberately loud: the spellings
are right, but a year from now nobody will be able to re-check them.
Cataloguing the images fixes every one of those lines at once.

~~**21. Show confidence in the UI.**~~ **Plumbing done in session 8**;
the display is still open and still blocked on B4. `lookupWord()`
returns `{ipa, tier, entry}` and `sentenceToIPA` carries it onto every
word, so the page knows which of attested / derived / guessed each word
is, plus source and confidence for the attested ones. **Nothing shows it
yet** — that is the judgement call in `CORPUS.md` §3, and it wants
looking at with real content rather than deciding cold.

~~**22. Make the corpus win in the lookup chain.**~~ **Done in session
8.** `corpus/attested.json` → `tools/build_corpus.py` → `site/js/corpus.js`,
loaded by the site, the wiki gadget and the designer, and consulted above
`EXCEPTIONS`. `appa` draws as three blocks; `students` and
`metalbending` draw their mid-word nulls. None of those were expressible
before.

Two things came out differently from the `CORPUS.md` design, both now
corrected there:

- **Entries store IPA, not the sounds syntax.** The syntax is ARPAbet and
  item 29 wants to replace it, which would have meant migrating the whole
  corpus. The site is already IPA internally — the codes are a display
  layer — so **item 29 no longer has to be sequenced before 20.**
- **`pairUp()` did not need bypassing.** A finished spelling with its
  nulls written out has an even token count, and pairing an even list is
  the exact inverse of flattening the blocks. So the feature is one
  lookup plus a data file, not a second render path. `build_corpus.py`
  rejects an odd count, since that means somebody recorded phonemes
  instead of a spelling.

~~**23. A transcription workbench.**~~ **Done in session 9.**

```
python3 tools/corpus_server.py     # http://localhost:8793/
```

`workbench/`, a local tool like the glyph designer and not deployed.

**The unit of work is a SOURCE, not a word.** A reference image almost
never holds one word — it holds a line, a caption, a poster. So the
landing screen is *import a source*: drop the image, transcribe the whole
thing in one box with `/` between words, and get one entry per word out,
every one already citing it.

The transcription box takes the site's own sounds syntax, so nothing new
had to be invented: `/` splits words and `(brackets)` name one you
already know. A line you could paste into the main site is a line you can
paste here.

```
F AE N IY / IH Z / M IH S IH NG 0            three entries, words suggested
F AE N IY (fanny) / IH Z (is) / M IH S IH NG 0 (missing)   words given
```

Each parsed word shows its rendered Avatarian, the English the fuzzy
reverse-decode suggests, and the runners-up as one-click chips. A word
already in the corpus is flagged and **skipped** unless you tick *replace
it*; an odd token count is flagged as unsaveable before you get anywhere
near the save button. The button says what it will actually do — "add 3
entries", "replace 1 entry" — counted, not promised.

The per-entry editor is still there for refining afterwards; clicking any
entry in the list opens it.

The image is **provenance, not input** — nothing reads its pixels. It is
stored in `corpus/sources/` so an entry can be re-checked later, which is
the one thing every pre-existing entry is missing. That makes this the
tool for **B2**: cataloguing is now filing an image and typing two
sentences about it, per source rather than per word.

What it gives you beyond a form:

- **Against the model** — the attested spelling beside what the pipeline
  would have predicted, and which of the two ways they disagree. "Same
  sounds, different blocks" means the pairing rule is wrong here;
  "different sounds" means the pronunciation is. That is `CORPUS.md` §4
  made visible while you type rather than as a later analysis.
- **A duplicate warning** with one button to open the existing entry,
  because transcribing a word already in the corpus should take you there
  rather than quietly building a second one.
- **Validation at the same strictness as the CLI** — it calls
  `build_corpus.check()`, so nothing can be saved through the UI that
  `python3 tools/build_corpus.py` would reject, and a rejected save
  writes nothing at all.

**24. Audit `EXCEPTIONS` against reference material.** Every in-world
name is a guess until checked. Two of the first four checked were wrong
(`toph`, `aang`), so expect more: `katara`, `sokka`, `iroh`, `azula`,
`korra`, `omashu`, `kyoshi`, `sozin`, `roku`, `ozai`, `suki`, `yue`,
`haru`. The file now says so in a comment above them, and the two halves
of the old table are properly separated: `EXCEPTIONS` is *readings* and
all of it is provisional, the corpus is *observations* and none of it is.
A confirmed name does not get corrected in `EXCEPTIONS` — it moves.

### Handwriting input

~~**25. Stylus glyph recognition.**~~ **Done in session 9.**
`site/js/recognise.js` scores, `site/js/draw.js` is the pad. On the main
page it is a card in the reference column; in the workbench it is beside
the spelling being built.

**It needed no new data.** `manifest.js` already carries every glyph's
SVG inline, so the reference shapes are sampled off the page with
`getPointAtLength`. The plan had been to reuse `designer/js/fit.js` and
snap the gesture to the lattice first; that turned out to be unnecessary
— comparing raw point clouds is tolerant of the same wobble fitting
would have removed, and it kept the whole feature inside `site/`, where
the main page can reach it.

Both sides normalise into a unit box **keeping the aspect ratio**, and
score is a symmetric chamfer distance. Aspect matters: normalise each
axis independently and every glyph fills a square, at which point a wide
flat cup starts looking like a tall narrow one.

Measured by tracing each glyph's own outline back through the matcher at
random scale and offset:

| input | top-1 | top-3 |
| --- | --- | --- |
| clean trace, ±9% jitter | 42/42 | 42/42 |
| coarse + heavy jitter | 40/42 | 41/42 |
| all strokes merged into one | 38/42 | 41/42 |
| **a whole stroke forgotten** | **24/42** | **32/42** |

The last row is the honest limit, and it is not really a recogniser
failure — draw half a glyph and you have drawn a different shape. It is
why the pad shows a ranked list rather than one answer, and why a loose
match is drawn faded with the distance in its tooltip. A transcription
tool that hides its own uncertainty puts guesses in the corpus.

Stroke order and direction are deliberately unused: they say how the
*designer* drew a glyph, and somebody copying one off a reference image
has no reason to take the same route. Stroke count is used at a low
weight because it is far more stable than either.

**26. Photo input — as an underlay, not as recognition.** ~~Show a
reference image behind the transcription surface~~ — **superseded.** The
image turns out to be wanted as *provenance*, not as something to trace
over: it is filed against a source so the entry can be re-checked, and
the reading is done by eye. Item 23 does that. What is left of 26 is only
full photo OCR, which still needs segmentation of interlocking
hand-lettered blocks and training data that only 20 can produce.
`CORPUS.md` §6.

### The site

~~**11. Sounds box scrolling.**~~ **Done in session 7.** It grows to fit
as you type and then scrolls, capped at 30vh (22vh on mobile, where the
output is pinned to the top and every row the box takes is a row the
drawing doesn't get).

~~**10. Better handling of parentheses.**~~ **Done in session 7**, in two
parts.

*Parsing:* replaced the regex with a depth-counting scan. Three inputs
used to put a bracket character into the tokeniser, where it rendered as
an unknown sound — an unclosed `(`, a nested `(a (b))`, and a stray `)`.
A fourth, two captions on one word, silently kept only the last.

*Spacing:* a caption written once after several `/`-separated groups now
spreads **backwards** across them, one word apiece —
`HH AE M ER R / AH V / TH AO R (hammer of thor)` captions hammer / of /
thor instead of putting the whole phrase under `TH AO R`. Nothing has to
line up: leftovers pile onto the earliest group reached, which is what
keeps `M AW N T B AY HH UW (mount baihu)` whole with no special case. It
won't overwrite a group that already carries its own caption.

~~**12. A space button.**~~ **Done in session 7.** A small toolbar on the
sounds box: `/ word break`, `0 null`, `⌫` and `clear`. Clicks now insert
**at the caret** rather than always appending, spaced off on both sides,
so going back to fix a word in the middle works — which is most of
transcribing from a reference. Verified by building the attested poster
line `F AE N IY / IH Z / M IH S IH NG` entirely by clicking.

**29. Design a more intuitive sound alphabet than ARPAbet.** ARPAbet is
what the sounds box takes today, and it is genuinely unintuitive — most
sharply because **`AH` is /ʌ/ (STRUT) while `AA` is /ɑ/ (PALM)**, so the
code that looks like "ah" is not the "ah" sound.

**This is not hypothetical: the project itself got it wrong.** Until
session 9 the site's sounds-box placeholder, its "how to write sounds"
help, and `AVATARIAN.md` §9 all said `K AH T AA R AH` spells *Katara*. It
does not — it gives /k ʌ t ɑ r ʌ/. The right answer is `K AX T AA R AX`.
Three places, written by people who knew the table, wrong for months, and
found only when the workbench's reverse-decode ranked *qatar* above
*katara* and the reason turned out to be the input. Fixed, with the trap
now named in the help text. `AO` is /ɔ/ but `AW` is
/aʊ/. `EY` is /eɪ/. None of it can be guessed; it has to be learned, and
this is the tool's main input surface for people who don't know IPA.

The model to steal from is **iTrans for Sanskrit**, which is learnable
because it is *systematic*: doubling marks length (`a`/`aa`), `h` marks
aspiration (`k`/`kh`), capitals mark retroflex (`t`/`T`). You can predict
a code you have never seen.

English has no such neat axes, but it does have a well-tested precedent:
the **respelling keys dictionaries use for laypeople** — `ah` father,
`ay` face, `ee` fleece, `eye` price, `oh` goat, `oo` goose, `uu` foot,
`ow` mouth, `oy` choice, `uh` schwa, `er` nurse. Those are guessable in a
way `AA`/`AH`/`AO` never will be.

Design constraints:

- **Still typeable on a plain QWERTY keyboard**, which is why ARPAbet was
  picked in the first place.
- **Unambiguous when run together.** Sounds are space-separated, so this
  is easier than it looks, but a scheme that only works with separators
  is worth knowing about up front.
- **Accept the old codes as input** — ARPAbet should keep working, and
  IPA already does. This is about what the tool *teaches and displays*,
  not about narrowing what it accepts.
- **`0`, `$`, `%` and `/` stay** — they are punctuation, not sounds.

~~**Sequence this against the corpus (20).**~~ **No longer coupled.**
The worry was that storing attested spellings as sounds-syntax strings
would tie every corpus entry to whatever scheme is current. The corpus
stores **IPA** instead, which is canonical and not going to change, and
the site was already IPA internally — `normaliseSound` converts on the
way in and `IPA_TO_CODE` converts on the way out, so ARPAbet was only
ever a display layer. Item 29 can land whenever; the corpus does not
move with it.

**4. Fuzzy reverse-decode.** Given an Avatarian sequence, suggest likely
English words ("pretty sure this is X") instead of the current
exact-match-only lookup.

**Built in session 9 as `site/js/reverse.js`**, because the workbench
needs it — transcribing is the reverse direction by definition. Phoneme
edit distance against the corpus, then `EXCEPTIONS`, then the whole CMU
lexicon; nulls and orientation overrides are stripped before matching, so
`AA 0 P 0 AA 0` reaches "appa". ~58 ms a query after a 220 ms index
build, which took reusing the edit-distance rows and bucketing the
lexicon by pronunciation length — the naive version was 500 ms.

**Still open: it is not on the main page.** The workbench uses it; the
public site has no decode direction at all yet. That is what is left of
this item.

**16. Punctuation.** Comma, question mark and apostrophe are documented
in the key chart — comma at the bottom beside the word, apostrophe
treated like a vowel, question mark centred — but are stripped rather
than rendered.

### Glyphs

**17. Five designs differ from the glyph they ship**: `aw`, `f`, `ng`,
`nurse`, `schwa`. Run `python3 tools/promote.py --all --dry-run` for the
live list. Deciding which direction is right is a per-glyph judgement,
which is why `ship all…` shows the list first.

**18. `/x/` has no glyph** and renders as a dashed box. The only
remaining placeholder, and it needs source material rather than a guess.

**30. Two glyphs flip that the docs say don't.** `designs/s.json` and
`designs/oi.json` both carry `flips: true`, so the shipped manifest
mirrors /s/ and /ɔɪ/ by slot — but `FLIPS_BASE` in `build_glyphs.py` is
`{æ, ɑ, l, ɪ, e, aɪ}` and `AVATARIAN.md` §6 states outright that **/s/ is
deliberately NOT in the list**, which is the entire reason the `$`/`%`
override exists. /ɔɪ/ is in neither the table nor any evidence note.

Found while writing the `students` corpus entry, which spells both its
/s/ by hand precisely because no slot rule works. Since session 6 moved
`flips` into the designs and made them the authority, a checkbox tick in
the designer silently overrides the documented table — so this is also a
question about whether that override should be able to add a flip nobody
recorded evidence for.

**Deliberately deferred until the corpus is built (20)** — same reasoning
as B1. `CORPUS.md` §4: every attested glyph in a known slot is evidence
for or against a `FLIPS` entry, and the current table cites one or two
words per glyph from memory. Rather than argue /s/ and /ɔɪ/ from the
docs, transcribe the material and read every orientation off it at once.
The answer arrives with the corpus instead of being litigated ahead of
it.

**19. Stroke-level fusion.** Canon is hand-lettered so adjacent glyphs
interlock and share edges; this butts discrete SVGs together. Correct
structure, wrong texture. Would need connection points designed into each
glyph — a real type-design project.

### Docs and process

**9. A public-facing spec section at the end of `AVATARIAN.md`.** The
language as it currently stands, present tense, no process or history
language. Distinct from item 8.

**7. Reference material catalogue page.** An index of every reference
image and what it contains. Overlaps B2 — the inventory is the input.

~~**6. Consolidate credits.**~~ **Done in session 7.** `AVATARIAN.md`
§ Credit is the one place they are maintained; `README.md` and
`CONTEXT.md` point at it. The site footer and the wiki file headers keep
their copies deliberately — they are the only place a reader who never
opens the repo will see attribution — and the site footer now leads with
the tool's own credit rather than burying it last. B5 (extra links) can
be added to the one section whenever they turn up.

**8. Final article synthesising the decipherment** — structural rules and
open questions as one write-up, separate from these working docs.

**27. A test suite.** There has never been one, and `promote.py` now
machine-edits `build_glyphs.py`, which raises the stakes. The corpus (20)
is the natural source of cases: real attested spellings rather than
invented ones, so any change to pairing, nulls or flips can be checked
against every attested word at once.

**There are 23 cases to run against now**, so this stopped being
circular. `tools/build_corpus.py` already validates the data; what's
missing is a harness that loads the JS in node and asserts that every
corpus entry still renders to the blocks it records. That is the
regression net `CORPUS.md` §4 describes, and it is small.

**28. README/CONTEXT rewrite** once the 9-row model is settled. They
currently carry inline corrections pointing at the session log rather
than the finished model.

---

## Done

Kept for reference; numbers are not reused.

- ~~**1. Designer/site live bridge**~~ — session 6. Live block and word
  preview drawn by the site's own `render.js` and `blocks.css`, plus
  `ship it` / `ship all…` replacing the manual build loop.
- ~~**2. Designer UI: flips and rows**~~ — session 6. Both saved into the
  design and read back by the build.
- ~~**5. Mobile layout**~~ — session 6. The output pins to the top while
  the reference scrolls under it.
- ~~**13. PNG/SVG download**~~, ~~**14. Export colour**~~,
  ~~**15. Copy to clipboard**~~ — session 7. The exporter had been
  dropping stroke attributes (hairline output) and inheriting the page
  theme (invisible on white).
- ~~**G2P accuracy**~~ — session 7. `js/lexicon.js` bundles the CMU
  Pronouncing Dictionary ahead of the rules; unstressed-vowel reduction
  falls out of CMU's stress marks.
- ~~**Null selection by pairing partner**~~ — session 7.
- ~~**V-C layout**~~ — session 7.
- ~~**The 3-row/4-row vowel set**~~ — session 7, applied per glyph.

---

## Item 3 — the 9-row block model

Kept separate because it is nearly done and blocked on one question.

Implemented: V-C layout, the 3-row/4-row split, null selection by
pairing partner. **Outstanding: C-C (B1), which is deferred until the
corpus (20) can show every attested C-C block at once.** Once that lands, the model
can be stated whole in `glyphspec.py` and `designer/js/geom.js` — run
`check_geom.py` after — and it likely wants the designer's lattice
reworked so a block's two glyphs share a coordinate space, which is what
the "vowel and consonant merge into one glyph" case in 4-row C-V blocks
needs.
