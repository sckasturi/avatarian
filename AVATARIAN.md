# Avatarian — the script, in one place

This is the reference for **Avatarian itself**: how the writing system
works, and everything the project currently knows about it, stated in the
present tense as one knowledgebase. Where the script is not yet fully
determined, the open question is named (§13).

- **How the script was worked out, as an article** → `DECIPHERMENT.md`
- **How the tool is built and deployed** → `DEVELOPMENT.md`
- **The glyph design / lattice format** → `designs/README.md`

When this document and the code disagree, the code wins:
`tools/build_glyphs.py` is the single definition of the shipped glyph
set, and `tools/glyphspec.py` is the authority on geometry. Treat the
tables here as a readable snapshot of those files.

---

## 1. What Avatarian is

Avatarian is the **conscript** (constructed script) introduced for the
new *Avatar: The Last Airbender* film. It is **phonetic**: it encodes IPA
*sounds*, not English letters. "Katara" is written from its pronunciation
/k ə t ɑ ɹ ə/, and any spelling that sounds the same is written the same.

Everything in this project's pipeline is IPA-first; English is an input
convenience that is converted to IPA before anything is drawn.

This is a **community decipherment**, not official documentation. The
reading below is assembled from labelled writing samples and a
hand-lettered key chart. What is solid and what is still a guess are both
called out.

### Credit

**This is the canonical credit list, mirrored on the site's Sources page**
(`site/sources.html`, its "References & credits" section) — keep the two in
step when either changes. The site footer carries the tool's own byline,
and the wiki files carry a one-line pointer back here.

The reference material this project encodes — the key chart, the writing
samples, the structural readings — comes from:

- **BokerBigBanana** on Avatar Wiki — <https://avatar.fandom.com/wiki/User:BokerBigBanana>
- **u/DepressionDokkebi**, "Avatarian decipherment so far" — <https://www.reddit.com/r/TheLastAirbender/comments/1v4yalr/avatarian_decipherment_so_far/>
- **u/DepressionDokkebi**, "The mostly full Avatarian alphabet and my translations" — <https://www.reddit.com/r/TheLastAirbender/comments/1v8aue5/the_mostly_full_avatarian_alphabet_and_my/>
- **u/arienzio**, "New Avatar: The Last Airbender conscript" — <https://www.reddit.com/r/neography/comments/1slqce2/new_avatar_the_last_airbender_conscript/>

**Tool designed by TechFilmer** on Avatar Wiki —
<https://avatar.fandom.com/wiki/User:TechFilmer>.

Pronunciations come from the **CMU Pronouncing Dictionary** (BSD-style
licence) — <https://github.com/cmusphinx/cmudict>; `tools/build_lexicon.py`
maps it onto this project's phoneme set. The code renders the decipherment
work — **the script itself is not this project's research.**

---

## 2. The writing model: blocks are pairs

**Sounds are written two to a block, in strict order: the first sound in
the top slot, the second in the bottom slot. Blocks run left to right.**
Words are separated by a space; blocks within a word are packed tight.

Nothing about the layout depends on a sound being a consonant or a vowel.
A block is simply the *next two sounds* in the word.

```
please  /p l i z/    (p,l) (i,z)
at      /æ t/        (æ,t)          vowel on top
up      /ʌ p/        (ʌ,p)          vowel on top
me      /m i/        (m,i)
not     /n ɑ t/      (n,ɑ) (t,∅)
mad     /m æ d/      (m,æ) (d,∅)
wake    /w eɪ k/     (w,e) (ɪ,k)
```

This is a pairing model, not a syllable model: consonants do **not**
cluster on top with the vowel beneath. The two agree on simple CV words
like "katara" and disagree on almost everything else.

---

## 3. The nulls

When a slot has no sound for it, a **null** is written in. A null is part
of the spelling, not padding, and is never omitted. Neither null is a
sound.

There are two, distinguished by height:

| key | shape | height class | design type |
| --- | --- | --- | --- |
| `∅` (typed `0`) | rounded cup ∪ | vowel-height (3-row) | `mark` (`null_v`) |
| `∅c` | squared cup | consonant-height (5-row) | `mark_consonant` (`null_c`) |

**Which null is written is decided by its pairing PARTNER, not by the slot
it fills:**

- a **vowel** paired with a null takes the **consonant-height** (`∅c`) null;
- a **consonant** paired with a null takes the **vowel-height** (`∅`) null.

