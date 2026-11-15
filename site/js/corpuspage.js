/* The corpus page (corpus.html): the word table and its search. Loaded last, after the scripts it uses;
 * see the <script> tags at the foot of the page for the order. */

"use strict";

// (The theme toggle is js/theme.js, loaded before this file.)

// --- the corpus ---------------------------------------------------------
const CORPUS = window.AVATARIAN_CORPUS || { words: {}, sources: {} };
const SOURCES = CORPUS.sources || {};

// One row per attested word, sorted by how it reads to a person.
const WORDS = Object.entries(CORPUS.words)
  .map(([key, entry]) => ({ key, label: entry.gloss || key, ...entry }))
  .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));

// nurseVowel runs before the null filter: the ə/ɹ adjacency that marks the
// NURSE vowel has to be judged with the nulls still in place (see sounds.js).
const soundsOf = (ipa) => nurseVowel(ipa.map(t => t.replace(/[$%]/g, "")))
  .filter(t => t !== "∅" && t !== "∅c").join(" ");

// The same sounds in the translator's readable respelling (k uh t ah r
// uh), for the card to show beside the IPA. Nulls drop out, and a
// cluster-form request (`_c`) normalises to its base code — but a
// `$`/`%` orientation override STAYS, the way the translator's Sounds
// box shows it, so a hand-oriented spelling like "students" (both /s/
// spelled by hand) reads the way it is actually drawn. `cqBase`
// (corpusquery.js) tests for the null; `soundToCode` (sounds.js) is the
// IPA -> readable-code map, and it carries the override suffix through.
const codesOf = (ipa) => ipa
  .filter(t => { const b = cqBase(t); return b !== "∅" && b !== "∅c"; })
  .map(t => soundToCode(t.replace("_c", "")))
  .join(" ");

// allSourcesOf / sourceHref / spellingGroups / fillWhat and the popup
// itself come from js/sourcepop.js, shared with the translator.

// A source id -> a short human label + a description for the tooltip.
function sourceTitle(id) {
  const s = SOURCES[id] || {};
  const bits = [];
  if (s.what) bits.push(s.what);
  if (s.where) bits.push(s.where);
  return bits.join(". ") || id;
}

// The source preview popup is built once here and shared with the
// translator (js/sourcepop.js): hover or focus a word card to open it.
const srcPop = createSourcePopup(SOURCES, renderAvatarian);

// Populate the source filter, each with how many words cite it.
(function fillSourceFilter() {
  const sel = document.getElementById("sourceFilter");
  const counts = {};
  for (const w of WORDS) for (const s of allSourcesOf(w)) counts[s] = (counts[s] || 0) + 1;
  Object.keys(SOURCES)
    .filter(id => counts[id])
    .sort((a, b) => counts[b] - counts[a])
    .forEach(id => {
      const o = document.createElement("option");
      o.value = id;
      o.textContent = `${id} (${counts[id]})`;
      o.title = sourceTitle(id);
      sel.appendChild(o);
    });
})();

function card(w) {
  const el = document.createElement("div");
  el.className = "word-card" + (w.contested ? " is-contested" : "");
  el.dataset.label = w.label.toLowerCase();
  el.dataset.key = w.key;
  el.dataset.sources = allSourcesOf(w).join(" ");
  el.tabIndex = 0;   // focusable, so the source preview works off the keyboard too

  const draw = document.createElement("div");
  draw.className = "draw";
  const word = document.createElement("div");
  word.className = "avatarian-word";
  renderAvatarian(w.ipa, word);
  draw.appendChild(word);
  el.appendChild(draw);

  const en = document.createElement("div");
  en.className = "word-en";
  en.textContent = w.label;
  el.appendChild(en);

  // The pronunciation as text: the IPA the blocks encode, and the same
  // sounds in the readable respelling — now visible, not just a tooltip.
  const ipaLine = document.createElement("div");
  ipaLine.className = "word-ipa";
  ipaLine.textContent = "/" + soundsOf(w.ipa) + "/";
  el.appendChild(ipaLine);

  const sndLine = document.createElement("div");
  sndLine.className = "word-sounds";
  sndLine.textContent = codesOf(w.ipa);
  el.appendChild(sndLine);

  // The sources themselves live in the hover preview; the card just says
  // how much it has been seen.
  const meta = document.createElement("div");
  meta.className = "word-meta";
  // The whole word, across every spelling: the winner's count plus each
  // alternate's. w.count alone is only the winning spelling's, which
  // undercounts a contested word (e.g. `your`, seen 4× but winner 3×).
  const seen = (w.count || 0)
    + (w.alternates || []).reduce((n, a) => n + (a.count || 0), 0);
  const times = seen === 1 ? "seen once" : `seen ${seen}×`;
  const nSrc = allSourcesOf(w).length;
  meta.append(times);
  if (w.contested) {
    meta.append(" · ");
    const flag = document.createElement("span");
    flag.className = "alt-flag";
    flag.textContent = "alternate spellings";
    meta.appendChild(flag);
  } else if (nSrc > 1) {
    meta.append(` · ${nSrc} sources`);
  }
  el.appendChild(meta);

  if (w.confidence && w.confidence !== "certain") {
    const t = document.createElement("span");
    t.className = "tag";
    t.textContent = w.confidence;
    el.appendChild(t);
  }

  el.addEventListener("mouseenter", () => srcPop.show(el, w));
  el.addEventListener("mouseleave", srcPop.hide);
  el.addEventListener("focus", () => srcPop.show(el, w));
  el.addEventListener("blur", srcPop.hide);
  return el;
}

