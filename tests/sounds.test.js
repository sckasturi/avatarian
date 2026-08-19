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
  // wrote raw IPA into a box that otherwise speaks codes. Nothing
  // produced an override upstream until the corpus did, which is why
  // this sat unnoticed.
  assert.equal(soundToCode("s%"), "s%");
  assert.equal(soundToCode("s$"), "s$");
  assert.equal(soundToCode("ɑ"), "ah");
  assert.equal(soundToCode("∅"), "0");
});

// ---------------------------------------------------------------------
// The readable scheme (item 29)
// ---------------------------------------------------------------------

test("the readable codes read the way they look", () => {
  const say = (text) => soundTextToWords(text)[0].ipa.join(" ");
  assert.equal(say("k uh t ah r uh"), "k ə t ɑ r ə", "katara");
  assert.equal(say("ah p ah"), "ɑ p ɑ", "appa");
  assert.equal(say("p l ee z"), "p l i z", "please");
  assert.equal(say("th aw t"), "θ ɔ t", "thought");
  assert.equal(say("m ow th"), "m aʊ θ", "mouth");
  assert.equal(say("p r eye s"), "p r aɪ s", "price");
  assert.equal(say("f uu t"), "f ʊ t", "foot");
  assert.equal(say("v i zh uh n"), "v ɪ ʒ ə n", "vision");
});

test("CAPITALS still mean ARPAbet, so old documents keep working", () => {
  const say = (text) => soundTextToWords(text)[0].ipa.join(" ");
  assert.equal(say("K AX T AA R AX"), "k ə t ɑ r ə");
  assert.equal(say("HH EH L OW"), "h ɛ l oʊ");
  assert.equal(say("AA 0 P 0 AA 0"), "ɑ ∅ p ∅ ɑ ∅");
});

test("case decides for the four codes that collide, and only those", () => {
  // These are the whole reason case is significant. Everything else is
  // case-insensitive, so the split is invisible unless you hit one.
  for (const [lower, readable, upper, arpabet] of [
    ["ah", "ɑ", "AH", "ʌ"],
    ["uh", "ə", "UH", "ʊ"],
    ["ow", "aʊ", "OW", "oʊ"],
    ["aw", "ɔ", "AW", "aʊ"],
  ]) {
    assert.equal(normaliseSound(lower), readable, `${lower} should be ${readable}`);
    assert.equal(normaliseSound(upper), arpabet, `${upper} should be ${arpabet}`);
  }
});

test("everything that doesn't collide stays case-insensitive", () => {
  for (const [a, b] of [["ee", "EE"], ["b", "B"], ["ng", "NG"], ["sh", "SH"],
                        ["eye", "EYE"], ["oy", "OY"], ["er", "ER"]]) {
    assert.equal(normaliseSound(a), normaliseSound(b), `${a} vs ${b}`);
  }
  // ARPAbet codes with no readable twin work lowercase too — there is no
  // reason to make somebody shout `IY`.
  assert.equal(normaliseSound("iy"), "i");
  assert.equal(normaliseSound("hh"), "h");
  assert.equal(normaliseSound("jh"), "dʒ");
});

test("every glyph has a readable code, and it round-trips", (t) => {
  const glyphs = ctx.window.AVATARIAN_GLYPHS || {};
  for (const ipa of Object.keys(glyphs)) {
    // ∅c is the one symbol with no code, ON PURPOSE and now settled.
    // `0` means "a null" and the renderer picks the height from the
    // pairing partner. CORPUS.md §2 held off on inventing `0c` until the
    // art had been checked; B3 confirmed in session 10 that `appa` is
    // written with mixed null heights exactly as the rule predicts, so
    // `0` plus the partner says everything a code could say.
    if (ipa === "∅c") continue;
    // Punctuation (mark_full) glyphs — , . ? ! — are drawn like every
    // other glyph and ship through the manifest so the designer can edit
    // them, but they are typed as THEMSELVES, not via a phoneme code, so
    // they have no entry in IPA_TO_CODE and none is wanted.
    if (glyphs[ipa].type === "mark_full") continue;
    const code = ctx.IPA_TO_CODE[ipa];
    assert.ok(code, `no code for ${ipa}`);
    assert.equal(normaliseSound(code), ipa,
      `${ipa} displays as '${code}', which reads back as something else`);
  }
  t.diagnostic("∅c and the punctuation marks have no typeable code — by design");
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