`render.js` (`nullFor`) applies this to any null, whether auto-inserted
into a trailing empty slot or typed as `0` mid-word. It is also what keeps
every block nine rows tall (§4): 4 + 5 for a vowel and its null, 5 + 4 for
a consonant and its null.

`∅c` has no typeable code, and none is needed: `0` plus the sound beside
it says everything a second code could.

Nulls occur at the end of a word with an odd sound count, and **inside**
words wherever the syllable rule (§5) leaves a slot open.

---

## 4. Heights — nine-row blocks

Every block is **nine rows** tall. A **consonant** occupies 5 rows, a
**vowel** 4, and they stack flush. Height follows the **sound, not the
slot** — a vowel in the top slot (a word that starts with a vowel, "at",
"up") is still short.

The ratio is height only: vowels keep the full block width, drawn wide and
flat spanning their partner. A vowel is a **separately generated 100×80
drawing** rather than a squashed square, so every glyph scales uniformly,
stroke weight is identical everywhere, and dots stay round.

### 3-row vs 4-row vowels

A vowel's drawing fills either 3 or 4 of its 4 rows.

| | vowels |
| --- | --- |
| **4-row** (fills the top row, connects to its partner) | ɪ e u ʊ ɑ aʊ ɔɪ |
| **3-row** (leaves the top row empty, a gap) | i ɛ æ ʌ ə oʊ ɔ aɪ |

Every vowel design carries an explicit `rows`, read from the designer's
row toggle; `VOWEL_4ROW_BASE` in `build_glyphs.py` is only the fallback
for an undrawn vowel. In the DOM a 4-row vowel carries an `avatarian-4row`
class. A 4-row vowel's ink spans lattice y **0.5–3.5**; a 3-row vowel's
spans **1.5–3.5** (`glyphspec.validate` checks the declaration against the
drawing).

⚠️ **Read the 4-row set as IPA, never off the file stems.** The SVG stems
don't track the sounds: stem `oo` is /ʊ/ (4-row) while stem `ow` is /oʊ/
(3-row), and stem `uh` is /ʌ/ (3-row) — see the code/stem note in §8.

### Reading a block top to bottom

```
V-C, 3-row vowel:   1-3 vowel · 4 gap · 5-9 consonant
V-C, 4-row vowel:   1-4 vowel         · 5-9 consonant
C-V, 3-row vowel:   1-5 consonant · 6 gap · 7-9 vowel
C-V, 4-row vowel:   1-5 consonant        · 6-9 vowel
```

A **4-row** vowel touches its partner directly and reads as one merged
figure; a **3-row** vowel does not. The empty row of a 3-row vowel is
always a gap on the vowel's **inner** side — between the vowel and its
partner, never at the block's outer edge. This holds even for a vowel that
mirrors (§6): a flipping 3-row vowel (æ, ə, aɪ) in a bottom slot is drawn
upside-down, which would carry its empty row to the outer edge, so it is
shifted back one row to keep the gap inner. "fire" /f aɪ ə ɹ/ is the
visible case — aɪ's bar sits on the baseline, not a row above it.

### The shared lattice edge, in CSS

A consonant's bottom lattice line *is* the vowel's top lattice line, but
each SVG carries its clearance margin (§7) outside the lattice, so
stacking the boxes flush leaves both margins as a gap. The bottom slot is
pulled up by the sum of the two margins:

- site: `.avatarian-slot-bottom { margin-top: calc(var(--av-size) * -0.18) }`
  (everything scales off `--av-size`, `52px` by default)
- wiki: `-0.225em` (keep the two in step)

A **C-C block** pulls its bottom slot up further — by the clearance sum
plus one full lattice row (`-0.36 × av-size` on the site, `-0.45em` on the
wiki) — which produces the one-row overlap in §5.

---

## 5. Block types, and where blocks divide

Three combinations occur: **V-C**, **C-V**, **C-C**. **V-V never occurs** —
where two vowels would meet, a null takes the second slot.

In a **C-C block** the two consonants are full size and **overlap by one
lattice row**: the bottom row of the top glyph is the top row of the
bottom one, so their ten rows of content total the block's nine.

**A block never straddles a syllable boundary.** Sounds are taken two at a
time, but only within one syllable; where a syllable ends the block ends,
and a null fills any slot left over.