const grid = document.getElementById("grid");
const frag = document.createDocumentFragment();
WORDS.forEach(w => frag.appendChild(card(w)));
grid.appendChild(frag);

// --- filtering ----------------------------------------------------------
const search = document.getElementById("search");
const sourceFilter = document.getElementById("sourceFilter");
const contestedOnly = document.getElementById("contestedOnly");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");
const cards = [...grid.children];
const WORD_BY_KEY = Object.fromEntries(WORDS.map(w => [w.key, w]));

// The parsed structural query, shared with applyFilters. `{ empty: true }`
// means no structural filter, so the grid behaves exactly as before.
let STRUCT = { empty: true };

// Ring the blocks a structural query matched inside one card, and clear
// any ring left from a previous query first. A no-op when nothing hit.
function highlightBlocks(el, hits) {
  el.querySelectorAll(".avatarian-block.q-hit")
    .forEach(b => b.classList.remove("q-hit"));
  if (!hits || !hits.length) return;
  const blocks = el.querySelectorAll(".avatarian-word .avatarian-block");
  for (const h of hits) {
    if (blocks[h.block]) blocks[h.block].classList.add("q-hit");
  }
}

function applyFilters() {
  const q = search.value.trim().toLowerCase();
  const src = sourceFilter.value;
  const onlyContested = contestedOnly.getAttribute("aria-pressed") === "true";
  const structOn = !STRUCT.empty && !STRUCT.error;
  let shown = 0;
  for (const el of cards) {
    const okText = !q || el.dataset.label.includes(q) || el.dataset.key.includes(q);
    const okSrc = !src || el.dataset.sources.split(" ").includes(src);
    const okContested = !onlyContested || el.classList.contains("is-contested");

    let okStruct = true, hits = null;
    if (structOn) {
      const w = WORD_BY_KEY[el.dataset.key];
      const r = matchWord(w ? w.ipa : [], STRUCT);
      okStruct = r.matched;
      hits = r.hits;
    }
    const show = okText && okSrc && okContested && okStruct;
    el.hidden = !show;
    highlightBlocks(el, show ? hits : null);

    // An exact word match (search "it" and it is buried mid-grid otherwise)
    // is ringed and pulled to the front with the grid's `order`, so it is
    // the first thing you see instead of hunting for it alphabetically.
    const isExact = show && !!q
      && (el.dataset.key === q || el.dataset.label === q);
    el.classList.toggle("is-exact", isExact);
    el.style.order = isExact ? "-1" : "";

    if (show) shown++;
  }
  emptyEl.hidden = shown > 0;
  const total = cards.length;
  countEl.textContent = shown === total
    ? `${total} words · ${Object.keys(SOURCES).length} sources`
    : `${shown} of ${total} words`;
}
search.addEventListener("input", applyFilters);
sourceFilter.addEventListener("change", applyFilters);
contestedOnly.addEventListener("click", () => {
  const on = contestedOnly.getAttribute("aria-pressed") === "true";
  contestedOnly.setAttribute("aria-pressed", String(!on));
  applyFilters();
});

// --- structural search: the builder <-> query-string pair ---------------
const advSearch = document.getElementById("advSearch");
const qPhoneme = document.getElementById("qPhoneme");
const qContext = document.getElementById("qContext");
const qSlot = document.getElementById("qSlot");
const qString = document.getElementById("qString");
const qClear = document.getElementById("qClear");
const qNote = document.getElementById("qNote");

// Fill the Sound dropdown from the drawn set, each labelled with its
// readable code and IPA — so it reads "sh (ʃ)", not a symbol you have to
// know how to type. Consonants then vowels; nulls and punctuation are
// not searchable sounds and are left out.
(function fillPhonemes() {
  const GLYPHS = window.AVATARIAN_GLYPHS || {};
  const groups = { consonant: "Consonants", vowel: "Vowels" };
  for (const type of ["consonant", "vowel"]) {
    const og = document.createElement("optgroup");
    og.label = groups[type];
    for (const [sym, g] of Object.entries(GLYPHS)) {
      if (g.type !== type) continue;
      const code = soundToCode(sym);
      const o = document.createElement("option");
      o.value = sym;
      o.textContent = code === sym ? sym : `${code} (${sym})`;
      og.appendChild(o);
    }
    if (og.children.length) qPhoneme.appendChild(og);
  }
})();

