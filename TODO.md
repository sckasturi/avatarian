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

**No longer waiting on the corpus — the evidence has arrived.** The plan
was always to build the corpus first and then *look*, rather than reason
from one or two samples. That has now happened. `python3
tools/run_tests.py` prints every attested C-C block as a diagnostic (item
27), and the list went from four to **fifteen** in a single session of
transcribing:

```
asked: (k,t)     found: (n,d)      hard: (r,d)     help: (l,p)
metalbending: (n,d)   mount: (n,t)   please: (p,l)  rest: (s,t)
farm: (r,m)      free: (f,r)       gems: (m,z)     still: (s%,t)
trends: (t,r)    trends: (d,z)     waters: (r,z)
```

**This is the thing to pick up next.** Fifteen blocks across three
independent sources is enough to read the answer off rather than guess
it: measure the row count of each of those blocks in its source image and
see whether two consonants total ten rows or overlap into nine. Session
5's working guess was a one-row overlap, and it has never been checked
against anything.

Item 3 is downstream, and so is a chunk of item 30 — `still: (s%,t)`
is a bottom-slot /s/ in attested material, which is exactly the evidence
that item was deferred waiting for.

~~**B2. What reference material exists, and where.**~~ **Answered for the
live corpus.** Every source in `corpus/attested.json` now carries its
image and can be re-checked. This was the top blocker for four sessions;
it is not one any more.

What broke the deadlock was giving up on retrofitting. The 22 entries
whose provenance had been lost were **moved to `corpus/uncatalogued/`**,
which nothing reads — `build_corpus` opens one hard-coded path, so a
sibling folder is inert. They are kept in the same file shape so a block
goes back verbatim once its image is filed. Then the corpus was rebuilt
from material that had an image from the start.

**The quarantine is what is left of B2.** 22 entries from 7 sources:
`wake-up-note` (11), `name-references` (4), `fanny-poster` (3),
`students`, `metalbending`, `appa-art`, `fire-photo`. The spellings are
right; nobody can check them. Two of those are probably recoverable
cheaply — `katara-letter` in the live corpus looks like the same wake-up
note those eleven came off, so they may be able to move back with real
provenance rather than being re-typed.

~~**B3. Does `appa` show tall-short-tall nulls?**~~ **Answered in session
10: yes.** The art shows **mixed null heights** — tall beside the vowels,
short beside /p/ — which is exactly what the pairing-partner rule gives,
since ɑ is a vowel and p is a consonant.

Two things follow, and both are closures rather than new work:

- **The null-height rule is confirmed on a third word.** It was read off
  one reference sample in session 5 and has since been carrying the
  9-row block invariant on its own. A prediction made from it, checked
  against art it was not derived from, came out right.
- **No `0c` code is needed**, which closes the syntax gap `CORPUS.md` §2
  opened. `0` means "a null" and the partner says which one; there is
  nothing a second code could add. The corpus keeps recording the
  generic `∅`, so the entries never encoded an interpretation and do not
  move now that the interpretation is confirmed.

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

**82 words from 94 sightings across 3 sources**, every one of them filed
with its image:

```
toph-letter     46      katara-letter   33      instagram-1.1   15
```

**An entry is a SIGHTING, not a word.** That changed during the session
and it is the model everything else now assumes. A word seen in two
sources is two entries; the unique thing is `(key, source, spelling)`.
Same spelling from another source is corroboration and is counted; a
different spelling is a conflict and both are kept as alternates; a
repeat inside one source raises that entry's `times`. **Independent
sources rank above repetition** when picking what renders — five
writings on one poster is one hand agreeing with itself. `CORPUS.md` §2
has the reasoning; `tools/build_corpus.py` enforces it.

Adding a word is a row in `corpus/attested.json` and a re-run of
`tools/build_corpus.py`, or a pass through the workbench.

**What this bought, immediately:** B1's C-C inventory went from four
blocks to fifteen, and B2 stopped being a blocker. The corpus is also the
test fixture, so transcribing a source gives the suite more evidence with
no test written — one long-standing failure fixed itself this way.

