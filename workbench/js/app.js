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
  sourceView: null, // which source is being browsed, if any
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
  renderSightings();
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
  const full = corpusKey($("key").value);
  const at = state.entries.findIndex((e, i) =>
    i !== state.index && corpusKey(e.key) === full);
  const box = $("dupeWarn");
  // Only while building a NEW entry. A word already having sightings is
  // no longer a problem — it is the point — so for a saved entry the
  // sightings panel says so instead of this warning crying wolf.
  box.hidden = at < 0 || !full || state.index >= 0;
  if (box.hidden) return;
  $("dupeText").textContent =
    `"${state.entries[at].key}" is already attested. A second sighting is `
    + `worth recording — open it if you meant to edit that one.`;
  $("dupeOpen").onclick = () => {
    // Drop the half-built duplicate, and do NOT let openEntry commit the
    // editor on the way — committing is what would push it straight back.
    if (state.index >= 0) state.entries.splice(state.index, 1);
    state.index = -1;
    const to = state.entries.findIndex(e => (e.key || "").toLowerCase() === full);
    if (to >= 0) openEntry(to, false);
  };
}

/**
 * Every sourcing of the word being edited.
 *
 * A word attested in four places is four entries, and the editor shows
 * one of them. Without this panel the other three are unreachable from
 * here — you cannot see who else attests it, how many times, or that two
 * of them disagree. Each row opens that sighting.
 */
