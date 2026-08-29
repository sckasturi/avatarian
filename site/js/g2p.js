/**
 * Avatarian G2P — compact English → IPA approximator.
 *
 * This is NOT a full CMU-dictionary-grade G2P. It is a small,
 * dependency-free, rule-based letter-to-sound converter so the whole
 * toolchain runs in the browser with no server and no build step
 * (required for GitHub Pages / Cloudflare Pages hosting).
 *
 * IMPLEMENTATION NOTE — why a scanner, not chained .replace() calls:
 * an earlier version applied the rule table as a sequence of
 * whole-string regex replacements. That corrupts its own output: once
 * a rule emits "oʊ", a later generic rule (o → ɑ) rewrites the "o"
 * *inside the phoneme just produced*, so "hello" came out /h ɛ l ɑ ʊ/.
 * This version scans the word left to right, consuming the longest
 * matching grapheme at each position and emitting phonemes into a
 * separate output array that rules can never touch.
 *
 * Coverage strategy, best evidence first:
 *   1. CORPUS      — words somebody has SEEN written (js/corpus.js).
 *   2. CONVENTIONS — unsourced spellings somebody DECIDED on, finished
 *                    blocks like the corpus but with no source (corpus.js).
 *   3. EXCEPTIONS  — hand dictionary for common irregular words.
 *   4. lexicon     — the bundled CMU dictionary, ~126k words.
 *   5. RULES       — ordered, longest-first grapheme → phoneme rules.
 *   6. FALLBACK    — unmatched characters are skipped, never fatal.
 *
 * Both of the first two ARE the finished block structure; the rest below
 * them produce sounds and let pairUp() choose the blocks.
 *
 * The corpus differs from the rest IN KIND, not just in priority. The
 * others answer "what does this word sound like" and let pairUp() decide
 * the blocks; a corpus entry is the finished block structure, nulls and
 * all. That is why `appa` can live there and nowhere else. See CORPUS.md.
 */

