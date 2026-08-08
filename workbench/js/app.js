/**
 * The transcription workbench.
 *
 * The loop this is built around:
 *
 *   1. file a reference image against a source
 *   2. read the Avatarian off it and type the spelling, block by block
 *   3. let the fuzzy reverse-decode say what English word that is
 *   4. confirm, note anything surprising, save
 *
 * The image is PROVENANCE, not input. Nothing here reads its pixels —
 * it is stored so that "where did this spelling come from" still has an
 * answer in a year, which is the one thing every entry written before
 * this tool existed is missing.
 *
 * Everything that matters is borrowed from the product rather than
 * reimplemented: the preview is drawn by site/js/render.js against
 * blocks.css, the spelling is parsed by site/js/sounds.js, recognition
 * is site/js/recognise.js and the word suggestions are
 * site/js/reverse.js. This file is the workflow around them.
 *
 * State lives in one object and the whole corpus is posted on save. The
 * server validates and writes nothing at all if anything is wrong, so a
 * rejected save leaves the file exactly as it was.
 */

const $ = (id) => document.getElementById(id);

const state = {
  sources: {},
  entries: [],
  index: -1,        // which entry is open; -1 is a new, unsaved one
  dirty: false,
};

/** Every field that, when touched, means the open entry changed. */
const ENTRY_FIELDS = ["key", "spelling", "gloss", "confidence", "source", "note"];

// ---------------------------------------------------------------------
// Spelling <-> symbols
// ---------------------------------------------------------------------

/**
 * The box takes the same ASCII codes the main site does, and stores IPA.
 *
 * Word breaks are deliberately NOT honoured: a corpus entry is one
 * spelling even when its key is a phrase, because the blocks run
 * straight through. `soundTextToWords` splits on "/", so anything it
 * hands back is flattened again here.
 */
function spellingToIPA(text) {
  return soundTextToWords(text).flatMap(w => w.ipa);
}

function ipaToSpelling(ipa) {
  return ipa && ipa.length ? wordsToSoundText([{ word: "", ipa }]) : "";
}

/** Blocks, as the renderer will pair them: two symbols each, in order. */
function blocksOf(ipa) {
  const out = [];
  for (let i = 0; i < ipa.length; i += 2) out.push([ipa[i], ipa[i + 1] ?? "∅"]);
  return out;
}

/**
 * What the model would write for a word: its derived pronunciation,
 * paired two at a time, with a null on the odd end. This is the
 * prediction an attested spelling is interesting *against*.
 */
function derivedSpelling(word) {
  const { ipa, tier } = derivedLookup(word);
  if (!ipa.length) return null;
  const tokens = ipa.slice();
  if (tokens.length % 2) tokens.push("∅");
  return { tokens, tier };
}

// ---------------------------------------------------------------------
// The open entry
// ---------------------------------------------------------------------

function blankEntry() {
  const firstSource = Object.keys(state.sources)[0] || "";
  return { key: "", spelling: "", gloss: "", confidence: "certain",
           source: firstSource, note: "" };
}

function writeEditor(entry) {
  $("key").value = entry.key || "";
  $("spelling").value = ipaToSpelling((entry.spelling || "").split(" ").filter(Boolean));
  $("gloss").value = entry.gloss || "";
  $("confidence").value = entry.confidence || "certain";
  $("note").value = entry.note || "";
  renderSourceOptions(entry.source);
  $("editorTitle").textContent = entry.key ? entry.key : "New entry";
  $("deleteEntry").hidden = state.index < 0;
  refresh();
}

function readEditor() {
  return {
    key: $("key").value.trim(),
    spelling: spellingToIPA($("spelling").value).join(" "),
    gloss: $("gloss").value.trim(),
    confidence: $("confidence").value,
    source: $("source").value,
    note: $("note").value.trim(),
  };
}

/** Fold the open editor back into the entry list, adding it if new. */
function commitEditor() {
  const entry = readEditor();
  if (!entry.key && !entry.spelling) return;
  for (const k of ["gloss", "note"]) if (!entry[k]) delete entry[k];
  if (state.index < 0) {
    state.entries.push(entry);
    state.index = state.entries.length - 1;
    $("deleteEntry").hidden = false;
  } else {
    state.entries[state.index] = entry;
  }
  renderEntryList();
}

function markDirty() {
  state.dirty = true;
  setStatus("unsaved changes", "is-dirty");
}

function setStatus(text, cls = "") {
  const el = $("saveState");
  el.textContent = text;
  el.className = "save-state " + cls;
}

// ---------------------------------------------------------------------
// Preview, comparison, suggestions
// ---------------------------------------------------------------------

