/**
 * The sounds syntax — the ASCII spelling you type, in and out.
 *
 * Split out of index.html because the glyph designer's live preview
 * parses the same thing: you type a test word in the designer exactly
 * as you would in the app, and get the same sequence of symbols. One
 * parser, so the two can't drift on what "AX" or "S$" means.
 *
 * The input is ASCII-first so the whole script is typeable on a plain
 * QWERTY keyboard. ARPAbet is the primary spelling (it is already the
 * table g2p.js converts through), IPA is accepted as-is for anyone who
 * prefers it, and a few stand-ins cover symbols that have no key at all.
 *
 * Loads after js/g2p.js — ARPABET_TO_IPA comes from there.
 */

/**
 * Codes for sounds g2p's ARPAbet table has no entry for, so every glyph
 * has something typeable. AX is standard ARPAbet for schwa; the table in
 * g2p.js only carries AH (which is ʌ), so ə would otherwise fall back to
 * showing a character you cannot type.
 */
const EXTRA_CODES = { "AX": "ə", "NUL": "∅" };

/** Spellings accepted for symbols that are awkward to type. */
const SOUND_ALIASES = {
  "0": "∅", "_": "∅", "-": "∅",   // the empty-slot filler
  "eɪ": "e", "ej": "e",           // key chart labels this vowel e/eɪ
  "ɝ": "ɜ", "ɜr": "ɜ",            // r-coloured spellings of the nurse vowel
  "ɑː": "ɑ", "iː": "i", "uː": "u",
};

/** IPA -> the ARPAbet code to display, so the UI teaches the syntax. */
const IPA_TO_CODE = (() => {
  const map = { "∅": "0" };
  Object.entries(ARPABET_TO_IPA).forEach(([code, ipa]) => {
    if (!map[ipa]) map[ipa] = code;
  });
  Object.entries(EXTRA_CODES).forEach(([code, ipa]) => {
    if (!map[ipa]) map[ipa] = code;
  });
  return map;
})();

/** Split a token into its sound and any $/% variant override. */
function splitOverride(token) {
  const last = token.slice(-1);
  return (last === "$" || last === "%")
    ? { body: token.slice(0, -1), suffix: last }
    : { body: token, suffix: "" };
}

/** One typed token -> the manifest's symbol, override suffix preserved. */
function normaliseSound(token) {
  const { body, suffix } = splitOverride(token);
  if (SOUND_ALIASES[body]) return SOUND_ALIASES[body] + suffix;
  const upper = body.toUpperCase();
  if (ARPABET_TO_IPA[upper]) return ARPABET_TO_IPA[upper] + suffix;
  if (EXTRA_CODES[upper]) return EXTRA_CODES[upper] + suffix;
  return body + suffix;
}

/**
 * Serialise words back into the ASCII syntax shown in the box, carrying
 * each word's English along in parentheses so the caption survives any
 * later hand-editing.
 */
function wordsToSoundText(words) {
  return words
    .map((w) => {
      const codes = w.ipa.map(sym => IPA_TO_CODE[sym] || sym).join(" ");
      return w.word ? codes + " (" + w.word + ")" : codes;
    })
    .join("  /  ");
}

/**
 * Parse the sounds box into words. Tolerant on purpose — this is a
 * correction surface, so stray slashes and runs of spaces shouldn't cost
 * you the render.
 */
function soundTextToWords(text) {
  return text.split("/")
    .map((chunk) => {
      // (anything in parentheses) is a caption for this word, not a
      // sound. Pulled out before tokenising so a multi-word label like
      // (mount baihu) survives intact.
      let word = "";
      const body = chunk.replace(/\(([^)]*)\)/g, (_, inner) => {
        word = inner.trim();
        return " ";
      });
      const ipa = body.trim().split(/\s+/).filter(Boolean).map(normaliseSound);
      return { word, ipa };
    })
    .filter(w => w.ipa.length);
}

if (typeof module !== "undefined") {
  module.exports = {
    EXTRA_CODES, SOUND_ALIASES, IPA_TO_CODE,
    splitOverride, normaliseSound, wordsToSoundText, soundTextToWords,
  };
}
