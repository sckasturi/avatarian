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

/** One symbol -> the code to display, override suffix carried through. */
function soundToCode(token) {
  const { body, suffix } = splitOverride(token);
  return (IPA_TO_CODE[body] || body) + suffix;
}

/**
 * Serialise words back into the ASCII syntax shown in the box, carrying
 * each word's English along in parentheses so the caption survives any
 * later hand-editing.
 *
 * The override suffix is split off before the code lookup — `s%` is not
 * a key in IPA_TO_CODE, so looking the whole token up wrote raw IPA into
 * a box that otherwise speaks ARPAbet. Nothing produced an override
 * upstream until the corpus did ("students" spells both its /s/ by
 * hand), which is why this only showed up now.
 */
function wordsToSoundText(words) {
  return words
    .map((w) => {
      const codes = w.ipa.map(soundToCode).join(" ");
      return w.word ? codes + " (" + w.word + ")" : codes;
    })
    .join("  /  ");
}

/**
 * Split one word's chunk into its sounds and its caption.
 *
 * (anything in parentheses) is a caption for the word, not a sound.
 * This is a depth-counting scan rather than a regex because the regex
 * version broke in three ways that all ended the same place — a bracket
 * character reaching the tokeniser and being rendered as an unknown
 * sound:
 *
 *   "T (unclosed"        the whole tail became sound tokens
 *   "T (outer (inner))"  the label stopped at the inner bracket and the
 *                        leftover ")" became a token
 *   "T )stray("          both brackets became tokens
 *
 * and a fourth that was merely silent: "T (one) (two)" kept only the
 * last label.
 *
 * The rules, in order of how likely you are to hit them:
 *
 *   - text inside brackets is caption, text outside is sounds;
 *   - several captions in one word are joined, not overwritten;
 *   - nesting is kept verbatim inside the caption, so "(mount (old)
 *     baihu)" captions the lot;
 *   - an unclosed "(" captions everything after it, which is what
 *     someone mid-type means;
 *   - a ")" with nothing open is dropped;
 *   - a bracket NEVER reaches the tokeniser.
 */
function splitCaption(chunk) {
  let depth = 0, body = "", label = "";
  for (const ch of chunk) {
    if (ch === "(") {
      depth += 1;
      if (depth === 1) continue;          // the opener itself isn't caption text
    } else if (ch === ")") {
      if (depth === 0) continue;          // unopened — drop it
      depth -= 1;
      if (depth === 0) { label += " "; continue; }
    }
    if (depth > 0) label += ch;
    else body += ch;
  }
  return { body, label: label.trim().replace(/\s+/g, " ") };
}

/**
 * Parse the sounds box into words. Tolerant on purpose — this is a
 * correction surface, so stray slashes, half-typed brackets and runs of
 * spaces shouldn't cost you the render.
 */
function soundTextToWords(text) {
  const words = text.split("/")
    .map((chunk) => {
      const { body, label } = splitCaption(chunk);
      const ipa = body.trim().split(/\s+/).filter(Boolean).map(normaliseSound);
      return { word: label, ipa };
    })
    .filter(w => w.ipa.length);
  return spreadCaptions(words);
}

/**
 * A caption written once at the end of several words belongs to all of
 * them, not to the last one.
 *
 *   HH AE M ER R / AH V / TH AO R (hammer of thor)
 *
 * captions only `TH AO R` if you read it naively, which is plainly not
 * what was meant. So the caption's words are handed out **backwards**
 * from the group it sits on, one apiece: thor, then of, then hammer.
 *
 * Nothing has to line up. If there are more caption words than groups to
 * put them on, the leftovers pile onto the earliest group reached —
 * which is what keeps a genuine multi-word name whole without a special
 * case: `M AW N T B AY HH UW (mount baihu)` is one group, "baihu" lands
 * on it, "mount" has nowhere to go and joins it, and the label comes out
 * "mount baihu" again.
 *
 * The one thing it won't do is overwrite a group that carries its own
 * caption; it stops there and drops the remainder on the group it
 * reached. Otherwise `K AH T (katara) / P L IY Z (say please)` would
 * quietly relabel katara.
 */
function spreadCaptions(words) {
  for (let i = 0; i < words.length; i++) {
    const parts = (words[i].word || "").split(/\s+/).filter(Boolean);
    if (parts.length < 2) continue;

    const placed = [];
    let group = i, part = parts.length - 1;
    while (part >= 0 && group >= 0) {
      if (group !== i && words[group].word) break;   // don't clobber
      placed.push([group, parts[part]]);
      group -= 1;
      part -= 1;
    }

    placed.forEach(([at, word]) => { words[at].word = word; });

    // Whatever didn't fit joins the earliest group we got to.
    const leftover = parts.slice(0, part + 1);
    if (leftover.length) {
      const earliest = placed[placed.length - 1][0];
      words[earliest].word = leftover.concat(words[earliest].word).join(" ");
    }
  }
  return words;
}

if (typeof module !== "undefined") {
  module.exports = {
    EXTRA_CODES, SOUND_ALIASES, IPA_TO_CODE,
    splitOverride, normaliseSound, soundToCode,
    wordsToSoundText, soundTextToWords,
    splitCaption, spreadCaptions,
  };
}
