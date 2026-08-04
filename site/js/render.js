/**
 * Avatarian renderer.
 *
 * Turns an array of IPA symbols into fused syllable blocks.
 *
 * GLYPHS — clean, geometrically-drawn SVGs (see tools/build_glyphs.py),
 * embedded inline by js/manifest.js rather than loaded as image files.
 * Inlining means the whole set is one small script: it works over
 * file://, needs no image hosting on the wiki, stays crisp at any size,
 * and inherits the surrounding text colour via currentColor.
 *
 * LAYOUT — derived from canon reference art ("Katara, please do not be
 * mad"):
 *
 *   - each syllable is ONE block;
 *   - the vowel sits UNDERNEATH the consonant(s);
 *   - both rows render at the same size;
 *   - blocks pack tight, with word spacing separating words.
 *
 * The key chart notes "Consonants take up 3/4 height, Vowels take 1/4
 * height", but that describes bands within a hand-lettered block, not a
 * scale factor. Every glyph here is drawn on one 100x100 grid, so
 * shrinking the lower row shrinks the whole mark — vowels came out too
 * faint to read against their consonant. Sizing lives in the CSS.
 *
 * This is deliberately not a font file: canon composes syllables into
 * blocks (closer to Hangul than to an alphabet), which no font format
 * does well. The same script runs standalone and on the wiki, so
 * {{avatarian|hello}} and the web app always stay in sync.
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
 * Group a flat IPA symbol list into syllable blocks. A trailing
 * consonant cluster becomes the coda of the previous syllable rather
 * than a stray block.
 */
function syllabify(ipaSeq) {
  const syllables = [];
  let onset = [];
  for (const sym of ipaSeq) {
    if (VOWELS.has(sym)) {
      syllables.push({ onset, nucleus: sym, coda: [] });
      onset = [];
    } else {
      onset.push(sym);
    }
  }
  if (onset.length) {
    if (syllables.length) syllables[syllables.length - 1].coda = onset;
    else syllables.push({ onset, nucleus: null, coda: [] });
  }
  return syllables;
}

function makeGlyph(ipaSymbol, kind) {
  const span = document.createElement("span");
  span.className = "avatarian-glyph avatarian-" + kind;
  span.title = ipaSymbol;
  const entry = GLYPHS[ipaSymbol];
  if (entry) {
    span.innerHTML = entry.svg;
    if (entry.status === "PLACEHOLDER") span.classList.add("avatarian-placeholder");
  } else {
    span.textContent = ipaSymbol;
    span.classList.add("avatarian-missing");
  }
  return span;
}

/**
 * Render an IPA sequence into a container as fused syllable blocks:
 * consonants on top, vowel beneath.
 */
function renderAvatarian(ipaSeq, container) {
  const syllables = syllabify(ipaSeq);
  container.innerHTML = "";
  container.classList.add("avatarian-word");

  syllables.forEach((syl) => {
    const block = document.createElement("span");
    block.className = "avatarian-syllable";

    const onsetRow = document.createElement("span");
    onsetRow.className = "avatarian-onset";
    [...syl.onset, ...(syl.coda || [])].forEach((c) => {
      onsetRow.appendChild(makeGlyph(c, "consonant"));
    });
    block.appendChild(onsetRow);

    const nucleusRow = document.createElement("span");
    nucleusRow.className = "avatarian-nucleus";
    if (syl.nucleus) nucleusRow.appendChild(makeGlyph(syl.nucleus, "vowel"));
    block.appendChild(nucleusRow);

    container.appendChild(block);
  });
  return container;
}

if (typeof module !== "undefined") {
  module.exports = { renderAvatarian, syllabify, glyphSVG, VOWELS };
}
