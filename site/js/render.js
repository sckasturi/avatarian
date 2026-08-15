/**
 * Avatarian renderer.
 *
 * Turns an array of IPA symbols into fused blocks.
 *
 * GLYPHS — clean, geometrically-drawn SVGs (see tools/build_glyphs.py),
 * embedded inline by js/manifest.js rather than loaded as image files.
 * Inlining means the whole set is one small script: it works over
 * file://, needs no image hosting on the wiki, stays crisp at any size,
 * and inherits the surrounding text colour via currentColor.
 *
 * LAYOUT — blocks are PAIRS, not syllables.
 *
 * Phonemes are written in strict order, TWO to a block, top slot then
 * bottom slot, with blocks running left to right. Nothing about the
 * layout depends on a phoneme being a consonant or a vowel; a block is
 * just the next two sounds in the word.
 *
 *   please  /p l i z/    (p,l) (i,z)
 *   at      /æ t/        (æ,t)          <- vowel on TOP
 *   up      /ʌ p/        (ʌ,p)          <- vowel on TOP
 *   me      /m i/        (m,i)
 *   not     /n ɑ t/      (n,ɑ) (t,∅)
 *   mad     /m æ d/      (m,æ) (d,∅)
 *   wake    /w eɪ k/     (w,eɪ) (k,∅)
 *
 * This was read off a labelled writing sample ("please do not be mad at
 * me when you wake up, but") and holds for all twelve of its words. It
 * replaces an earlier syllable model — consonants clustered on top, the
 * vowel beneath — which happened to agree on CV words like "katara" and
 * disagreed on everything else.
 *
 * An odd phoneme count leaves the final bottom slot empty, and a null
 * filler is written there. Five of the sample's words need it. There are
 * two nulls and the pairing partner picks which — see NULL_IPA below.
 *
 * Some glyphs change form with the slot they land in — see VARIANTS in
 * tools/build_glyphs.py. Consonants are 5×5 grid, vowels 4×5 grid.
 * 4-row vowels fill all 4 rows and bridge to the consonant above;
 * 3-row vowels leave the top row empty (gap). Sizing lives in the CSS.
 *
 * This is deliberately not a font file: canon composes blocks (closer to
 * Hangul than to an alphabet), which no font format does well. The same
 * script runs standalone and on the wiki, so {{avatarian|hello}} and the
 * web app always stay in sync.
 */

const GLYPHS = (typeof window !== "undefined" && window.AVATARIAN_GLYPHS) || {};

const VOWELS = new Set([
  "i", "ɪ", "e", "ɛ", "æ", "ʌ", "ə", "u", "ʊ", "oʊ", "ɔ", "ɑ",
  "aɪ", "aʊ", "ɔɪ",
]);

/** Kept async for API compatibility; glyphs are already in memory. */
async function loadManifest() {
  return GLYPHS;
}

function glyphSVG(ipaSymbol) {
  const entry = GLYPHS[ipaSymbol];
  return entry ? entry.svg : null;
}

/**
 * The two null fillers. NEITHER IS A SOUND — they fill a slot that has
 * no phoneme in it, and they are part of the spelling rather than
 * padding.
 *
 *   ∅   a rounded ∪, vowel-height    (3 rows)
 *   ∅c  a squared ∪, consonant-height (5 rows)
 *
 * Which one is written is decided by the null's PAIRING PARTNER, not by
 * the slot it happens to fill:
 *
 *   a VOWEL     paired with a null takes the 5-height (tall) null
 *   a CONSONANT paired with a null takes the 3-height (short) null
 *
 * Confirmed from a reference sample. It is also what keeps a block nine
 * rows tall whatever is in it — 4 + 5 for a vowel and its null, 5 + 4
 * for a consonant and its null. The renderer used to write the cup into
 * every empty slot regardless, which left a vowel-plus-null block eight
 * rows tall and the wrong shape.
 */