let suggestTimer = null;

function refresh() {
  const ipa = spellingToIPA($("spelling").value);
  renderPreview(ipa);
  renderComparison(ipa);
  renderDuplicate();
  // Reverse-decode scans the whole dictionary. It is fast enough to feel
  // instant but not fast enough to run on every keystroke of a long
  // spelling, so it waits for a pause.
  clearTimeout(suggestTimer);
  suggestTimer = setTimeout(() => renderSuggestions(ipa), 180);
}

/**
 * Warn when the open entry's key already belongs to another one.
 *
 * The save would catch it — `build_corpus.check` rejects duplicates — but
 * finding out at save time means having already transcribed the whole
 * thing twice. The reverse-decode marks a suggestion "already attested"
 * for the same reason; this is that warning followed through to the one
 * action worth offering.
 */
function renderDuplicate() {
  const key = normaliseWord($("key").value.trim().split(/\s+/)[0] || "");
  const full = $("key").value.trim().toLowerCase();
  const at = state.entries.findIndex((e, i) =>
    i !== state.index && (e.key || "").toLowerCase() === full);
  const box = $("dupeWarn");
  box.hidden = at < 0 || !key;
  if (at < 0) return;
  $("dupeText").textContent =
    `"${state.entries[at].key}" is already in the corpus.`;
  $("dupeOpen").onclick = () => {
    // Drop the half-built duplicate, and do NOT let openEntry commit the
    // editor on the way — committing is what would push it straight back.
    if (state.index >= 0) state.entries.splice(state.index, 1);
    state.index = -1;
    const to = state.entries.findIndex(e => (e.key || "").toLowerCase() === full);
    if (to >= 0) openEntry(to, false);
  };
}

function renderPreview(ipa) {
  const out = $("preview");
  out.innerHTML = "";
  if (!ipa.length) {
    $("previewNote").textContent = "";
    return;
  }
  const word = document.createElement("span");
  renderAvatarian(ipa, word);
  out.appendChild(word);

  const blocks = blocksOf(ipa);
  const odd = ipa.length % 2 === 1;
  const unknown = [...new Set(ipa
    .map(t => splitOverride(t).body)
    .filter(sym => !(window.AVATARIAN_GLYPHS || {})[sym]))];

  const note = $("previewNote");
  const bits = [`${ipa.length} symbols, ${blocks.length} blocks`];
  // Both of these would be rejected on save. Saying so here means you
  // find out while looking at the glyphs, not after filling in the form.
  if (odd) bits.push("odd count — the last block is half empty, so a "
                     + "null is missing");
  if (unknown.length) bits.push("no glyph for: " + unknown.join(" "));
  note.textContent = bits.join(" · ");
  note.className = "preview-note" + (odd || unknown.length ? " is-warn" : "");
}

/**
 * Canon beside the prediction.
 *
 * This is the part that makes the corpus a research instrument rather
 * than a spelling patch (CORPUS.md §4). Every disagreement is a data
 * point about where the model is wrong, and the two ways it can
 * disagree mean completely different things:
 *
 *   same sounds, different blocks  -> the PAIRING is wrong here
 *                                     (this is what `appa` is)
 *   different sounds               -> the PRONUNCIATION is wrong
 *                                     (this is what `toph` was)
 */
function renderComparison(ipa) {
  const box = $("compare");
  const word = $("key").value.trim();
  if (!ipa.length || !word) { box.hidden = true; return; }

  const derived = derivedSpelling(word);
  if (!derived) { box.hidden = true; return; }

  const attestedStr = ipa.join(" ");
  const derivedStr = derived.tokens.join(" ");
  const sameSounds = soundsOnly(ipa).join(" ") === soundsOnly(derived.tokens).join(" ");

  let verdict, cls = "";
  if (attestedStr === derivedStr) {
    verdict = "The model already gets this right. Worth recording anyway — "
            + "agreements say where it works.";
    cls = " is-same";
  } else if (sameSounds) {
    verdict = "Same sounds, different blocks. The pairing rule is wrong "
            + "for this word — that is what `appa` is.";
  } else {
    verdict = "Different sounds. The pronunciation the tool uses for this "
            + "word is wrong, not just its spelling.";
  }

  $("compareBody").innerHTML = "";
  const rows = [
    ["attested", ipaToSpelling(ipa), `${blocksOf(ipa).length} blocks`],
    [derived.tier === "guessed" ? "guessed" : "derived",
     ipaToSpelling(derived.tokens), `${blocksOf(derived.tokens).length} blocks`],
  ];
  for (const [tag, val, count] of rows) {
    const row = document.createElement("div");
    row.className = "compare-row";
    row.innerHTML = `<span class="compare-tag"></span>`
      + `<span class="compare-val"></span><span class="compare-tag"></span>`;
    const cells = row.querySelectorAll("span");
    cells[0].textContent = tag;
    cells[1].textContent = val;
    cells[2].textContent = count;
    $("compareBody").appendChild(row);
  }
  const v = document.createElement("p");
  v.className = "compare-verdict" + cls;
  v.textContent = verdict;
  $("compareBody").appendChild(v);
  box.hidden = false;
}

