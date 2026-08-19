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

- **Open decoding questions** → `AVATARIAN.md` §10 and §12.8. What is
  left: how far two consonants overlap in a C-C block, whether /ɔɪ/
  mirrors by slot, /x/'s missing glyph, whether the FACE vowel is ever
  written as one letter, and the unassigned mark.
- **The corpus design** → `CORPUS.md`. Items 20–24 below are its
  execution; the reasoning is there, not repeated here.

---

## Blocked — needs a decision or material from the user

~~**B1. C-C block layout.**~~ **Settled in session 12: one lattice row of
overlap.** The user measured the art and gave the answer directly — the
two consonants are **full size** and the bottom row of the top glyph is
the top row of the bottom one, so ten rows of content total the block's
nine. Session 5's guess was right; the shrink model the site had been
using (each consonant at 4.5 rows / 9/10 scale) was wrong.

Implemented as the bottom-slot pull-up in `blocks.css` — a C-C block uses
`margin-top: -0.36 × av-size` (the clearance sum plus one full lattice
row) instead of scaling the glyphs. Wiki CSS in step (`-0.45em`). Verified
in the browser against the site's own `render.js`: the two consonant
boxes overlap by exactly one lattice row (box overlap = one row + both
clearance margins), the consonants render at full `av-size`, and the C-C
block's ink lines up with the V-C block beside it to within a pixel.

This closes item 3 (the 9-row model) entirely. What remains is only
**stroke-level fusion** (item 19): the rows coincide, but the inks butt
rather than truly interlock the way hand-lettered canon does.

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

~~**B4. Squiggle or badge?**~~ **Decided (session 12): mark the
attested word, with an underline.** Confirms `CORPUS.md` §3 — badge the
rare attested word rather than squiggle the unattested majority. So
item 21's display is: an **underline under attested words**, nothing on
the rest. Unblocks item 21 and the confidence rendering on item 31.

**B5. Extra credits links.** Contributors plus source material read or
transcribed. The user will supply everything needed **at ship time**;
until then there is nothing to add. Goes into `AVATARIAN.md` § Credit.

---

## Ready to build

### The corpus (see `CORPUS.md`)

**20. Digitise the attested writing samples** into a confirmed
dictionary: one entry per attested word or phrase, storing the spelling
actually observed, plus where it was observed. The biggest open
workstream — and also the **prerequisite for item 3 and B1**, since the
C-C question is going to be answered by looking at attested blocks
rather than by reasoning from a couple of samples.

**209 words from 255 sightings across 11 sources**, every one of them
filed with its image, and every image named after its source.

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

**What this bought.** B1's C-C inventory went from four blocks to 72;
B2 stopped being a blocker; and the corpus turned out to be keeping three
rules nobody had stated — the syllable rule (§12.5), the approximant
turn, and /s/ above a cluster (§12.6). None of them could have been seen
at 26 entries. The corpus is also the test fixture, so transcribing gives
the suite more evidence with no test written.

**Still wanted: water, earth and air, with images.** Worth more than
their count — the reference material supplies IPA *alongside* Avatarian
for all four elements, which is what proved the ɜ/ə merge, and none of
that evidence is in the corpus yet.

~~**21. Show confidence in the UI.**~~ **Done in session 13.** B4's mark
— an underline under an attested word, nothing on the rest — now shows in
the translator output as well as the corpus page. `corpus.html`
(`.word-en`) was the working example and its legend; the same mark is a
new `.cap-en.is-attested` rule in `style.css`, applied in `renderWords`.

The signal is the word's presence in the corpus, read off the caption
rather than off `w.tier` — `draw()` always renders from the SOUNDS BOX,
so these word objects come from `soundTextToWords` and carry no tier or
entry. That is the same reason the `contested` slice already looked words
up by caption, so the two now share one lookup, lifted above the caption:
the underline marks every attested word, the badge the disputed handful.
They coexist (`the`/`come` render underlined + `contested`; `cat` plain).
Verified in-browser; cache-bust `v=31 → v=32`.

