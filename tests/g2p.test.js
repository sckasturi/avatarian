/**
 * The lookup chain, and the order it has to stay in.
 *
 *   corpus      attested — somebody has SEEN this written
 *   EXCEPTIONS  hand readings, all provisional
 *   lexicon     CMU, ~126k words
 *   RULES       letter-to-sound guesser
 *
 * Order is the whole feature. If the corpus ever stopped winning, `appa`
 * would quietly go back to two blocks and `toph` back to rhyming with
 * "loaf" — both of which are wrong, and neither of which looks wrong on
 * screen unless you know the word.
 *
 * Loads the real 1.6 MB dictionary, because a test that asserts the
 * lexicon layer against a stub is asserting the stub.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSite, entries, plain } = require("./harness.js");

const ctx = loadSite({ lexicon: true });
const { lookupWord, derivedLookup, wordToIPA, sentenceToIPA, normaliseWord,
        EXCEPTIONS, hasLexicon } = ctx;

test("the bundled dictionary actually loaded", () => {
  // Every "derived" assertion below is worthless if it didn't.
  assert.ok(hasLexicon(), "js/lexicon.js did not load");
});

// ---------------------------------------------------------------------
// Order
// ---------------------------------------------------------------------

test("the corpus wins over everything below it", () => {
  for (const entry of entries(ctx)) {
    const got = lookupWord(entry.key);
    assert.equal(got.tier, "attested", `${entry.key} was answered by ${got.tier}`);
    assert.deepEqual(plain(got.ipa), plain(entry.ipa),
      `${entry.key} did not come back as recorded`);
  }
});

test("appa keeps its three-block spelling through the chain", () => {
  // The one entry that cannot be expressed as a phoneme list, so the one
  // that proves the corpus is being consulted rather than approximated.
  assert.deepEqual(plain(wordToIPA("appa")), ["ɑ", "∅", "p", "∅", "ɑ", "∅"]);
});

test("EXCEPTIONS wins over the dictionary", () => {
  // "katara" is in EXCEPTIONS and not in CMU, and "of" is in both — the
  // hand reading has to win for the Avatar vocabulary to mean anything.
  const katara = lookupWord("katara");
  assert.equal(katara.tier, "derived");
  assert.deepEqual(plain(katara.ipa), ["k", "ə", "t", "ɑ", "r", "ə"]);
  assert.deepEqual(plain(wordToIPA("of")), plain(EXCEPTIONS["of"].split(" ")));
});

test("the dictionary wins over the rules", () => {
  // The rules alone gave /θ æ t/ for "that" and /g u d/ for "good".
  assert.equal(lookupWord("that").tier, "derived");
  assert.deepEqual(plain(wordToIPA("that")), ["ð", "æ", "t"]);
  assert.deepEqual(plain(wordToIPA("good")), ["g", "ʊ", "d"]);
});

test("a word nothing knows falls through to the rules", () => {
  const got = lookupWord("zzblrf");
  assert.equal(got.tier, "guessed");
  assert.ok(got.ipa.length, "the rules should still produce something");
});

test("the chain never throws, whatever it is handed", () => {
  for (const input of ["", "   ", "!!!", "123", "don't", "ÜBER", "a".repeat(200)]) {
    assert.doesNotThrow(() => wordToIPA(input), `threw on: ${JSON.stringify(input)}`);
  }
});

// ---------------------------------------------------------------------
// Tiers
// ---------------------------------------------------------------------

test("the tier says which layer answered", () => {
  assert.equal(lookupWord("appa").tier, "attested");
  assert.equal(lookupWord("katara").tier, "derived");
  assert.equal(lookupWord("that").tier, "derived");
  assert.equal(lookupWord("zzblrf").tier, "guessed");
});

test("an attested answer carries its source and confidence", () => {
  // This is item 21's plumbing. Nothing displays it yet, but the page
  // cannot show what the lookup doesn't return.
  const got = lookupWord("appa");
  assert.ok(got.entry, "no entry attached");
  assert.equal(got.entry.source, "appa-art");
  assert.equal(got.entry.confidence, "certain");
});

test("sentenceToIPA carries the tier onto every word", () => {
  const words = sentenceToIPA("appa katara zzblrf");
  assert.deepEqual(plain(words.map(w => w.tier)),
    ["attested", "derived", "guessed"]);
});

// ---------------------------------------------------------------------
// derivedLookup — the model, not consulted about its own answer
// ---------------------------------------------------------------------

test("derivedLookup skips the corpus", () => {
  // The workbench shows canon beside the prediction. If this returned
  // the corpus entry, the comparison would be a word against itself and
  // would always agree.
  const derived = derivedLookup("appa");
  assert.notDeepEqual(plain(derived.ipa), plain(wordToIPA("appa")));
  assert.ok(!derived.ipa.includes("∅"), "a derived reading has no nulls in it");
});

test("derivedLookup still uses everything below the corpus", () => {
  assert.deepEqual(plain(derivedLookup("katara").ipa),
    plain(EXCEPTIONS["katara"].split(" ")));
  assert.equal(derivedLookup("that").tier, "derived");
  assert.equal(derivedLookup("zzblrf").tier, "guessed");
});

// ---------------------------------------------------------------------
// Keys
// ---------------------------------------------------------------------

test("lookup keys are normalised the way the corpus builder normalises", () => {
  // If these two ever disagreed, an entry could be unreachable — present
  // in the file and never matched.
  assert.equal(normaliseWord("Appa"), "appa");
  assert.equal(normaliseWord("APPA!"), "appa");
  assert.equal(normaliseWord("don't"), "don't");
  assert.equal(normaliseWord("  "), "");
  for (const entry of entries(ctx)) {
    assert.equal(normaliseWord(entry.key.split(" ")[0]), entry.key.split(" ")[0],
      `${entry.key} is stored in a form its own lookup would not find`);
  }
});

test("case and punctuation don't lose an attested word", () => {
  assert.equal(lookupWord("Appa").tier, "attested");
  assert.equal(lookupWord("APPA").tier, "attested");
  assert.equal(lookupWord("appa,").tier, "attested");
});

// ---------------------------------------------------------------------
// Phrases
// ---------------------------------------------------------------------

test("without a phrase entry, three words stay three words", () => {
  assert.equal(sentenceToIPA("be at me").length, 3);
});

test("a phrase entry beats spelling its words separately", (t) => {
  // "Ba Sing Se" is the case this is for: if a name turns out to be
  // written as a unit, its blocks are not the ones you get by running
  // three spellings together. No phrase entry exists yet, so this builds
  // one in a fresh context — the scan is machinery that has to work the
  // first time it is needed, not the first time it is noticed.
  const phrase = loadSite({
    extraWords: {
      "be at me": { ipa: ["b", "i", "æ", "t", "m", "i"],
                    source: "test", confidence: "certain" },
    },
  });

  const got = phrase.sentenceToIPA("be at me");
  assert.equal(got.length, 1, "the phrase should be taken as one unit");
  assert.equal(got[0].word, "be at me");
  assert.equal(got[0].tier, "attested");
  assert.deepEqual(plain(got[0].ipa), ["b", "i", "æ", "t", "m", "i"]);

  // Longest-first: the phrase wins even though every word in it is also
  // an entry in its own right.
  const mixed = phrase.sentenceToIPA("do be at me");
  assert.deepEqual(plain(mixed.map(w => w.word)), ["do", "be at me"]);

  t.diagnostic("no phrase entries in the corpus yet; machinery covered");
});