// A CONFIRMED WORD LEAVES THIS TABLE. It does not get corrected here —
// it lives in corpus/attested.json, which records the spelling somebody
// SAW rather than a reading of it, and which wins above this table
// anyway. Nineteen words were removed this way (session 12, TODO 33):
//
//   the of to and you your are is have when come do no be me
//   what katara bending metalbending
//
// Eighteen of them agreed with the corpus and were unreachable dead
// weight. `what` did not — this table read it /w ʌ t/ and canon writes
// `w ɑ t` (katara-letter, checked against the art). The site drew the
// right thing because the corpus wins, but `derivedLookup` reads this
// table directly and so the workbench's "against the model" panel was
// being told canon disagreed with the model when the wrong reading was
// the model's. That is `toph` again (TODO item 24).
//
// The model's honest answer for those words is now CMU's, one layer
// down, which is what the panel should have been comparing against all
// along. Where CMU has never heard of the word — `katara`,
// `metalbending` — the model falls to the letter-to-sound rules and says
// so, which is a true statement about the model rather than a hand
// reading dressed up as one.
const EXCEPTIONS = {
  "a": "ə", "one": "w ʌ n", "two": "t u", "said": "s ɛ d", "says": "s ɛ z",
  "was": "w ʌ z", "were": "w ə ɹ", "has": "h æ z",
  "here": "h ɪ ɹ", "there": "ð ɛ ɹ", "they": "ð e", "their": "ð ɛ ɹ",
  "who": "h u", "where": "w ɛ ɹ",
  "some": "s ʌ m", "done": "d ʌ n", "gone": "g ɔ n",
  "does": "d ʌ z", "go": "g oʊ", "so": "s oʊ",
  // Short words ending in -e: the vowel is /i/, NOT a silent e
  "he": "h i", "she": "ʃ i", "we": "w i",
  "hello": "h ɛ l oʊ", "people": "p i p ə l", "again": "ə g ɛ n",
  // -ough is famously irregular; the rule table can only pick one reading
  "through": "θ ɹ u", "though": "ð oʊ", "thought": "θ ɔ t",
  "enough": "ɪ n ʌ f", "cough": "k ɔ f", "bought": "b ɔ t",

  // --- the Avatar vocabulary, NOT YET CHECKED against any sample ---
  // Ordinary guesses from English spelling. Every one is provisional
  // until somebody has seen the word written — TODO item 24 — and two
  // of the first four audited (`aang`, `toph`) turned out wrong, so
  // expect more. A word that gets confirmed does NOT get corrected
  // here: it moves to corpus/attested.json, which records the observed
  // spelling rather than a reading of it, and which wins above this
  // table. See CORPUS.md.
  "world": "w ə ɹ l d", "water": "w ɔ t ə ɹ",
  "earth": "ə ɹ θ", "air": "e ɹ", "avatar": "æ v ə t ɑ ɹ",
  "sokka": "s ɑ k ə",
  "korra": "k ɔ ɹ ə", "iroh": "aɪ ɹ oʊ", "azula": "ə z u l ə",
  // `katara`, `bending` and `metalbending` were here and are ATTESTED,
  // so they left with the other sixteen. `metalbending` had been kept
  // deliberately as a fallback for corpus.js failing to load; that is
  // not worth a second copy that can drift, and it was never the whole
  // answer anyway — canon puts a null after the `l` that a phoneme list
  // cannot express, so the corpus entry is what got drawn regardless.
  //
  // Coined compounds below, so no general dictionary has them. The
  // -bending ones all reduce the linking vowel to schwa, which is the
  // reading canon shows for `metalbending` — the one member of the
  // family anybody has seen written, and now the corpus's to state.
  //
  // These are phoneme lists; the syllabifier divides them, and it splits the
  // suffix BEN-DING (`n ∅ · d ɪ ŋ`), matching attested standalone `bending`
  // and every other -ing word (looking, baking, missing). Attested
  // `metalbending` is the lone outlier — it splits BEND-ING (`n d · ɪ ŋ`),
  // keeping the stem whole. That divergence is DELIBERATELY not matched here
  // (decided 2026-08-22): ben-ding is the majority, metalbending the anomaly.
  // Don't "fix" firebending to metalbending — the family is meant to disagree
  // with that one word. (Pinning bend-ing would need explicit block structure
  // this phoneme-only table can't carry anyway.)
  "airbending": "e ɹ b ɛ n d ɪ ŋ", "waterbending": "w ɔ t ə ɹ b ɛ n d ɪ ŋ",
  "earthbending": "ə ɹ θ b ɛ n d ɪ ŋ", "firebending": "f aɪ ə ɹ b ɛ n d ɪ ŋ",
  "bloodbending": "b l ʌ d b ɛ n d ɪ ŋ",
  "airbender": "e ɹ b ɛ n d ə ɹ", "waterbender": "w ɔ t ə ɹ b ɛ n d ə ɹ",
  "earthbender": "ə ɹ θ b ɛ n d ə ɹ", "firebender": "f aɪ ə ɹ b ɛ n d ə ɹ",
  "bender": "b ɛ n d ə ɹ", "benders": "b ɛ n d ə ɹ z",
  "kyoshi": "k i oʊ ʃ i", "omashu": "oʊ m ɑ ʃ u",
  "sozin": "s oʊ z ɪ n", "roku": "ɹ oʊ k u", "ozai": "oʊ z aɪ",
  "suki": "s u k i", "yue": "j u e", "haru": "h ɑ ɹ u",
  "unagi": "u n ɑ g i", "agni": "ɑ g n i", "sifu": "ʃ i f u",
};

// ---------------------------------------------------------------------
// Syllables, and where the nulls go
// ---------------------------------------------------------------------
//
// A BLOCK NEVER STRADDLES A SYLLABLE BOUNDARY. Read off 255 attested
// spellings: this one rule reproduces 233 of them exactly, nulls and all,
// from nothing but the sounds. Everything the old model said about nulls
// is a special case of it —
//
//   two consonants share a block only inside one syllable
//     fou-nd, fr-ee, be-st       share        ben-ding, gar-den    do not
//   a vowel does not pair with a consonant that starts the next syllable
//     a-ca-de-my  ->  ə ∅ k æ d ə m i        fro-zen -> f r oʊ ∅ z ə n
//   V-V never shares, which was already known
//
// Before this, 45 of the 51 attested mid-word nulls had no account at all
// — "a null substitutes for a missing second vowel" covered only 6.
//
// Syllabification is MAXIMUM ONSET: a consonant, or a legal cluster,
// belongs to the vowel that follows it rather than the one before. That
// is what makes `festival` fe-sti-val rather than fes-ti-val, and it is
// why its /s/ and /t/ share a block — a fact read off the art first and
// only then explained.

const NULL_SYMBOL = "∅";