**Still wanted: water, earth and air, with images.** Worth more than
their count — the reference material supplies IPA *alongside* Avatarian
for all four elements, which is what proved the ɜ/ə merge, and none of
that evidence is in the corpus yet.

**21. Show confidence in the UI.** Plumbing done in session 8;
`lookupWord()` returns `{ipa, tier, entry}` and `sentenceToIPA` carries
it onto every word. The full attested / derived / guessed display is
**still open and still blocked on B4** — that one has to mark nearly
every word on the page, which is the judgement B4 is about.

**One narrow slice of it shipped**: a word whose sources *disagree* is
marked `contested` on the site, with the counts and sources in its
tooltip. That needed no B4 decision because it is rare by construction —
it marks the handful genuinely in dispute rather than the whole page.
Note it is looked up in `renderWords` rather than read off `w.entry`,
because `draw()` renders from the sounds box and those word objects carry
no corpus entry.

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

**Added since, and the reason the corpus quadrupled in a day:**

- **English in.** Type the line as you read it and get a first draft of
  the sounds, so a poster is transcribed by *correcting* a draft rather
  than spelling every word from nothing. A seeded spelling is an
  inference, so every word it fills in starts **unconfirmed and
  unsaveable**: saving one unchecked would file the model's own
  prediction as evidence, and the "against the model" panel would then
  show perfect agreement — the model validated against itself. Correct
  it, or tick that it already agrees; either way a human compared it
  with the image. Mid-word nulls are deliberately not guessed.
- **The spelling is editable in the row**, not only in the transcription
  box, and edits sync back so the two never drift.
- **Repeats are counted, not dropped** — a word written three times in
  one line raises that entry's `times`.
- **The entry list is one row per word**, showing how many times it has
  been seen rather than a block count you can read off the preview.
  Opening a word lists **every sourcing**, each with its own glyphs,
  repeat count and confidence.
- **Sources can be deleted**, taking their entries with them (an entry
  citing a missing source fails validation, so they cannot be orphaned).
  Words attested elsewhere stay, and the confirmation says which.
- **Images are named after the source.** `tools/rename_images.py` fixes
  ones filed before that; it reports orphans and never deletes them.
- The tools column is sticky, and the palette and draw pad insert into
  whichever sounds field you last touched.

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

**Flipped forms, added in session 10.** A glyph is drawn once, in its
top-slot form, and eight of them mirror when they land in a bottom slot
(`s l ɪ e æ ɑ aɪ ɔɪ`). Until this, drawing a cap off a reference image
matched nothing — which is the whole use case. Each flipping glyph now
carries a second, mirrored reference cloud, and a mirrored win reports
itself: the code comes out `AE%`, the thumbnail is drawn the way you drew
it, and the tooltip says "bottom-slot form".

Only glyphs that actually flip get one — a mirrored drawing of a glyph
that doesn't flip is not that glyph. **The /s/ case works end to end**:
draw `∧` and get `S`, draw `∨` and get `S%`, which is exactly the
distinction "students" needs and which no slot rule can make.

~~**26. Photo input / photo OCR.**~~ **Dropped — not doing this.**

Two things ate it from both ends. The "photo as an underlay" half was
**superseded**: the image turned out to be wanted as *provenance*, not as
something to trace over, and item 23 does that. What was left was full
OCR — segmenting interlocking hand-lettered blocks, then a bundled
classifier — which needs training data only item 20 can produce and would
put megabytes on a static page.

Kept as a number, per the rule at the top of this file, so nothing that
refers to "26" goes dangling. `CORPUS.md` §6 has the full reasoning if it
is ever revisited.

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

~~**29. Design a more intuitive sound alphabet than ARPAbet.**~~ **Done in
session 10.** The sounds box now takes, and teaches, the respelling keys
dictionaries use for laypeople — the one notation for English sounds
ordinary readers already know how to read.

