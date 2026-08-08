/**
 * The block model, checked against real evidence.
 *
 * These are the structural claims the whole script rests on, and the
 * cases are attested spellings rather than invented ones — so a change
 * to pairing, nulls or heights is checked against every word anybody has
 * actually seen written, at once. That is what `CORPUS.md` §4 means by
 * the corpus being a research instrument and not just an accuracy patch.
 *
 * The 9-row test does something a normal test doesn't: it **reports the
 * C-C blocks rather than failing on them**. C-C is the one piece of the
 * model that is genuinely unresolved (TODO B1), so a red test there would
 * be asserting an answer nobody has. Instead it prints every attested C-C
 * block, which is exactly the inventory B1 says it needs.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSite, entries, plain, show, showBlocks } = require("./harness.js");

const ctx = loadSite();
const { pairUp, resolveBlocks, slotRows, nullFor, NULL_IPA, NULL_C_IPA } = ctx;

// ---------------------------------------------------------------------
// Pairing
// ---------------------------------------------------------------------

test("pairUp takes two symbols at a time, in order", () => {
  assert.deepEqual(plain(pairUp(["p", "l", "i", "z"])),
    [{ top: "p", bottom: "l" }, { top: "i", bottom: "z" }]);
});

test("an odd count leaves the last bottom slot empty", () => {
  assert.deepEqual(plain(pairUp(["n", "ɑ", "t"]).at(-1)), { top: "t", bottom: null });
});

test("pairing an even list is the exact inverse of flattening it", () => {
  // This is the property the corpus format depends on: a finished
  // spelling is stored flat, and pairing has to give the blocks back
  // unchanged. If it ever stopped being true, every entry would need a
  // second render path — which is what CORPUS.md originally assumed.
  for (const entry of entries(ctx)) {
    if (entry.ipa.length % 2) continue;
    const flat = pairUp(entry.ipa).flatMap(b => [b.top, b.bottom]);
    assert.deepEqual(plain(flat), plain(entry.ipa),
      `${entry.key} did not survive pairing`);
  }
});

// ---------------------------------------------------------------------
// Nulls
// ---------------------------------------------------------------------

test("a null takes its height from its pairing partner, not its slot", () => {
  // Confirmed from a reference sample, and the reason a block stays nine
  // rows whatever is in it: 4+5 for a vowel and its null, 5+4 for a
  // consonant and its null.
  assert.equal(nullFor("ɑ"), NULL_C_IPA, "a vowel takes the TALL null");
  assert.equal(nullFor("p"), NULL_IPA, "a consonant takes the SHORT null");
});

test("a null with nothing to pair against stays short", () => {
  assert.equal(nullFor(null), NULL_IPA);
  assert.equal(nullFor(undefined), NULL_IPA);
  assert.equal(nullFor(NULL_IPA), NULL_IPA);
});

test("an orientation override doesn't change what a sound IS", () => {
  // `ɑ$` is still a vowel, so the null beside it is still the tall one.
  assert.equal(nullFor("ɑ$"), NULL_C_IPA);
  assert.equal(nullFor("s%"), NULL_IPA);
});

test("a typed null is resolved by its neighbour, not taken literally", () => {
  // `0` means "a null" — mid-word too, where canon puts nulls the
  // renderer cannot derive. Both of these come from attested spellings.
  const students = resolveBlocks(["s%", "t", "u", "∅", "d", "ə", "n", "t", "s$", "∅"]);
  assert.equal(students[1].bottom, NULL_C_IPA, "(u,∅) takes the tall null");
  assert.equal(students[4].bottom, NULL_IPA, "(s,∅) takes the short null");
});

test("an empty trailing slot gets a null written into it", () => {
  // The null is part of the spelling; dropping it would silently
  // shorten the word.
  const blocks = resolveBlocks(["n", "ɑ", "t"]);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[1].bottom, NULL_IPA, "(t,_) fills with the short null");
});

// ---------------------------------------------------------------------
// appa — the spelling that cannot be derived
// ---------------------------------------------------------------------

test("appa is three blocks, tall-short-tall", () => {
  // Canon writes three blocks where pairing predicts two. The heights
  // are the prediction TODO B3 is a straight look at the art against:
  // ɑ is a vowel so its null is tall, p is a consonant so its null is
  // short. If the art disagrees, this test is where it shows.
  const appa = entries(ctx).find(e => e.key === "appa");
  assert.ok(appa, "appa should be in the corpus");

  const blocks = resolveBlocks(appa.ipa);
  assert.equal(blocks.length, 3, `got ${showBlocks(blocks)}`);
  assert.deepEqual(plain(blocks.map(b => b.bottom)),
    [NULL_C_IPA, NULL_IPA, NULL_C_IPA],
    "expected tall, short, tall");
});

// ---------------------------------------------------------------------
// The nine-row invariant
// ---------------------------------------------------------------------

test("consonant slots are 5 rows and vowel slots 4", () => {
  assert.equal(slotRows("p"), 5);
  assert.equal(slotRows("ɑ"), 4);
  assert.equal(slotRows(NULL_C_IPA), 5, "the tall null is consonant-height");
  assert.equal(slotRows(NULL_IPA), 4, "the short null is vowel-height");
  assert.equal(slotRows("s%"), 5, "an override doesn't change the height");
});

test("every attested block is nine rows — except C-C, which is open", (t) => {
  // A block is 9 rows: 5 + 4 or 4 + 5. Two consonants would be 10, which
  // is precisely the unresolved question (B1) — session 5's guess was
  // that they overlap by a shared row. So C-C is collected and reported
  // rather than failed on: asserting either answer here would be
  // inventing one.
  const cc = [];
  const vv = [];

  for (const entry of entries(ctx)) {
    for (const block of resolveBlocks(entry.ipa)) {
      const rows = slotRows(block.top) + slotRows(block.bottom);
      const where = `${entry.key}: (${block.top},${block.bottom})`;
      if (rows === 10) { cc.push(where); continue; }
      if (rows === 8) { vv.push(where); continue; }
      assert.equal(rows, 9, `${where} is ${rows} rows, expected 9`);
    }
  }

  // "Only three block types occur: V-C, C-V, C-C. V-V never happens — a
  // null substitutes for the missing second vowel." A V-V block in
  // attested material would contradict that outright, so it fails.
  assert.deepEqual(plain(vv), [],
    "V-V blocks found; the model says a null substitutes instead");

  t.diagnostic(`${cc.length} attested C-C blocks (TODO B1 — unresolved):`);
  for (const block of cc) t.diagnostic(`  ${block}`);
});

test("every corpus entry has an even symbol count", () => {
  // A spelling is whole blocks. An odd count means somebody recorded a
  // phoneme list instead — the one mistake that would quietly poison the
  // data. build_corpus.py rejects it; this catches a hand-edited
  // corpus.js that skipped the builder.
  for (const entry of entries(ctx)) {
    assert.equal(entry.ipa.length % 2, 0,
      `${entry.key} has ${entry.ipa.length} symbols: ${show(entry.ipa)}`);
  }
});

test("every symbol in the corpus has a glyph", () => {
  const glyphs = ctx.window.AVATARIAN_GLYPHS || {};
  for (const entry of entries(ctx)) {
    for (const token of entry.ipa) {
      const sym = ctx.parseSymbol(token).sym;
      assert.ok(glyphs[sym], `${entry.key}: no glyph for '${sym}'`);
    }
  }
});
