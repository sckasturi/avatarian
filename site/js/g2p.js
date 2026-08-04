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
 * Coverage strategy:
 *   1. EXCEPTIONS — hand dictionary for common irregular words.
 *   2. RULES      — ordered, longest-first grapheme → phoneme rules.
 *   3. FALLBACK   — unmatched characters are skipped, never fatal.
 */

const ARPABET_TO_IPA = {
  AA: "ɑ", AE: "æ", AH: "ʌ", AO: "ɔ", AW: "aʊ", AY: "aɪ",
  EH: "ɛ", ER: "ɜ", EY: "e", IH: "ɪ", IY: "i", OW: "oʊ",
  OY: "ɔɪ", UH: "ʊ", UW: "u",
  B: "b", CH: "tʃ", D: "d", DH: "ð", F: "f", G: "g", HH: "h",
  JH: "dʒ", K: "k", L: "l", M: "m", N: "n", NG: "ŋ", P: "p",
  R: "r", S: "s", SH: "ʃ", T: "t", TH: "θ", V: "v", W: "w",
  Y: "j", Z: "z", ZH: "ʒ",
};

const EXCEPTIONS = {
  "the": "ð ə", "a": "ə", "of": "ʌ v", "to": "t u", "and": "æ n d",
  "one": "w ʌ n", "two": "t u", "said": "s ɛ d", "says": "s ɛ z",
  "you": "j u", "your": "j ɔ r", "are": "ɑ r", "is": "ɪ z",
  "was": "w ʌ z", "were": "w ɜ r", "have": "h æ v", "has": "h æ z",
  "here": "h ɪ r", "there": "ð ɛ r", "they": "ð e", "their": "ð ɛ r",
  "what": "w ʌ t", "who": "h u", "where": "w ɛ r", "when": "w ɛ n",
  "some": "s ʌ m", "come": "k ʌ m", "done": "d ʌ n", "gone": "g ɔ n",
  "do": "d u", "does": "d ʌ z", "go": "g oʊ", "so": "s oʊ", "no": "n oʊ",
  // Short words ending in -e: the vowel is /i/, NOT a silent e
  "be": "b i", "he": "h i", "she": "ʃ i", "we": "w i", "me": "m i",
  "hello": "h ɛ l oʊ", "people": "p i p ə l", "again": "ə g ɛ n",
  // -ough is famously irregular; the rule table can only pick one reading
  "through": "θ r u", "though": "ð oʊ", "thought": "θ ɔ t",
  "enough": "ɪ n ʌ f", "cough": "k ɔ f", "bought": "b ɔ t",
  // Avatar-relevant
  "world": "w ɜ r l d", "water": "w ɔ t ə r", "fire": "f aɪ ə r",
  "earth": "ɜ r θ", "air": "ɛ r", "avatar": "æ v ə t ɑ r",
  "aang": "ɑ ŋ", "toph": "t oʊ f", "zuko": "z u k oʊ",
  "katara": "k ə t ɑ r ə", "sokka": "s ɑ k ə", "appa": "ɑ p ə",
  "korra": "k ɔ r ə", "iroh": "aɪ r oʊ", "azula": "ə z u l ə",
  "beifong": "b e f ɔ ŋ", "bending": "b ɛ n d ɪ ŋ",
};

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
  ["air", ["ɛ", "r"]],
  ["are$", ["ɛ", "r"]],
  ["ire", ["aɪ", "ə", "r"]],
  ["ure", ["j", "ʊ", "r"]],
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
  ["wr", ["r"]],
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
  ["ar", ["ɑ", "r"]],
  ["er", ["ɜ", "r"]],
  ["ir", ["ɜ", "r"]],
  ["ur", ["ɜ", "r"]],
  ["or", ["ɔ", "r"]],
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
  ["n", ["n"]], ["p", ["p"]], ["r", ["r"]], ["s", ["s"]],
  ["t", ["t"]], ["v", ["v"]], ["w", ["w"]], ["z", ["z"]],
  ["'", []],
];

const VOWEL_LETTERS = "aeiou";

function wordToIPA(word) {
  const w = word.toLowerCase().replace(/[^a-z']/g, "");
  if (!w) return [];
  if (EXCEPTIONS[w]) return EXCEPTIONS[w].split(" ");

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

function sentenceToIPA(text) {
  return text
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => ({ word, ipa: wordToIPA(word) }));
}

if (typeof module !== "undefined") {
  module.exports = { wordToIPA, sentenceToIPA, ARPABET_TO_IPA, EXCEPTIONS };
}
