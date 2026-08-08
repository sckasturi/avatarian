/**
 * Load the site's own JavaScript into one context, the way a browser
 * does, so the tests exercise the shipped code rather than a copy of it.
 *
 * WHY A `vm` CONTEXT AND NOT `require`. Everything in `site/js/` is a
 * classic script, not a module: the files share one global scope, and
 * that sharing is load-bearing — `sounds.js` reads `ARPABET_TO_IPA` off
 * `g2p.js`, `reverse.js` calls `lexicon()` and `corpusWords()`, and
 * `render.js` reads `window.AVATARIAN_GLYPHS`. `require`ing them would
 * give each file its own scope and none of that would resolve. Running
 * them in a shared `vm` context reproduces the browser's arrangement
 * exactly, including the load ORDER, which is itself something worth not
 * getting wrong silently.
 *
 * Each file's `module.exports` block is folded onto the context after it
 * loads. That is not how the page reads them — the page just uses the
 * shared global — but it is how the CONSTANTS become reachable from
 * outside the context. See the note in the loop.
 *
 * NO DOM. Nothing loaded here needs one at load time, and the tests are
 * deliberately written against the parts that don't need one at CALL
 * time either — `resolveBlocks` rather than `renderAvatarian`. That is
 * why `resolveBlocks` exists: the block model is the thing worth
 * asserting, and it should not require an element tree to check.
 *
 * The recogniser is the one piece that cannot be tested here at all: it
 * samples SVG paths with `getPointAtLength`, which is browser geometry.
 * See tests/recognise.html.
 */

const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const ROOT = path.resolve(__dirname, "..");
const SITE = path.join(ROOT, "site", "js");

/** Load order matters and mirrors site/index.html. */
const CORE = ["manifest.js", "corpus.js", "g2p.js", "sounds.js", "render.js"];

/**
 * Build a context with the site's scripts in it.
 *
 * `lexicon` is opt-in because the file is 1.6 MB and `node --test` runs
 * each test file in its own process — loading it everywhere would cost
 * more than the rest of the suite put together. Only the tests that
 * actually search the dictionary ask for it.
 */
function loadSite({ lexicon = false, reverse = false, extraWords = null } = {}) {
  const ctx = { window: {}, console, module: { exports: {} } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);

  const files = [...CORE];
  if (lexicon) files.splice(2, 0, "lexicon.js");   // before g2p.js, as on the page
  if (reverse) files.push("reverse.js");

  for (const name of files) {
    // Extra corpus entries go in AFTER corpus.js and BEFORE g2p.js, which
    // is the only point they can. g2p caches the longest phrase length on
    // first use and never invalidates it — correct on a page, where the
    // corpus is a static file loaded once, but it means a test cannot add
    // a phrase entry later and expect the scan to widen. Injecting here
    // reproduces what the browser would see.
    if (name === "g2p.js" && extraWords) {
      Object.assign(ctx.window.AVATARIAN_CORPUS.words, extraWords);
    }
    // Each file gets a fresh `module` so a stray export can't leak into
    // the next one, exactly as separate <script> tags behave.
    ctx.module = { exports: {} };
    const file = path.join(SITE, name);
    vm.runInContext(fs.readFileSync(file, "utf8"), ctx, { filename: file });

    // A top-level `function` becomes a property of the global object, but
    // a top-level `const` does NOT — it goes into the global *lexical*
    // scope, which is reachable from other scripts in the context but not
    // from outside it. So `ctx.pairUp` resolves and `ctx.NULL_IPA` would
    // silently be `undefined`, and a test comparing against it would pass
    // by comparing undefined to undefined.
    //
    // Each file already declares its surface in a `module.exports` block
    // at the bottom. Folding those onto the context gives the constants
    // back, and does it through the export list the file itself
    // maintains rather than by scraping its source.
    Object.assign(ctx, ctx.module.exports);
  }
  return ctx;
}

/** The corpus as data, straight from the generated file. */
function corpus(ctx) {
  return (ctx.window.AVATARIAN_CORPUS || { sources: {}, words: {} });
}

/** Every attested entry as { key, ipa, source, confidence, ... }. */
function entries(ctx) {
  return Object.entries(corpus(ctx).words)
    .map(([key, entry]) => ({ key, ...entry }));
}

/**
 * Copy a value out of the vm's realm into this one.
 *
 * A `vm` context has its own intrinsics, so an array built inside it is
 * an instance of a DIFFERENT `Array` — and `deepStrictEqual` compares
 * prototypes, so it rejects two structurally identical arrays with a
 * diff showing them as equal, which is a memorably confusing five
 * minutes. Anything crossing the boundary into a strict comparison goes
 * through here first.
 */
function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

/** A spelling as a readable string, for assertion messages. */
function show(ipa) {
  return Array.isArray(ipa) ? ipa.join(" ") : String(ipa);
}

/** Blocks as `(top,bottom) (top,bottom)`, for assertion messages. */
function showBlocks(blocks) {
  return blocks.map(b => `(${b.top},${b.bottom})`).join(" ");
}

module.exports = { loadSite, corpus, entries, plain, show, showBlocks, ROOT, SITE };
