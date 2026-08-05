# Avatarian — session handoff

Read `README.md` for architecture and `CONTEXT.md` for the decoding rules
and open questions. Both are current. This file covers what changed in this
session and what to do next.

---

## 1. The big structural finding

**Blocks are pairs, not syllables.** Phonemes are written in strict order,
two to a block, top slot then bottom slot. Nothing depends on a sound being
a consonant or a vowel.

This replaced a syllable model (consonants clustered on top, vowel beneath)
that happened to agree on CV words like "katara" and disagreed on
everything else. It was read off a labelled writing sample — "please do not
be mad at me when you wake up, but" — and holds for all twelve of its
words. An odd phoneme count leaves the last bottom slot empty and the ∅
filler (the ∪ cup, `glot_v`) is written into it.

Everything else this session followed from that.

## 2. What else landed

* **/ɜ/ and /ə/ separated.** Mirror images, not one shared glyph: ə ascends
  with the dot above-left, ɜ descends with the dot below-left.
* **Glyphs corrected**: /d/ (no dot, smooth shoulder), /f/ (bowed X, high
  crossing — the straight saltire was wrong), /z/ (stem + bowed legs),
  /ʌ/ (four dots, not rules), /ə/ (flipped), /e/ (turned, and connected).
* **Orientation** replaced per-glyph variant pairs — see `FLIPS`.
* **/ɑ/, /ɪ/, /e/, /æ/, /l/** all confirmed as flipping by slot.
* **UI rebuilt as one page**: no tabs, ASCII (ARPAbet) input, live redraw,
  two sticky columns, dark mode, `(parenthesised)` captions, glyph
  reference doubling as the palette.
* **Credit** added — see the top of `README.md`.

## 3. Traps that cost real time

* **Caching lies.** `manifest.js` and `style.css` are cached hard over both
  `file://` and the dev server. A rebuilt glyph silently doesn't appear and
  the stale page looks exactly like a change that didn't work. Verify from
  disk, or `fetch('css/style.css',{cache:'reload'})` in the console. This
  cost two wrong conclusions.
* **Measure the thing you changed.** A layout change was verified by
  checking stroke widths and dot geometry — which passed — while every
  block had silently collapsed to zero width and stacked on top of each
  other. Check block positions after any sizing change.
* **One correction is not a rule.** /e/ was turned into a positional
  variant pair on the strength of a single word; the next word showed the
  same orientation in the opposite slot and the pair had to be deleted.
  Wait for a word showing *both* forms before splitting a glyph.
* **`preserveAspectRatio="none"` distorts everything the scale touches** —
  dots become ellipses, horizontal strokes thin. Proportional mode now
  swaps to a separately-generated 100x60 drawing and scales uniformly.
  Don't reintroduce the squash.

## 4. Open questions, in priority order

These are the live decoding problems. `CONTEXT.md` has fuller notes.

1. **Where do mid-word nulls come from?** Two confirmed spellings:

   ```
   students      S$ T UW 0 D AX N T S 0
   metalbending  M EH T AX L 0 B EH N D IH NG
   ```

   Both divide into two units, each paired independently and padded with a
   trailing null when odd. The split point is **not** morpheme boundaries
   ("metal|bending" is one, "stu|dents" is not) and **not** syllables
   (metalbending's four syllables would force nulls canon doesn't have).
   Needs more multi-null words — "academy" and "anyways" would help.

2. **appa breaks the pairing model.** Canon writes it as three blocks,
   `AA 0 P 0 AA 0`, where pairing predicts two. Not explained by phoneme
   count ("not" is also three and pairs normally) or by intervocalic
   consonants ("hurry" and "really" render correctly). The renderer does
   not special-case it.

3. **/s/ doesn't follow the slot.** "students" writes both of its /s/ in
   TOP slots with a different orientation for each; "some" has a third top
   /s/ using the other one. Spell with `S$` / `S%` until a rule appears.

4. **Seven sounds have no glyph**: tʃ, dʒ, ʃ, ʒ, x, ʊ, ɔɪ. Needs source
   material, not guessing.

5. **One unassigned mark** in the key — an unlabelled wedge above the
   vowel-block null; `CELLS` maps it to `None`.

6. **g2p accuracy.** Rule-based, so it mistranscribes ("wake" → /w æ k/,
   "metalbending" → /m ɛ t æ l …/). The sounds box is the fix — type the
   correct sounds directly rather than misspelling the English.

## 5. Working agreement

The user (TechFilmer) supplies reference images and canon spellings; the
job is to turn them into rules and code. Two things that have paid off:

* **Say when an image is too small to read** rather than guessing. A wrong
  glyph propagates everywhere.
* **Don't over-generalise from one example.** Several corrections this
  session were turned into rules too early and had to be reverted. If a
  rule rests on a single word, say so.
