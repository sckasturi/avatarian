/**
 * GOLDEN-FILE PARITY: the Lua module vs the JS renderer.
 *
 * Module_Avatarian.lua (tools/build_lua_module.py) is a hand port of
 * render.js, so it can drift. This renders every attested corpus word through
 * BOTH — the shipped render.js under a tiny DOM shim, serialised to av-* markup
 * the way build_css_only.py's CSS expects; and p._renderWord in the Lua — and
 * asserts they are byte-identical. It also checks normaliseSound (the sounds.js
 * port) over every code, and a few end-to-end p._main cases (solo, multi-word,
 * caption). Needs `lua` on PATH; skips with a notice if absent.
 *
 * Run:  node --test tests/lua_golden.test.js
 */
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const { loadSite, entries, ROOT } = require("./harness.js");

const LUA_MODULE = path.join(ROOT, "wiki", "Module_Avatarian.lua");
const haveLua = spawnSync("lua", ["-v"]).status === 0;

// ---- a DOM shim just big enough for render.js's makeGlyph/renderAvatarian ----
function makeDocument() {
  class El {
    constructor(tag) {
      this.tagName = tag; this.children = []; this._c = new Set();
      this.dataset = {}; this.style = {}; this.title = ""; this._text = "";
    }
    set className(v) { this._c = new Set(String(v).split(/\s+/).filter(Boolean)); }
    get className() { return [...this._c].join(" "); }
    get classList() {
      const c = this._c;
      return { add: (...n) => n.forEach(x => c.add(x)), contains: x => c.has(x),
               remove: (...n) => n.forEach(x => c.delete(x)) };
    }
    appendChild(ch) { this.children.push(ch); ch.parentNode = this; return ch; }
    set textContent(v) { this._text = v; this.children = []; }
    get textContent() { return this._text; }
    set innerHTML(v) {                       // one child <svg> per drawing
      this._html = v; this.children = [];
      const n = (v.match(/<svg\b/g) || []).length;
      for (let i = 0; i < n; i++) this.appendChild(new El("svg"));
    }
    get innerHTML() { return this._html || ""; }
    _descendants(out = []) { for (const c of this.children) { out.push(c); c._descendants(out); } return out; }
    querySelectorAll(sel) {
      const parts = sel.split(",").map(s => s.trim());
      const hit = el => parts.some(pt => pt[0] === "." ? el._c.has(pt.slice(1)) : el.tagName === pt);
      return this._descendants().filter(hit);
    }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
  }
  return { createElement: t => new El(t) };
}

// ---- serialise a rendered .avatarian-word the way the Lua emits one word ----
const HEIGHT = {
  "avatarian-consonant": "av-consonant", "avatarian-vowel": "av-vowel",
  "avatarian-null_consonant": "av-null-c", "avatarian-null": "av-null-v",
};
const WIDE_MARK = new Set(["question"]);

function serializeGlyph(g) {
  if (g._c.has("avatarian-unreadable")) return '<span class="av-glyph av-consonant g-unreadable"></span>';
  let name = String(g.dataset.glyph || "").replace(/%$/, "");
  // /s/ and /z/ redraw in a C-C block: read render.js's ACTUAL mutated SVG (not
  // a re-derivation) so this reflects what the gadget really drew.
  const drawn = g.innerHTML || "";
  if (name === "s" && /L 50 31 L/.test(drawn)) name = "s_inset";
  if (name === "z") {
    const l = /cx="26"/.test(drawn), r = /cx="74"/.test(drawn);
    if (l && !r) name = "z_left";
    else if (r && !l) name = "z_right";
    else if (!l && !r) name = "z_none";
  }
  const stem = "g-" + name;
  let height = "";
  for (const [k, v] of Object.entries(HEIGHT)) if (g._c.has(k)) height = v;
  let cls = "av-glyph " + stem + " " + height;
  if (g._c.has("avatarian-4row")) cls += " av-4row";
  if (g._c.has("avatarian-flipped")) cls += " av-flipped";
  return '<span class="' + cls + '"></span>';
}

function serializeWord(container) {
  let h = "";
  for (const n of container.children) {
    if (n._c.has("avatarian-block")) {
      h += '<span class="av-block' + (n._c.has("avatarian-cc") ? " av-cc" : "") + '">';
      for (const slot of n.children) {
        const top = slot._c.has("avatarian-slot-top");
        h += '<span class="av-slot av-slot-' + (top ? "top" : "bottom") + '">'
           + serializeGlyph(slot.children[0]) + "</span>";
      }
      h += "</span>";
    } else if (n._c.has("avatarian-mark")) {
      const name = n.dataset.glyph;
      h += '<span class="av-mark g-' + name + (WIDE_MARK.has(name) ? " av-wide" : "") + '"></span>';
    }
  }
  return h;
}

