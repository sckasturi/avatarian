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

/**
 * THE READABLE CODES — what the tool now teaches and displays.
 *
 * ARPAbet was picked because it is typeable on a plain keyboard, and it
 * is: it is also close to unguessable. `AH` is /ʌ/ (STRUT) while `AA` is
 * /ɑ/ (PALM), so the code that looks like "ah" is not the "ah" sound.
 * That is not a theoretical complaint — this project shipped
 * `K AH T AA R AH` as the spelling of "Katara" in three separate places,
 * written by people who knew the table. It gives /k ʌ t ɑ r ʌ/.
 *
 * These are the **respelling keys dictionaries use for laypeople**, which
 * are the one notation for English sounds that ordinary readers already
 * know how to read. The pattern worth noticing:
 *
 *   a e i u        the short vowels, as in cat bed sit cut
 *   ah oh uh       the broad ones — father, goat, comma
 *   ee oo uu       fleece, goose, foot
 *   ey eye ow aw oy   the diphthongs, spelled the way they sound
 *
 * Consonants are almost all just themselves. The only ones worth
 * learning are `dh` (this) against `th` (thin), and `zh` (vision).
 *
 * WHY CASE MATTERS HERE AND NOWHERE ELSE. Four of these mean something
 * different in ARPAbet — `ah`, `uh`, `ow`, `aw` — and they are exactly
 * the cluster ARPAbet is worst at, so dodging them would give up most of
 * the benefit. Instead: **lowercase is this scheme, UPPERCASE is
 * ARPAbet.** Every document ever written for this tool keeps working
 * unchanged, because ARPAbet has always been written in capitals. One
 * sentence to learn, and nothing to migrate.
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
  "er": "ɜ",     // nurse
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
  "ur": "ɜ", "ir": "ɜ",           // nurse
  "igh": "aɪ",                    // price
  "schwa": "ə", "ax": "ə",
  "sh'": "ʃ",
};

/** Spellings accepted for symbols that are awkward to type. */
const SOUND_ALIASES = {
  "0": "∅", "_": "∅", "-": "∅",   // the empty-slot filler
  "eɪ": "e", "ej": "e",           // key chart labels this vowel e/eɪ
  "ɝ": "ɜ", "ɜr": "ɜ",            // r-coloured spellings of the nurse vowel
  "ɑː": "ɑ", "iː": "i", "uː": "u",
};

/**
 * IPA -> the code to DISPLAY, so the UI teaches one scheme rather than
 * showing a second one it also happens to accept.
 *
 * Built from READABLE first, with ARPAbet only as the fallback for any
 * sound the readable table somehow misses — which is nothing today, and
 * is a safety net rather than a plan.
 */
const IPA_TO_CODE = (() => {
  const map = { "∅": "0" };
  Object.entries(READABLE).forEach(([code, ipa]) => {
    if (!map[ipa]) map[ipa] = code;
  });
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

/**
 * One typed token -> the manifest's symbol, override suffix preserved.
 *
 * The order is the whole compatibility story:
 *
 *   1. IPA and its aliases, which are exact and never ambiguous.
 *   2. ALL-CAPS is read as ARPAbet. This is what keeps every document
 *      ever written for this tool working: `AH` is still /ʌ/, `AW` is
 *      still /aʊ/. It is checked before the readable table precisely
 *      because four codes collide.
 *   3. The readable scheme, case-insensitively — so `ah`, `Ah` and `aH`
 *      all mean /ɑ/, and only the shouted `AH` means /ʌ/.
 *   4. ARPAbet again, case-insensitively, for the codes that DON'T
 *      collide. `iy`, `ae` and `hh` keep working in lowercase, because
 *      there is no reason for them not to.
 *
 * A single-letter ARPAbet consonant like `B` is caught at step 2 and
 * `b` at step 3; both are /b/, so the split is invisible for everything
 * except the four vowels it exists for.
 */
function normaliseSound(token) {
  const { body, suffix } = splitOverride(token);
  if (SOUND_ALIASES[body]) return SOUND_ALIASES[body] + suffix;

  const upper = body.toUpperCase();
  const lower = body.toLowerCase();

  if (body === upper && ARPABET_TO_IPA[upper]) return ARPABET_TO_IPA[upper] + suffix;
  if (body === upper && EXTRA_CODES[upper]) return EXTRA_CODES[upper] + suffix;

  if (READABLE[lower]) return READABLE[lower] + suffix;
  if (READABLE_ALIASES[lower]) return READABLE_ALIASES[lower] + suffix;

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
    EXTRA_CODES, SOUND_ALIASES, READABLE, READABLE_ALIASES, IPA_TO_CODE,
    splitOverride, normaliseSound, soundToCode,
    wordsToSoundText, soundTextToWords,
    splitCaption, spreadCaptions,
  };
}