const NULL_IPA = "∅";
const NULL_C_IPA = "∅c";
const NULLS = new Set([NULL_IPA, NULL_C_IPA]);

function isVowelSymbol(token) {
  if (token == null) return false;
  // A $/% orientation override rides on the token, so strip it before
  // asking what the sound is — "ɑ$" is still a vowel.
  const sym = parseSymbol(token).sym;
  const entry = GLYPHS[sym];
  if (entry && entry.type) return entry.type === "vowel";
  return VOWELS.has(sym);
}

/**
 * The null to write beside `partner`. A null next to a null (or next to
 * nothing) has no vowel to take its height from, so it stays short.
 */
function nullFor(partner) {
  return isVowelSymbol(partner) ? NULL_C_IPA : NULL_IPA;
}

/**
 * ORIENTATION. SOME glyphs mirror top-to-bottom with the slot they land
 * in — æ's cup becomes a cap, /ɑ/'s Y inverts — and those carry a
 * `flips` flag from the manifest (see FLIPS in tools/build_glyphs.py).
 * Most glyphs do not, and are drawn the same way in either slot, so this
 * is NOT applied to everything.
 *
 * A trailing marker overrides the slot:
 *
 *   s$   force the TOP orientation      s%   force the BOTTOM one
 *
 * Needed where the slot doesn't decide it. /s/ is the live case:
 * "students" writes both of its /s/ in top slots yet uses a different
 * orientation for each.
 */
const VARIANT_MARKERS = { "$": "top", "%": "bottom" };

function parseSymbol(token) {
  const marker = VARIANT_MARKERS[token.slice(-1)];
  return marker
    ? { sym: token.slice(0, -1), forced: marker }
    : { sym: token, forced: null };
}

/**
 * Group a flat IPA symbol list into blocks of two, in order. An odd
 * count leaves the last bottom slot empty, marked here as null so the
 * caller can write the ∅ filler into it.
 */
function pairUp(ipaSeq) {
  const blocks = [];
  for (let i = 0; i < ipaSeq.length; i += 2) {
    blocks.push({ top: ipaSeq[i], bottom: ipaSeq[i + 1] ?? null });
  }
  return blocks;
}

/**
 * Pair a sequence AND decide its nulls — the block model, with no DOM in
 * sight.
 *
 * This used to be three lines inside the render loop, which meant the
 * structural rules of the script could only be checked by rendering to
 * elements and reading them back. Splitting it out is what lets
 * `tests/blocks.test.js` assert the model directly, including against
 * every attested spelling in the corpus.
 *
 * An empty bottom slot is written, not skipped — the null is part of the
 * spelling, so dropping it would silently shorten the word. A null that
 * was TYPED is resolved here too rather than taken literally: `0` means
 * "a null", and the sound beside it says which one. That applies
 * mid-word, where canon puts nulls the renderer cannot derive — (u,∅)
 * takes the tall one, (s,∅) the short one.
 */
function resolveBlocks(ipaSeq) {
  return pairUp(ipaSeq).map((pair) => {
    const top = NULLS.has(pair.top) ? nullFor(pair.bottom) : pair.top;
    const bottom = pair.bottom == null || NULLS.has(pair.bottom)
      ? nullFor(top)
      : pair.bottom;
    return { top, bottom };
  });
}

/** Height classes, in lattice rows. A block is meant to total nine. */
const TALL_TYPES = new Set(["consonant", "null_consonant"]);

/**
 * How many of a block's nine rows this symbol occupies: 5 for a
 * consonant-height slot, 4 for a vowel-height one.
 *
 * NOT the number of rows the drawing fills — a 3-row vowel leaves one of
 * its four empty, and that gap is the point (see the V-C and C-V rules).
 * This is the slot, which is what has to add up.
 */
function slotRows(token) {
  if (token == null) return 0;
  const sym = parseSymbol(token).sym;
  const entry = GLYPHS[sym];
  if (entry && entry.type) return TALL_TYPES.has(entry.type) ? 5 : 4;
  return VOWELS.has(sym) ? 4 : 5;
}

