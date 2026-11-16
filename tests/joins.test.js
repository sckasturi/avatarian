/**
 * Joins — one glyph's stroke running on to its partner's ink (render.js
 * `joinsFor`, AVATARIAN.md §11).
 *
 * The cases are blocks read off the Reddit dispatches (reddit.1–5), where
 * the art is clean enough to see what touches what: which pairs join, which
 * do not, and how far the stroke runs. The geometry is checked two ways —
 * the particular lengths those blocks need, and a rule that has to hold for
 * every pairing of two drawn glyphs: a join always ends exactly on ink the
 * partner really has, so nothing dangles and nothing stops short.
 *
 * The wiki draws the same joins from the same numbers; that port is guarded
 * by tests/lua_golden.test.js, which serialises `data-join`.
 */

const test = require("node:test");
const assert = require("node:assert/strict");
const { loadSite } = require("./harness.js");

const ctx = loadSite();
const { joinsFor, resolveGlyph } = ctx;
const GLYPHS = ctx.window.AVATARIAN_GLYPHS;

/** Every join a block draws, from either slot. */
const blockJoins = (top, bottom) =>
  [...joinsFor(top, "top", bottom), ...joinsFor(bottom, "bottom", top)];

test("a stemmed vowel reaches the ink its partner has in that column", () => {
  // [top, bottom, word] — all joined in the sources.
  const joined = [
    ["n", "u", "knew"], ["h", "u", "who"], ["ð", "e", "they"], ["h", "ɪ", "him"],
    ["n", "ɑ", "not"], ["dʒ", "e", "jae"], ["m", "e", "may"], ["ɪ", "t", "it"],
    ["ɪ", "z", "is"], ["l", "ʊ", "look"], ["t", "ɑ", "avatar"],
    ["ɪ", "f", "if"], ["ɪ", "n", "daemin"], ["u", "θ", "truth"], ["w", "ɪ", "with"],
    ["v", "ɔɪ", "envoys"], ["v", "z", "receives"],
  ];
  for (const [top, bottom, word] of joined) {
    assert.ok(blockJoins(top, bottom).length, `${word}: ${top}/${bottom} should join`);
  }
});

test("a 3-row vowel keeps its gap, and nothing runs into a null", () => {
  const apart = [
    ["l", "oʊ", "ellora"], ["ɹ", "ə", "ellora"], ["s", "ɛ", "seven"], ["f", "i", "feel"],
    ["ð", "ʌ", "the"], ["æ", "n", "and"], ["ʌ", "s", "trust"], ["æ", "v", "avatar"],
    ["d", "∅", "would"], ["ə", "∅c", "about"], ["z", "∅", "those"],

  ];
  for (const [top, bottom, word] of apart) {
    assert.deepEqual(blockJoins(top, bottom), [], `${word}: ${top}/${bottom} should not join`);
  }
});

test("the stem runs INTO the partner where its ink is not at the seam", () => {
  // /u/ under /n/: the bar sits on the seam, one row from the stem's end.
  assert.equal(joinsFor("u", "bottom", "n")[0].len, 16);
  // /e/ under /ð/: no ink on the seam there — the stem climbs to the arc.
  assert.ok(joinsFor("e", "bottom", "ð")[0].len > 16);
  // /ɑ/ under /f/ would be four rows up to the crossing — too deep. The
  // stem rises a little into the opening and stops, touching nothing
  // (`afar`); asking for the full run by `reach` still gets it.
  const afar = joinsFor("ɑ", "bottom", "f")[0];
  assert.equal(afar.open, true);
  assert.equal(afar.len, 20);
});

test("a stem closes /g/'s mouth, and runs into /b/'s dot", () => {
  // `games`, `garden`: /g/ over a stem is a full square — the join carries
  // the bar that closes the foot, from one loose end to the other.
  const g = joinsFor("e", "bottom", "g")[0];
  assert.equal(g.len, 16);
  assert.equal(g.bar[0], 34);
  assert.equal(g.bar[1], 66);
  // `big`, `books`: the stem REPLACES the dot in /b/'s foot — it runs to
  // where the dot's far edge was, and /b/ leaves the dot out.
  const b = joinsFor("ɪ", "bottom", "b")[0];
  assert.equal(b.dot[0], 66);
  assert.equal(b.dot[1], 82);
  assert.equal(b.len, 32);
  // /s/'s dot is too far to receive, and nothing rises toward it.
  assert.equal(joinsFor("ɪ", "bottom", "s").length, 0);
});

