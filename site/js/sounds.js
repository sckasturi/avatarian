/**
 * The sounds syntax — the readable ASCII spelling you type, in and out.
 *
 * Split out of index.html because the glyph designer's live preview parses
 * the same thing, so the two can't drift on what "uh" or "S$" means. The
 * codes are ASCII-first (typeable on a plain keyboard) and
 * case-insensitive; IPA is accepted as-is. Standalone — no dependency on
 * g2p.js.
 */

/**
 * THE READABLE CODES — the respelling keys dictionaries use for laypeople,
 * the one notation for English sounds ordinary readers already read:
 *
 *   a e i u        the short vowels, as in cat bed sit cut
 *   ah oh uh       the broad ones — father, goat, comma
 *   ee oo uu       fleece, goose, foot
 *   ey eye ow aw oy   the diphthongs, spelled the way they sound
 *
 * Consonants are almost all just themselves; the only ones worth learning
 * are `dh` (this) against `th` (thin), and `zh` (vision).
 */
const READABLE = {
  // --- vowels, in the order the key chart lists them -----------------
  "a": "æ",      // trap
  "e": "ɛ",      // dress
  "i": "ɪ",      // kit
  "u": "ʌ",      // strut
  "ah": "ɑ",     // father, lot
  "uh": "ə",     // comma, the second vowel of Katara
  "ee": "i",     // fleece
  "ey": "e",     // face
  "eye": "aɪ",   // price
  "oh": "oʊ",    // goat
  "oo": "u",     // goose
  "uu": "ʊ",     // foot
  "ow": "aʊ",    // mouth
  "aw": "ɔ",     // thought
  "oy": "ɔɪ",    // choice
  // --- consonants ---------------------------------------------------
  "p": "p", "b": "b", "t": "t", "d": "d", "k": "k", "g": "g",
  "m": "m", "n": "n", "ng": "ŋ",
  "ch": "tʃ", "j": "dʒ",
  "f": "f", "v": "v", "th": "θ", "dh": "ð",
  "s": "s", "z": "z", "sh": "ʃ", "zh": "ʒ",
  "h": "h", "w": "w", "y": "j", "r": "r", "l": "l", "kh": "x",
  // Not a sound; kept alongside so `0` has a spelled-out twin.
  "nul": "∅",
};

/**
 * Spellings accepted but not taught. Mostly the other obvious guess for
 * a sound: somebody who writes `ay` for FACE or `au` for THOUGHT has
 * understood the scheme and picked the other common convention, and
 * should not be told they are wrong.
 */
const READABLE_ALIASES = {
  "o": "ɑ",                       // lot, for anyone reading a/e/i/o/u as a set
  "ay": "e", "ai": "e",           // face — the other respelling convention
  "au": "ɔ", "or": "ɔ",           // thought
  // These all used to name a separate vowel /ɜ/, which turned out to be
  // ə written in a top slot. Still accepted, still the same sound.
  "er": "ə", "ur": "ə", "ir": "ə",
  "igh": "aɪ",                    // price
  "schwa": "ə", "ax": "ə",
  "sh'": "ʃ",
};

/** Spellings accepted for symbols that are awkward to type. */
const SOUND_ALIASES = {
  "0": "∅", "_": "∅", "-": "∅",   // the empty-slot filler
  "0c": "∅c",                     // the consonant-height null, for glyph=0c
  "eɪ": "e", "ej": "e",           // key chart labels this vowel e/eɪ
  "ɝ": "ə", "ɜr": "ə", "ɜ": "ə",  // r-coloured spellings, and ɜ itself
  "ɑː": "ɑ", "iː": "i", "uː": "u",
};

/** IPA -> the readable code to DISPLAY. `∅` shows as its `0` filler. */
const IPA_TO_CODE = (() => {
  const map = { "∅": "0" };
  Object.entries(READABLE).forEach(([code, ipa]) => {
    if (!map[ipa]) map[ipa] = code;
  });
  return map;
})();

/**
 * Split a token into its base sound and any trailing markers: a `$`/`%`
 * orientation override and/or a `_c` cluster-form request. Both are carried
 * through the code<->IPA lookups untouched (`r_c$` is not a key in READABLE)
 * and may combine — `r_c$` is r's cluster form, top-oriented. The suffix
 * keeps them in `_c` + `$`/`%` order so the token round-trips exactly.
 */
function splitOverride(token) {
  let rest = token;
  let override = "";
  const last = rest.slice(-1);
  if (last === "$" || last === "%") { override = last; rest = rest.slice(0, -1); }
  let cluster = "";
  if (rest.endsWith("_c")) { cluster = "_c"; rest = rest.slice(0, -2); }
  return { body: rest, suffix: cluster + override };
}

/**
 * One typed token -> the manifest's symbol, override suffix preserved.
 * IPA (and its aliases) first, then the readable codes case-insensitively,
 * then the token as-is.
 */
function normaliseSound(token) {
  const { body, suffix } = splitOverride(token);
  if (SOUND_ALIASES[body]) return SOUND_ALIASES[body] + suffix;
  const lower = body.toLowerCase();
  if (READABLE[lower]) return READABLE[lower] + suffix;
  if (READABLE_ALIASES[lower]) return READABLE_ALIASES[lower] + suffix;
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
 * a box that otherwise speaks the readable codes. Nothing produced an override
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
    SOUND_ALIASES, READABLE, READABLE_ALIASES, IPA_TO_CODE,
    splitOverride, normaliseSound, soundToCode,
    wordsToSoundText, soundTextToWords,
    splitCaption, spreadCaptions,
  };
}