```
k uh t ah r uh   Katara          th aw t    thought
ah 0 p 0 ah 0    appa            p r eye s  price
```

| | | | | | | | |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `a` | c**a**t | `ah` | f**a**ther | `ee` | s**ee** | `ow` | m**ou**th |
| `e` | b**e**d | `oh` | g**o**at | `oo` | s**oo**n | `aw` | th**ou**ght |
| `i` | s**i**t | `uh` | comm**a** | `uu` | f**oo**t | `oy` | ch**oi**ce |
| `u` | c**u**t | `ey` | f**a**ce | `eye` | pr**i**ce | `er` | n**ur**se |

Consonants are themselves, plus `ng ch sh th dh zh j y kh`. Only `dh`
(*this*) against `th` (*thin*) has to be learned.

**The compatibility problem, and how it was solved.** Exactly four codes
mean different things in the two schemes — `ah uh ow aw` — and they are
precisely the cluster ARPAbet is worst at, so dodging them would have
given up most of the benefit. Resolution: **lowercase is the readable
scheme, CAPITALS are ARPAbet.** Every document ever written for this tool
keeps working verbatim, because ARPAbet has always been written in
capitals. One sentence to teach, nothing to migrate. Everything that
doesn't collide stays case-insensitive, so the split is invisible unless
you hit one of the four.

The corpus needed no migration at all — it stores IPA, which is what
made this landable after the corpus rather than before it (see item 22).

Still true, and now demonstrated rather than argued: `AH` is /ʌ/ while
`AA` is /ɑ/, and this project shipped `K AH T AA R AH` as *Katara* in
three separate places.

~~**4. Fuzzy reverse-decode.**~~ **Done in session 10.**
`site/js/reverse.js` — phoneme edit distance against the corpus, then
`EXCEPTIONS`, then all ~126k CMU words. Nulls and `$`/`%` come off before
matching, so `ah 0 p 0 ah 0` reaches "appa".

**Where it shows on the site.** Converting from English labels every word
on the way past, so the caption is already there. Building sounds *by
hand* doesn't — and that is the mode you are in when you click glyphs out
of the reference, draw them with the pad, or copy a word off reference
art. In that mode the page could draw your word perfectly and never tell
you what it said.

So any word with **no caption** gets a row of suggestions under the
sounds box, and clicking one writes the caption in. Words that already
carry a label are left alone; when every word has one the strip hides
itself. A corpus hit is outlined and ticked — somebody has *seen* that
word written, which outranks any dictionary guess.

```
ah 0 p 0 ah 0        Sounds like  [appa ✓] [apia] [aha] [ahah] [op]
```

Two details worth keeping: the caption is inserted into the one
`/`-separated chunk it belongs to rather than rebuilding the box, so
hand-typed spacing survives; and `chunkIndices()` mirrors
`soundTextToWords`'s own filter, because that function drops chunks with
no sounds in them and a naive index would label the wrong word.

Performance: ~58 ms a query after a 220 ms index build, debounced 250 ms.
The naive version was 500 ms — reusing the edit-distance rows and
bucketing the lexicon by pronunciation length is what fixed it.

**31. A public corpus page on the site.** Read-only, a second page
alongside the translator: every attested word, its spelling rendered in
real Avatarian, which source it came from, and the confidence. **Not the
workbench** — that stays local and stays the only thing that writes.

Cheap, because the data already ships. `site/js/corpus.js` is generated
into the deployed folder and loaded on every page load already, since it
sits at the top of the lookup chain — so this is one more static HTML
file reading a global that is on the page anyway. No server, no build
step, nothing new to deploy.

Three things to decide when it is picked up:

- **The images are the open question, not the data.** `corpus/sources/`
  is gitignored, so nothing that would let a reader *check* an entry is
  currently deployed. Publishing the spellings without them is still
  worth doing — it is what the corpus says — but "source: a poster,
  season 1 episode 4" reads very differently from a thumbnail you can
  click. Whether other people's screenshots and stills can go in a public
  repo is a licensing call, not a technical one, and it is the same call
  `.gitignore` is currently deferring.
