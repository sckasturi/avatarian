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

**B3. Does `appa` show tall-short-tall nulls?** One look at the art.
Rendering its attested spelling `AA 0 P 0 AA 0` predicts tall, short,
tall — which is what the pairing-partner rule gives, since ɑ is a vowel
and p is a consonant. Confirm and the null-height rule holds on a third
word with no syntax change; contradict it and the sounds syntax needs a
`0c` code. See `CORPUS.md` §7.

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
actually observed as a sounds-syntax string, plus where it was observed.
The biggest open workstream — and now also the **prerequisite for item 3
and B1**, since the C-C question is going to be answered by looking at
attested blocks rather than by reasoning from a couple of samples.

**21. Show confidence in the UI.** Three tiers — attested / derived /
guessed — matching the lookup chain. Blocked on B4 for the visual
treatment, not for the plumbing.

**22. Make the corpus win in the lookup chain**, ahead of `EXCEPTIONS`.
It differs in kind from everything below it: the others produce phonemes
and let `pairUp()` decide the blocks, while the corpus supplies a
finished spelling and `pairUp()` must not run. `appa` is the proof — it
cannot be expressed as a phoneme list plus the pairing rule.

**23. A transcription workbench.** Reference image on one side, the
spelling being built on the other, live Avatarian underneath to compare.
Most of it exists already in the designer: the live block preview, the
palette, the shared sounds syntax, a local server that writes files. What
it needs is an image underlay, an entry form and a save route.

**24. Audit `EXCEPTIONS` against reference material.** Every in-world
name is a guess until checked. Two of the first four checked were wrong
(`toph`, `aang`), so expect more: `katara`, `sokka`, `iroh`, `azula`,
`korra`, `omashu`, `kyoshi`, `sozin`, `roku`, `ozai`, `suki`, `yue`,
`haru`. Confirmed ones migrate into the corpus.

### Handwriting input

**25. Stylus glyph recognition.** Draw a glyph, get ranked matches. Much
of the work is done: `designer/js/fit.js` already normalises a freehand
gesture onto the lattice, which is exactly the step a stroke recogniser
needs. Recognition on top is nearest-neighbour against the 43 shipped
designs. No model, no training data, no page weight.

**26. Photo input — as an underlay, not as recognition.** Show a
reference image behind the transcription surface and let a human read it
with 25 helping. Full photo OCR is a much larger project (segmentation of
interlocking hand-lettered blocks, a bundled classifier) and needs
training data that only 20 can produce, so it is downstream of the
corpus, not parallel to it. `CORPUS.md` §6.

### The site

~~**11. Sounds box scrolling.**~~ **Done in session 7.** It grows to fit
as you type and then scrolls, capped at 30vh (22vh on mobile, where the
output is pinned to the top and every row the box takes is a row the
drawing doesn't get).

~~**10. Better handling of parentheses.**~~ **Done in session 7.**
Replaced the regex with a depth-counting scan. Three inputs used to put a
bracket character into the tokeniser, where it rendered as an unknown
sound — an unclosed `(`, a nested `(a (b))`, and a stray `)`. A fourth,
two captions on one word, silently kept only the last.

~~**12. A space button.**~~ **Done in session 7.** A small toolbar on the
sounds box: `/ word break`, `0 null`, `⌫` and `clear`. Clicks now insert
**at the caret** rather than always appending, spaced off on both sides,
so going back to fix a word in the middle works — which is most of
transcribing from a reference. Verified by building the attested poster
line `F AE N IY / IH Z / M IH S IH NG` entirely by clicking.

**29. Design a more intuitive sound alphabet than ARPAbet.** ARPAbet is
what the sounds box takes today, and it is genuinely unintuitive — most
sharply because **`AH` is /ʌ/ (STRUT) while `AA` is /ɑ/ (PALM)**, so the
code that looks like "ah" is not the "ah" sound. `AO` is /ɔ/ but `AW` is
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

**Sequence this against the corpus (20).** `CORPUS.md` proposes storing
attested spellings as sounds-syntax strings, which would tie every corpus
entry to whatever scheme is current — change the scheme later and the
whole corpus needs migrating. The fix is to **store the corpus in IPA**,
which is canonical and not going to change, and treat any ASCII scheme as
a display and input layer over it. Worth deciding before 20 is built
rather than after.

**4. Fuzzy reverse-decode.** Given an Avatarian sequence, suggest likely
English words ("pretty sure this is X") instead of the current
exact-match-only lookup.

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