/**
 * A glyph that is in the source but could not be made out.
 *
 * Distinct from a sound with no glyph drawn yet (`avatarian-missing`,
 * which is item 18's /x/): that one is a gap in THIS TOOL, and it will be
 * filled by drawing the glyph. This one is a gap in the READING, and no
 * amount of work here closes it — only a better look at the source.
 */
const UNREADABLE = "*";

/**
 * The mark for a slot that could not be read.
 *
 * Drawn here rather than added to the glyph manifest, on purpose: the
 * manifest is letters of the script, and this is not one. Both validators
 * exempt `?` precisely because it has no glyph, so giving it one would
 * make them contradict themselves.
 *
 * It borrows the script's geometry — 100x100 box, square caps, miter
 * joins — so it sits in a word without looking pasted in, but the dashed
 * frame belongs to no letter in the alphabet and is meant to read as "a
 * glyph is here and nobody knows which" at a glance.
 */
const UNREADABLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"'
  + ' stroke="currentColor" stroke-linecap="square" stroke-linejoin="miter">'
  + '<rect x="7" y="7" width="86" height="86" stroke-width="4"'
  + ' stroke-dasharray="11 9" opacity="0.75"/>'
  // A six-pointed asterisk, matching the `*` you type. It was a question
  // mark until `?` became the punctuation and `*` took this job over —
  // a box holding the wrong character is worse than no character.
  + '<path d="M 50 30 L 50 70" stroke-width="9"/>'
  + '<path d="M 32.7 40 L 67.3 60" stroke-width="9"/>'
  + '<path d="M 32.7 60 L 67.3 40" stroke-width="9"/>'
  + '</svg>';

/**
 * THE APPROXIMANTS TURN INSIDE A CLUSTER. Read off the corpus: across
 * seventeen consonants seen in a bottom slot, the only ones that ever
 * mirror are /r l w j/ — exactly the English approximants — and they do
 * it when the block holds two consonants, 28 times against 1.
 *
 * Under a VOWEL they stay upright: /r/ is plain in all six such blocks
 * (are, ear, fire, choir, organic, warrior). So this is not the by-slot
 * flip that æ ɑ ɪ e aɪ ə take; it depends on what shares the block.
 *
 * `l` is deliberately absent — it is in FLIPS already and flips by slot,
 * where the evidence is mixed (2 flipped against 3 plain under a vowel).
 * Changing it would trade three known exceptions for two, so it waits.
 */
const TURNS_IN_CLUSTER = new Set(["r", "j", "w"]);

/**
 * /s/ TURNS ON TOP OF A CLUSTER. Mirrored in 11 of the 12 blocks where
 * it sits above another consonant, and in none of the 20 where it does
 * not. This is why the $/% override exists at all — no by-slot rule can
 * produce it, since /s/ takes both orientations in the same slot.
 */
const TURNS_ABOVE_CLUSTER = new Set(["s"]);

/**
 * Glyphs whose saved drawing is the BOTTOM-slot form rather than the top.
 * They flip like any other, but the art is stored the other way up, so
 * the slot test is inverted. Read off the corpus: /u/ is plain in all 18
 * bottom slots and mirrored in 7 of its 9 top ones, /ɔ/ plain in 12
 * bottoms and mirrored in all 3 tops.
 */
const DRAWN_BOTTOM_UP = new Set(["u", "ɔ"]);

/** True when the block partner is another consonant — i.e. a C-C block. */
function isClusterPartner(partner) {
  return partner != null && !isVowelSymbol(partner)
         && !NULLS.has(parseSymbol(partner).sym);
}

