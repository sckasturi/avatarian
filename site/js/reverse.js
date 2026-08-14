/**
 * Fuzzy reverse-decode — sounds in, likely English words out.
 *
 * The forward direction (English -> sounds -> blocks) is what the site
 * does. This is the other way, and it exists because transcribing is the
 * other way: you are looking at a reference image, you can read the
 * glyphs, and what you don't know is what word they spell.
 *
 * Fuzzy rather than exact-match, because the two ends rarely meet
 * cleanly. The dictionary records one pronunciation and canon writes
 * another (`toph` is /t ɑ f/, not the /t oʊ f/ any English reader would
 * guess); an unstressed vowel may be written full or reduced; and a
 * glyph read off a small or skewed image may simply be read wrong. An
 * exact index would answer "no such word" to all of that, which is
 * useless exactly when help is wanted.
 *
 * So: phoneme-level edit distance against every word we have a
 * pronunciation for, ranked. Wrong-but-close is the normal case and it
 * is still the answer you need.
 *
 * WHERE THE CANDIDATES COME FROM, best first:
 *   the corpus      already attested — if it matches, this is not a new word
 *   EXCEPTIONS      the Avatar vocabulary, which no general dictionary has
 *   the lexicon     CMU, ~126k words
 *
 * Distance is computed on the lexicon's own PACKED strings — one
 * character per phoneme — so the inner loop is ordinary string edit
 * distance over ~8 characters rather than array comparison over objects.
 * That is what makes scanning the whole dictionary per query fine to do
 * on a keystroke.
 */

/** phoneme -> the lexicon's one-character code for it. */
let CODE_OF = null;

function codeTable() {
  if (CODE_OF) return CODE_OF;
  CODE_OF = {};
  const src = (typeof window !== "undefined" && window.AVATARIAN_LEXICON) || null;
  if (src) {
    for (let i = 0; i < src.codes.length; i++) CODE_OF[src.alphabet[i]] = src.codes[i];
  }
  return CODE_OF;
}

/**
 * Pack a phoneme list into the lexicon's encoding. Anything with no code
 * gets a character of its own from a private range, so an unknown
 * phoneme still counts as one edit rather than silently vanishing and
 * making the word look like a better match than it is.
 */
function pack(phonemes) {
  const table = codeTable();
  let out = "";
  for (const p of phonemes) {
    out += table[p] || String.fromCharCode(0xe000 + (p.charCodeAt(0) % 256));
  }
  return out;
}

/**
 * Scratch rows for the edit-distance table.
 *
 * Reused rather than allocated per call. A query scans tens of thousands
 * of candidates, and two small array allocations each was the single
 * biggest cost in the whole search — removing them took a query from
 * ~500 ms to well inside a keystroke.
 */
const ROW_A = new Int32Array(64);
const ROW_B = new Int32Array(64);

/**
 * Levenshtein distance, abandoning early once the best cell in a row
 * exceeds `cap`. Most of the dictionary is nowhere near any given query,
 * so the cutoff is where nearly all the remaining time is saved.
 */
function editDistance(a, b, cap) {
  const n = a.length, m = b.length;
  if (Math.abs(n - m) > cap) return cap + 1;
  if (m + 1 > ROW_A.length) return Math.abs(n - m) > cap ? cap + 1 : cap;  // absurdly long
  let prev = ROW_A, curr = ROW_B;
  for (let j = 0; j <= m; j++) prev[j] = j;
  for (let i = 1; i <= n; i++) {
    curr[0] = i;
    let best = i;
    const ai = a.charCodeAt(i - 1);
    for (let j = 1; j <= m; j++) {
      const cost = ai === b.charCodeAt(j - 1) ? 0 : 1;
      const up = prev[j] + 1, left = curr[j - 1] + 1, diag = prev[j - 1] + cost;
      const v = up < left ? (up < diag ? up : diag) : (left < diag ? left : diag);
      curr[j] = v;
      if (v < best) best = v;
    }
    if (best > cap) return cap + 1;
    const swap = prev; prev = curr; curr = swap;
  }
  return prev[m];
}

/**
 * The lexicon bucketed by pronunciation length, built once.
 *
 * A query only has to look at lengths within `cap` of its own, which
 * throws away most of the dictionary before any distance is computed —
 * a four-phoneme word never gets compared against "unconstitutional".
 */
let BY_LENGTH = null;