test("`reach` in a block's tweak overrides the rule for that pair", () => {
  const tweaks = ctx.window.AVATARIAN_BLOCK_TWEAKS;
  const saved = JSON.stringify(tweaks);
  const set = (key, reach) => { tweaks[key] = { ...(tweaks[key] || {}), reach }; };
  try {
    // `second` runs through /w/'s bar and on up to its arc. Set here rather
    // than read from the shipped tweaks: those are review data and change.
    set("w|ʊ", "second");
    const second = joinsFor("ʊ", "bottom", "w")[0].len;
    set("w|ʊ", "first");
    const first = joinsFor("ʊ", "bottom", "w")[0].len;
    assert.ok(second > first, "second runs further than first");
    // `open` stops a join short: /e/ under /ð/ touches the arc by default.
    assert.equal(joinsFor("e", "bottom", "ð")[0].open, undefined);
    set("ð|e", "open");
    assert.equal(joinsFor("e", "bottom", "ð")[0].open, true);
    set("w|ʊ", "none");
    assert.deepEqual(blockJoins("w", "ʊ"), []);
    // `first` forces a join the default would not make: into a 3-row vowel.
    assert.deepEqual(blockJoins("æ", "z"), []);
    set("æ|z", "first");
    assert.equal(blockJoins("æ", "z").length, 1);
  } finally {
    for (const k of Object.keys(tweaks)) delete tweaks[k];
    Object.assign(tweaks, JSON.parse(saved));
  }
});

test("every join, in every pairing, ends exactly on the partner's ink", () => {
  const drawn = Object.entries(GLYPHS)
    .filter(([, g]) => !g.type.startsWith("mark") && g.status !== "PLACEHOLDER")
    .map(([ipa]) => ipa);
  const box = (g) => (g.type === "consonant" || g.type === "null_consonant" ? 100 : 80);
  let joins = 0;
  for (const top of drawn) for (const bottom of drawn) {
    for (const [tok, slot, partner] of [[top, "top", bottom], [bottom, "bottom", top]]) {
      for (const j of joinsFor(tok, slot, partner)) {
        joins++;
        assert.ok(j.len > 0, `${top}/${bottom}: a join has length`);
        if (j.open) continue;     // rises into an opening; meant to touch nothing
        if (j.bar || j.dot) continue;   // ends on a mouth it closes, or in a dot
        // Re-derive the far end in block coordinates and look for the
        // partner's ink there, independently of joinsFor's own search.
        const other = slot === "top" ? "bottom" : "top";
        const them = resolveGlyph(partner, other, tok);
        const topH = box(GLYPHS[top]);
        const cc = GLYPHS[top].type === "consonant" && GLYPHS[bottom].type === "consonant";
        const y0 = (s) => (s === "top" ? 0 : topH - (cc ? 36 : 18));
        const H = box(them.entry);
        const threeRow = H === 80 && them.entry.rows !== 4;
        const shift = threeRow && other === "top" && !them.flipped ? -16
                    : threeRow && other === "bottom" && them.flipped ? 16 : 0;
        const end = y0(slot) + j.b;
        const onInk = (them.form.ink[j.x] || []).some(([p, q]) => {
          const u = y0(other) + shift + (them.flipped ? H - p : p);
          const v = y0(other) + shift + (them.flipped ? H - q : q);
          return end >= Math.min(u, v) && end <= Math.max(u, v);
        });
        assert.ok(onInk, `${top}/${bottom}: the join from ${tok} ends on ${partner}'s ink`);
      }
    }
  }
  assert.ok(joins > 100, `expected joins across the grid, found ${joins}`);
});

test("a block can name an alternate drawing for a slot", () => {
  // Stand-ins, so the test does not depend on which alternates are drawn:
  // /k/ gets one called `low`, and `ŋ|k` asks for it in the bottom slot.
  const tweaks = ctx.window.AVATARIAN_BLOCK_TWEAKS;
  const saved = JSON.stringify(tweaks);
  const k = GLYPHS["k"], had = k.variants;
  const low = { name: "k_alt_low", svg: k.svg, ink: k.ink };
  try {
    k.variants = { ...(had || {}), low };
    tweaks["ŋ|k"] = { ...(tweaks["ŋ|k"] || {}), bottom: "low" };
    const r = resolveGlyph("k", "bottom", "ŋ");
    assert.equal(r.alt, "low");
    assert.equal(r.form.name, "k_alt_low");
    assert.equal(r.flipped, false);
    // Only that block, only that slot; a typed override still wins.
    assert.equal(resolveGlyph("k", "top", "ŋ").alt, undefined);
    assert.equal(resolveGlyph("k", "bottom", "n").alt, undefined);
    assert.equal(resolveGlyph("k%", "bottom", "ŋ").alt, undefined);
    // A label nothing is drawn for falls back to the usual form.
    tweaks["ŋ|k"].bottom = "nosuch";
    assert.equal(resolveGlyph("k", "bottom", "ŋ").alt, undefined);
  } finally {
    if (had) k.variants = had; else delete k.variants;
    for (const key of Object.keys(tweaks)) delete tweaks[key];
    Object.assign(tweaks, JSON.parse(saved));
  }
});

test("only a glyph's base form emits — a cluster form leaves its line to the rail", () => {
  for (const [ipa, g] of Object.entries(GLYPHS)) {
    if (!g.emit) continue;
    for (const [x, y, dir] of g.emit) {
      assert.ok(Number.isInteger(x) && Number.isInteger(y) && (dir === 1 || dir === -1),
        `${ipa}: an emitter is [x, y, ±1] in whole viewBox units`);
      assert.ok(g.ink[x], `${ipa}: every emitter column has an ink profile`);
    }
  }
});
