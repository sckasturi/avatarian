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
  "aɪ", "aʊ", "ɔɪ", "ɜ",
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

function makeGlyph(token, slot) {
  const { sym, forced } = parseSymbol(token);
  const span = document.createElement("span");
  const entry = GLYPHS[sym];
  const kind = entry
    ? entry.type || (VOWELS.has(sym) ? "vowel" : "consonant")
    : VOWELS.has(sym) ? "vowel" : "consonant";
  span.className = "avatarian-glyph avatarian-" + kind;
  if (entry && entry.rows === 4) span.classList.add("avatarian-4row");
  span.title = sym;
  if (entry) {
    const form = entry;
    // An explicit $/% override wins; otherwise only flip-capable glyphs
    // follow the slot.
    const orientation = forced || (entry.flips ? slot : "top");
    if (orientation === "bottom") span.classList.add("avatarian-flipped");
    // Both drawings ride along and CSS shows one. The flat copy is the
    // same glyph re-laid-out at 4/5 height rather than a squashed copy
    // of the square one, so stroke weight and dots match exactly in
    // either height mode. Consonants have no flat form and keep theirs.
    //
    // The <svg> elements are tagged directly rather than wrapped: a
    // wrapper <span> is inline, cannot take a height, and collapses the
    // SVG inside it to nothing.
    span.innerHTML = form.svg + (form.flat || "");
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

function makeSlot(ipaSymbol, slot) {
  const cell = document.createElement("span");
  cell.className = "avatarian-slot avatarian-slot-" + slot;
  cell.appendChild(makeGlyph(ipaSymbol, slot));
  return cell;
}

/**
 * Render an IPA sequence into a container as fused blocks of two
 * phonemes, written top then bottom.
 */
function renderAvatarian(ipaSeq, container) {
  const blocks = pairUp(ipaSeq);
  container.innerHTML = "";
  container.classList.add("avatarian-word");

  blocks.forEach((pair) => {
    const block = document.createElement("span");
    block.className = "avatarian-block";
    // An empty bottom slot is written, not skipped — the null is part of
    // the spelling, so dropping it would silently shorten the word. Its
    // height comes from the partner (see nullFor), which is also why a
    // null already typed into the sounds box gets resolved here rather
    // than taken literally: `0` means "a null", and the sound beside it
    // is what says which one. That applies mid-word too, where canon
    // puts nulls the renderer can't yet derive — (u,∅) takes the tall
    // one, (s,∅) the short one.
    const top = NULLS.has(pair.top) ? nullFor(pair.bottom) : pair.top;
    const bottom = pair.bottom == null || NULLS.has(pair.bottom)
      ? nullFor(top)
      : pair.bottom;
    block.appendChild(makeSlot(top, "top"));
    block.appendChild(makeSlot(bottom, "bottom"));
    container.appendChild(block);
  });
  return container;
}

if (typeof module !== "undefined") {
  module.exports = {
    renderAvatarian, pairUp, glyphSVG, VOWELS,
    NULL_IPA, NULL_C_IPA, nullFor,
  };
}