**The `contested` slice** (a word whose sources *disagree* on the
spelling) is marked separately from the underline, and in session 13 its
translator display changed twice over: from a "contested" badge to a
small asterisk on the word (`your*`), **and gated to a near-even split** —
the runner-up spelling must be at least half the leader (`minor*2 >=
major`). So `your`/`come`/`free`/`of` (2–1, 1–1) mark; `the` (5–2) does
not, because a lopsided split is one spelling with stragglers, not a real
dispute. This is translator-only; the corpus page keeps its own contested
handling (the `is-contested` border, the collapsed-by-spelling hover).

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

~~**24. Audit `EXCEPTIONS` against reference material.**~~ **Closed by
decision (session 12): the corpus is essentially complete, and any name
not in it has no source to check against.** The audit was "check each
guessed name against art"; with no more art coming, the remaining names
(`sokka`, `iroh`, `azula`, `korra`, `omashu`, `kyoshi`, `sozin`, `roku`,
`ozai`, `suki`, `yue`, `haru`) stay provisional readings, and that is the
final state — `EXCEPTIONS` is *readings*, all provisional; the corpus is
*observations*, none of it is. The mechanism is settled and proven: a
name that ever does get attested **moves** to the corpus rather than
being corrected in place (this is how `what`/`toph`/`aang`/`katara` went).

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

~~**31. A public corpus page on the site.**~~ **Built, session 12** —
`site/corpus.html`, a read-only second page linked from the translator
("Corpus →", and "← Translator" back). Every attested word, its spelling
drawn in real Avatarian, on a card sized to the word (flex-wrap, so a
long word gets a wider card and stays one line). A live text filter, a
source filter, and B4's underline used as the page's own legend. It reads
`window.AVATARIAN_CORPUS`, already on every page — no server, no build
step. Light/dark verified.

It went through a long UX arc with the user; where it landed:

- **Hover a word for its source(s)** (`#pop`, a fixed floating panel so a
  card edge never clips it, capped height + scroll). Uncontested words
  show each source's image and the text slice around the word, bolded.
- **Contested words collapse to one row per distinct spelling** — the
  glyph and count on the left, that spelling's sources as thumbnails on
  the right — so `the` is two rows, not six. A **second hover** on a
  thumbnail (`#pop2`) shows that source's name and snippet. "alternate
  spellings" is flagged inline on the card's meta line.
- **The source images are now published** (item 31's open question,
  resolved by the user). `corpus/sources/` stays the workbench's dir;
  `build_corpus.py` `sync_images()` copies them into `site/sources/`
  (committed, served); the corpus page links each source to its post URL
  or its image. See the `.gitignore` note.
- **The source filter is item 7 as a filter** — it counts every source
  that cites a word, winning spelling or losing alternate. The standalone
  source-catalogue page (item 7 proper) shipped in session 13 as
  `sources.html`.
- **B4 decided: a line under attested words.** The page is the working
  example; applying the same mark in the translator output is item 21.

~~**16. Punctuation.**~~ **Rendering done.** `, . ? !` are written as
themselves in the sounds box and drawn beside the word.

**A mark is a new height class: one lattice column wide, nine rows tall**
— the height of a whole block rather than of a slot. So it is not paired
with anything, it does not count toward the whole-blocks rule, and it
breaks the pairing: the sounds either side of a mark pair among
themselves.

The unreadable-glyph marker moved from `?` to **`*`** to free the
question mark up. Eleven corpus entries were migrated.

Apostrophe is still stripped. It is documented as being treated like a
vowel, i.e. as a *slot*, which is a different thing from these four and
wants its own look at the art.

**32. The punctuation marks are not in the designer.** They are inline
SVG in `site/js/render.js`, and can only be changed by editing that file.