Syllables divide by **maximum onset**: a consonant, or a cluster English
allows at the start of a syllable, belongs to the vowel that *follows* it.

```
found     f aʊ n d              /nd/ closes one syllable — one block
panda     p æ n ∅ d ə           pan-da: the same pair, divided by a null
free      f r i ∅               /fr/ opens one syllable — one block
academy   ə ∅ k æ d ə m i       a-ca-de-my: the vowel closes its syllable
frozen    f r oʊ ∅ z ə n ∅      fro-zen: likewise
festival  f ɛ s t ə ∅ v ə l ∅   fe-sti-val, NOT fes-ti-val — /st/ is a
                                legal onset, so s and t share a block
```

From a word's sounds this reproduces all but about ten of the attested
spellings exactly. The residue divides at a **morpheme** boundary as well
as a syllable one — `some|thing`, `human|sitters`, `water|proof`,
`woong|'s` — which looks like the same principle on a second kind of
boundary, on too few examples to state as a rule. The
syllabifier itself (`ONSET_CLUSTERS` / `same_syllable` in `g2p.js`) is a
hand-rolled heuristic.

---

## 6. Orientation — some glyphs mirror

A glyph is drawn **once**, in its top-slot form. Most glyphs are written
the same way in either slot. `render.js` applies a `scaleY(-1)` (class
`avatarian-flipped`) where a glyph mirrors, rather than shipping a second
drawing. There are three separate reasons a glyph turns.

**By slot.** These mirror top-to-bottom purely by which slot they land in
— æ's cup becomes a cap, ɑ's Y inverts:

> **æ ɑ ɪ e aɪ ə**

(/l/ is **not** in this set: it stays plain beside a vowel — school, all,
lord, still. /l/ and /ɹ/ change shape by the cluster-form rule above, not
by slot.)

