/**
 * Structural corpus search — find a phoneme by the COMPANY it keeps, not
 * by the English word it sits in.
 *
 * The corpus page's plain filter answers "which words contain these
 * letters". This answers a different question, the one you actually ask
 * when you are studying the script: "where does /g/ appear in a C-C
 * block?", "which words put /s/ in the top slot of a C-V block?". The
 * data is already shaped for it — every corpus entry stores its finished
 * BLOCK STRUCTURE, two tokens per block with the nulls written out, so a
 * block is just an adjacent pair and its shape is readable straight off
 * the symbols.
 *
 * THE QUERY, in one line:  [slot:]phoneme [@context]
 *
 *   g            /g/ anywhere
 *   g @cc        /g/ in a two-consonant block (so NOT beside a null)
 *   top:s @cv    /s/ in the top slot of a consonant-vowel block
 *   aɪ @vv       the diphthong sharing its block with another vowel
 *
 *   slot     top | bottom            (t | b accepted; absent = either)
 *   context  @cc @cv @vc @vv @null   (@any or absent = any shape)
 *
 * The phoneme is read the same way the Sounds box reads it — a readable
 * code (`sh`, `ng`, `uh`) or raw IPA — so "g but not ng" needs no special
 * case: `g` and `ŋ` are simply different symbols. Normalisation reuses
 * `normaliseSound` from sounds.js when it is loaded (as it is on the
 * page and in the test harness); standalone it falls back to identity,
 * which is fine for IPA input.
 *
 * Standalone and DOM-free on purpose, like g2p.js and sounds.js: the
 * matcher works on the stored `ipa` array so it can be unit-tested
 * without a browser, and the page layers highlighting on top of the
 * block indices it returns.
 */

// The syllabic nuclei — kept here rather than imported so the matcher is
// self-contained. Mirrors g2p.js's SYLLABIC; a vowel added to the script
// must be added in both, which is true of every vowel list in the code.
const CQ_VOWELS = new Set([
  "i", "ɪ", "e", "ɛ", "æ", "ɑ", "ɔ", "oʊ", "ʊ", "u", "ʌ", "ə",
  "aɪ", "aʊ", "ɔɪ",
]);
const CQ_NULLS = new Set(["∅", "∅c"]);
const CQ_PUNCT = new Set([".", ",", "?", "!"]);

/** The block-shape codes a `@context` can name, and what each requires. */
const CQ_CONTEXTS = ["any", "cc", "cv", "vc", "vv", "null"];

/**
 * A stored token down to its bare symbol: drop a `$`/`%` orientation
 * override and a `_c` cluster-form request, the two suffixes a corpus
 * spelling can carry (`s%`, `r_c`). Everything else is already bare.
 */
function cqBase(token) {
  let t = String(token);
  if (t.endsWith("$") || t.endsWith("%")) t = t.slice(0, -1);
  if (t.endsWith("_c")) t = t.slice(0, -2);
  return t;
}

/** C, V or N (consonant / vowel / null) — the class that decides shape. */
function cqClass(token) {
  const b = cqBase(token);
  if (CQ_NULLS.has(b)) return "N";
  if (CQ_VOWELS.has(b)) return "V";
  return "C";
}

/**
 * The stored `ipa` array as blocks, in the ORDER they are drawn, so a
 * block's index here is the index of its `.avatarian-block` on the page.
 *
 * Punctuation is not paired (see render.js): a mark stands beside the
 * writing and breaks the run, so the sounds either side of it pair among
 * themselves. We pair the non-punctuation tokens two at a time, which is
 * what render does within each run and therefore what the DOM shows.
 */
function cqBlocks(ipa) {
  const out = [];
  const run = [];
  for (const tok of ipa) {
    if (CQ_PUNCT.has(cqBase(tok))) continue;
    run.push(tok);
  }
  for (let i = 0; i < run.length; i += 2) {
    out.push([run[i], run[i + 1] === undefined ? "∅" : run[i + 1]]);
  }
  return out;
}