function renderSuggestions(ipa) {
  const box = $("suggestions");
  box.innerHTML = "";
  if (!ipa.length) return;

  const hits = suggestWords(ipa, 8);
  if (!hits.length) {
    box.innerHTML = '<span class="empty">No word close to these sounds. '
      + 'That is normal for a name — type it yourself.</span>';
    return;
  }
  for (const hit of hits) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sugg from-" + hit.source;
    const mark = hit.source === "corpus" ? "already attested"
      : hit.source === "exceptions" ? "Avatar vocab" : "";
    btn.innerHTML = '<span class="sugg-word"></span><span class="sugg-mark"></span>';
    btn.querySelector(".sugg-word").textContent = hit.word;
    btn.querySelector(".sugg-mark").textContent =
      mark || (hit.distance === 0 ? "exact" : `${hit.distance} off`);
    btn.title = hit.distance === 0
      ? `exact match on the sounds (${hit.source})`
      : `${hit.distance} sound${hit.distance > 1 ? "s" : ""} different (${hit.source})`;
    btn.addEventListener("click", () => {
      $("key").value = hit.word;
      $("editorTitle").textContent = hit.word;
      markDirty();
      commitEditor();
      refresh();
    });
    box.appendChild(btn);
  }
}

// ---------------------------------------------------------------------
// Lists
// ---------------------------------------------------------------------

function renderEntryList() {
  const filter = $("filter").value.trim().toLowerCase();
  const list = $("entryList");
  list.innerHTML = "";
  state.entries.forEach((entry, i) => {
    if (filter && !(entry.key || "").toLowerCase().includes(filter)
        && !(entry.source || "").toLowerCase().includes(filter)) return;
    const tokens = (entry.spelling || "").split(" ").filter(Boolean);
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "entry-btn" + (i === state.index ? " is-active" : "");
    btn.innerHTML = '<span class="entry-key"></span>'
      + '<span class="entry-flag"></span><span class="entry-blocks"></span>';
    btn.querySelector(".entry-key").textContent = entry.key || "(unnamed)";
    btn.querySelector(".entry-flag").textContent =
      entry.confidence && entry.confidence !== "certain" ? "?" : "";
    btn.querySelector(".entry-blocks").textContent = Math.ceil(tokens.length / 2);
    btn.addEventListener("click", () => openEntry(i));
    li.appendChild(btn);
    list.appendChild(li);
  });
  $("corpusCount").textContent =
    `${state.entries.length} entries · ${Object.keys(state.sources).length} sources`;
}

function renderSourceList() {
  const list = $("sourceList");
  list.innerHTML = "";
  for (const name of Object.keys(state.sources)) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "source-btn";
    const used = state.entries.filter(e => e.source === name).length;
    btn.innerHTML = '<span class="entry-key"></span><span class="entry-blocks"></span>';
    btn.querySelector(".entry-key").textContent = name;
    btn.querySelector(".entry-blocks").textContent = used;
    btn.addEventListener("click", () => {
      $("source").value = name;
      showSource(name);
    });
    li.appendChild(btn);
    list.appendChild(li);
  }
}

function renderSourceOptions(selected) {
  const sel = $("source");
  sel.innerHTML = "";
  for (const name of Object.keys(state.sources)) {
    const opt = document.createElement("option");
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  }
  if (selected && !state.sources[selected]) {
    const opt = document.createElement("option");
    opt.value = selected;
    opt.textContent = selected + " (missing)";
    sel.appendChild(opt);
  }
  sel.value = selected || Object.keys(state.sources)[0] || "";
  showSource(sel.value);
}

/** Show a source's fields and its stored image. */
function showSource(name) {
  const source = state.sources[name];
  $("sourceFields").hidden = !source;
  if (!source) {
    $("sourceImage").hidden = true;
    $("dropHint").hidden = false;
    $("imageName").textContent = "";
    return;
  }
  $("srcName").value = name;
  $("srcWhat").value = source.what || "";
  $("srcWhere").value = source.where || "";
  const img = $("sourceImage");
  if (source.image) {
    img.src = "/images/" + source.image + "?t=" + Date.now();
    img.hidden = false;
    $("dropHint").hidden = true;
    $("imageName").textContent = source.image;
  } else {
    img.hidden = true;
    $("dropHint").hidden = false;
    $("imageName").textContent = "no image filed";
  }
  applyZoom();
}