function byLength() {
  if (BY_LENGTH) return BY_LENGTH;
  BY_LENGTH = new Map();
  if (typeof lexicon !== "function") return BY_LENGTH;
  for (const [word, packed] of lexicon()) {
    let bucket = BY_LENGTH.get(packed.length);
    if (!bucket) BY_LENGTH.set(packed.length, bucket = []);
    bucket.push(word, packed);      // flat, two entries per word
  }
  return BY_LENGTH;
}

/**
 * Strip a transcription down to the sounds it contains.
 *
 * Nulls come off because they are structure, not sound — no
 * pronunciation dictionary has an entry with a null in it, and `appa`
 * written `ɑ ∅ p ∅ ɑ ∅` has to reach the word "appa" (/ɑ p ɑ/). The
 * orientation overrides come off for the same reason: `s%` is still /s/.
 *
 * This is exactly the information the corpus keeps and the dictionary
 * throws away, which is why the block structure has to be preserved in
 * the entry even though it plays no part in finding the word.
 *
 * An unreadable glyph comes off too, and for a different reason: it is a
 * sound, but nobody knows which one. Left in, it would be compared as the
 * literal character `?` and score a mismatch against every real phoneme,
 * so a word with one gap in it could never find itself. Dropped, the
 * readable part still searches — "d r ? ∅" looks for /d r/ and the edit
 * distance treats the gap as the one missing sound it is.
 */
function soundsOnly(tokens) {
  const out = [];
  for (const t of tokens) {
    const body = t.slice(-1) === "$" || t.slice(-1) === "%" ? t.slice(0, -1) : t;
    if (body === "∅" || body === "∅c" || body === "?" || !body) continue;
    out.push(body);
  }
  return out;
}

/**
 * Suggest English words for a transcription.
 *
 * `tokens` is a spelling as the workbench builds it — IPA symbols, nulls
 * and overrides included. Returns [{ word, score, distance, source,
 * phonemes }], best first, where `score` is 1 for an exact match and
 * falls off with each edit.
 */
function suggestWords(tokens, limit = 8) {
  const query = soundsOnly(tokens);
  if (!query.length) return [];
  const packed = pack(query);

  // Two edits on a short word is already a stretch; on a long one it is
  // a plausible reading difference. Scaling with length keeps both ends
  // sensible without a second parameter to tune.
  const cap = Math.max(1, Math.min(4, Math.round(query.length / 3) + 1));

  const seen = new Map();
  const consider = (word, phonemes, source, bonus) => {
    const d = editDistance(packed, pack(phonemes), cap);
    if (d > cap) return;
    // A shorter word reaching the same distance is a worse match: two
    // edits out of three sounds is a different word, two out of nine is
    // a reading difference.
    const score = Math.max(0, 1 - d / Math.max(query.length, phonemes.length)) + bonus;
    const prev = seen.get(word);
    if (!prev || score > prev.score) {
      seen.set(word, { word, score, distance: d, source, phonemes });
    }
  };

  // The corpus first, and with a thumb on the scale: a match here means
  // the word is already attested, which is the single most useful thing
  // this can tell you mid-transcription — you are about to record
  // something that is already recorded.
  const attested = typeof corpusWords === "function" ? corpusWords() : {};
  for (const [word, entry] of Object.entries(attested)) {
    consider(word, soundsOnly(entry.ipa), "corpus", 0.25);
  }

  // Then the hand list, which is where the Avatar vocabulary lives. CMU
  // has never heard of Katara.
  if (typeof EXCEPTIONS !== "undefined") {
    for (const [word, ipa] of Object.entries(EXCEPTIONS)) {
      consider(word, ipa.split(" "), "exceptions", 0.05);
    }
  }

  const buckets = byLength();
  for (let len = Math.max(1, packed.length - cap); len <= packed.length + cap; len++) {
    const bucket = buckets.get(len);
    if (!bucket) continue;
    for (let i = 0; i < bucket.length; i += 2) {
      const d = editDistance(packed, bucket[i + 1], cap);
      if (d > cap) continue;
      const word = bucket[i];
      const score = Math.max(0, 1 - d / Math.max(query.length, len));
      const prev = seen.get(word);
      if (!prev || score > prev.score) {
        seen.set(word, { word, score, distance: d, source: "lexicon", phonemes: null });
      }
    }
  }

  return [...seen.values()]
    .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word))
    .slice(0, limit);
}

if (typeof module !== "undefined") {
  module.exports = { suggestWords, soundsOnly, editDistance };
}
