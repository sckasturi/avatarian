/**
 * The sounds syntax — the one surface three tools have to agree on.
 *
 * `site/js/sounds.js` is parsed by the main page, the glyph designer's
 * live preview and the transcription workbench. A change here that looks
 * harmless on the page can silently change what a corpus entry means, so
 * the round trip is the thing worth pinning.
 *
 * Most of these cases are not invented: they are the specific inputs that
 * broke earlier versions, recorded in the comments in sounds.js. A test
 * suite written after the fact is most useful when it remembers the bugs.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSite, entries, plain } = require("./harness.js");

const ctx = loadSite();
const {
  normaliseSound, soundToCode, splitOverride, splitCaption,
  soundTextToWords, wordsToSoundText,
} = ctx;

// ---------------------------------------------------------------------
// Codes in, symbols out
// ---------------------------------------------------------------------

test("ARPAbet, IPA and the stand-ins all reach the same symbol", () => {
  assert.equal(normaliseSound("AA"), "ɑ");
  assert.equal(normaliseSound("aa"), "ɑ", "codes are case-insensitive");
  assert.equal(normaliseSound("ɑ"), "ɑ", "IPA passes through");
  assert.equal(normaliseSound("AX"), "ə", "schwa has no ARPAbet code of its own");
  assert.equal(normaliseSound("0"), "∅");
  assert.equal(normaliseSound("_"), "∅");
  assert.equal(normaliseSound("-"), "∅");
});

test("AH is STRUT and AA is PALM — the trap in item 29", () => {
  // The code that looks like "ah" is not the "ah" sound. This is not
  // hypothetical: `K AH T AA R AH` sat in the site's own help text and
  // in AVATARIAN.md as the spelling of "Katara" until session 9, and it
  // gives /k ʌ t ɑ r ʌ/. Pinning it here means the next person to
  // "correct" the example has to argue with a test.
  assert.equal(normaliseSound("AH"), "ʌ");
  assert.equal(normaliseSound("AA"), "ɑ");
  assert.equal(normaliseSound("AX"), "ə");
  assert.deepEqual(
    plain(soundTextToWords("K AX T AA R AX")[0].ipa),
    ["k", "ə", "t", "ɑ", "r", "ə"],
    "K AX T AA R AX is Katara");
});

test("an orientation override rides on the sound", () => {
  assert.deepEqual(plain(splitOverride("S$")), { body: "S", suffix: "$" });
  assert.deepEqual(plain(splitOverride("S")), { body: "S", suffix: "" });
  assert.equal(normaliseSound("S$"), "s$");
  assert.equal(normaliseSound("S%"), "s%");
});

test("an override survives the trip back to codes", () => {
  // `s%` is not a key in IPA_TO_CODE, so looking the whole token up
  // wrote raw IPA into a box that otherwise speaks ARPAbet. Nothing
  // produced an override upstream until the corpus did, which is why
  // this sat unnoticed.
  assert.equal(soundToCode("s%"), "S%");
  assert.equal(soundToCode("s$"), "S$");
  assert.equal(soundToCode("ɑ"), "AA");
  assert.equal(soundToCode("∅"), "0");
});

// ---------------------------------------------------------------------
// Captions
// ---------------------------------------------------------------------

test("a bracket never reaches the tokeniser", () => {
  // Four inputs that used to put a bracket character through as an
  // unknown sound, or silently drop a caption.
  for (const [input, expected] of [
    ["T (unclosed", { body: "T ", label: "unclosed" }],
    ["T (outer (inner))", { body: "T ", label: "outer (inner)" }],
    ["T )stray(", { body: "T stray", label: "" }],
    ["T (one) (two)", { body: "T  ", label: "one two" }],
  ]) {
    const got = plain(splitCaption(input));
    assert.equal(got.label, expected.label, `label of: ${input}`);
    assert.ok(!/[()]/.test(got.body), `a bracket got through: ${input}`);
  }
});

test("a caption written once spreads backwards, one word per group", () => {
  const words = soundTextToWords("HH AE M ER R / AH V / TH AO R (hammer of thor)");
  assert.deepEqual(plain(words.map(w => w.word)), ["hammer", "of", "thor"]);
});

test("a multi-word name in one group stays whole", () => {
  // The leftovers pile onto the earliest group reached, which is what
  // keeps this working with no special case.
  const words = soundTextToWords("M AW N T B AY HH UW (mount baihu)");
  assert.deepEqual(plain(words.map(w => w.word)), ["mount baihu"]);
});

test("spreading won't clobber a group that has its own caption", () => {
  const words = soundTextToWords("K AH T (katara) / P L IY Z (say please)");
  assert.equal(words[0].word, "katara", "katara must not be relabelled");
});

// ---------------------------------------------------------------------
// The round trip
// ---------------------------------------------------------------------

test("every attested spelling survives box -> parse -> box", () => {
  // A corpus entry is meant to be a line you could paste into the site.
  // If serialising and reparsing changed it, the workbench would be
  // editing something other than what it saves.
  for (const entry of entries(ctx)) {
    const text = wordsToSoundText([{ word: entry.key, ipa: entry.ipa }]);
    const back = soundTextToWords(text);
    assert.equal(back.length, 1, `${entry.key} split into ${back.length} groups`);
    assert.deepEqual(plain(back[0].ipa), plain(entry.ipa),
      `${entry.key} changed: ${text}`);
  }
});

test("the parser is tolerant of the mess a correction surface collects", () => {
  // This is an editing box, not a compiler. Stray slashes, runs of
  // spaces and a half-typed bracket shouldn't cost you the render.
  for (const input of ["", "   ", "/", "//  //", "T   AA", "T (", ")", "$", "%"]) {
    assert.doesNotThrow(() => soundTextToWords(input), `threw on: ${JSON.stringify(input)}`);
  }
});

test("an unknown code is passed through rather than dropped", () => {
  // Dropping it would silently shorten the word; the page names it in a
  // warning instead.
  const words = soundTextToWords("T QQQ AA");
  assert.equal(words[0].ipa.length, 3);
  assert.ok(words[0].ipa.includes("QQQ"));
});