// A parsed query as a plain-English line, so the note confirms what the
// tool understood ("/g/ in a C–C block") rather than echoing the syntax.
const CTX_PHRASE = {
  cc: "a C–C block", cv: "a C–V block", vc: "a V–C block",
  vv: "a V–V block", null: "a block with a null",
};
const CTX_NAME = {
  cc: "C–C block", cv: "C–V block", vc: "V–C block",
  vv: "V–V block", null: "block with a null",
};
function describeQuery(q) {
  if (q.empty) return "";
  // A run of sounds: "the sounds /e ɪ/ in a row".
  if (q.seq) return "the sounds /" + q.seq.join(" ") + "/ in a row, however the blocks split them";
  // A whole block: "the block /m/ over /z/".
  if (q.block) return "the block /" + q.block[0] + "/ over /" + q.block[1] + "/";
  // Shape-only: no phoneme, just a block shape — "every C–C block".
  if (!q.phoneme) return "every " + CTX_NAME[q.context];
  const bits = ["/" + q.phoneme + "/"];
  if (q.slot) bits.push("in the " + q.slot + " slot");
  if (q.context) bits.push((q.slot ? "of " : "in ") + CTX_PHRASE[q.context]);
  return bits.join(" ");
}

// Reflect the current query into `?query=` so a search is shareable, and
// drop the param when the box is empty.
function updateURL() {
  const p = new URLSearchParams(location.search);
  const v = qString.value.trim();
  if (v) p.set("query", v); else p.delete("query");
  const qs = p.toString();
  history.replaceState(null, "", location.pathname + (qs ? "?" + qs : "") + location.hash);
}

// Parse whatever is in the box, filter the grid, and say what happened.
// An error leaves the grid unfiltered (applyFilters ignores a broken
// STRUCT) and shows the reason under the box.
function runQuery() {
  STRUCT = parseQuery(qString.value, normaliseSound);
  applyFilters();
  updateURL();
  if (STRUCT.error) {
    qNote.textContent = STRUCT.error;
    qNote.classList.add("is-error");
  } else {
    qNote.textContent = describeQuery(STRUCT);
    qNote.classList.remove("is-error");
  }
}

// Builder -> string: the dropdowns are the source, write the canonical
// query and run it.
function syncFromBuilder() {
  qString.value = buildQuery({
    // The option's value is IPA, but the box reads readable codes first —
    // so `e` (the FACE vowel) would come back as ɛ, `i` as ɪ, `u` as ʌ, `j`
    // as dʒ. Write the readable code, which always reads back to this sound.
    phoneme: qPhoneme.value ? soundToCode(qPhoneme.value) : null,
    slot: qSlot.value || null,
    context: qContext.value || null,
  });
  runQuery();
}

// String -> builder: the box is the source (someone typed or pasted a
// query). Push its parse back onto the dropdowns where it fits; a phoneme
// with no matching option just leaves the dropdown on "any", the box
// still driving. Setting .value programmatically fires no `change`, so
// this never loops back into syncFromBuilder.
function syncFromString() {
  const q = parseQuery(qString.value, normaliseSound);
  if (!q.error) {
    qPhoneme.value = q.phoneme && [...qPhoneme.options].some(o => o.value === q.phoneme)
      ? q.phoneme : "";
    qContext.value = q.context || "";
    qSlot.value = q.slot || "";
  }
  runQuery();
}

[qPhoneme, qContext, qSlot].forEach(el => el.addEventListener("change", syncFromBuilder));
qString.addEventListener("input", syncFromString);
qClear.addEventListener("click", () => {
  qString.value = ""; qPhoneme.value = ""; qContext.value = ""; qSlot.value = "";
  runQuery();
  qString.focus();
});

// Deep links from the source catalogue (sources.html): `?source=<id>`
// opens the grid filtered to one source, `?q=<word>` to one word, and
// `?query=<expr>` opens the structural search on a saved query. Applied
// before the first render so arriving here already shows the filtered set.
// `?source` only takes if that id is a real option, so a stale link falls
// back to showing everything rather than an empty grid.
(function fromQuery() {
  const p = new URLSearchParams(location.search);
  const src = p.get("source");
  if (src && [...sourceFilter.options].some(o => o.value === src)) {
    sourceFilter.value = src;
  }
  const q = p.get("q");
  if (q) search.value = q;
  const structured = p.get("query");
  if (structured) {
    advSearch.open = true;
    qString.value = structured;
    syncFromString();          // parses, fills the builder, filters the grid
  }
})();

applyFilters();