/** Which way round this glyph goes, before any explicit $/% override. */
function orientationOf(sym, entry, slot, partner) {
  if (DRAWN_BOTTOM_UP.has(sym)) return slot === "bottom" ? "top" : "bottom";
  if (entry.flips) return slot;
  const clustered = isClusterPartner(partner);
  if (clustered && slot === "bottom" && TURNS_IN_CLUSTER.has(sym)) return "bottom";
  if (clustered && slot === "top" && TURNS_ABOVE_CLUSTER.has(sym)) return "bottom";
  return "top";
}

/**
 * /s/ IN A CLUSTER PULLS ITS VERTEX IN ONE ROW.
 *
 * /s/ is a full five-row caret whose sharp point sits on the lattice
 * edge. In a C-C block the one-row overlap (blocks.css) brings the
 * neighbour up to that edge, so the point is the one scrap of ink in the
 * shared row and it reads as poking through the glyph beside it — the
 * flat-topped consonants fuse there instead. Insetting the apex by one
 * lattice row (y 18 → 31) lands the point on the block boundary rather
 * than across it.
 *
 * Done to the stored top-slot caret, so the flip carries the inset to
 * whichever side faces the overlap: point-down on top of a cluster
 * (`still`), point-up on the bottom of one (`balance`, `sula's`). A
 * non-cluster /s/ — the final /s/ in `class`, sitting under a vowel — is
 * left full length. See AVATARIAN.md §12.6.
 */
function clusterS(svg) {
  return svg.replace("L 50 18 L", "L 50 31 L");
}

function makeGlyph(token, slot, partner) {
  const { sym, forced } = parseSymbol(token);
  const span = document.createElement("span");

  if (sym === UNREADABLE) {
    // Consonant-height, because it is the taller slot and an unread glyph
    // could be either — a block that is too tall reads as a gap, one that
    // is too short reads as a vowel it may not be.
    span.className = "avatarian-glyph avatarian-consonant avatarian-unreadable";
    span.title = "A glyph is here in the source but could not be made out";
    span.innerHTML = UNREADABLE_SVG;
    span.querySelector("svg").classList.add("g-square");
    span.dataset.glyph = "unreadable";
    return span;
  }

  const entry = GLYPHS[sym];
  const kind = entry
    ? entry.type || (VOWELS.has(sym) ? "vowel" : "consonant")
    : VOWELS.has(sym) ? "vowel" : "consonant";
  span.className = "avatarian-glyph avatarian-" + kind;
  if (entry && entry.rows === 4) span.classList.add("avatarian-4row");
  span.title = sym;
  if (entry) {
    const form = entry;
    // An explicit $/% override wins; otherwise the glyph's own rule does.
    const orientation = forced || orientationOf(sym, entry, slot, partner);
    if (orientation === "bottom") span.classList.add("avatarian-flipped");
    // /s/'s point overshoots the neighbour in a C-C block; shorten it there.
    const svg = sym === "s" && isClusterPartner(partner)
      ? clusterS(form.svg) : form.svg;
    // Both drawings ride along and CSS shows one. The flat copy is the
    // same glyph re-laid-out at 4/5 height rather than a squashed copy
    // of the square one, so stroke weight and dots match exactly in
    // either height mode. Consonants have no flat form and keep theirs.
    //
    // The <svg> elements are tagged directly rather than wrapped: a
    // wrapper <span> is inline, cannot take a height, and collapses the
    // SVG inside it to nothing.
    span.innerHTML = svg + (form.flat || "");
    const drawings = span.querySelectorAll("svg");
    drawings[0].classList.add("g-square");
    if (drawings[1]) drawings[1].classList.add("g-flat");
    // Which form actually got written, so the rendered DOM says what it
    // chose — reading it back off the SVG is unreliable once the browser
    // has reserialised it.
    span.dataset.glyph = form.name + (orientation === "bottom" ? "%" : "");
    if (entry.status === "PLACEHOLDER") span.classList.add("avatarian-placeholder");
  } else {
    span.textContent = sym;
    span.classList.add("avatarian-missing");
  }
  return span;
}