/**
 * The vowels, kept here rather than borrowed from render.js: this file
 * loads first, and a spelling decision should not depend on the module
 * that draws it.
 */
const SYLLABIC = new Set([
  "i", "ɪ", "e", "ɛ", "æ", "ɑ", "ɔ", "oʊ", "ʊ", "u", "ʌ", "ə",
  "aɪ", "aʊ", "ɔɪ",
]);
function isVowel(sym) {
  return SYLLABIC.has(sym);
}

/** Consonant clusters English allows at the start of a syllable. */
const ONSET_CLUSTERS = new Set([
  "pl", "pɹ", "bl", "bɹ", "tɹ", "dɹ", "kl", "kɹ", "gl", "gɹ",
  "tw", "dw", "kw", "gw", "θw", "sw",
  "fl", "fɹ", "θɹ", "ʃɹ", "sl", "sm", "sn", "sp", "st", "sk", "sf",
  "hj", "kj", "pj", "bj", "fj", "vj", "mj", "nj", "lj",
  "spl", "spɹ", "stɹ", "skɹ", "skw",
]);

/**
 * Are these two sounds in the same syllable?
 *
 * The lookahead is the whole trick: a consonant only belongs to the NEXT
 * syllable if there is a vowel there for it to attach to. `asked` keeps
 * /s k/ together because nothing follows the /k/ but /t/ — there is no
 * next syllable to onset.
 */
function sameSyllable(seq, i) {
  const a = seq[i], b = seq[i + 1];
  if (b === undefined) return false;
  const av = isVowel(a), bv = isVowel(b);
  if (av && bv) return false;                 // V-V never shares a block
  if (!av && bv) return true;                 // an onset and its vowel
  const after = seq[i + 2];
  if (av) {                                   // V + C
    if (isVowel(after)) return false;         // C onsets the next syllable
    if (after && ONSET_CLUSTERS.has(b + after) && isVowel(seq[i + 3])) {
      return false;                           // so does the whole cluster
    }
    return true;                              // C closes this syllable
  }
  // C + C: together only as a legal onset, or when they close a syllable.
  if (ONSET_CLUSTERS.has(a + b) && isVowel(after)) return true;
  return !isVowel(after);
}

/**
 * A phoneme list, padded with nulls into whole blocks.
 *
 * The null is not decoration: it holds a slot open so the block above it
 * stays inside one syllable. `resolveBlocks` in render.js then picks
 * which null — tall or short — from the sound it is paired with.
 */
function padToBlocks(seq) {
  const out = [];
  for (let i = 0; i < seq.length; ) {
    if (sameSyllable(seq, i)) { out.push(seq[i], seq[i + 1]); i += 2; }
    else { out.push(seq[i], NULL_SYMBOL); i += 1; }
  }
  return out;
}

/**
 * Ordered grapheme → phoneme rules, longest first.
 * A trailing "$" means the grapheme only matches at end of word.
 * Some single letters are refined by following-letter context in the
 * scanner below (c, g, y, s).
 */
const RULES = [
  ["tion$", ["ʃ", "ə", "n"]],
  ["sion$", ["ʒ", "ə", "n"]],
  ["ight", ["aɪ", "t"]],
  ["eigh", ["e"]],
  ["ough", ["ʌ", "f"]],
  ["augh", ["æ", "f"]],
  ["dge", ["dʒ"]],
  ["tch", ["tʃ"]],
  ["air", ["ɛ", "ɹ"]],
  ["are$", ["ɛ", "ɹ"]],
  ["ire", ["aɪ", "ə", "ɹ"]],
  ["ure", ["j", "ʊ", "ɹ"]],
  ["sch", ["s", "k"]], // must precede "ch" — otherwise "school" → /s tʃ u l/
  ["ck", ["k"]],
  ["ph", ["f"]],
  ["gh", []],
  ["th", ["θ"]],
  ["sh", ["ʃ"]],
  ["ch", ["tʃ"]],
  ["ng", ["ŋ"]],
  ["qu", ["k", "w"]],
  ["wh", ["w"]],
  ["wr", ["ɹ"]],
  ["kn", ["n"]],
  ["oo", ["u"]],
  ["ee", ["i"]],
  ["ea", ["i"]],
  ["ie", ["i"]],
  ["ai", ["e"]],
  ["ay", ["e"]],
  ["oa", ["oʊ"]],
  ["oe", ["oʊ"]],
  ["ow", ["aʊ"]],
  ["ou", ["aʊ"]],
  ["oy", ["ɔɪ"]],
  ["oi", ["ɔɪ"]],
  ["au", ["ɔ"]],
  ["aw", ["ɔ"]],
  ["ar", ["ɑ", "ɹ"]],
  ["er", ["ə", "ɹ"]],
  ["ir", ["ə", "ɹ"]],
  ["ur", ["ə", "ɹ"]],
  ["or", ["ɔ", "ɹ"]],
  ["o$", ["oʊ"]],
  ["y$", ["i"]],
  ["a$", ["ə"]],
  ["e$", []],
  ["c", ["k"]],
  ["x", ["k", "s"]],
  ["j", ["dʒ"]],
  ["y", ["j"]],
  ["a", ["æ"]],
  ["e", ["ɛ"]],
  ["i", ["ɪ"]],
  ["o", ["ɑ"]],
  ["u", ["ʌ"]],
  ["b", ["b"]], ["d", ["d"]], ["f", ["f"]], ["g", ["g"]],
  ["h", ["h"]], ["k", ["k"]], ["l", ["l"]], ["m", ["m"]],
  ["n", ["n"]], ["p", ["p"]], ["r", ["ɹ"]], ["s", ["s"]],
  ["t", ["t"]], ["v", ["v"]], ["w", ["w"]], ["z", ["z"]],
  ["'", []],
];