- **It overlaps item 7** (reference material catalogue). A page listing
  every source with what it contains, and a page listing every word with
  where it came from, are two views of one table. Build them together or
  build one and let the other be a filter.
- **It wants item 21's tiers**, or at least the vocabulary — attested
  against derived is the distinction the whole page exists to make
  visible, and B4 is the judgement about how to show it.

The reason to want it: right now the corpus is the most interesting thing
this project has produced and it is only visible to somebody who clones
the repo and reads JSON. It is also the part other people could
contribute to, and they cannot contribute to what they cannot see.

**16. Punctuation.** Comma, question mark and apostrophe are documented
in the key chart — comma at the bottom beside the word, apostrophe
treated like a vowel, question mark centred — but are stripped rather
than rendered.

### Glyphs

~~**17. Five designs differ from the glyph they ship.**~~ **Checked in
session 10: none of them do.** Every design renders to the shape it
ships. There is no per-glyph judgement to make and never was one by the
end — the drift closed as glyphs were shipped through the designer.

`python3 tools/promote.py --all --dry-run` still reports four (`f`,
`ng`, `uh`, `schwa`), which is what this item was counting. **They are
comment differences, not shape differences.** Promote compares the whole
generated entry, and a design's `notes` field is not the hand-written
comment above the same entry in `build_glyphs.py`. Strip the comments and
the drawing expressions are identical.

That is worth knowing before pressing **ship all…**: right now it would
rewrite four hand-written comments — including the one explaining the
ɜ/ə merge — with shorter design notes, for no change to any glyph.

**18. `/x/` has no glyph** and renders as a dashed box. The only
remaining placeholder, and it needs source material rather than a guess.

**30. Two glyphs flip that the docs say don't.** `designs/s.json` and
`designs/oi.json` both carry `flips: true`, so the shipped manifest
mirrors /s/ and /ɔɪ/ by slot — but `FLIPS_BASE` in `build_glyphs.py` is
`{æ, ɑ, l, ɪ, e, aɪ, ə}` and `AVATARIAN.md` §6 states outright that
**/s/ is deliberately NOT in the list**, which is the entire reason the
`$`/`%` override exists. /ɔɪ/ is in neither the table nor any evidence
note.

**Session 10 added ə to `FLIPS_BASE` and that is relevant evidence, not
noise.** ə got there because its two drawings turned out to be an exact
mirror pair, and a mirror pair is what a slot flip looks like — the
project had read the same fact as proof of two separate letters and been
wrong for two sessions. So "these two shapes are mirrors" is now a known
argument FOR a flip. Whether it applies to /s/ is a different question,
since /s/'s problem is that both forms appear in the *same* slot, which
no flip rule can produce.

Found while writing the `students` corpus entry, which spells both its
/s/ by hand precisely because no slot rule works. Since session 6 moved
`flips` into the designs and made them the authority, a checkbox tick in
the designer silently overrides the documented table — so this is also a
question about whether that override should be able to add a flip nobody
recorded evidence for.

**The corpus now has something to say about /s/.** This was deferred
waiting on 20, on the same reasoning as B1: every attested glyph in a
known slot is evidence for or against a `FLIPS` entry, and the current
table cites one or two words per glyph from memory. The material is now
transcribed, and `still: (s%,t)` is a **bottom-slot /s/ in attested
material** — read off a source image rather than argued from the docs.

Both /s/ forms appearing in the same slot is what no flip rule can
produce, so the question is still whether `designs/s.json`'s `flips: true`
should be able to override a documented table that deliberately excludes
it. But it can now be settled by looking. /ɔɪ/ still has no evidence in
either direction.

**19. Stroke-level fusion.** Canon is hand-lettered so adjacent glyphs
interlock and share edges; this butts discrete SVGs together. Correct
structure, wrong texture. Would need connection points designed into each
glyph — a real type-design project.

### Docs and process