function renderSightings() {
  const box = $("sightings");
  const key = corpusKey($("key").value);
  const group = key ? sightingsOf(key) : { at: [] };

  // One sighting is just the entry you are already looking at.
  if (group.at.length < 2) { box.hidden = true; return; }

  const contested = group.spellings.length > 1;
  $("sightingsCount").textContent =
    `Seen ${group.instances} time${group.instances === 1 ? "" : "s"} `
    + `in ${group.sources.length} source${group.sources.length === 1 ? "" : "s"}`;
  $("sightingsNote").textContent = contested
    ? "— and they disagree on the spelling"
    : "— all agreeing";

  const list = $("sightingsList");
  list.innerHTML = "";
  for (const { entry, index } of group.at) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "sighting" + (index === state.index ? " is-active" : "");

    const tokens = (entry.spelling || "").split(" ").filter(Boolean);
    const art = document.createElement("span");
    art.className = "sighting-art";
    renderAvatarian(tokens, art);

    const meta = document.createElement("span");
    meta.className = "sighting-meta";
    const times = entry.times || 1;
    const bits = [entry.source || "(no source)"];
    if (times > 1) bits.push(`written ${times}×`);
    if ((entry.confidence || "certain") !== "certain") bits.push(entry.confidence);
    meta.innerHTML = '<span class="sighting-src"></span>'
      + '<span class="sighting-codes"></span>';
    meta.querySelector(".sighting-src").textContent = bits.join(" · ");
    meta.querySelector(".sighting-codes").textContent = ipaToSpelling(tokens);

    btn.append(art, meta);
    btn.addEventListener("click", () => openEntry(index));
    li.appendChild(btn);
    list.appendChild(li);
  }
  box.hidden = false;
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
  const bodies = ipa.map(t => splitOverride(t).body);
  const unread = bodies.filter(sym => sym === "*").length;
  // `?` is excluded: it has no glyph deliberately, and both validators
  // accept it. Flagging it as a missing glyph would put a red warning on
  // a spelling that is going to save perfectly well.
  const unknown = [...new Set(bodies.filter(
    sym => sym !== "*" && !(window.AVATARIAN_GLYPHS || {})[sym]))];

  const note = $("previewNote");
  const bits = [`${ipa.length} symbols, ${blocks.length} blocks`];
  // Both of these would be rejected on save. Saying so here means you
  // find out while looking at the glyphs, not after filling in the form.
  if (odd) bits.push("odd count — the last block is half empty, so a "
                     + "null is missing");
  if (unknown.length) bits.push("no glyph for: " + unknown.join(" "));
  // Stated, not warned about — an honest gap in the reading.
  if (unread) bits.push(`${unread} unread slot${unread === 1 ? "" : "s"}`);
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

  // AN UNREAD SLOT IS NOT A DISAGREEMENT. `?` means the reader could not
  // make the glyph out, so it says nothing about the model — and because
  // soundsOnly() drops it, the two would otherwise compare as different
  // sounds and accuse the pronunciation of being wrong when it is not.
  //
  // Where the rest lines up, the model's symbol for the gap is worth
  // saying out loud: it is the best available candidate for the glyph you
  // could not read. Offered as information, never written in — filling
  // the gap from the model is exactly the inference the corpus must not
  // record as an observation.
  const gaps = [];
  if (ipa.length === derived.tokens.length) {
    for (let i = 0; i < ipa.length; i++) {
      if (splitOverride(ipa[i]).body === "*") gaps.push(i);
    }
  }
  const readableAgrees = gaps.length && ipa.every((t, i) =>
    gaps.includes(i) || t === derived.tokens[i]);

  let verdict, cls = "";
  if (readableAgrees) {
    const guessed = gaps.map(i => soundToCode(derived.tokens[i]));
    verdict = `Agrees everywhere you could read it. The model reads the `
            + `${gaps.length === 1 ? "gap" : "gaps"} as `
            + `${guessed.join(", ")} — a candidate for what you could not `
            + `make out, not evidence. Leave the ? unless you can see it.`;
    cls = " is-same";
  } else if (attestedStr === derivedStr) {
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

/**
 * Every entry for one word, with the total number of times it was seen.
 *
 * An entry is a sighting, so a word can have several — and `times`
 * carries repeats within a single source. "Instances" is the sum, which
 * is the number that says how well attested a word actually is.
 */
function sightingsOf(key) {
  const want = corpusKey(key);
  const at = [];
  state.entries.forEach((entry, index) => {
    if (corpusKey(entry.key) === want) at.push({ entry, index });
  });
  return {
    at,
    instances: at.reduce((n, m) => n + (m.entry.times || 1), 0),
    sources: [...new Set(at.map(m => m.entry.source))],
    spellings: [...new Set(at.map(m => m.entry.spelling || ""))],
  };
}

/**
 * The list is one row per WORD, not per entry.
 *
 * It used to be one row per entry showing that entry's block count. Both
 * halves were wrong once entries became sightings: a word attested three
 * times appeared as three identical-looking rows, and the block count
 * was a fact about the spelling you can already see in the preview.
 * How many times a word has been seen is the thing you cannot see
 * anywhere else, and it is what tells you whether a spelling is solid.
 */
function renderEntryList() {
  const filter = $("filter").value.trim().toLowerCase();
  const list = $("entryList");
  list.innerHTML = "";

  const seen = new Set();
  state.entries.forEach((entry, i) => {
    const key = corpusKey(entry.key);
    if (seen.has(key) && key) return;
    if (key) seen.add(key);

    const group = key ? sightingsOf(key) : { at: [{ entry, index: i }],
      instances: entry.times || 1, sources: [entry.source], spellings: [] };
    // Filtering matches ANY of the word's sources, since the row stands
    // for all of them.
    if (filter && !key.includes(filter)
        && !group.sources.some(s => (s || "").toLowerCase().includes(filter))) return;

    const contested = group.spellings.length > 1;
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    const isOpen = group.at.some(m => m.index === state.index);
    btn.className = "entry-btn" + (isOpen ? " is-active" : "")
                  + (contested ? " is-contested" : "");
    btn.innerHTML = '<span class="entry-key"></span>'
      + '<span class="entry-flag"></span><span class="entry-blocks"></span>';
    btn.querySelector(".entry-key").textContent = entry.key || "(unnamed)";
    btn.querySelector(".entry-flag").textContent =
      contested ? "≠" : group.at.some(m => (m.entry.confidence || "certain") !== "certain")
        ? "?" : "";
    const count = btn.querySelector(".entry-blocks");
    count.textContent = group.instances;
    count.title = `Seen ${group.instances} time`
      + `${group.instances === 1 ? "" : "s"}, in `
      + `${group.sources.length} source${group.sources.length === 1 ? "" : "s"}`
      + (contested ? ` — and they do not agree on the spelling` : "");
    btn.addEventListener("click", () => openEntry(group.at[0].index));
    li.appendChild(btn);
    list.appendChild(li);
  });

  const words = new Set(state.entries.map(e => corpusKey(e.key))).size;
  const sightings = state.entries.reduce((n, e) => n + (e.times || 1), 0);
  $("corpusCount").textContent =
    `${words} word${words === 1 ? "" : "s"} · ${sightings} sighting`
    + `${sightings === 1 ? "" : "s"} · ${Object.keys(state.sources).length} sources`;
}

function renderSourceList() {
  const list = $("sourceList");
  list.innerHTML = "";
  for (const name of Object.keys(state.sources)) {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "source-btn" + (name === state.sourceView ? " is-active" : "");
    const used = state.entries.filter(e => e.source === name).length;
    btn.innerHTML = '<span class="entry-key"></span><span class="entry-blocks"></span>';
    btn.querySelector(".entry-key").textContent = name;
    btn.querySelector(".entry-blocks").textContent = used;
    btn.addEventListener("click", () => openSourceView(name));
    li.appendChild(btn);
    list.appendChild(li);
  }
}

/**
 * Show everything read off one source.
 *
 * The entry list is per word and the editor is per entry, so a source —
 * which is what a sitting of work actually produces — had no view of its
 * own. This is also how a transcription gets checked: the words in the
 * order they were recorded, beside the image on the right.
 *
 * It takes over the main column rather than opening beside the editor,
 * because the editor edits ONE entry and having both visible invites
 * editing the wrong one.
 */
function openSourceView(name) {
  if (!state.sources[name]) return;
  commitEditor();
  state.sourceView = name;
  $("source").value = name;
  showSource(name);
  $("importPanel").hidden = true;
  // Not closeImport(), which would also show the editor — but the Source
  // panel has to come back, since the import panel hid it and showing a
  // source without it is the whole point of this view.
  $("sourcePanel").hidden = false;
  // The editor waits until you pick a word out of the source. Showing it
  // straight away would sit an unrelated entry under the source you just
  // opened, which is the wrong thing to invite editing.
  $("editor").hidden = true;
  $("sourceView").hidden = false;
  renderSourceView();
  renderSourceList();
  renderEntryList();
}

function closeSourceView() {
  state.sourceView = null;
  $("sourceView").hidden = true;
  $("editor").hidden = false;
  renderSourceList();
}

function renderSourceView() {
  const name = state.sourceView;
  const source = state.sources[name];
  if (!source) return closeSourceView();

  const mine = [];
  state.entries.forEach((entry, index) => {
    if (entry.source === name) mine.push({ entry, index });
  });
  const sightings = mine.reduce((n, m) => n + (m.entry.times || 1), 0);
  const unread = mine.reduce((n, m) =>
    n + (m.entry.spelling || "").split(" ").filter(t => t === "*").length, 0);

  $("sourceViewTitle").textContent = name;
  $("sourceViewCount").textContent =
    `${mine.length} word${mine.length === 1 ? "" : "s"} · `
    + `${sightings} sighting${sightings === 1 ? "" : "s"}`
    + (unread ? ` · ${unread} unread slot${unread === 1 ? "" : "s"}` : "");
  // The full reading is no longer repeated here: the Source panel sits
  // directly above with the same text in an editable field.
  const box = $("sourceWords");
  box.innerHTML = "";
  if (!mine.length) {
    box.innerHTML = '<p class="empty">Nothing has been read off this source '
      + 'yet. Use <b>+ import a source</b> to transcribe it.</p>';
    return;
  }

  for (const { entry, index } of mine) {
    const tokens = (entry.spelling || "").split(" ").filter(Boolean);
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "source-word" + (index === state.index ? " is-active" : "");

    const art = document.createElement("span");
    art.className = "source-word-art";
    renderAvatarian(tokens, art);

    const label = document.createElement("span");
    label.className = "source-word-key";
    label.textContent = entry.gloss || entry.key || "(unnamed)";

    // Compact, so the flags are marks rather than sentences — the full
    // wording is in the tooltip. A grid of forty words is only readable
    // if each one is the size of a word.
    const marks = [], said = [];
    if ((entry.times || 1) > 1) {
      marks.push(`${entry.times}×`);
      said.push(`written ${entry.times} times here`);
    }
    if ((entry.confidence || "certain") !== "certain") {
      marks.push("~");
      said.push(entry.confidence);
    }
    if (tokens.includes("*")) { marks.push("◌"); said.push("partly unread"); }
    // A word this source shares with another is where corroboration
    // lives, so it stays visible even in the compact form.
    const others = state.entries.filter(
      e => e.source !== name && corpusKey(e.key) === corpusKey(entry.key)).length;
    if (others) {
      marks.push(`+${others}`);
      said.push(`also attested in ${others} other source${others === 1 ? "" : "s"}`);
    }
    if (marks.length) {
      const meta = document.createElement("span");
      meta.className = "source-word-meta";
      meta.textContent = marks.join(" ");
      label.appendChild(meta);
    }
    btn.title = [entry.key, ...said].join(" — ");

    btn.append(art, label);
    // The source view STAYS. Opening a word out of it should not throw
    // away the thing you were reading — you are working through a source,
    // and the editor is a detail of that, not a replacement for it.
    btn.addEventListener("click", () => openEntry(index));
    box.appendChild(btn);
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
  // An armed delete must never survive a change of selection — the whole
  // point of the two clicks is that they mean the same source.
  if (pendingSourceDelete && pendingSourceDelete !== name) disarmSourceDelete();
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
  // Picking an entry means you want to refine it, so leave the import
  // panel rather than hiding the thing you just asked to see.
  closeImport();
  state.index = i;
  $("editor").hidden = false;
  writeEditor(state.entries[i]);
  renderEntryList();
  // The source view stays open above the editor when there is one: you
  // are working THROUGH a source, and the word you opened is a detail of
  // it. Re-rendered so the word you just picked shows as active.
  if (state.sourceView) renderSourceView();
}

function newEntry() {
  commitEditor();
  closeImport();
  state.index = -1;
  writeEditor(blankEntry());
  renderEntryList();
  $("spelling").focus({ preventScroll: true });
}

function deleteEntry() {
  if (state.index < 0) return;
  state.entries.splice(state.index, 1);
  state.index = -1;
  writeEditor(blankEntry());
  renderEntryList();
  markDirty();
}

/**
 * A new source is an import.
 *
 * This used to make an empty source called "source-3" and put the cursor
 * in a name field on the far side of the screen, which left a nameless
 * husk in the file if you wandered off — and a source with no entries is
 * not a thing anyone wants. Importing is what you were going to do
 * anyway: name it, describe it, drop the image, transcribe it, in one
 * panel and one pass.
 */
function newSource() {
  openImport();
  $("impName").focus();
}

/**
 * Delete the selected source, and every entry that cites it.
 *
 * The entries CANNOT be kept. `build_corpus.check` rejects an entry whose
 * source is not in `sources`, so orphaning them would leave a corpus that
 * will not save at all — worse than the deletion you asked for, and you
 * would find out at save time with no obvious way back.
 *
 * Two steps, because this is the one action here that destroys attested
 * observations. The first click says exactly what will go; the second
 * does it. A source with no entries deletes on the first click, since
 * there is nothing to lose.
 *
 * The image file is left on disk. It is the evidence, it is not in git,
 * and deciding it is rubbish is a separate judgement from deciding this
 * source record is — `tools/rename_images.py` lists whatever ends up
 * unreferenced.
 */
let pendingSourceDelete = null;

function deleteSource() {
  const name = $("source").value;
  const source = state.sources[name];
  if (!source) return;

  const citing = state.entries.filter(e => e.source === name);
  const sightings = citing.reduce((n, e) => n + (e.times || 1), 0);

  // ONLY THIS SOURCE'S SIGHTINGS GO. A word attested somewhere else keeps
  // that other entry and stays in the corpus — which is the point of an
  // entry being a sighting rather than a word. Worth saying out loud,
  // because "4 entries go too" reads like four words disappearing, and
  // the difference between losing a word and losing one attestation of
  // it is exactly what you want to know before clicking.
  const keys = [...new Set(citing.map(e => corpusKey(e.key)))];
  const elsewhere = new Set(
    state.entries.filter(e => e.source !== name).map(e => corpusKey(e.key)));
  const surviving = keys.filter(k => elsewhere.has(k));
  const losing = keys.filter(k => !elsewhere.has(k));

  if (citing.length && pendingSourceDelete !== name) {
    pendingSourceDelete = name;
    $("deleteSource").textContent = `really delete "${name}"`;
    $("deleteSource").classList.add("is-armed");

    const bits = [
      `${citing.length} entr${citing.length === 1 ? "y" : "ies"} `
      + `(${sightings} sighting${sightings === 1 ? "" : "s"}) cite it.`,
    ];
    bits.push(losing.length
      ? `${losing.length} word${losing.length === 1 ? "" : "s"} leave${
          losing.length === 1 ? "s" : ""} the corpus`
        + (losing.length <= 5 ? `: ${losing.join(", ")}.` : ".")
      : `No word leaves the corpus.`);
    if (surviving.length) {
      bits.push(`${surviving.length} stay${surviving.length === 1 ? "s" : ""}, `
        + `attested elsewhere`
        + (surviving.length <= 5 ? `: ${surviving.join(", ")}.` : "."));
    }
    bits.push("Click again to confirm.");
    if (source.image) bits.push(`${source.image} stays on disk.`);

    $("deleteSourceNote").textContent = bits.join(" ");
    return;
  }

  state.entries = state.entries.filter(e => e.source !== name);
  delete state.sources[name];
  state.index = -1;
  // The view of a source that no longer exists has nothing to show.
  if (state.sourceView === name) closeSourceView();
  // Put the button back before anything re-renders. Clearing only the
  // pending name would leave it looking armed at the NEXT source you
  // select, and showSource's guard cannot catch that — there is no
  // pending name left for it to compare against.
  disarmSourceDelete();

  writeEditor(blankEntry());
  renderSourceList();
  renderSourceOptions();
  renderEntryList();
  markDirty();
  setStatus(
    `deleted "${name}"`
    + (citing.length ? ` and ${citing.length} entries` : "")
    + (surviving.length
        ? `; ${surviving.length} word${surviving.length === 1 ? "" : "s"} kept, `
          + `attested elsewhere`
        : "")
    + " — not saved yet", "is-dirty");
}

/** Put the delete button back to its unarmed state. */
function disarmSourceDelete() {
  pendingSourceDelete = null;
  const btn = $("deleteSource");
  if (!btn) return;
  btn.textContent = "delete this source";
  btn.classList.remove("is-armed");
  $("deleteSourceNote").textContent = "";
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
  if (state.sourceView === from) state.sourceView = to;
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
/**
 * The sounds field the shared controls act on.
 *
 * The palette and the draw pad live in the right-hand column and are
 * used from BOTH panels, but they used to write to the editor's spelling
 * box unconditionally. With the import panel open that box is hidden, so
 * clicking a glyph appeared to do nothing — and then `commitEditor` filed
 * the result as a new entry with no key, which the validator only catches
 * at save time.
 *
 * So the target is whatever sounds field you last touched: a row's codes,
 * the transcription box, or the editor's spelling. `offsetParent` is the
 * hidden check — a field in a closed panel is never the target.
 */
let activeSoundField = null;

function soundTarget() {
  if (activeSoundField && document.contains(activeSoundField)
      && activeSoundField.offsetParent !== null) return activeSoundField;
  return $("importPanel").hidden ? $("spelling") : $("impText");
}

function trackSoundField(el) {
  el.addEventListener("focus", () => { activeSoundField = el; });
}

/**
 * Tell whatever owns the field that it changed.
 *
 * The row and transcription handlers already know how to react to their
 * own input, so firing the event they listen for keeps one code path
 * instead of three — a row repaints its glyphs and its flags, the
 * transcription box re-parses.
 */
function afterSoundEdit(box) {
  if (box.id === "spelling") {
    markDirty();
    commitEditor();
    refresh();
  } else {
    box.dispatchEvent(new Event("input", { bubbles: true }));
  }
}

function insertToken(text) {
  const box = soundTarget();
  const at = Number.isInteger(box.selectionStart) ? box.selectionStart : box.value.length;
  const before = box.value.slice(0, at);
  const after = box.value.slice(at);
  const lead = before && !/\s$/.test(before) ? " " : "";
  const trail = after && !/^\s/.test(after) ? " " : "";
  box.value = before + lead + text + trail + after;
  const pos = before.length + lead.length + text.length;
  // preventScroll, because the control that called this is often nowhere
  // near the box: clicking a glyph in the reference, or picking a match
  // off the draw pad, would otherwise focus the textarea and have the
  // browser yank the page back to the top — a 1600px jump on every
  // single letter, which is exactly the mode you are in when building a
  // word by clicking.
  box.focus({ preventScroll: true });
  box.setSelectionRange(pos, pos);
  afterSoundEdit(box);
}

/**
 * `$` and `%` are not sounds — they ride on the sound before them. So
 * they attach to the token to the left of the caret instead of being
 * inserted as one of their own.
 */
function appendOverride(mark) {
  const box = soundTarget();
  const at = Number.isInteger(box.selectionStart) ? box.selectionStart : box.value.length;
  const before = box.value.replace(/\s+$/, "").slice(0, at).replace(/[$%]+$/, "");
  if (!before.trim()) return;
  const after = box.value.slice(at);
  box.value = before + mark + after;
  // preventScroll, because the control that called this is often nowhere
  // near the box: clicking a glyph in the reference, or picking a match
  // off the draw pad, would otherwise focus the textarea and have the
  // browser yank the page back to the top — a 1600px jump on every
  // single letter, which is exactly the mode you are in when building a
  // word by clicking.
  box.focus({ preventScroll: true });
  box.setSelectionRange(before.length + 1, before.length + 1);
  afterSoundEdit(box);
}

function deleteToken() {
  const box = soundTarget();
  const at = Number.isInteger(box.selectionStart) ? box.selectionStart : box.value.length;
  const before = box.value.slice(0, at).replace(/\s*\S+\s*$/, "");
  box.value = before + box.value.slice(at);
  // preventScroll, because the control that called this is often nowhere
  // near the box: clicking a glyph in the reference, or picking a match
  // off the draw pad, would otherwise focus the textarea and have the
  // browser yank the page back to the top — a 1600px jump on every
  // single letter, which is exactly the mode you are in when building a
  // word by clicking.
  box.focus({ preventScroll: true });
  box.setSelectionRange(before.length, before.length);
  afterSoundEdit(box);
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
// Importing a whole source
// ---------------------------------------------------------------------
//
// A reference image almost never holds one word — it holds a line, a
// caption, a poster. So the unit of work here is the SOURCE: its image
// and its whole transcription go in together, and one entry per word
// comes out, every one of them already citing it.
//
// The transcription uses the site's own sounds syntax, which already has
// everything this needs: "/" between words, and "(brackets)" for a word
// you already know. So a line you could paste into the main site is also
// a line you can paste here, and the parser is `soundTextToWords` rather
// than anything new.

/** The image filed for the import in progress, if one has been dropped. */
let importImage = null;

/** The parsed rows, rebuilt whenever the transcription changes. */
let importRows = [];

/**
 * Words the English box filled in, and the spelling the MODEL gave each
 * one — plus the ones you have since confirmed against the image.
 *
 * This pair is the whole safety mechanism behind deriving from English.
 * A seeded spelling is an inference; a corpus entry is an observation;
 * and the corpus is only worth anything because it keeps those apart
 * (CORPUS.md §4). Saving a seeded row unchecked would file the model's
 * own prediction as evidence, and the "against the model" comparison
 * would then show perfect agreement for it — the model being validated
 * against itself, which reads exactly like the model being right.
 *
 * So a seeded row is unsaveable until one of two things has happened:
 *
 *   the spelling CHANGED   you corrected it while looking at the image,
 *                          so the result is what you saw
 *   you ticked it          you looked, and it already agreed
 *
 * Either way a human compared it with the source. The check is keyed on
 * the word rather than the row index because rows are rebuilt from the
 * text on every keystroke.
 */
let importSeeded = new Map();
let importConfirmed = new Set();

/**
 * English in, a first draft of the sounds out.
 *
 * `derivedLookup` rather than `lookupWord` on purpose: the corpus must
 * not seed a transcription that is about to be compared against the
 * corpus. Asking the model what it thinks, while it is not allowed to
 * consult the answer, is the same reason `renderComparison` uses it.
 *
 * Odd counts get the trailing null the block model requires. Mid-word
 * nulls are deliberately NOT guessed — canon puts them where the model
 * cannot derive them (this is what `appa` is), so leaving them out keeps
 * the draft honestly wrong rather than invisibly wrong.
 */
function deriveFromEnglish() {
  const words = ($("impEnglish").value.match(/[A-Za-z][A-Za-z'’-]*/g) || []);
  if (!words.length) {
    showProblems(["Type an English line first."]);
    return;
  }

  importSeeded = new Map();
  importConfirmed = new Set();

  const chunks = [], missing = [];
  for (const word of words) {
    const { ipa } = derivedLookup(word);
    if (!ipa.length) { missing.push(word); continue; }
    const tokens = ipa.slice();
    if (tokens.length % 2) tokens.push("∅");
    importSeeded.set(corpusKey(word), tokens.join(" "));
    chunks.push(`${ipaToSpelling(tokens)} (${word})`);
  }

  $("impText").value = chunks.join(" / ");
  parseImport();
  showProblems(missing.length
    ? [`No pronunciation for: ${missing.join(", ")}. Those words were left `
       + `out — spell them by hand.`]
    : []);
}

function openImport() {
  if (state.sourceView) closeSourceView();
  $("importPanel").hidden = false;
  $("editor").hidden = true;
  // The import panel carries its own name / what / where / image, so
  // showing the Source panel too would put two of every field on screen.
  $("sourcePanel").hidden = true;
  $("impName").focus();
}

function closeImport() {
  $("importPanel").hidden = true;
  $("editor").hidden = false;
  $("sourcePanel").hidden = false;
}

/**
 * Split the transcription into words and work out what each one is.
 *
 * A caption wins over a suggestion: if you already know the word, saying
 * so is not something the reverse-decode should be allowed to overrule.
 */
function parseImport() {
  const words = soundTextToWords($("impText").value);
  importRows = words.map((w) => {
    const known = (w.word || "").trim();
    const suggestions = suggestWords(w.ipa, 4);
    const guess = known || (suggestions[0]?.word ?? "");
    // A seeded word whose spelling still matches what the model wrote is
    // unchecked. Edit it and it stops being the model's opinion, so the
    // flag clears on its own — the common case is correcting a draft
    // against the image, and that should not also need a tick.
    const row = {
      ipa: w.ipa,
      word: guess,
      fromCaption: !!known,
      suggestions,
      checked: importConfirmed.has(corpusKey(guess)),
      // Only ever ticked for a true duplicate, where there is nothing to
      // add and correcting the existing entry is the only sensible move.
      update: false,
    };
    row.needsCheck = seedUnchanged(row);
    return row;
  });
  // Relations are a second pass because a row can repeat an EARLIER row
  // in the same transcription, which means they have to all exist first.
  recountRows();
  renderImportRows();
}

/**
 * Work out each row's relation, then fold repeats onto the row that
 * first recorded them.
 *
 * A repeat is not thrown away: the word really was written that many
 * times, and three renderings of a spelling rule out a slip of the pen
 * in a way one does not. It is counted on the FIRST row, so the source
 * yields one entry carrying `times` rather than N entries the validator
 * would reject as the same observation.
 *
 * Both passes run over every row because one edit can change another
 * row's answer — correcting word 30 to a different spelling stops it
 * being a repeat, and word 1's count has to drop.
 */
function recountRows() {
  importRows.forEach((row) => {
    row.relation = importRelation(row);
    row.times = 1;
  });
  for (const row of importRows) {
    if ((row.relation || {}).kind !== "repeat") continue;
    const first = importRows[row.relation.at];
    if (first) first.times += 1;
  }
}

/** Repaint every row's warnings, leaving the inputs (and the caret) alone. */
function repaintAllFlags() {
  for (const row of importRows) {
    if (!row.flagBox) continue;
    row.el.classList.toggle("is-unchecked", row.needsCheck && !row.checked);
    row.el.classList.toggle("is-repeat", (row.relation || {}).kind === "repeat");
    paintFlags(row, row.flagBox);
  }
}

/** The source name the import panel is currently filing under. */
function currentImportSource() {
  return $("impName").value.trim();
}

/**
 * The lookup key for a word, normalised the way the corpus stores keys.
 *
 * Mirrors `build_corpus.normalise_key`, which lowercases and drops
 * anything but letters and apostrophes, per word so a phrase key keeps
 * its single spaces. The validator REJECTS an unnormalised key rather
 * than fixing it, deliberately — an entry whose key doesn't match the
 * form its own lookup uses would sit in the file unreachable.
 *
 * So it has to be normalised here instead. Typing "Zuko", or deriving
 * from an English line that capitalises a name, must not produce an
 * entry the save then bounces. The word as you wrote it is kept as the
 * gloss, which is exactly what `gloss` is for.
 */
function corpusKey(word) {
  return String(word || "").trim().split(/\s+/)
    .map(normaliseWord).filter(Boolean).join(" ");
}

/**
 * How a row relates to what the corpus already holds.
 *
 * A word being present is not by itself a problem, and treating it as
 * one was the old design's mistake: the only way past a "duplicate" was
 * to overwrite the earlier observation. Three cases, and only the first
 * is actually a problem:
 *
 *   duplicate      same word, same spelling, same source. Nothing to
 *                  add — it is one observation entered twice.
 *   corroborates   same spelling, a different source. This is EVIDENCE,
 *                  and it is the case the old model could not record at
 *                  all. Saving it counts the second sighting.
 *   conflict       a different spelling. Both are kept as alternates and
 *                  the most-attested one renders. Two sources disagreeing
 *                  is a finding about the script; deleting either side
 *                  destroys it.
 */
function importRelation(row) {
  // Compared on the normalised key, so "Zuko" and "zuko" are recognised
  // as the same word rather than filed as two.
  const word = corpusKey(row.word);
  if (!word) return { kind: "new" };

  const spelling = row.ipa.join(" ");
  const source = currentImportSource();

  // A line can repeat a word — "on top of the on" — and two rows that
  // agree exactly would be filed as the same word, same spelling, same
  // source: one observation entered twice, which the validator rejects.
  // Caught here rather than at save, because a save is all-or-nothing
  // and finding out then means the whole batch bounces.
  //
  // A repeat with a DIFFERENT spelling is left alone on purpose: one
  // source writing a word two ways is a real finding, and it records
  // correctly as a contested word.
  const at = importRows.indexOf(row);
  const earlier = importRows.findIndex(
    (other, i) => i < at
      && corpusKey(other.word) === word
      && other.ipa.join(" ") === spelling);
  if (at > 0 && earlier >= 0) return { kind: "repeat", at: earlier };
  const matches = [];
  state.entries.forEach((entry, index) => {
    if (corpusKey(entry.key) === word) matches.push({ entry, index });
  });
  if (!matches.length) return { kind: "new" };

  const identical = matches.find(
    m => (m.entry.spelling || "") === spelling && m.entry.source === source);
  if (identical) return { kind: "duplicate", at: identical.index };

  const agreeing = matches.filter(m => (m.entry.spelling || "") === spelling);
  if (agreeing.length) {
    return { kind: "corroborates", at: agreeing[0].index,
             sources: [...new Set(agreeing.map(m => m.entry.source))] };
  }
  return {
    kind: "conflict", at: matches[0].index,
    sources: [...new Set(matches.map(m => m.entry.source))],
    spellings: [...new Set(matches.map(m => m.entry.spelling || ""))],
  };
}

/**
 * Is this row still exactly what the model wrote for it?
 *
 * Recomputed rather than stored, because the spelling is editable in the
 * row itself now: correct a draft against the image and the row stops
 * being the model's opinion the moment the text differs. Editing it back
 * to the model's own answer makes it unchecked again, which is right —
 * that is the state it describes.
 */
function seedUnchanged(row) {
  const seed = importSeeded.get(corpusKey(row.word));
  return seed !== undefined && seed === row.ipa.join(" ");
}

/**
 * Rewrite the transcription box from the rows.
 *
 * The box stays the record of what is about to be saved, so an edit made
 * in a row has to land there too — otherwise the next keystroke in the
 * box would re-parse and silently throw the edit away. Captions are
 * written for every named word, which also fixes a older quiet loss: a
 * word typed into a row used to vanish on the next re-parse.
 */
function syncImportText() {
  $("impText").value = wordsToSoundText(
    importRows.map(r => ({ word: r.word || "", ipa: r.ipa })));
}

/**
 * The warnings under one row, rebuilt in place.
 *
 * Separate from `renderImportRows` because editing a spelling changes
 * which of these apply — an odd count appears and clears as you type —
 * and rebuilding the whole list to say so would move the caret.
 */
function paintFlags(row, into) {
  into.innerHTML = "";

  const flags = [];
  if (row.ipa.length % 2) {
    flags.push(["is-warn", `${row.ipa.length} symbols — odd, so a null is `
      + `missing. This one can't be saved as it stands.`]);
  }
  // Seen more than once in this transcription, and counted on the row
  // that first recorded it.
  if (row.times > 1) {
    flags.push(["is-ok",
      `Written ${row.times} times in this transcription. All ${row.times} are `
      + `counted on this one entry — repeats of a spelling are evidence for `
      + `it, so they raise its count rather than making a second entry.`]);
  }

  const rel = row.relation || { kind: "new" };
  if (rel.kind === "repeat") {
    flags.push(["is-muted",
      `Same spelling as word ${rel.at + 1}, so it is counted there rather `
      + `than recorded again. Spell it differently if the source really `
      + `does.`]);
  } else if (rel.kind === "duplicate") {
    flags.push(["is-dupe",
      `Already recorded from this source with this spelling — the same `
      + `observation twice, so there is nothing to add.`,
      "correct the existing entry instead", row.update,
      (on) => { row.update = on; }]);
  } else if (rel.kind === "corroborates") {
    flags.push(["is-ok",
      `${rel.sources.join(" and ")} spell${rel.sources.length > 1 ? "" : "s"} `
      + `this the same way. Saving records a second sighting — the count is `
      + `what makes it stronger evidence.`]);
  } else if (rel.kind === "conflict") {
    flags.push(["is-dupe",
      `${rel.sources.join(" and ")} spell${rel.sources.length > 1 ? "" : "s"} `
      + `this ${rel.spellings.map(s => ipaToSpelling(s.split(" "))).join(" / ")}`
      + `. Both are kept — the most-attested one is what renders.`]);
  }
  if (row.needsCheck && !row.checked) {
    flags.push(["is-unchecked",
      "Derived from English — the model wrote this, nobody has seen it. "
      + "Compare it with the image: correct it, or say it already agrees.",
      "matches the image", false, (on) => {
        row.checked = on;
        const key = corpusKey(row.word);
        if (on) importConfirmed.add(key); else importConfirmed.delete(key);
        renderImportRows();
      }]);
  }

  for (const [cls, text, label, checked, onToggle] of flags) {
    const p = document.createElement("p");
    p.className = "imp-flag " + cls;
    p.textContent = text;
    if (label) {
      const wrap = document.createElement("label");
      const cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = checked;
      cb.addEventListener("change", () => {
        onToggle(cb.checked);
        updateImportSummary();
      });
      wrap.append(cb, document.createTextNode(" " + label));
      p.appendChild(wrap);
    }
    into.appendChild(p);
  }
}

function renderImportRows() {
  const box = $("impRows");
  box.innerHTML = "";

  importRows.forEach((row, i) => {
    const el = document.createElement("div");
    el.className = "imp-row"
      + (row.needsCheck && !row.checked ? " is-unchecked" : "")
      + ((row.relation || {}).kind === "repeat" ? " is-repeat" : "");

    const art = document.createElement("div");
    art.className = "imp-art";
    renderAvatarian(row.ipa, art);

    const body = document.createElement("div");
    body.className = "imp-body";

    // The spelling is editable here rather than only in the transcription
    // box above. Correcting a draft against the image is the main thing
    // this panel is for, and hunting for the right word in one long line
    // of codes is the slow part of doing it.
    const codes = document.createElement("input");
    codes.type = "text";
    codes.className = "imp-codes";
    codes.spellcheck = false;
    codes.value = ipaToSpelling(row.ipa);
    codes.title = "The spelling as it will be saved. Edit it to match the "
                + "image — 0 is a null.";
    // So the palette and the draw pad insert into THIS row once you have
    // clicked into it, which is the whole point of them being shared.
    trackSoundField(codes);

    const flagBox = document.createElement("div");
    flagBox.className = "imp-flags";
    // Kept on the row so an edit in ONE row can repaint the warnings of
    // the others — a repeat that stops being a repeat changes the count
    // shown on the row it was folded into.
    row.el = el;
    row.flagBox = flagBox;

    /** Everything about the row that its own spelling can change. */
    const repaint = () => {
      row.needsCheck = seedUnchanged(row);
      art.innerHTML = "";
      renderAvatarian(row.ipa, art);
      // Relations and repeat counts are global, not per-row: editing this
      // spelling can make it match — or stop matching — another row.
      recountRows();
      repaintAllFlags();
      syncImportText();
      updateImportSummary();
    };

    // Repainting in place rather than calling renderImportRows: a full
    // rebuild on every keystroke would take the caret out of the field
    // being typed in.
    codes.addEventListener("input", () => {
      row.ipa = spellingToIPA(codes.value);
      repaint();
    });

    const input = document.createElement("input");
    input.type = "text";
    input.className = "imp-word";
    input.value = row.word;
    input.placeholder = "word";
    input.addEventListener("input", () => {
      row.word = input.value.trim();
      // Naming it yourself is what a caption means, so it survives the
      // next re-parse instead of being re-guessed.
      row.fromCaption = !!row.word;
      row.checked = importConfirmed.has(corpusKey(row.word));
      repaint();
    });

    body.append(input, codes);

    // Suggestions, unless the transcription already named the word.
    if (!row.fromCaption && row.suggestions.length) {
      const chips = document.createElement("div");
      chips.className = "imp-chips";
      for (const hit of row.suggestions) {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "sugg from-" + hit.source;
        chip.textContent = hit.word;
        chip.title = hit.distance === 0
          ? `exact match on the sounds (${hit.source})`
          : `${hit.distance} sound${hit.distance > 1 ? "s" : ""} different`;
        chip.addEventListener("click", () => {
          row.word = hit.word;
          input.value = hit.word;
          row.relation = importRelation(row);
          syncImportText();
          renderImportRows();
        });
        chips.appendChild(chip);
      }
      body.appendChild(chips);
    }

    paintFlags(row, flagBox);
    body.appendChild(flagBox);

    el.append(art, body);
    box.appendChild(el);
  });

  updateImportSummary();
}

/** What the button is actually about to do, counted rather than promised. */
function importPlan() {
  const add = [], replace = [], blocked = [], unchecked = [], agreeing = [],
        conflicting = [], merged = [];
  for (const row of importRows) {
    if (!row.word) { blocked.push(row); continue; }
    if (row.ipa.length % 2) { blocked.push(row); continue; }
    // Counted apart from `blocked` because it is the one kind of skip you
    // can clear by looking at something rather than by typing.
    if (row.needsCheck && !row.checked) { unchecked.push(row); continue; }

    const kind = (row.relation || {}).kind;
    // Not skipped and not lost — counted onto the row it repeats, which
    // carries the total as `times`.
    if (kind === "repeat") { merged.push(row); continue; }
    // The only case with nothing to record. Everything else is a
    // sighting, and a sighting is always worth adding.
    if (kind === "duplicate") {
      if (row.update) replace.push(row);
      else blocked.push(row);
      continue;
    }
    if (kind === "corroborates") agreeing.push(row);
    if (kind === "conflict") conflicting.push(row);
    add.push(row);
  }
  return { add, replace, blocked, unchecked, agreeing, conflicting, merged };
}

function updateImportSummary() {
  const { add, replace, blocked, unchecked, agreeing, conflicting, merged }
    = importPlan();
  const bits = [];
  const fresh = add.length - agreeing.length - conflicting.length;
  if (fresh) bits.push(`${fresh} new`);
  if (agreeing.length) bits.push(`${agreeing.length} corroborating`);
  if (conflicting.length) bits.push(`${conflicting.length} conflicting`);
  if (merged.length) bits.push(`${merged.length} counted onto a repeat`);
  if (replace.length) bits.push(`${replace.length} corrected`);
  if (unchecked.length) bits.push(`${unchecked.length} unchecked`);
  if (blocked.length) bits.push(`${blocked.length} skipped`);

  const all = $("impCheckAll");
  all.hidden = !unchecked.length;
  all.textContent = unchecked.length === 1
    ? "it matches the image" : "all of them match the image";
  $("impSummary").textContent = importRows.length
    ? bits.join(" · ") || "nothing to add"
    : "";
  $("impAdd").disabled = !add.length && !replace.length;
  // Say what the button will actually do — "add" is the wrong verb when
  // every row is a replacement, and "1 entries" reads like a bug.
  const n = (k) => `${k} ${k === 1 ? "sighting" : "sightings"}`;
  $("impAdd").textContent =
    add.length && replace.length ? `record ${n(add.length)}, correct ${replace.length}`
    : add.length ? `record ${n(add.length)}`
    : replace.length ? `correct ${replace.length === 1 ? "1 entry" : replace.length + " entries"}`
    : "record sightings";
}

function commitImport() {
  const name = $("impName").value.trim();
  if (!name) {
    showProblems(["Give the source a name before adding its entries."]);
    $("impName").focus();
    return;
  }

  const source = state.sources[name] || {};
  source.what = $("impWhat").value.trim();
  source.where = $("impWhere").value.trim();
  if (importImage) source.image = importImage;
  state.sources[name] = source;

  const confidence = $("impConfidence").value;
  const make = (row) => {
    const key = corpusKey(row.word);
    const entry = { key, spelling: row.ipa.join(" "), source, confidence };
    entry.source = name;
    // "Zuko" saves under "zuko" but is still displayed as you wrote it.
    if (row.word && row.word !== key) entry.gloss = row.word;
    // Written out only when it says something. `times: 1` on every entry
    // would be noise in the file and in its diffs.
    if (row.times > 1) entry.times = row.times;
    return entry;
  };

  const { add, replace, agreeing, conflicting } = importPlan();
  // Only a true duplicate is ever written over, and only when asked —
  // everything else is appended, because an entry is a sighting and a
  // second sighting must not erase the first.
  for (const row of replace) {
    const was = state.entries[row.relation.at];
    state.entries[row.relation.at] = { ...was, ...make(row) };
  }
  for (const row of add) state.entries.push(make(row));

  showProblems([]);
  markDirty();
  renderSourceList();
  renderEntryList();

  // Clear the transcription but keep the source, because the next thing
  // you do is usually another line off the same image.
  $("impText").value = "";
  $("impEnglish").value = "";
  importSeeded = new Map();
  importConfirmed = new Set();
  importRows = [];
  renderImportRows();
  const extra = [];
  if (agreeing.length) extra.push(`${agreeing.length} corroborating`);
  if (conflicting.length) extra.push(`${conflicting.length} conflicting`);
  setStatus(`${add.length + replace.length} sightings recorded`
            + (extra.length ? ` (${extra.join(", ")})` : "")
            + " — not saved yet", "is-dirty");
}

function wireImport() {
  $("importBtn").addEventListener("click", openImport);
  $("closeImport").addEventListener("click", closeImport);
  $("impAdd").addEventListener("click", commitImport);

  $("impDerive").addEventListener("click", deriveFromEnglish);
  $("impEnglish").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); deriveFromEnglish(); }
  });

  // One tick for the line rather than one per word — you check a poster
  // at a glance, not word by word. Still a deliberate act, which is the
  // whole requirement.
  $("impCheckAll").addEventListener("click", () => {
    for (const row of importRows) {
      if (row.needsCheck && !row.checked) {
        row.checked = true;
        importConfirmed.add(corpusKey(row.word));
      }
    }
    renderImportRows();
  });

  let timer = null;
  $("impText").addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(parseImport, 200);
  });
  $("impConfidence").addEventListener("change", updateImportSummary);

  // The name defaults from the image's filename, since that is usually
  // what you would have typed anyway. It also decides whether a row is a
  // duplicate or a second source corroborating, so the rows repaint.
  $("impName").addEventListener("input", () => {
    for (const row of importRows) row.relation = importRelation(row);
    renderImportRows();
  });

  wireDrop($("impDrop"), importDropped);
}

/** An image dropped or pasted onto the import panel. */
async function importDropped(file) {
  // The image is filed UNDER the source, so the source needs a name first —
  // otherwise it lands under whatever the screenshot was called (a
  // Paramount+ URL, "image.png"). Ask for the name rather than guessing it
  // from the file, which is exactly what wrote those junk source names.
  if (!$("impName").value.trim()) {
    showProblems(["Name the source first, then drop its reference image."]);
    $("impName").focus();
    return;
  }
  const stored = await storeImage(file, $("impName").value);
  if (!stored) return;
  importImage = stored;
  const img = $("impImage");
  img.src = "/images/" + stored + "?t=" + Date.now();
  img.hidden = false;
  $("impDropHint").hidden = true;
  updateImportSummary();
}

// ---------------------------------------------------------------------
// The reference image
// ---------------------------------------------------------------------

/** Send an image to the server and return the filename it was stored as. */
/**
 * File an image and get back the name it was stored under.
 *
 * Named after the SOURCE, not the dropped file. A folder of `image.png`,
 * `image-2.png`, `image-3.png` says nothing about which entry each one
 * backs up — and re-checking a spelling a year from now means finding
 * its image, which is the entire reason these are kept. The server
 * slugifies and de-duplicates, so a name it would not accept still lands
 * somewhere safe.
 */
async function storeImage(file, sourceName) {
  const data = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  const res = await fetch("/api/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      // Never the dropped file's name — a screenshot called
      // "VS--AvatarAang…ParamountPlus.jpg" would file the source under that.
      name: (sourceName || "").trim() || "source",
      data,
    }),
  });
  const body = await res.json();
  if (body.error) {
    showProblems([body.error]);
    return null;
  }
  showProblems([]);
  return body.file;
}

