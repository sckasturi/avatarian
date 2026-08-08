/**
 * Fuzzy reverse-decode — sounds in, likely English words out.
 *
 * The property that matters for the workbench: **transcribe an attested
 * word and it should come back top of the list.** That is the whole
 * interaction — you read glyphs off an image, and the tool tells you
 * which word they spell. If it stops being reliable, the workbench
 * quietly starts suggesting the wrong English for things going into the
 * corpus, which is the worst failure this project has available.
 *
 * Loads the real dictionary. A stub would make the ranking meaningless,
 * since the whole question is whether the right word beats 126k others.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSite, entries, plain } = require("./harness.js");

const ctx = loadSite({ lexicon: true, reverse: true });
const { suggestWords, soundsOnly, editDistance } = ctx;

// ---------------------------------------------------------------------
// Stripping
// ---------------------------------------------------------------------

test("nulls and overrides come off before matching", () => {
  // No pronunciation dictionary has an entry with a null in it, and `s%`
  // is still /s/. This is exactly the information the corpus keeps and
  // the dictionary throws away.
  assert.deepEqual(plain(soundsOnly(["ɑ", "∅", "p", "∅", "ɑ", "∅"])), ["ɑ", "p", "ɑ"]);
  assert.deepEqual(plain(soundsOnly(["s%", "t", "s$", "∅c"])), ["s", "t", "s"]);
  assert.deepEqual(plain(soundsOnly([])), []);
});

// ---------------------------------------------------------------------
// Edit distance
// ---------------------------------------------------------------------

test("edit distance counts substitutions, insertions and deletions", () => {
  assert.equal(editDistance("abc", "abc", 3), 0);
  assert.equal(editDistance("abc", "abd", 3), 1);
  assert.equal(editDistance("abc", "ab", 3), 1);
  assert.equal(editDistance("abc", "abcd", 3), 1);
});

test("edit distance abandons past the cap rather than counting on", () => {
  // The cutoff is where nearly all the search time is saved, so a change
  // that broke it would be slow rather than wrong — and slow is the
  // failure this had to be fixed for once already.
  assert.ok(editDistance("abcdef", "zzzzzz", 2) > 2);
  assert.ok(editDistance("a", "abcdefgh", 2) > 2, "length gap alone should bail");
});

test("the scratch rows are reused without corrupting a result", () => {
  // Two shared Int32Arrays back every comparison. If the row swap were
  // wrong, results would depend on what was measured just before.
  const alone = editDistance("please", "pleased", 4);
  editDistance("something", "different", 4);
  editDistance("aaaaa", "bbbbb", 4);
  assert.equal(editDistance("please", "pleased", 4), alone);
});

// ---------------------------------------------------------------------
// The property that matters
// ---------------------------------------------------------------------

test("every attested word is the top suggestion for its own spelling", (t) => {
  const misses = [];
  for (const entry of entries(ctx)) {
    const hits = suggestWords(entry.ipa, 5);
    if (hits[0]?.word !== entry.key) {
      misses.push(`${entry.key} -> ${hits.map(h => h.word).join(", ") || "(nothing)"}`);
    }
  }
  assert.deepEqual(plain(misses), [],
    "an attested word did not rank first for its own spelling");
  t.diagnostic(`${entries(ctx).length}/${entries(ctx).length} attested words rank first`);
});

test("an attested word is marked as coming from the corpus", () => {
  // The workbench uses this to say "already attested" and to skip the
  // row, which is what stops a duplicate entry being built.
  const hits = suggestWords(["f", "æ", "n", "i"], 5);
  assert.equal(hits[0].word, "fanny");
  assert.equal(hits[0].source, "corpus");
  assert.equal(hits[0].distance, 0);
});

test("the Avatar vocabulary is reachable, which CMU alone would not be", () => {
  // CMU has never heard of Katara.
  const hits = suggestWords(["k", "ə", "t", "ɑ", "r", "ə"], 5);
  assert.equal(hits[0].word, "katara");
  assert.equal(hits[0].source, "exceptions");
});

test("a near miss still finds the word", () => {
  // The point of being fuzzy: the dictionary records one pronunciation
  // and canon writes another, and a glyph read off a small image may
  // simply be read wrong. `missing` with the wrong first vowel:
  const hits = suggestWords(["m", "ɛ", "s", "ɪ", "ŋ", "∅"], 8);
  assert.ok(hits.some(h => h.word === "missing"),
    `missing not found; got ${hits.map(h => h.word).join(", ")}`);
});

test("nothing plausible returns nothing rather than noise", () => {
  assert.deepEqual(plain(suggestWords([], 5)), []);
  assert.deepEqual(plain(suggestWords(["∅", "∅"], 5)), []);
});

test("results are ranked best first and respect the limit", () => {
  const hits = suggestWords(["p", "l", "i", "z"], 4);
  assert.ok(hits.length <= 4);
  for (let i = 1; i < hits.length; i++) {
    assert.ok(hits[i - 1].score >= hits[i].score, "scores are not descending");
  }
});

// ---------------------------------------------------------------------
// Speed
// ---------------------------------------------------------------------

test("a query is fast enough to run as you type", (t) => {
  // The first version was 500 ms, which is not usable on a keystroke.
  // Reusing the edit-distance rows and bucketing the lexicon by
  // pronunciation length brought it to well under 100. The bar here is
  // deliberately loose — it is catching a return to the old shape, not
  // policing milliseconds on someone else's machine.
  suggestWords(["f", "æ", "n", "i"], 5);          // warm: builds the index

  const queries = [
    ["f", "æ", "n", "i"], ["k", "ə", "t", "ɑ", "r", "ə"],
    ["m", "ɪ", "s", "ɪ", "ŋ"], ["b", "ɛ", "n", "d", "ɪ", "ŋ"],
    ["p", "l", "i", "z"],
  ];
  const started = Date.now();
  for (let i = 0; i < 20; i++) suggestWords(queries[i % queries.length], 5);
  const each = (Date.now() - started) / 20;

  t.diagnostic(`${each.toFixed(1)} ms per query`);
  assert.ok(each < 250, `${each.toFixed(1)} ms per query — the naive version was ~500`);
});
