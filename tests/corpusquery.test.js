/**
 * Structural corpus search — the query language and the matcher.
 *
 * These pin the two things that are easy to get subtly wrong: the parse
 * of the compact `[slot:]phoneme [@context]` string, and the block-shape
 * classification the matcher decides `@cc`/`@cv`/… on. The end-to-end
 * cases run against the real corpus so a change to the data or the block
 * model that breaks the search shows up here, not on the page.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSite, corpus, plain } = require("./harness.js");

const ctx = loadSite();
const { parseQuery, matchWord, buildQuery, cqBlocks, cqClass, cqShapeMatches } = ctx;
const WORDS = corpus(ctx).words;

// A convenience: which corpus keys match this query string.
function found(str) {
  const q = plain(parseQuery(str, ctx.normaliseSound));
  assert.ok(!q.error, `query "${str}" should parse: ${q.error || ""}`);
  return Object.keys(WORDS)
    .filter((k) => matchWord(WORDS[k].ipa, q).matched)
    .sort();
}

// ---------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------

test("a bare phoneme parses to just that phoneme", () => {
  assert.deepEqual(plain(parseQuery("g")), { phoneme: "g", slot: null, context: null });
});

test("a readable code is normalised to its IPA symbol", () => {
  assert.equal(parseQuery("sh", ctx.normaliseSound).phoneme, "ʃ");
  assert.equal(parseQuery("ng", ctx.normaliseSound).phoneme, "ŋ");
  // The whole point of "g but not ng": they are different symbols, so a
  // search for g never returns ŋ and vice versa.
  assert.notEqual(parseQuery("g").phoneme, parseQuery("ng", ctx.normaliseSound).phoneme);
});

test("slot and context attach however they are written", () => {
  assert.deepEqual(plain(parseQuery("g @cc")), { phoneme: "g", slot: null, context: "cc" });
  assert.deepEqual(plain(parseQuery("g@cc")),  { phoneme: "g", slot: null, context: "cc" });
  assert.deepEqual(plain(parseQuery("top:s @cv")), { phoneme: "s", slot: "top", context: "cv" });
  assert.deepEqual(plain(parseQuery("b:t")), { phoneme: "t", slot: "bottom", context: null });
  assert.equal(parseQuery("g @any").context, null, "@any is 'no shape filter'");
});

test("an empty query is 'no filter', not an error", () => {
  assert.equal(parseQuery("").empty, true);
  assert.equal(parseQuery("   ").empty, true);
});

test("nonsense is reported, not silently matched", () => {
  assert.ok(parseQuery("@cc").error, "a context with no phoneme");
  assert.ok(parseQuery("g @zz").error, "an unknown context");
  assert.ok(parseQuery("side:g").error, "an unknown slot");
  assert.ok(parseQuery("g s").error, "two phonemes (out of scope in v1)");
});

// ---------------------------------------------------------------------
// Block classification
// ---------------------------------------------------------------------

test("block shape reads off the two symbols", () => {
  assert.equal(cqClass("g"), "C");
  assert.equal(cqClass("ə"), "V");
  assert.equal(cqClass("∅"), "N");
  assert.equal(cqClass("s%"), "C", "an override suffix is stripped first");
  assert.equal(cqClass("r_c"), "C", "a cluster-form suffix is stripped first");

  assert.ok(cqShapeMatches("cc", ["g", "l"]));
  assert.ok(!cqShapeMatches("cc", ["g", "∅"]), "C + null is not C-C");
  assert.ok(cqShapeMatches("null", ["g", "∅"]));
  assert.ok(cqShapeMatches("cv", ["k", "ə"]));
  assert.ok(cqShapeMatches("vc", ["ə", "k"]));
  assert.ok(cqShapeMatches("vv", ["aɪ", "ə"]));
});

test("blocks pair in the drawn order, skipping punctuation", () => {
  assert.deepEqual(plain(cqBlocks(["b", "ɪ", "g", "∅"])), [["b", "ɪ"], ["g", "∅"]]);
  assert.deepEqual(plain(cqBlocks(["h", "aɪ", ",", "θ", "ɔ"])), [["h", "aɪ"], ["θ", "ɔ"]]);
});

// ---------------------------------------------------------------------
// Matching, against the real corpus
// ---------------------------------------------------------------------

test("the motivating query: /g/ in a C-C block", () => {
  // g paired with another consonant — not g beside a null, not /ŋ/.
  const hits = found("g @cc");
  assert.ok(hits.includes("gluten"), "gluten has g·l");
  assert.ok(hits.includes("language"), "language has a g in a C-C block");
  // "big" is /b ɪ g ∅/ — its g sits with a null, so C-C must exclude it.
  assert.ok(!hits.includes("big"), "big's g is beside a null, not a consonant");
});

test("a bare phoneme finds it in any block", () => {
  const anyG = found("g");
  assert.ok(anyG.includes("big"), "big contains g somewhere");
  assert.ok(anyG.length >= found("g @cc").length, "any-block is a superset of C-C");
});

test("slot pins where in the block the phoneme sits", () => {
  const q = plain(parseQuery("top:g"));
  // Every hit must be a g in a TOP slot.
  for (const k of Object.keys(WORDS)) {
    for (const h of matchWord(WORDS[k].ipa, q).hits) {
      assert.equal(h.slot, "top", `${k}: a top:g hit should be a top slot`);
    }
  }
});

test("hits report the block index the page will highlight", () => {
  // big = (b,ɪ)(g,∅): the g is block 1, top slot.
  const r = matchWord(["b", "ɪ", "g", "∅"], plain(parseQuery("g")));
  assert.deepEqual(plain(r.hits), [{ block: 1, slot: "top" }]);
});

// ---------------------------------------------------------------------
// Round trip: builder state <-> query string
// ---------------------------------------------------------------------

test("buildQuery is the inverse of parseQuery", () => {
  for (const s of ["g", "g @cc", "top:s @cv", "bottom:t", "aɪ @vv"]) {
    assert.equal(buildQuery(plain(parseQuery(s, ctx.normaliseSound))), s,
      `"${s}" should round-trip`);
  }
  assert.equal(buildQuery({}), "", "no phoneme is the empty query");
});