The bar for this list is both forms attested in known slots (e.g. /aɪ/:
the chart's citation form, dots below the rule, vs "fire", dots above).
`u` and `ɔ` also mirror by slot, but their stored drawing is the
bottom-slot form rather than the top; only the saved art is the other way
up. (`ɔɪ` also mirrors by slot in the shipped set, but with no evidence
either way — see §13.)

**By company — the approximants, and /l/ /ɹ/'s cluster form.** In a
two-consonant block /l/ and /ɹ/ do **not** merely flip — they take an
independently-drawn **cluster form** (a second body, read off the key's
`l_b` tracing; /ɹ/'s is /l/'s mirror). /l/ takes its cluster form in *every*
cluster; /ɹ/ in every cluster **except beside /l/**, where the pair splits:
the **top** glyph keeps its base (vowel-context) form and the **bottom**
takes the cluster form — `world` = r-base over l-cluster; a hypothetical
`l/r` would be l-base over r-cluster. The cluster form is drawn in its
bottom-slot orientation, so it still flips top-to-bottom when it lands in a
**top** slot (`help`, `milk`). Under a vowel /l/ and /ɹ/ keep their base
form. **/w/ and /j/ have no cluster form yet** and simply mirror in the C-C
bottom slot, the way /l/ and /ɹ/ did before this was worked out; the
mechanism (`CLUSTERS` in `build_glyphs.py`, `variants.cluster` in the
manifest) is ready for them when the shapes are drawn.

**By company — /s/ above a cluster.** /s/ mirrors when it sits on **top of
another consonant** and stays upright everywhere else — `render.js` derives
it (`TURNS_ABOVE_CLUSTER`). The corpus bears this out (flipped over a
consonant, upright over a vowel/null or in a bottom slot) with **one known
exception**: `rest` in the katara-letter draws its /s/ **upright** above /t/,
carried as an `s$` override. That word is why the flip isn't *fully*
derivable and why the `$`/`%` override still exists for /s/.

### Cluster forms

Two consonants are redrawn when they sit in a C-C block (`clusterForm` in
`render.js`), because the one-row overlap changes what fits:

- **/s/** is a full five-row caret whose point sits on the lattice edge;
  the overlap brings the neighbour up to that edge, so in a C-C block its
  vertex is pulled in one row to stop on the block boundary. A non-cluster
  /s/ (the final /s/ of `class`, under a vowel) keeps its full length.
- **/z/** drops its two corner dots in a C-C block — they sit in the top
  row, which the overlap rides up into the glyph above (`goods`, `trends`,
  `models`). A /z/ beside a vowel (`is`, `cheese`) keeps them.

---

## 7. The lattice and geometry

Every glyph is **drawn, not traced** — constructed from arcs, straight
segments and dots on a shared grid with one stroke weight, so the set
reads as a single coherent script. They are clean canonical
interpretations of the key chart, not facsimiles.

| height class | grid | box |
| --- | --- | --- |
| consonant, `mark_consonant` | 5 × 5 cells | 100 × 100 |
| vowel, `mark` | 5 × 4 cells | 100 × 80 (flat) |
| `mark_full` (punctuation) | 1–3 × 9 cells | 36–68 × 164 |

Constants (`tools/glyphspec.py` / `tools/build_glyphs.py`, kept in step):

- `UNIT = 16` — svg units per lattice cell.
- `SW = 9` — stroke width, every glyph, `square` caps + `miter` joins.
- `DOT = UNIT / 2 = 8` — a dot is a filled circle whose **diameter fills
  one grid cell**, the same visual weight as a stroke. `s`/`l` size
  classes exist as an escape hatch for a source that shows a smaller or
  larger mark; reach for `m` (the default) otherwise.
- **Margin** — the lattice is centred in its box with a 10-unit (consonant
  / mark) or 8-unit (flat vowel) margin, so a stroke on the outermost row
  isn't clipped. This is drawing clearance, not writing space (§4).

Glyphs are **inlined into `site/js/manifest.js`** (~72 KB for the whole
set) rather than loaded as image files: `fetch()` is CORS-blocked on
`file://`, so double-clicking `index.html` would otherwise fail; inlining
also lets the wiki render with no image hosting (the same SVGs are baked
into its CSS masks), and lets glyphs inherit text colour via `currentColor`.

### Two implementations

- `tools/glyphspec.py` — Python, **the authority**: the design format,
  frame system, curve fitting, SVG output.
- `designer/js/geom.js` — a JS **port** for the designer's live canvas.

Anything the designer hands to a human or a build script goes through the
Python. `python3 tools/check_geom.py` renders generated designs through
both and diffs them byte for byte (currently 283 cases); run it after
touching either file — they must not drift.

### Sizing lives in two stylesheets

The site and the wiki draw the same blocks two ways, so sizing is duplicated
and must match: `site/css/blocks.css` (px: 52 / 41.6, for `render.js`'s inline
SVGs) and `wiki/Avatarian-css-only.css` (`em`: 1.25em / 1em, so Avatarian
scales with surrounding wiki text). The wiki one is **generated** — the LAYOUT
block in `tools/build_css_only.py` mirrors `blocks.css`. Both encode the same
5:4 ratio, the same margin-collapse, and the same "show the flat vowel SVG"
rule; if the block geometry changes, update both.

---

## 8. The glyph inventory

A snapshot of `tools/build_glyphs.py`. **code** is the readable code you
type (§10); **stem** is the SVG file stem in `site/assets/glyphs/`. The two
often differ — don't read one off the other. Regenerate this table from the
build script rather than trusting it blind.

The inventory is **40 phonemes — 25 consonants and 15 vowels** — plus two
nulls (§3) and four punctuation marks (§9). Every drawn glyph is sourced
from reference material; nothing is invented.

### Consonants (5×5)

| IPA | code | stem | status | notes |
| --- | --- | --- | --- | --- |
| p | p | p | drawn | |
| b | b | b | drawn | |
| t | t | t | drawn | |
| d | d | d | drawn | |
| k | k | k | drawn | |
| g | g | g | drawn | |
| m | m | m | drawn | |
| n | n | n | drawn | |
| ŋ | ng | ng | drawn | |
| f | f | f | drawn | bowed X, high crossing |
| v | v | v | drawn | |
| θ | th | th | drawn | |
| ð | dh | dh | drawn | |
| s | s | s | drawn | mirrors above a cluster, not by slot — see §6 |
| z | z | z | drawn | drops its dots in a C-C block — see §6 |
| h | h | h | drawn | |
| w | w | w | drawn | approximant — mirrors in a C-C bottom slot |
| j | y | y | drawn | approximant |
| ɹ | r | r | drawn | approximant — IPA `ɹ`, the American-English rhotic; code/stem stay `r` |
| l | l | l | drawn | takes a distinct cluster form in a C-C block (§6); /ɹ/ mirrors it |
| tʃ | ch | ch | drawn | from source outside the key chart |
| dʒ | j | j_dz | drawn | from source outside the key chart |
| ʃ | sh | sh | drawn | from source outside the key chart |
| ʒ | zh | zh | drawn | the /ʒ/ in "treasure" |
| x | kh | kh | **placeholder** | no source shows it |

### Vowels (5×4)

| IPA | code | stem | drawn rows | flips by slot | notes |
| --- | --- | --- | --- | --- | --- |
| i | ee | i | 3 | | |
| ɪ | i | ih | 4 | ✓ | |
| e | ey | ei | 4 | ✓ | alias `eɪ`; the FACE vowel is written `e` then `ɪ` |
| ɛ | e | eh | 3 | | |
| æ | a | ae | 3 | ✓ | cup on top, cap on bottom |
| ʌ | u | uh | 3 | | four dots, two-by-two |
| ə | uh | schwa | 3 | ✓ | recurve descends L→R, two dots; also covers NURSE |
| u | oo | uu | 4 | | stored as its bottom-slot drawing |
| oʊ | oh | ow | 3 | | |
| ɔ | aw | aw | 3 | | stored as its bottom-slot drawing; source outside the chart |
| ɑ | ah | ah | 4 | ✓ | source outside the chart |
| aɪ | eye | ai | 3 | ✓ | cleanest attested flip pair |
| aʊ | ow | au | 4 | | |
| ʊ | uu | oo | 4 | | the vowel in "good" |
| ɔɪ | oy | oi | 4 | ✓ | flip unverified — see §13 |

Watch the code/stem mismatch: the SVG **stem** `oo` is /ʊ/ (4-row) while the
**code** `oo` is /u/, and stem `ow` is /oʊ/ (3-row) while code `ow` is /aʊ/
(4-row). Read the drawn-rows set off the IPA, never off the stems.

**There is no /ɜ/.** Avatarian writes the NURSE vowel and the schwa with a
single letter; both map to /ə/. IPA `ɜ`/`ɝ`/`ɜr` are accepted as aliases of
`ə`, with /ɹ/ emitted as a separate segment ("bird" → `ə ɹ`), so the vowel
carries no r-colouring.

**The rhotic is `/ɹ/`, not `/r/`.** The characters speak American English,
whose r is the alveolar approximant `ɹ` — strict IPA `/r/` is the alveolar
*trill* (rolled, as in Spanish or Scots), a sound the script never encodes.
So the phoneme is stored and transcribed as `ɹ`. The readable code and the
SVG stem stay the plain letter `r` (you still type `r`), the same code/stem-
vs-IPA split the vowels above use — read the phoneme off the IPA, not the code.

---

## 9. Punctuation

`. , ? !` are a **third height class — `mark_full`: nine rows tall and
one or more lattice columns wide** (a period is one column, a 36×164 box;
a mark may be wider), the height of a whole block. A mark stands beside
the writing rather than in a slot, is not paired with anything, and does
not count toward the whole-blocks rule — the sounds either side of a mark
pair among themselves.

| | width | name |
| --- | --- | --- |
| `.` | one column — a dot | period |
| `,` | one column — a short stroke | comma |
| `!` | one column — a stroke over a dot | exclamation |
| `?` | **two columns** — a curl | question |

Marks are drawn on the mark lattice (one column wide, or two for the
question mark) in the designer, and shipped through the manifest exactly
like a letter (`MARKS_FULL` in `build_glyphs.py`, keyed by the character;
each entry records its column count). `render.js` draws each from the
manifest and takes its aspect ratio from the SVG's own viewBox, so a wider
mark keeps its proportions; an inline copy is the fallback for a page that
carries no manifest. The exact shapes live in `build_glyphs.py`.

The apostrophe is still stripped; `woong's` and `heng's` are attested and
write the possessive as sounds (`ɛ s`) with no mark.

---

## 10. The sounds syntax (how you type it)

The app is one page: type English and convert, or type sounds directly
into the **sounds box**, which is what actually gets drawn and is always
editable (`g2p.js` is rule-based and gets words wrong — you fix the
sounds, not the English). Input is **ASCII-first**, typeable on a plain
QWERTY keyboard.

**The readable codes** are the primary spelling — the respelling keys
dictionaries use for laypeople. `k uh t ah r uh` is *Katara*.

| | | | | | | | |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `a` | c**a**t | `ah` | f**a**ther | `ee` | s**ee** | `ow` | m**ou**th |
| `e` | b**e**d | `oh` | g**o**at | `oo` | s**oo**n | `aw` | th**ou**ght |
| `i` | s**i**t | `uh` | comm**a** | `uu` | f**oo**t | `oy` | ch**oi**ce |
| `u` | c**u**t | `ey` | f**a**ce | `eye` | pr**i**ce | | |

`uh` also covers the vowel of *nurse* and *bird* — Avatarian writes one
letter where English dictionaries write two — so `er`, `ur`, `ir` all land
on it. Consonants are themselves, plus `ng`, `ch`, `sh`, `th` (*thin*),
`dh` (*this*), `zh` (*vision*), `j` (*jam*), `y` (*yes*), `kh` (/x/).

- **Codes are case-insensitive** — `ah`, `Ah` and `AH` all mean the same
  sound.
- **IPA is accepted too**, plus aliases: `eɪ`→`e`, `ɝ`/`ɜ`/`ɜr`→`ə`,
  `ɑː`→`ɑ`, `iː`→`i`, `uː`→`u`. The corpus is stored in IPA, so it does
  not move when the ASCII layer changes.
- **Sounds are separated by spaces, words by `/`.**
- **`0`** (or `_`, `-`) is the `∅` filler. `∅c` has no code — the height
  comes from the pairing partner (§3).
- **`$` / `%`** force a glyph's orientation: `$` is the top-slot form, `%`
  the bottom, for **every** glyph (the upside-down-stored u/ɔ included). The
  only spot the corpus still needs it is **`s$`** in *rest* and *humansitters*
  (/s/ drawn upright above a consonant, the §6 exception). Everything else is
  derived by rule (§6) — /l/ and /ɹ/ by the cluster-form rule, the rest by
  slot; otherwise `$`/`%` is just a convenience for showing both forms.
- **`_c`** asks for a glyph's cluster form on its own, with no consonant
  beside it — `l_c`, `r_c`. Only /l/ and /ɹ/ have one; on anything else the
  suffix is ignored. It combines with the orientation marker: bare `r_c` is
  bottom-oriented (as drawn), `r_c$` is top-oriented (flipped), `r_c%` is
  bottom. Mainly for showing the cluster form in a reference table, since in
  a real word it is chosen by context.
- **`*`** marks a glyph visible in a source but unreadable. It fills a
  slot, so block structure is recorded where the letter is not.
- **`(parentheses)`** caption a word instead of being read as sounds:
  `m e t uh l 0 b e n d i ng (metalbending)`. Converting from English
  emits these automatically.

The drawing updates live as you type. **Insert sounds** appends rather
than replacing the box, so a line can be assembled a piece at a time.
Anything mapping to no glyph is named in a warning rather than dropped.
The glyph reference doubles as a palette — click a cell to append its code.

---

## 11. What differs from canon

In the reference, glyphs are hand-lettered so adjacent strokes
**interlock and share edges**, and blocks are visibly skewed and organic.
This project renders each glyph as a discrete vector butted against its
neighbours, so it reproduces the *structure* correctly — the pairing, the
heights, the flips, the C-C overlap — but not the stroke-level fusion.
Getting that would mean redrawing every glyph with defined connection
points: a type-design project, not a layout tweak.

---

## 12. What is not determined

1. **/x/ has no glyph.** No source shows one; it renders as a dashed box.
2. **Whether /ɔɪ/ mirrors by slot.** The shipped set says it does, with
   nothing behind it: three sightings, all in bottom slots, none checked.
3. **Whether the FACE vowel is ever one letter.** Every printed source
   writes it `e` then `ɪ`; two hand-written letters use a bare `e`
   (*take, wake, hey, anyway*). Whether that is the script or the reading
   is open.
4. **A morpheme-boundary rule.** The syllable rule (§5) misses about ten
   attested spellings, most of which divide at a morpheme boundary; too
   few to state as a rule.
5. **One mark in the reference key is unassigned** — an unlabelled wedge
   above the vowel null; `CELLS` maps it to nothing pending a source.
6. **Positional variants of ɪ and u.** Both are numbered as pairs in the
   source but only one form each is drawn, so they render identically in
   both slots; distinguishing them needs a word placing the vowel at both
   an even and an odd index.

Anything a tool derives beyond these is inference, and should be presented
as such.