function applyZoom() {
  const img = $("sourceImage");
  img.style.width = $("imageZoom").value + "%";
  // Nothing to zoom until something is filed.
  $("imageZoom").closest(".zoom-ctl").hidden = img.hidden;
}

// ---------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------

/**
 * `commit` is false only when the editor holds something we are
 * deliberately throwing away — folding it back in first is exactly what
 * we are trying to avoid.
 */
function openEntry(i, commit = true) {
  if (commit) commitEditor();
  state.index = i;
  writeEditor(state.entries[i]);
  renderEntryList();
}

function newEntry() {
  commitEditor();
  state.index = -1;
  writeEditor(blankEntry());
  renderEntryList();
  $("spelling").focus();
}

function deleteEntry() {
  if (state.index < 0) return;
  state.entries.splice(state.index, 1);
  state.index = -1;
  writeEditor(blankEntry());
  renderEntryList();
  markDirty();
}

function newSource() {
  let name = "source";
  let n = 2;
  while (state.sources[name]) name = "source-" + n++;
  state.sources[name] = { what: "", where: "" };
  renderSourceList();
  renderSourceOptions(name);
  markDirty();
  $("srcName").focus();
  $("srcName").select();
}

/** Rename a source, carrying every entry that cites it along. */
function renameSource(from, to) {
  if (!to || from === to || state.sources[to]) return false;
  const rebuilt = {};
  for (const [name, source] of Object.entries(state.sources)) {
    rebuilt[name === from ? to : name] = source;
  }
  state.sources = rebuilt;
  for (const entry of state.entries) {
    if (entry.source === from) entry.source = to;
  }
  return true;
}

async function save() {
  commitEditor();
  setStatus("saving…");
  try {
    const res = await fetch("/api/corpus", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources: state.sources, entries: state.entries }),
    });
    const body = await res.json();
    showProblems(body.problems || []);
    if (body.saved) {
      state.dirty = false;
      setStatus(`saved — ${body.count} entries`, "is-ok");
    } else {
      setStatus("not saved — see above", "is-error");
    }
  } catch (e) {
    showProblems([String(e)]);
    setStatus("not saved — see above", "is-error");
  }
}

function showProblems(problems) {
  const box = $("problems");
  box.hidden = !problems.length;
  box.textContent = problems.length
    ? `${problems.length} problem(s) — nothing was written:\n` +
      problems.map(p => "  " + p).join("\n")
    : "";
}

// ---------------------------------------------------------------------
// The spelling box: palette, draw pad, tokens
// ---------------------------------------------------------------------

/**
 * Put text in at the caret, spaced off on both sides, rather than always
 * appending — going back to fix a block in the middle is most of what
 * transcribing from an image actually is.
 */
function insertToken(text) {
  const box = $("spelling");
  const at = Number.isInteger(box.selectionStart) ? box.selectionStart : box.value.length;
  const before = box.value.slice(0, at);
  const after = box.value.slice(at);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after && !/^\s/.test(after) ? " " : "";
  box.value = before + lead + text + trail + after;
  const pos = before.length + lead.length + text.length;
  box.focus();
  box.setSelectionRange(pos, pos);
  markDirty();
  commitEditor();
  refresh();
}

/**
 * `$` and `%` are not sounds — they ride on the sound before them. So
 * they attach to the token to the left of the caret instead of being
 * inserted as one of their own.
 */
function appendOverride(mark) {
  const box = $("spelling");
  const at = Number.isInteger(box.selectionStart) ? box.selectionStart : box.value.length;
  const before = box.value.replace(/\s+$/, "").slice(0, at).replace(/[$%]+$/, "");
  if (!before.trim()) return;
  const after = box.value.slice(at);
  box.value = before + mark + after;
  box.focus();
  box.setSelectionRange(before.length + 1, before.length + 1);
  markDirty();
  commitEditor();
  refresh();
}

function deleteToken() {
  const box = $("spelling");
  const at = Number.isInteger(box.selectionStart) ? box.selectionStart : box.value.length;
  const before = box.value.slice(0, at).replace(/\s*\S+\s*$/, "");
  box.value = before + box.value.slice(at);
  box.focus();
  box.setSelectionRange(before.length, before.length);
  markDirty();
  commitEditor();
  refresh();
}