~~**9. A public-facing spec section at the end of `AVATARIAN.md`.**~~
**Done in session 10** — §12, "The specification".

The rest of `AVATARIAN.md` is a working reference: it carries the
reasoning, the evidence, and the record of what was believed and
corrected on the way, which is exactly what you want while the model is
still moving and exactly what you don't want when you are trying to
implement it. §12 is the other thing — present tense, no history, no
citations, no argument. Where a rule isn't determined it says so and
stops rather than guessing.

**7. Reference material catalogue page.** An index of every reference
image and what it contains. Overlaps B2 — the inventory is the input.

~~**6. Consolidate credits.**~~ **Done in session 7.** `AVATARIAN.md`
§ Credit is the one place they are maintained; `README.md` and
`CONTEXT.md` point at it. The site footer and the wiki file headers keep
their copies deliberately — they are the only place a reader who never
opens the repo will see attribution — and the site footer now leads with
the tool's own credit rather than burying it last. B5 (extra links) can
be added to the one section whenever they turn up.

~~**8. Final article synthesising the decipherment**~~ **Done in session
10** — `DECIPHERMENT.md`, "Reading Avatarian".

A write-up rather than a working doc: what is known, how it is known, and
what isn't. Deliberately a different genre from item 9 — that one states
the rules, this one makes the argument for them.

The section that earns its place is the last one. Three failures shaped
how this project works and they are all the same failure — treating a
single observation as a rule. /e/ was made a positional variant on one
example and had to be reverted; `toph` sat in the dictionary confidently
wrong for months; the tool's own help text taught a broken spelling of
"Katara" in three places. The response to all three is the commitment the
corpus exists to enforce: **record what was observed separately from what
was inferred from it.**

It also ends with what would actually move the decipherment forward,
ranked — glossed sentences first, isolated names a distant fifth — since
"send more material" is not useful advice on its own.

~~**27. A test suite.**~~ **Done in session 10.**

```bash
python3 tools/run_tests.py
```

67 checks: geometry parity (243 cases, folded in from `check_geom.py`),
16 Python tests over the corpus validator and its save path, and 51 node
tests over the block model, the sounds syntax, the lookup chain and
reverse-decode. **No dependencies** — `unittest` and node's built-in
`--test`. See `tests/README.md`.

**The corpus is the fixture.** Nearly every structural assertion runs
against `corpus/attested.json` rather than invented examples, so the
suite grows on its own: transcribe a source in the workbench and every
test gets more evidence, with no test written. A failure names the word
it broke.

Two tests behave unusually, both on purpose:

- **C-C blocks are reported, not failed on.** The nine-row invariant
  holds for V-C and C-V; two consonants would be ten, and whether they
  overlap is B1. Asserting either answer would invent one, so the test
  prints the inventory instead — currently `please: (p,l)`,
  `students: (s%,t)`, `students: (n,t)`, `metalbending: (n,d)`.
  **That list is what B1 has been waiting for**, and it grows with the
  corpus.
- **V-V blocks do fail.** "V-V never happens, a null substitutes" is a
  claim about the script, so attested material contradicting it should
  stop the build.

The recogniser needs `getPointAtLength` and cannot run in node, so
`tests/recognise.html` is its test — open it. Floors are set below the
measured numbers and averaged over three passes.

One small refactor came out of it: `resolveBlocks()` in `render.js`. The
null-resolution decision used to be three lines inside the render loop,
so the structural rules could only be checked by building elements and
reading them back. It is now a function, and the DOM is only what happens
afterwards.

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
pairing partner. **Outstanding: C-C (B1) — and B1 is no longer waiting
on anything.** The corpus now shows fifteen attested C-C blocks across
three sources, which is what this was deferred for. Measure their rows in
the source images and the last piece of the model can be stated whole in
`glyphspec.py` and `designer/js/geom.js` — run `check_geom.py` after.

It likely also wants the designer's lattice reworked so a block's two
glyphs share a coordinate space, which is what the "vowel and consonant
merge into one glyph" case in 4-row C-V blocks needs.