Everything else in the glyph set is drawn in the designer and shipped
through `build_glyphs.py`; these four are the exception, because the
designer only knows two height classes — consonant `5×5` and vowel `5×4`
— and a mark is `1×9`. Adding the class means touching:

- `tools/glyphspec.py` — `TALL_KINDS`, `frame_for`, a `mark_full` type
- `designer/js/geom.js` — the same, kept in step with the Python
- the designer UI — a lattice that is 1 wide and 9 tall
- `tools/build_glyphs.py` and `tools/promote.py` — so a mark can ship

Worth doing before anyone wants to *change* a mark, and worth doing at
all because the current four were drawn by eye rather than on the
lattice. Not urgent: they render correctly and are pinned by tests.

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
remaining placeholder. **Parked by decision (session 12): no glyph is
known, and none is coming — do not raise this again.** It stays a
placeholder; the dashed box is the honest rendering of "no source shows
this."

~~**30. Two glyphs flip that the docs say don't.**~~ **/s/ answered;
/ɔɪ/ still open.**

`designs/s.json` carried `flips: true`, an undocumented override of a
table that deliberately excludes /s/ — and the corpus says it was wrong.
**/s/ takes both orientations in the same slot**, which no by-slot rule
can produce. What decides is the glyph beneath it: /s/ mirrors on top of
another consonant in 11 of 12 attested blocks, and in none of the 20
where it sits above a vowel or a null. The flag is removed and the rule
is in `render.js` as `TURNS_ABOVE_CLUSTER`.

The same look found a second rule nobody had: **only the approximants
/r l w j/ ever mirror in a bottom slot**, and they do it in the bottom of
a C-C block — 28 times against 1, across seventeen consonants. That
accounted for 19 of the 52 hand-typed overrides.

**Three attested slots disagree with the rules and are not errors** —
all checked against the art:

- `waterproof` — /r/ plain in a /pr/ onset where the rule says it turns.
  Also a morpheme-boundary word (item 34), which may be the reason.
- `rest` — /s/ drawn above /t/ where the rule says it mirrors. From
  `katara-letter`, one of the two hand-written sources.
- `l` is left as a **by-slot** flip rather than moved to the approximant
  rule, because its evidence under a vowel is mixed: 2 mirrored against
  3 plain. Moving it would trade three known exceptions for two. Wants
  more attested `l` in V-C blocks.

**/ɔɪ/ still carries `flips: true` with nothing behind it.** Three
sightings, all in bottom slots, none checked against the art. **Decision
(session 12): presume no answer until something in the corpus settles
it.** Leave the flag as the shipped default; do not chase it. If a
top-slot /ɔɪ/ ever turns up attested, revisit then.

~~**33. `EXCEPTIONS` is now partly redundant, and one entry is wrong.**~~
**Done in session 12.** All nineteen attested words are out of
`EXCEPTIONS`:

```
the of to and you your are is have when come do no be me
what katara bending metalbending
```

`what` was checked against the art before it went. **The corpus is
right**: the block glossed "what" in `katara-letter.webp` is `w` over
/ɑ/'s three-stroke Y, beside `(t, ∅)` with the U-shaped null a consonant
partner takes. /ʌ/ is four dashes and is not in the word. (The letter is
the only source that has "what" — `instagram-3-3.png` does not contain
it.)

What changed, and what did not:

- **Nothing the site draws.** All nineteen are attested, so the corpus
  answered for them before and answers for them now.
- **The workbench's "against the model" panel** now gets CMU's reading
  instead of a hand assertion. For `what` that is still `w ʌ t` — but it
  is now a real disagreement between canon and the dictionary, which is
  what the panel is for, rather than the model being handed a wrong
  answer and blamed for it.
- `katara` and `metalbending` are not in CMU, so the model's honest
  answer for them is now `guessed` from the letter-to-sound rules. That
  is a true statement about the model.