function buildPalette() {
  const box = $("palette");
  const glyphs = window.AVATARIAN_GLYPHS || {};
  const order = { consonant: 0, vowel: 1 };
  const rows = Object.entries(glyphs)
    .map(([ipa, entry]) => ({ ipa, entry }))
    .sort((a, b) =>
      (order[a.entry.type] ?? 2) - (order[b.entry.type] ?? 2)
      || a.entry.name.localeCompare(b.entry.name));

  for (const { ipa, entry } of rows) {
    const code = IPA_TO_CODE[ipa] || ipa;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "pal-btn";
    btn.title = `${code} — ${ipa}`;
    btn.innerHTML = `<span>${entry.flat || entry.svg}</span>`
      + `<span class="pal-code"></span>`;
    btn.querySelector(".pal-code").textContent = code;
    btn.addEventListener("click", () => insertToken(code));
    box.appendChild(btn);
  }
}

// ---------------------------------------------------------------------
// The reference image
// ---------------------------------------------------------------------

async function fileImage(file) {
  const name = $("source").value;
  if (!state.sources[name]) {
    showProblems(["Pick or create a source before filing an image against it."]);
    return;
  }
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: file.name || name, data }),
  });
  const body = await res.json();
  if (body.error) return showProblems([body.error]);
  showProblems([]);
  state.sources[name].image = body.file;
  showSource(name);
  markDirty();
}

function wireDropzone() {
  const zone = $("dropzone");
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  zone.addEventListener("dragover", (e) => { stop(e); zone.classList.add("is-over"); });
  zone.addEventListener("dragleave", (e) => { stop(e); zone.classList.remove("is-over"); });
  zone.addEventListener("drop", (e) => {
    stop(e);
    zone.classList.remove("is-over");
    const file = e.dataTransfer?.files?.[0];
    if (file) fileImage(file);
  });
  // Pasting a screenshot is how most of these will arrive.
  window.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items || [])]
      .find(i => i.type.startsWith("image/"));
    if (item) fileImage(item.getAsFile());
  });
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

async function load() {
  const res = await fetch("/api/corpus");
  const body = await res.json();
  state.sources = body.sources || {};
  state.entries = body.entries || [];
  showProblems(body.problems || []);
  renderSourceList();
  renderEntryList();
  if (state.entries.length) openEntry(0);
  else writeEditor(blankEntry());
  setStatus(body.problems?.length ? "loaded with problems" : "loaded");
}

function wire() {
  for (const id of ENTRY_FIELDS) {
    const el = $(id);
    el.addEventListener("input", () => {
      markDirty();
      commitEditor();
      if (id === "key" || id === "spelling") refresh();
      if (id === "key") $("editorTitle").textContent = el.value.trim() || "New entry";
    });
    if (el.tagName === "SELECT") {
      el.addEventListener("change", () => { showSource(el.value); markDirty(); });
    }
  }

  $("filter").addEventListener("input", renderEntryList);
  $("newEntry").addEventListener("click", newEntry);
  $("deleteEntry").addEventListener("click", deleteEntry);
  $("newSource").addEventListener("click", newSource);
  $("saveBtn").addEventListener("click", save);

  document.querySelectorAll(".sound-tools [data-insert]").forEach((b) => {
    const text = b.dataset.insert;
    b.addEventListener("click", () =>
      text === "$" || text === "%" ? appendOverride(text) : insertToken(text));
  });
  $("delToken").addEventListener("click", deleteToken);
  $("clearSpelling").addEventListener("click", () => {
    $("spelling").value = "";
    markDirty();
    commitEditor();
    refresh();
  });

  $("srcName").addEventListener("change", () => {
    const from = $("source").value;
    const to = $("srcName").value.trim();
    if (renameSource(from, to)) {
      renderSourceList();
      renderEntryList();
      renderSourceOptions(to);
      markDirty();
    } else {
      $("srcName").value = from;
    }
  });
  for (const [id, key] of [["srcWhat", "what"], ["srcWhere", "where"]]) {
    $(id).addEventListener("input", () => {
      const source = state.sources[$("source").value];
      if (source) { source[key] = $(id).value; markDirty(); }
    });
  }

  $("imageZoom").addEventListener("input", applyZoom);
  wireDropzone();

  createDrawPad($("drawpad"), {
    onPick: (hit) => insertToken(hit.code),
  });

  // ⌘S / Ctrl+S, because this is a tool you sit in.
  window.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s") {
      e.preventDefault();
      save();
    }
  });

  window.addEventListener("beforeunload", (e) => {
    if (!state.dirty) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

buildPalette();
wire();
load();