const VOWEL_LETTERS = "aeiou";

/**
 * The bundled pronunciation dictionary (js/lexicon.js), if it loaded.
 *
 * Built lazily and once: the file is ~126k entries, and decoding it at
 * script-load would cost that on every page whether or not anyone types
 * anything. Only the WORDS are decoded here — each pronunciation stays
 * as its packed string and is expanded on the lookup that wants it, so
 * a session that converts ten words doesn't build 126k arrays.
 *
 * If lexicon.js isn't on the page this returns an empty map and
 * everything below falls through to the rules, which is exactly how the
 * site behaved before the dictionary existed.
 */
let LEXICON = null;
let PHONE_OF = null;

function lexicon() {
  if (LEXICON) return LEXICON;
  LEXICON = new Map();
  const src = (typeof window !== "undefined" && window.AVATARIAN_LEXICON) || null;
  if (!src) return LEXICON;

  PHONE_OF = {};
  for (let i = 0; i < src.codes.length; i++) PHONE_OF[src.codes[i]] = src.alphabet[i];

  // Front-coded: each line reuses the first n characters of the word
  // before it. See tools/build_lexicon.py for the format.
  let prev = "";
  for (const line of src.words.split("\n")) {
    const cut = line.lastIndexOf(" ");
    if (cut < 1) continue;
    const head = line.slice(0, cut);
    const n = head.charCodeAt(0) - src.shift;
    prev = prev.slice(0, n) + head.slice(1);
    LEXICON.set(prev, line.slice(cut + 1));
  }
  return LEXICON;
}

/** True once the bundled dictionary is available. */
function hasLexicon() {
  return lexicon().size > 0;
}

/**
 * The attested corpus (js/corpus.js), if it loaded.
 *
 * Loaded eagerly, unlike the pronunciation dictionary — it is tens of
 * entries, not 126k, so there is nothing to defer. If the file isn't on
 * the page this is empty and everything falls through to EXCEPTIONS,
 * which is how the site behaved before the corpus existed.
 */
function corpusWords() {
  const src = (typeof window !== "undefined" && window.AVATARIAN_CORPUS) || null;
  return (src && src.words) || {};
}

/**
 * Conventions: spellings somebody DECIDED on rather than SAW (corpus.js,
 * beside `words`). They are not attestations — no source, no count — so
 * they are kept apart from the corpus here just as they are in the file,
 * and `corpusWords()` above never returns one. But they carry finished
 * block structure like a corpus entry, so the lookup treats a convention
 * the same way it treats an attested word: it already IS the blocks.
 * Empty when the file has none, which is the usual case.
 */
function conventionWords() {
  const src = (typeof window !== "undefined" && window.AVATARIAN_CORPUS) || null;
  return (src && src.conventions) || {};
}

/** Longest corpus key, in words. 1 until a phrase entry is added. */
let CORPUS_SPAN = null;

function corpusSpan() {
  if (CORPUS_SPAN === null) {
    CORPUS_SPAN = 1;
    for (const key of Object.keys(corpusWords())) {
      CORPUS_SPAN = Math.max(CORPUS_SPAN, key.split(" ").length);
    }
  }
  return CORPUS_SPAN;
}