/** Does a block of two tokens have the shape a `@context` asks for? */
function cqShapeMatches(context, block) {
  if (!context || context === "any") return true;
  const a = cqClass(block[0]), b = cqClass(block[1]);
  switch (context) {
    case "cc":   return a === "C" && b === "C";
    case "cv":   return a === "C" && b === "V";
    case "vc":   return a === "V" && b === "C";
    case "vv":   return a === "V" && b === "V";
    case "null": return a === "N" || b === "N";
    default:     return true;
  }
}

/**
 * Parse the one-line query into `{ phoneme, slot, context }`, or an
 * `{ error }` naming what is wrong. `normalise` turns a readable code
 * into its IPA symbol; the page passes `normaliseSound`, tests can too,
 * and the default identity is right for raw-IPA input.
 *
 * An empty string is not an error — it is "no structural filter", which
 * is how the page falls back to the plain word list.
 */
function parseQuery(str, normalise) {
  const norm = typeof normalise === "function"
    ? normalise
    : (typeof normaliseSound === "function" ? normaliseSound : (x) => x);

  const raw = String(str || "").trim();
  if (!raw) return { empty: true, phoneme: null, slot: null, context: null };

  let slot = null, context = null;
  const parts = raw.split(/\s+/);
  let phoneme = null;

  for (let piece of parts) {
    if (!piece) continue;

    // A trailing @context can be glued to the phoneme ("g@cc") or stand
    // on its own ("g @cc"); split it off wherever it sits.
    const at = piece.indexOf("@");
    if (at >= 0) {
      const ctx = piece.slice(at + 1).toLowerCase();
      if (!CQ_CONTEXTS.includes(ctx)) {
        return { error: `unknown context "@${ctx}" — try @cc @cv @vc @vv @null` };
      }
      if (context) return { error: "only one @context per query" };
      context = ctx === "any" ? null : ctx;
      piece = piece.slice(0, at);
      if (!piece) continue;               // the @context stood alone
    }

    // A leading slot: prefix ("top:g", "b:s").
    const colon = piece.indexOf(":");
    if (colon >= 0) {
      const s = piece.slice(0, colon).toLowerCase();
      const map = { top: "top", t: "top", bottom: "bottom", b: "bottom" };
      if (!map[s]) return { error: `unknown slot "${s}:" — try top: or bottom:` };
      if (slot) return { error: "only one slot per query" };
      slot = map[s];
      piece = piece.slice(colon + 1);
      if (!piece) continue;               // "top:" with the phoneme still to come
    }

    if (phoneme) return { error: "one phoneme per query in this version" };
    phoneme = cqBase(norm(piece));
  }

  if (!phoneme) return { error: "name a phoneme to search for, e.g. g or sh" };
  return { phoneme, slot, context };
}

/**
 * Run a parsed query against one word's stored `ipa`.
 *
 * Returns `{ matched, hits }` where each hit is the `{ block, slot }` of
 * a slot that satisfied every constraint — the page highlights those
 * blocks. A query with only a `context` (no phoneme) never reaches here;
 * `parseQuery` requires a phoneme.
 */
function matchWord(ipa, q) {
  if (!q || q.empty) return { matched: true, hits: [] };
  if (q.error || !q.phoneme) return { matched: false, hits: [] };

  const blocks = cqBlocks(ipa || []);
  const hits = [];
  blocks.forEach((block, bi) => {
    if (!cqShapeMatches(q.context, block)) return;
    for (const [pos, name] of [[0, "top"], [1, "bottom"]]) {
      if (q.slot && q.slot !== name) continue;
      if (cqBase(block[pos]) === q.phoneme) hits.push({ block: bi, slot: name });
    }
  });
  return { matched: hits.length > 0, hits };
}

/**
 * The builder's state -> the canonical query string, so the two stay in
 * step: the dropdowns write this, the text box shows it, and editing the
 * text box parses back to the same state. Empty phoneme -> empty string
 * (no filter).
 */
function buildQuery({ phoneme, slot, context } = {}) {
  if (!phoneme) return "";
  let head = phoneme;
  if (slot === "top" || slot === "bottom") head = slot + ":" + phoneme;
  if (context && context !== "any") return head + " @" + context;
  return head;
}

if (typeof module !== "undefined") {
  module.exports = {
    parseQuery, matchWord, buildQuery,
    cqBase, cqClass, cqBlocks, cqShapeMatches,
    CQ_VOWELS, CQ_NULLS, CQ_CONTEXTS,
  };
}