- `metalbending`'s comment had argued it should stay as a fallback for
  `corpus.js` failing to load. It went anyway: a second copy that can
  drift is the whole failure mode item 24 exists to prevent, and it was
  never the full answer — canon's null after the `l` cannot be written
  in a phoneme list.

**34. Morpheme boundaries look like a second boundary rule.** The
syllable rule (§12.5) misses ten of 244 attested spellings, and six of
those divide at a morpheme boundary instead:

```
something     s ʌ ∅ m θ ɪ ŋ ∅         some|thing
humansitters  h u m ∅ n ∅ s i t ∅ ...  human|sitters
waterproof    w ɔ t ə r ∅ p r u f      water|proof
woong's       w u ŋ ∅ ɛ s              woong|'s
heng's        h ɛ ŋ ∅ ɛ s              heng|'s
anyway        ɛ n i ∅ w e              any|way
```

Six is enough to notice and not enough to state. It also needs a way to
*find* morpheme boundaries, which is a harder problem than syllables and
has no equivalent of maximum onset to fall back on. Worth revisiting when
more compounds are attested.

`appa` (every phoneme padded) and `mmm` are the other two misses, and
both look like genuine oddities rather than rules.

~~**35. Six tests fail on quarantined specimens.**~~ **Fixed, session 12.
Suite is 57/0.** The six broke because `appa`, `katara`, `fanny` and
`of` all became attested (or, for `of`, left `EXCEPTIONS`), so tests that
pinned their tier/spelling/source went stale.

Fixed two ways, following the shape this item asked for:

- **Where the value can drift, read it from the corpus.** `appa`'s
  three-block check and its source/confidence check now look the entry up
  via `entries(ctx)` instead of hardcoding `ɑ…ɑ` / `appa-art` — appa had
  since been re-transcribed to `æ…ə` off `katara-letter`, and a pinned
  check just breaks again.
- **Derived-tier specimens moved to words the corpus will not attest.**
  `bloodbending` (in `EXCEPTIONS`, not CMU, a coined compound) and
  `though` (in both), replacing the main-character names. A main
  character is exactly what got attested before, so it was the wrong
  choice; the user has since confirmed the corpus is essentially
  complete, which makes these stable.

**36. The syllabifier is hand-rolled.** `ONSET_CLUSTERS` in `g2p.js` is a
literal list, and `same_syllable` is a heuristic with two known misses
(`anyway`, `asked`). It gets 234 of 244, which is good enough to ship and
not good enough to forget. CMU's stress marks are in the bundled
dictionary and are a better source of truth than a cluster list.


**19. Stroke-level fusion.** Canon is hand-lettered so adjacent glyphs
interlock and share edges; this butts discrete SVGs together. Correct
structure, wrong texture. Would need connection points designed into each
glyph — a real type-design project.

Session 12 surfaced this in the C-C overlap: a glyph's full-height edge
line (l/r/j right, d left, z centre) rides one row into its neighbour and
reads as a stray line where the neighbour is empty there — `please`,
`hard`, `card`, `new`, `menu`, `models`, `waters` — while fusing cleanly
where it isn't (`class`, `cream`, the `k`/`f` tops).

Two glyphs got a targeted per-cluster redraw (`render.js` `clusterForm`),
which is the clean case for each: **/s/**'s point insets one row so it
stops at the boundary, and **/z/** drops its two corner dots (they rode
up into the glyph above). Both leave the non-cluster form alone.

The **edge lines** are the part left as-is. A "the overlap row belongs to
the top glyph" clip was prototyped: it removed the protrusions and left
`class`/`cream` pixel-identical, **but the user reviewed it and chose to
keep the current rendering** — the lines stay. Untouched by design, not
forgotten; revisit only as part of the real fusion pass, and don't
re-propose the clip without asking. (`help` is the mirror case — the line
belongs to the top glyph poking down — and was never handled.)

**/p/ was the third point-overshoot case and stays as-is.** Its diamond
tip pokes into the neighbour like /s/'s did, but insetting a single
vertex made a lopsided pentagon, and a compressed-symmetric-diamond
version the user also disliked. Both were reverted. Don't re-propose
either; if revisited, it needs a genuinely different idea.

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