// ---- run a batch of jobs through the Lua module, one markup line each -------
function runLua(driver) {
  const file = path.join(os.tmpdir(), "av_lua_" + process.pid + ".lua");
  fs.writeFileSync(file, driver);
  try {
    return execFileSync("lua", [file], { encoding: "utf8", maxBuffer: 64 << 20 });
  } finally {
    fs.rmSync(file, { force: true });
  }
}

const luaLit = s => '"' + String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"') + '"';
const luaArr = a => "{" + a.map(luaLit).join(",") + "}";

test("Lua module renders every corpus word identically to render.js", { skip: !haveLua && "lua not on PATH" }, () => {
  const ctx = loadSite();
  ctx.document = makeDocument();
  const words = entries(ctx);

  // JS reference markup, one per word.
  const ref = words.map(w => {
    const el = ctx.document.createElement("span");
    ctx.renderAvatarian(w.ipa, el);
    return serializeWord(el);
  });

  // Same words through the Lua.
  const driver =
    `local p = dofile(${luaLit(LUA_MODULE)})\n` +
    `local words = {${words.map(w => luaArr(w.ipa)).join(",")}}\n` +
    `for _, ipa in ipairs(words) do print(p._renderWord(ipa)) end\n`;
  const got = runLua(driver).split("\n").slice(0, words.length);

  const mismatches = [];
  words.forEach((w, i) => {
    if (got[i] !== ref[i]) mismatches.push(`${w.key} [${w.ipa.join(" ")}]\n  js : ${ref[i]}\n  lua: ${got[i]}`);
  });
  assert.equal(mismatches.length, 0,
    `${mismatches.length}/${words.length} words differ:\n\n` + mismatches.slice(0, 8).join("\n\n"));
});

test("Lua normaliseSound matches sounds.js over every code", { skip: !haveLua && "lua not on PATH" }, () => {
  const ctx = loadSite();
  // Everything the JS knows how to spell, plus a few overrides and raw IPA.
  const codes = [...new Set([
    ...Object.keys(ctx.READABLE), ...Object.keys(ctx.READABLE_ALIASES),
    ...Object.keys(ctx.SOUND_ALIASES), "AH", "Uh", "EE", "s$", "z%", "r_c", "r_c$",
    "0", "0c", "ə", "ɑ", "tʃ", "x", "notasound",
  ])];
  const ref = codes.map(ctx.normaliseSound);

  const driver =
    `local p = dofile(${luaLit(LUA_MODULE)})\n` +
    `local codes = ${luaArr(codes)}\n` +
    `for _, c in ipairs(codes) do print(p._normaliseSound(c)) end\n`;
  const got = runLua(driver).split("\n").slice(0, codes.length);

  const mismatches = codes
    .map((c, i) => got[i] !== ref[i] && `${JSON.stringify(c)}: js=${JSON.stringify(ref[i])} lua=${JSON.stringify(got[i])}`)
    .filter(Boolean);
  assert.equal(mismatches.length, 0, mismatches.join("\n"));
});

test("Lua p._main handles solo, multi-word and captions", { skip: !haveLua && "lua not on PATH" }, () => {
  const driver =
    `local p = dofile(${luaLit(LUA_MODULE)})\n` +
    `print(p._main("r", nil))\n` +
    `print(p._main("ng", nil))\n` +
    `print(p._main("k uh t ah r uh", "Katara"))\n` +
    `print(p._main("hh ay / th ao r (hammer of thor)", nil))\n` +
    `print(p._main("", nil))\n`;
  const out = runLua(driver).split("\n");
  assert.match(out[0], /^<span class="av-word av-solo"><span class="av-copy">\/r\/<\/span><span class="av-glyph g-r av-consonant">/);
  assert.match(out[1], /g-ng av-consonant/);                       // ng -> ŋ glyph
  assert.match(out[1], /<span class="av-copy">\/ŋ\/<\/span>/);      // solo, no caption -> IPA in slashes
  assert.match(out[2], /title="Katara"/);
  assert.match(out[2], /<span class="av-copy">Katara<\/span>/);     // caption is the copyable text
  assert.match(out[2], /av-word-part/);
  assert.match(out[3], /title="hammer of thor"/);                  // caption spread + stripped
  assert.equal(out[4], "");                                        // empty -> nothing
});