function makeSlot(ipaSymbol, slot, partner) {
  const cell = document.createElement("span");
  cell.className = "avatarian-slot avatarian-slot-" + slot;
  cell.appendChild(makeGlyph(ipaSymbol, slot, partner));
  return cell;
}

/**
 * Render an IPA sequence into a container as fused blocks of two
 * phonemes, written top then bottom.
 */
function renderAvatarian(ipaSeq, container) {
  container.innerHTML = "";
  container.classList.add("avatarian-word");

  // PUNCTUATION IS NOT PAIRED. A mark is one column wide and nine rows
  // tall — the height of a whole block, not of a slot — so it stands
  // beside the writing rather than inside it. It also breaks the run:
  // the blocks either side of it pair among themselves, or a comma in
  // the middle of a word would drag the sounds after it into the wrong
  // slots.
  let run = [];
  const flush = () => {
    resolveBlocks(run).forEach(({ top, bottom }) => {
      const block = document.createElement("span");
      block.className = "avatarian-block";
      // Each slot is told what shares its block: the approximants and /s/
      // turn according to the company they keep, not the slot alone.
      block.appendChild(makeSlot(top, "top", bottom));
      block.appendChild(makeSlot(bottom, "bottom", top));
      container.appendChild(block);
    });
    run = [];
  };

  for (const token of ipaSeq) {
    if (PUNCTUATION[parseSymbol(token).sym]) {
      flush();
      container.appendChild(makeMark(parseSymbol(token).sym));
    } else {
      run.push(token);
    }
  }
  flush();
  return container;
}

/**
 * The punctuation marks: one lattice column wide, nine rows tall.
 *
 * A NEW HEIGHT CLASS. Every letter is five rows (consonant) or four
 * (vowel), and they stack to nine. A mark is the whole nine on its own,
 * which is why it cannot live in a slot.
 *
 * They are written as themselves — `,` `.` `?` `!`. The unreadable-glyph
 * marker moved to `*` to free `?` up for the one people already know.
 *
 * Drawn in the script's geometry: a 16-unit column with the same 10 units
 * of margin the letters get, 9 rows of 16 running from y=10 to y=154.
 * Row centres are therefore 2 + 16n.
 */
const MARK_BOX = 'viewBox="0 0 36 164" fill="none" stroke="currentColor"'
  + ' stroke-width="9" stroke-linecap="square" stroke-linejoin="miter"';

const PUNCTUATION = {
  // A dot on the baseline — the bottom row, beside the word's last block.
  ".": { name: "period",
         d: '<path d="M 18 146 L 18 146.5"/>' },
  // A stroke through the bottom two rows: the same weight as the period,
  // given length rather than a tail, which one column has no room for.
  ",": { name: "comma",
         d: '<path d="M 18 122 L 18 146"/>' },
  // A full stroke over a dot, the shape everyone already reads as this.
  "!": { name: "exclamation",
         d: '<path d="M 18 18 L 18 98"/><path d="M 18 146 L 18 146.5"/>' },
  // The same, broken: a question is an interrupted statement. The gap is
  // one row, which is the smallest the lattice can say anything with.
  "?": { name: "question",
         d: '<path d="M 18 18 L 18 50"/><path d="M 18 82 L 18 98"/>'
            + '<path d="M 18 146 L 18 146.5"/>' },
};

function makeMark(sym) {
  const mark = PUNCTUATION[sym];
  const span = document.createElement("span");
  span.className = "avatarian-mark avatarian-mark-" + mark.name;
  span.title = mark.name;
  span.dataset.glyph = mark.name;
  span.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" ${MARK_BOX}>`
    + mark.d + "</svg>";
  return span;
}

if (typeof module !== "undefined") {
  module.exports = {
    renderAvatarian, pairUp, resolveBlocks, slotRows, glyphSVG, VOWELS,
    NULL_IPA, NULL_C_IPA, NULLS, nullFor, isVowelSymbol, parseSymbol,
  };
}