~~**7. Reference material catalogue page.**~~ **Done in session 13** —
`site/sources.html`, the inverse of the corpus page. A card per reference
image (letter, poster, stamp) showing the image, its provenance link, the
transcription, and every word read off it — each drawn in the spelling
*that source* used (the corpus page only reveals per-source spellings in
the contested hover), with a `∗` on any word this source spells
differently from the corpus's most-attested form. Sorted richest-first.

Cross-linked with the corpus page both ways: word chips link to
`corpus.html?q=<word>`, a "Sources →" nav link was added, and
`corpus.html` now honours `?source=<id>` / `?q=<word>` to pre-filter.
Reads `window.AVATARIAN_CORPUS` — no server, no build step. Light/dark
verified.

**A discrepancy it surfaced, and fixed:** `academy` had cited
`instagram-3.3` in `attested.json`, but that poster has no "academy" —
the word is in the toph-letter ("metalbending academy"). The user
confirmed the mis-attribution; its `source` was corrected to
`toph-letter` and `corpus.js` rebuilt. The catalogue making this kind of
thing visible is part of its point.

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

~~**28. README/CONTEXT rewrite — they had gone WRONG.**~~ **Done in
session 12.** Both documents now agree with `AVATARIAN.md` on the three
session-11 rules: the syllable boundary and mid-word nulls, the
approximants turning inside a cluster, /s/ turning above one, and `l`
being a by-slot flip on purpose rather than by oversight. Neither tells
you to spell /s/ by hand any more — `$`/`%` are described as a recording
tool, since the derivation reproduces 50 of the corpus's 53 markers and
the three misses are the known `l$` cases.

Four more contradictions turned up in the same read and went with them:
`README.md` said punctuation is stripped (four marks have been drawn
since session 11); it told the reader to bundle the CMU dictionary three
paragraphs after describing the bundled CMU dictionary — that passage was
really about the wiki gadget, which is the one place with no dictionary,
and now says so; its sounds example was ARPAbet directly under a line
calling readable codes primary; and `CONTEXT.md` said there is no test
suite, which stopped being true in session 10.

**`AVATARIAN.md` §10 and `CORPUS.md` §1 were not current either**, though
item 28 said they were. §10 listed /s/ orientation as open against its
own §12.6, still said punctuation was stripped, and still proposed the
dictionary that shipped in session 7; `CORPUS.md` §1 argued for building
a corpus from three unknowns, two of which the corpus has since answered.
Both fixed. The lesson is worth keeping: **a document can contradict
itself between sections**, and this one did it in the two places a reader
is most likely to start.

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

## Item 3 — the 9-row block model ~~(DONE, session 12)~~

Implemented: V-C layout, the 3-row/4-row split, null selection by
pairing partner, and now **C-C (B1): two full-size consonants overlapping
by one lattice row** — the last piece. The site renders it via
`blocks.css` (a C-C block's bottom slot pulls up `-0.36 × av-size`), and
the model is stated whole in `AVATARIAN.md` §12.4/§12.5/§12.8.

Two follow-ons that are NOT part of the height model and stay open:

- **Stroke-level fusion (item 19).** The overlapping rows coincide but the
  inks butt rather than interlock. This is the texture, not the layout.
- **The designer's lattice** could be reworked so a block's two glyphs
  share one coordinate space — what the 4-row C-V "merge into one glyph"
  case wants, and what would let the C-C overlap be previewed there rather
  than only on the site. `glyphspec.py` / `designer/js/geom.js` draw one
  glyph at a time today; the overlap lives in CSS, not in them, so
  `check_geom.py` is unaffected.