/** Drag-and-drop onto one zone. */
function wireDrop(zone, onFile) {
  const stop = (e) => { e.preventDefault(); e.stopPropagation(); };
  zone.addEventListener("dragover", (e) => { stop(e); zone.classList.add("is-over"); });
  zone.addEventListener("dragleave", (e) => { stop(e); zone.classList.remove("is-over"); });
  zone.addEventListener("drop", (e) => {
    stop(e);
    zone.classList.remove("is-over");
    const file = e.dataTransfer?.files?.[0];
    if (file) onFile(file);
  });
}

/** File an image against the source the open ENTRY cites. */
async function fileImage(file) {
  const name = $("source").value;
  if (!state.sources[name]) {
    showProblems(["Pick or create a source before filing an image against it."]);
    return;
  }
  const stored = await storeImage(file, name);
  if (!stored) return;
  state.sources[name].image = stored;
  showSource(name);
  markDirty();
}

function wireDropzone() {
  wireDrop($("dropzone"), fileImage);
  // Pasting a screenshot is how most of these will arrive. It goes to
  // whichever panel is open, because that is the one you are looking at.
  window.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items || [])]
      .find(i => i.type.startsWith("image/"));
    if (!item) return;
    const file = item.getAsFile();
    ($("importPanel").hidden ? fileImage : importDropped)(file);
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

  // Importing a source is the way things get IN; the entry editor is for
  // refining what is already there. So the import panel is what you land
  // on, and clicking an entry is what takes you out of it.
  openImport();
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

  // The two standing sounds fields. A row's codes field registers itself
  // as it is built, since rows come and go with every re-parse.
  trackSoundField($("spelling"));
  trackSoundField($("impText"));

  $("filter").addEventListener("input", renderEntryList);
  $("newEntry").addEventListener("click", newEntry);
  $("deleteEntry").addEventListener("click", deleteEntry);
  $("newSource").addEventListener("click", newSource);
  $("deleteSource").addEventListener("click", deleteSource);
  $("closeSourceView").addEventListener("click", closeSourceView);
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
  wireImport();

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