/** The lookup key for a word: lowercased, punctuation dropped. */
function normaliseWord(word) {
  return word.toLowerCase().replace(/[^a-z']/g, "");
}

/**
 * Which layer of the chain answered, so the UI can say how much to trust
 * a spelling (TODO item 21, CORPUS.md §3):
 *
 *   attested  somebody has seen this written              corpus
 *   derived   the sounds are known, the blocks inferred   EXCEPTIONS / lexicon
 *   guessed   even the sounds are a guess from spelling   RULES
 *
 * The bottom two are worth separating because they fail differently: a
 * derived word is probably right about its sounds and may be wrong about
 * its block structure, while a guessed one may be wrong about what the
 * word even sounds like.
 */
function lookupWord(word) {
  const w = normaliseWord(word);
  if (!w) return { ipa: [], tier: "guessed" };

  // An attested spelling already IS the finished blocks, nulls written
  // out. Padding it again would be second-guessing the observation.
  const attested = corpusWords()[w];
  if (attested) return { ipa: attested.ipa.slice(), tier: "attested", entry: attested };

  // A convention is a decided spelling, not a seen one — below the
  // attested corpus (a real sighting still wins), but above everything
  // derived. It too already IS the blocks, so it is returned whole; its
  // own tier keeps it honest, and its absence from corpusWords() is what
  // stops the site marking it "attested".
  const convention = conventionWords()[w];
  if (convention) {
    return { ipa: convention.ipa.slice(), tier: "convention", entry: convention };
  }

  // EXCEPTIONS next: it carries the Avatar vocabulary and the hand
  // corrections, which should win over a general dictionary.
  if (EXCEPTIONS[w]) {
    return { ipa: spellSounds(EXCEPTIONS[w].split(" ")), tier: "derived" };
  }

  // Then the bundled dictionary, which knows ~126k words and — because
  // it reads CMU's stress marks — reduces unstressed vowels to schwa,
  // something the rules never did.
  const packed = lexicon().get(w);
  if (packed) {
    const out = [];
    for (const ch of packed) out.push(PHONE_OF[ch]);
    return { ipa: spellSounds(out), tier: "derived" };
  }

  return { ipa: spellSounds(rulesToIPA(w)), tier: "guessed" };
}

/**
 * Sounds in, a finished spelling out: the FACE vowel written as canon
 * writes it, then padded into whole blocks along the syllables.
 *
 * THE FACE VOWEL IS TWO LETTERS. Every one of the eleven attested words
 * containing /eɪ/ writes it `e` then `ɪ` — ages, baking, ballet, cakes,
 * brave, available, raise, always, baked, made, today — and there is no
 * single glyph for it in the manifest. The tool wrote one letter, so
 * every such word came out a slot short and a block wrong.
 *
 * (`take`, `wake`, `hey` and `anyway` use a bare `e`, and all four are
 * from the two hand-written letters rather than the printed sources.
 * Whether that is a real difference in the script or a difference in how
 * carefully those two were read is still open — see AVATARIAN.md §10.)
 */
function spellSounds(seq) {
  const spelt = [];
  for (const sym of seq) {
    if (sym === "e") spelt.push("e", "ɪ");
    else spelt.push(sym);
  }
  return padToBlocks(spelt);
}

function wordToIPA(word) {
  return lookupWord(word).ipa;
}

/**
 * What the chain WOULD have said if the corpus didn't know this word.
 *
 * The transcription workbench needs it to show canon beside the model:
 * an attested spelling is only interesting against the prediction it
 * agrees or disagrees with, and `lookupWord` on an attested word just
 * hands the corpus entry back. Asking the question this way round also
 * keeps it honest — the model is not consulted about its own answer.
 */
function derivedLookup(word) {
  const w = normaliseWord(word);
  if (!w) return { ipa: [], tier: "guessed" };
  if (EXCEPTIONS[w]) return { ipa: EXCEPTIONS[w].split(" "), tier: "derived" };
  const packed = lexicon().get(w);
  if (packed) {
    const out = [];
    for (const ch of packed) out.push(PHONE_OF[ch]);
    return { ipa: out, tier: "derived" };
  }
  return { ipa: rulesToIPA(w), tier: "guessed" };
}

/**
 * The FINISHED spelling the model would draw, ignoring both the corpus
 * and the conventions: the model's sounds, run through the same face-vowel
 * and whole-blocks padding a real lookup uses. `derivedLookup` gives the
 * raw phonemes; this gives what they become on the page.
 *
 * The workbench's conventions editor starts from this — you type a name,
 * get the model's spelling with its nulls in place, and change the one
 * slot it got wrong rather than typing the whole thing out.
 */
function modelSpelling(word) {
  return spellSounds(derivedLookup(word).ipa);
}

/**
 * The letter-to-sound guesser — the bottom of the chain, reached only
 * when nothing above it knows the word.
 */
function rulesToIPA(w) {
  // Collapse doubled consonants: "hello" is /h ɛ l oʊ/, not /h ɛ l l oʊ/.
  // Vowels are excluded — "ee"/"oo" are meaningful digraphs.
  const s = w.replace(/([bcdfgklmnprstvz])\1/g, "$1");

  const out = [];
  let i = 0;
  scan: while (i < s.length) {
    for (const [pattern, phonemes] of RULES) {
      const atEnd = pattern.endsWith("$");
      const graph = atEnd ? pattern.slice(0, -1) : pattern;
      if (!s.startsWith(graph, i)) continue;
      if (atEnd && i + graph.length !== s.length) continue;

      let emit = phonemes;
      const next = s[i + graph.length];

      // Final "e" is only silent in longer words that already contain
      // another vowel ("have", "make"). In short words like "be" it is
      // the actual vowel, so don't swallow it.
      if (atEnd && graph === "e") {
        const earlier = s.slice(0, i);
        const hasEarlierVowel = /[aeiouy]/.test(earlier);
        if (!(s.length >= 4 && hasEarlierVowel)) {
          out.push("i");
          i += graph.length;
          continue scan;
        }
      }

      // Context refinements apply only to the bare single-letter rules,
      // never to the word-final ("$") variants, which already encode
      // their own answer (e.g. final -y is /i/ in "happy", not /ɪ/).
      if (atEnd) {
        out.push(...emit);
        i += graph.length;
        continue scan;
      }
      if (graph === "c") {
        emit = next && "eiy".includes(next) ? ["s"] : ["k"];
      } else if (graph === "g") {
        emit = next && "eiy".includes(next) ? ["dʒ"] : ["g"];
      } else if (graph === "y") {
        emit = next && VOWEL_LETTERS.includes(next) ? ["j"] : ["ɪ"];
      } else if (graph === "s") {
        // -s is voiced to /z/ after a voiced sound at word end, whether
        // it's truly final ("dogs") or followed by a silent e ("please").
        const rest = s.slice(i + 1);
        const isFinal = rest === "" || rest === "e";
        const prev = s[i - 1];
        emit = isFinal && prev && "bdgnmlrvaeiou".includes(prev) ? ["z"] : ["s"];
      }

      out.push(...emit);
      i += graph.length;
      continue scan;
    }
    i += 1; // unmatched character — skip rather than fail
  }
  return out;
}

/**
 * Text → one group per word, each carrying its symbols and which layer
 * of the chain produced them.
 *
 * A corpus key may be a PHRASE — "Ba Sing Se" is plausibly written as a
 * unit, and if it is, its blocks won't be the ones you get by spelling
 * three words and running them together. So this scans longest-first
 * rather than assuming one word at a time. With no phrase entries in the
 * corpus, `corpusSpan()` is 1 and the loop below collapses to the
 * word-at-a-time behaviour it replaced.
 */
function sentenceToIPA(text) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const out = [];
  const span = corpusSpan();
  const attested = corpusWords();

  for (let i = 0; i < words.length; ) {
    let taken = 0;
    for (let n = Math.min(span, words.length - i); n > 1; n--) {
      const run = words.slice(i, i + n);
      const key = run.map(normaliseWord).filter(Boolean).join(" ");
      const entry = attested[key];
      if (entry) {
        out.push({
          word: run.join(" "), ipa: entry.ipa.slice(),
          tier: "attested", entry,
        });
        taken = n;
        break;
      }
    }
    if (!taken) {
      const { ipa, tier, entry } = lookupWord(words[i]);
      out.push({ word: words[i], ipa, tier, entry });
      taken = 1;
    }
    i += taken;
  }
  return out;
}

if (typeof module !== "undefined") {
  module.exports = {
    wordToIPA, lookupWord, derivedLookup, modelSpelling, sentenceToIPA,
    normaliseWord, EXCEPTIONS, hasLexicon, corpusWords, conventionWords,
  };
}
