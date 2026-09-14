/**
 * The public contribution tool — a static, SUBMIT-ONLY build of the
 * transcription workbench (workbench/js/app.js).
 *
 * The workbench writes files, so it can only ever run on a laptop with
 * tools/corpus_server.py behind it. This page does the same reading and
 * previewing, but it cannot and must not write to the repo directly:
 * GitHub Pages serves static files and has no write path. So instead of
 * saving, it posts one submission to a small Cloudflare Worker, which
 * opens a pull request that stages the sighting under corpus/incoming/.
 * A maintainer reviews it, CI runs the SAME python validator
 * (build_corpus.check) that guards every other write, and only then does
 * it land in the corpus. Nothing here can corrupt attested.json — the
 * worst a bad submission can do is be a PR that fails CI and is closed.
 *
 * Everything that matters is still borrowed from the product rather than
 * reimplemented: the preview is drawn by site/js/render.js against
 * blocks.css, the spelling is parsed by site/js/sounds.js, the word
 * suggestions and "already attested?" check are site/js/reverse.js +
 * corpus.js, and the model comparison is site/js/g2p.js. This file is the
 * workflow around them, trimmed to the one thing a stranger can do: read
 * a source and offer it.
 *
 * The image is PROVENANCE, not input. Nothing here reads its pixels — it
 * is sent so that "where did this spelling come from" still has an answer
 * in a year, which is the one thing every entry written before the
 * workbench existed is missing.
 */

const $ = (id) => document.getElementById(id);

// Where a finished submission goes: the Worker that opens the PR. Set in
// contribute.html so the endpoint is edited in one obvious place; empty
// until it is configured, and the submit button says so rather than
// posting into the void.
const SUBMIT_URL =
  (window.AVATARIAN_CONTRIB && window.AVATARIAN_CONTRIB.submitUrl) || "";

// Mirror tools/corpus_server.py: an accidental 200 MB paste should fail
// fast in the browser rather than be uploaded and rejected. The Worker
// enforces the same ceiling — this is the courtesy copy.
const MAX_IMAGE = 24 * 1024 * 1024;
const IMAGE_TYPES = {
  "image/png": ".png", "image/jpeg": ".jpg",
  "image/webp": ".webp", "image/gif": ".gif",
};

const state = {
  // The one source being contributed. A contribution is always a fresh
  // sighting citing a source the contributor is describing right now.
  // `credit` is who READ the Avatarian — the reading is the contribution,
  // so that is the credit that matters, and it is not always the submitter.
  source: { name: "", what: "", where: "", confidence: "certain", credit: "" },
  submitter: "",        // who is sending it (may differ from who read it)
  image: null,          // { name, mime, dataUrl, bytes } once one is dropped
  entries: [],          // the sightings read off it this session
  submitting: false,
};

// ---------------------------------------------------------------------
// Spelling <-> symbols  (verbatim from the workbench — the box takes the
// same ASCII codes the main site does, and stores IPA)
// ---------------------------------------------------------------------

function spellingToIPA(text) {
  return soundTextToWords(text).flatMap((w) => w.ipa);
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
 *
 * `derivedLookup` rather than `lookupWord` on purpose: the corpus must
 * not seed a transcription that is about to be compared against the
 * corpus — asking the model what it thinks while it is not allowed to
 * consult the answer.
 */
function derivedSpelling(word) {
  const { ipa, tier } = derivedLookup(word);
  if (!ipa.length) return null;
  const tokens = ipa.slice();
  if (tokens.length % 2) tokens.push("∅");
  return { tokens, tier };
}

/**
 * The lookup key for a word, normalised the way the corpus stores keys.
 * Mirrors build_corpus.normalise_key (via normaliseWord from g2p.js), so
 * "Zuko" and "zuko" are one word and a key the validator would bounce is
 * never built here. The word as typed is kept as the gloss.
 */
function corpusKey(word) {
  return String(word || "").trim().split(/\s+/)
    .map(normaliseWord).filter(Boolean).join(" ");
}

// ---------------------------------------------------------------------
// Status + problems
// ---------------------------------------------------------------------

function setStatus(text, cls = "") {
  const el = $("submitState");
  el.textContent = text;
  el.className = "save-state " + cls;
}

function showProblems(problems) {
  const box = $("problems");
  box.hidden = !problems.length;
  box.textContent = problems.length
    ? `${problems.length} problem(s):\n` + problems.map((p) => "  " + p).join("\n")
    : "";
  if (problems.length) box.scrollIntoView({ block: "nearest" });
}

// ---------------------------------------------------------------------
// The source being described
// ---------------------------------------------------------------------

function readSourceFields() {
  state.source.name = $("srcName").value.trim();
  state.source.what = $("srcWhat").value.trim();
  state.source.where = $("srcWhere").value.trim();
  state.source.confidence = $("srcConfidence").value;
  state.submitter = $("submitter").value.trim();
  // Who to credit for the READING. "Someone else" credits the named
  // reader; otherwise the reading is the submitter's own, so they get the
  // credit (blank when they chose to stay anonymous — an honest unknown).
  state.source.credit = $("translatorWho").value === "other"
    ? $("translatorName").value.trim()
    : state.submitter;
}

/** Show the "who read it" name field only when it is someone else. */
function syncTranslatorField() {
  $("translatorNameField").hidden = $("translatorWho").value !== "other";
}

// ---------------------------------------------------------------------
// The reference image (kept in memory, sent with the submission)
// ---------------------------------------------------------------------

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

async function imageDropped(file) {
  if (!IMAGE_TYPES[file.type]) {
    showProblems([`${file.type || "that file"} is not an image type this `
      + `accepts (${Object.keys(IMAGE_TYPES).map((t) => t.split("/")[1]).join(", ")}).`]);
    return;
  }
  if (file.size > MAX_IMAGE) {
    showProblems([`That image is ${(file.size / 1048576).toFixed(1)} MB — the `
      + `limit is 24 MB. Shrink it and try again.`]);
    return;
  }
  const dataUrl = await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  state.image = { name: file.name || "source", mime: file.type, dataUrl, bytes: file.size };
  const img = $("sourceImage");
  img.src = dataUrl;
  img.hidden = false;
  $("dropHint").hidden = true;
  $("imageName").textContent =
    `${file.name || "image"} · ${(file.size / 1024).toFixed(0)} KB`;
  applyZoom();
  showProblems([]);
  updateSubmit();
}

function applyZoom() {
  const img = $("sourceImage");
  img.style.width = $("imageZoom").value + "%";
  $("imageZoom").closest(".zoom-ctl").hidden = img.hidden;
}

// ---------------------------------------------------------------------
// The spelling controls: palette, draw pad, tokens
// ---------------------------------------------------------------------
//
// The palette and the draw pad write to whichever sounds field you last
// touched — a row's codes, or the transcription box. `offsetParent` is
// the hidden check: a field in a closed panel is never the target.

let activeSoundField = null;

function soundTarget() {
  if (activeSoundField && document.contains(activeSoundField)
      && activeSoundField.offsetParent !== null) return activeSoundField;
  return $("impText");
}

function trackSoundField(el) {
  el.addEventListener("focus", () => { activeSoundField = el; });
}

/** Tell whatever owns the field that it changed. */
function afterSoundEdit(box) {
  box.dispatchEvent(new Event("input", { bubbles: true }));
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
  box.focus({ preventScroll: true });
  box.setSelectionRange(pos, pos);
  afterSoundEdit(box);
}

/**
 * `$` and `%` are not sounds — they ride on the sound before them, so
 * they attach to the token to the left of the caret.
 */
function appendOverride(mark) {
  const box = soundTarget();
  const at = Number.isInteger(box.selectionStart) ? box.selectionStart : box.value.length;
  const before = box.value.replace(/\s+$/, "").slice(0, at).replace(/[$%]+$/, "");
  if (!before.trim()) return;
  const after = box.value.slice(at);
  box.value = before + mark + after;
  box.focus({ preventScroll: true });
  box.setSelectionRange(before.length + 1, before.length + 1);
  afterSoundEdit(box);
}

function deleteToken() {
  const box = soundTarget();
  const at = Number.isInteger(box.selectionStart) ? box.selectionStart : box.value.length;
  const before = box.value.slice(0, at).replace(/\s*\S+\s*$/, "");
  box.value = before + box.value.slice(at);
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
// Transcribing the source
// ---------------------------------------------------------------------
//
// A reference image almost never holds one word — it holds a line, a
// caption, a poster. So the unit of work is the SOURCE: transcribe the
// whole thing in one go with "/" between words, and get one row per word
// out. The parser is soundTextToWords (the site's own sounds syntax:
// "/" between words, "(brackets)" for a word you already know).

/** The parsed rows, rebuilt whenever the transcription changes. */
let importRows = [];

/**
 * Words the English box filled in, and the spelling the MODEL gave each
 * one — plus the ones since confirmed against the image. A seeded
 * spelling is an inference; a corpus entry is an observation; and the
 * corpus is only worth anything because it keeps those apart. So a seeded
 * row is unsaveable until either the spelling CHANGED (you corrected it
 * against the image) or you ticked it (you looked, and it agreed).
 */
let importSeeded = new Map();
let importConfirmed = new Set();

/**
 * English in, a first draft of the sounds out. Odd counts get the
 * trailing null the block model requires. Mid-word nulls are deliberately
 * NOT guessed — canon puts them where the model cannot derive them (this
 * is what `appa` is), so leaving them out keeps the draft honestly wrong
 * rather than invisibly wrong.
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

/**
 * Split the transcription into words and work out what each one is.
 * A caption wins over a suggestion: if you already know the word, saying
 * so is not something the reverse-decode should overrule.
 */
function parseImport() {
  const words = soundTextToWords($("impText").value);
  importRows = words.map((w) => {
    const known = (w.word || "").trim();
    const suggestions = suggestWords(w.ipa, 4);
    const guess = known || (suggestions[0]?.word ?? "");
    const row = {
      ipa: w.ipa,
      word: guess,
      fromCaption: !!known,
      suggestions,
      checked: importConfirmed.has(corpusKey(guess)),
    };
    row.needsCheck = seedUnchanged(row);
    return row;
  });
  recountRows();
  renderImportRows();
}

/**
 * Work out each row's relation, then fold repeats onto the row that first
 * recorded them. A repeat is not thrown away: the word really was written
 * that many times, and three renderings rule out a slip of the pen in a
 * way one does not. It is counted on the FIRST row, so the source yields
 * one entry carrying `times` rather than N the validator would reject.
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

function repaintAllFlags() {
  for (const row of importRows) {
    if (!row.flagBox) continue;
    row.el.classList.toggle("is-unchecked", row.needsCheck && !row.checked);
    row.el.classList.toggle("is-repeat", (row.relation || {}).kind === "repeat");
    paintFlags(row, row.flagBox);
  }
}

/**
 * How a row relates to what is already known — the sightings recorded
 * this session, and the shipped corpus.
 *
 *   repeat        the same word+spelling appeared earlier in THIS
 *                 transcription — counted there, not recorded twice.
 *   duplicate     already added this session with this spelling. Nothing
 *                 to add.
 *   attested      the shipped corpus already has this word. A fresh
 *                 sighting is still worth submitting — corroboration is
 *                 evidence — but the contributor should know it is not new.
 *   conflict      the corpus has it spelled differently. Worth submitting:
 *                 sources disagreeing is a finding about the script.
 */
function importRelation(row) {
  const word = corpusKey(row.word);
  if (!word) return { kind: "new" };
  const spelling = row.ipa.join(" ");

  // A line can repeat a word — two rows that agree exactly would be the
  // same observation entered twice, which the validator rejects.
  const at = importRows.indexOf(row);
  const earlier = importRows.findIndex(
    (other, i) => i < at
      && corpusKey(other.word) === word
      && other.ipa.join(" ") === spelling);
  if (at > 0 && earlier >= 0) return { kind: "repeat", at: earlier };

  // Already staged this session (same source, since a contribution has
  // only one). Same spelling is a duplicate; a different one is the
  // contributor disagreeing with themselves — left alone, it records as
  // two alternates.
  const staged = state.entries.findIndex(
    (e) => corpusKey(e.key) === word && (e.spelling || "") === spelling);
  if (staged >= 0) return { kind: "duplicate", at: staged };

  // The shipped corpus. corpusWords() is keyed by the normalised word.
  const attested = corpusWords()[word];
  if (attested) {
    const same = (attested.ipa || []).join(" ") === spelling;
    return same
      ? { kind: "attested" }
      : { kind: "conflict", spelling: (attested.ipa || []).join(" ") };
  }
  return { kind: "new" };
}

/** Is this row still exactly what the model wrote for it? */
function seedUnchanged(row) {
  const seed = importSeeded.get(corpusKey(row.word));
  return seed !== undefined && seed === row.ipa.join(" ");
}

/** Rewrite the transcription box from the rows, so a row edit lands there. */
function syncImportText() {
  $("impText").value = wordsToSoundText(
    importRows.map((r) => ({ word: r.word || "", ipa: r.ipa })));
}

/**
 * The warnings under one row, rebuilt in place. Separate from
 * renderImportRows because editing a spelling changes which apply — an
 * odd count appears and clears as you type — and rebuilding the whole
 * list to say so would move the caret.
 */
function paintFlags(row, into) {
  into.innerHTML = "";
  const flags = [];

  if (row.ipa.length % 2) {
    flags.push(["is-warn", `${row.ipa.length} symbols — odd, so a null is `
      + `missing. This one can't be submitted as it stands.`]);
  }
  // Glyphs the renderer has no drawing for would fail validation too.
  const bodies = row.ipa.map((t) => splitOverride(t).body);
  const unknown = [...new Set(bodies.filter(
    (sym) => sym !== "*" && !(window.AVATARIAN_GLYPHS || {})[sym]))];
  if (unknown.length) {
    flags.push(["is-warn", `No glyph for: ${unknown.join(" ")}. Check the `
      + `codes — a symbol with no glyph can't be submitted.`]);
  }
  if (row.times > 1) {
    flags.push(["is-ok",
      `Written ${row.times} times in this transcription. All ${row.times} are `
      + `counted on this one entry — repeats of a spelling are evidence.`]);
  }

  const rel = row.relation || { kind: "new" };
  if (rel.kind === "repeat") {
    flags.push(["is-muted",
      `Same spelling as word ${rel.at + 1}, so it is counted there rather `
      + `than recorded again.`]);
  } else if (rel.kind === "duplicate") {
    flags.push(["is-dupe",
      `Already added this session with this spelling — nothing to add.`]);
  } else if (rel.kind === "attested") {
    flags.push(["is-ok",
      `Already in the corpus, spelled the same way. Submitting records a `
      + `second sighting — corroboration is what makes a spelling solid.`]);
  } else if (rel.kind === "conflict") {
    flags.push(["is-dupe",
      `The corpus spells this ${ipaToSpelling(rel.spelling.split(" "))}. Both `
      + `are kept — sources disagreeing is a real finding, worth submitting.`]);
  }

  // Against the model: the comparison that makes the corpus a research
  // instrument rather than a spelling patch. Only when the word is known
  // and the model has an opinion of its own.
  if (row.word && !(row.ipa.length % 2)) {
    const derived = derivedSpelling(row.word);
    if (derived && derived.tokens.join(" ") !== row.ipa.join(" ")) {
      const sameSounds =
        soundsOnly(row.ipa).join(" ") === soundsOnly(derived.tokens).join(" ");
      flags.push(["is-muted", (sameSounds
        ? `Same sounds, different blocks from the model `
          + `(${ipaToSpelling(derived.tokens)}) — you're recording a pairing `
          + `the model gets wrong.`
        : `Different from the model (${ipaToSpelling(derived.tokens)}) — the `
          + `pronunciation it assumes is off, not just the blocks.`)]);
    }
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
      cb.addEventListener("change", () => { onToggle(cb.checked); updateImportSummary(); });
      wrap.append(cb, document.createTextNode(" " + label));
      p.appendChild(wrap);
    }
    into.appendChild(p);
  }
}

function renderImportRows() {
  const box = $("impRows");
  box.innerHTML = "";

  importRows.forEach((row) => {
    const el = document.createElement("div");
    el.className = "imp-row"
      + (row.needsCheck && !row.checked ? " is-unchecked" : "")
      + ((row.relation || {}).kind === "repeat" ? " is-repeat" : "");

    const art = document.createElement("div");
    art.className = "imp-art";
    renderAvatarian(row.ipa, art);

    const body = document.createElement("div");
    body.className = "imp-body";

    const codes = document.createElement("input");
    codes.type = "text";
    codes.className = "imp-codes";
    codes.spellcheck = false;
    codes.value = ipaToSpelling(row.ipa);
    codes.title = "The spelling as it will be submitted. Edit it to match the "
                + "image — 0 is a null.";
    trackSoundField(codes);

    const flagBox = document.createElement("div");
    flagBox.className = "imp-flags";
    row.el = el;
    row.flagBox = flagBox;

    const repaint = () => {
      row.needsCheck = seedUnchanged(row);
      art.innerHTML = "";
      renderAvatarian(row.ipa, art);
      recountRows();
      repaintAllFlags();
      syncImportText();
      updateImportSummary();
    };

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
      row.fromCaption = !!row.word;
      row.checked = importConfirmed.has(corpusKey(row.word));
      repaint();
    });

    body.append(input, codes);

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

/** What the "add these" button is actually about to do. */
function importPlan() {
  const add = [], blocked = [], unchecked = [], merged = [];
  for (const row of importRows) {
    if (!row.word) { blocked.push(row); continue; }
    if (row.ipa.length % 2) { blocked.push(row); continue; }
    const bodies = row.ipa.map((t) => splitOverride(t).body);
    if (bodies.some((s) => s !== "*" && !(window.AVATARIAN_GLYPHS || {})[s])) {
      blocked.push(row); continue;
    }
    if (row.needsCheck && !row.checked) { unchecked.push(row); continue; }
    const kind = (row.relation || {}).kind;
    if (kind === "repeat") { merged.push(row); continue; }
    if (kind === "duplicate") { blocked.push(row); continue; }
    add.push(row);
  }
  return { add, blocked, unchecked, merged };
}

function updateImportSummary() {
  const { add, blocked, unchecked, merged } = importPlan();
  const bits = [];
  if (add.length) bits.push(`${add.length} to add`);
  if (merged.length) bits.push(`${merged.length} counted onto a repeat`);
  if (unchecked.length) bits.push(`${unchecked.length} unchecked`);
  if (blocked.length) bits.push(`${blocked.length} skipped`);

  const all = $("impCheckAll");
  all.hidden = !unchecked.length;
  all.textContent = unchecked.length === 1
    ? "it matches the image" : "all of them match the image";
  $("impSummary").textContent = importRows.length
    ? bits.join(" · ") || "nothing to add"
    : "";
  $("impAdd").disabled = !add.length;
  const n = (k) => `${k} ${k === 1 ? "sighting" : "sightings"}`;
  $("impAdd").textContent = add.length ? `add ${n(add.length)}` : "add sightings";
}

/** Fold the confirmed rows into the staged sightings. */
function commitImport() {
  readSourceFields();
  if (!state.source.name) {
    showProblems(["Give the source a name first — it is how the entries cite it."]);
    $("srcName").focus();
    return;
  }
  const confidence = state.source.confidence;
  const make = (row) => {
    const key = corpusKey(row.word);
    const entry = { key, spelling: row.ipa.join(" "),
                    source: state.source.name, confidence };
    if (row.word && row.word !== key) entry.gloss = row.word;
    if (row.times > 1) entry.times = row.times;
    return entry;
  };

  const { add } = importPlan();
  for (const row of add) state.entries.push(make(row));

  showProblems([]);
  // Clear the transcription but keep the source — the next thing is
  // usually another line off the same image.
  $("impText").value = "";
  $("impEnglish").value = "";
  importSeeded = new Map();
  importConfirmed = new Set();
  importRows = [];
  renderImportRows();
  renderStaged();
  setStatus(`${add.length} sighting${add.length === 1 ? "" : "s"} ready — `
            + `add more, or submit below.`, "is-dirty");
}

// ---------------------------------------------------------------------
// The staged sightings + submit
// ---------------------------------------------------------------------

function renderStaged() {
  const box = $("stagedWords");
  box.innerHTML = "";
  const count = $("stagedCount");
  if (!state.entries.length) {
    box.innerHTML = '<p class="empty">Nothing staged yet. Transcribe the '
      + 'source above and press <b>add sightings</b>.</p>';
    count.textContent = "";
    updateSubmit();
    return;
  }
  const sightings = state.entries.reduce((n, e) => n + (e.times || 1), 0);
  count.textContent = `${state.entries.length} word`
    + `${state.entries.length === 1 ? "" : "s"} · ${sightings} sighting`
    + `${sightings === 1 ? "" : "s"}`;

  state.entries.forEach((entry, index) => {
    const tokens = (entry.spelling || "").split(" ").filter(Boolean);
    const card = document.createElement("div");
    card.className = "source-word";

    const art = document.createElement("span");
    art.className = "source-word-art";
    renderAvatarian(tokens, art);

    const label = document.createElement("span");
    label.className = "source-word-key";
    label.textContent = entry.gloss || entry.key || "(unnamed)";
    if ((entry.times || 1) > 1) {
      const meta = document.createElement("span");
      meta.className = "source-word-meta";
      meta.textContent = `${entry.times}×`;
      label.appendChild(meta);
    }

    const del = document.createElement("button");
    del.type = "button";
    del.className = "staged-del";
    del.title = "remove this sighting";
    del.textContent = "×";
    del.addEventListener("click", () => {
      state.entries.splice(index, 1);
      renderStaged();
      // A staged word changes what counts as a duplicate below.
      recountRows();
      repaintAllFlags();
    });

    card.append(art, label, del);
    box.appendChild(card);
  });
  updateSubmit();
}

/** Turnstile calls this back with a token (see contribute.html). */
window.onTurnstile = (token) => { state.turnstileToken = token; updateSubmit(); };
window.onTurnstileExpired = () => { state.turnstileToken = null; updateSubmit(); };

/** Whether every precondition for a submission is met, and enable/label. */
function updateSubmit() {
  const btn = $("submitBtn");
  const needsTurnstile = !!(window.AVATARIAN_CONTRIB
    && window.AVATARIAN_CONTRIB.turnstileSiteKey);
  const ready = !state.submitting
    && state.entries.length > 0
    && !!state.source.name
    && !!state.image
    && (!needsTurnstile || !!state.turnstileToken);
  btn.disabled = !ready;

  const why = [];
  if (!state.entries.length) why.push("add at least one sighting");
  if (!state.source.name) why.push("name the source");
  if (!state.image) why.push("attach the reference image");
  if (needsTurnstile && !state.turnstileToken) why.push("complete the check");
  $("submitWhy").textContent = state.submitting ? "" : why.join(" · ");

  updateSelfServe();
}

// ---------------------------------------------------------------------
// The GitHub-account path: build the same staged file and hand it to
// GitHub's new-file editor prefilled, so a contributor can open the PR
// under their own name instead of through the submission Worker.
// ---------------------------------------------------------------------

/** Mirror the Worker's safe_stem, so the file lands under the same name. */
function safeStem(name) {
  return String(name || "").trim()
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[-.]+|[-.]+$/g, "")
    .replace(/\.(png|jpe?g|webp|gif|heic|tiff?)$/i, "")
    .slice(0, 60) || "source";
}

function shortId() {
  return Math.random().toString(36).slice(2, 8);
}

/**
 * The staged submission object — the exact shape the Worker writes and
 * promote_corpus.py folds, built client-side so the self-serve path
 * produces an identical file. The image bytes are not here (a prefilled
 * link cannot carry a binary); only its filename, which the contributor
 * uploads to match.
 */
function buildSubmissionObject() {
  const name = safeStem(state.source.name);
  const ext = (state.image && IMAGE_TYPES[state.image.mime]) || ".png";
  const imageFile = name + ext;
  const entries = state.entries.map((e) => {
    const out = { key: e.key, spelling: e.spelling, source: name,
                  confidence: e.confidence || "certain" };
    if (e.gloss) out.gloss = e.gloss;
    if (e.times && e.times > 1) out.times = e.times;
    if (e.note) out.note = e.note;
    return out;
  });
  const sub = {
    _submission: { at: new Date().toISOString(), via: "contribute.html" },
    source: { name, what: state.source.what, where: state.source.where, image: imageFile },
    entries,
  };
  if (state.submitter) sub._submission.submitter = state.submitter;
  if (state.source.credit) sub.source.credit = state.source.credit;
  return { sub, name, imageFile };
}

function updateSelfServe() {
  const cfg = window.AVATARIAN_CONTRIB || {};
  const repo = cfg.repo || "";
  const branch = cfg.baseBranch || "main";
  const link = $("selfserveLink");
  const hint = $("selfserveHint");
  const ready = state.entries.length && state.source.name && state.image && repo;

  if (!ready) {
    link.classList.add("is-disabled");
    link.setAttribute("aria-disabled", "true");
    link.removeAttribute("href");
    $("ssImageName").textContent = "the image";
    hint.textContent = !repo
      ? "This site has no repository configured for the self-serve path."
      : "Stage a sighting and attach the image first to build the file.";
    state.selfServeJson = "";
    return;
  }

  const { sub, imageFile } = buildSubmissionObject();
  const slug = safeStem(state.source.name) + "-" + shortId();
  const json = JSON.stringify(sub, null, 2) + "\n";
  const filename = "corpus/incoming/" + slug + ".json";
  link.href = "https://github.com/" + repo + "/new/" + encodeURIComponent(branch)
    + "?filename=" + encodeURIComponent(filename)
    + "&value=" + encodeURIComponent(json);
  link.classList.remove("is-disabled");
  link.removeAttribute("aria-disabled");
  $("ssImageName").textContent = imageFile;
  hint.textContent = `The link opens GitHub with ${filename} prefilled. Upload `
    + `your image as ${imageFile} in the same pull request.`;
  state.selfServeJson = json;
}

async function submit() {
  readSourceFields();
  updateSubmit();
  if ($("submitBtn").disabled) return;

  if (!SUBMIT_URL) {
    showProblems(["This site has no submission endpoint configured yet "
      + "(window.AVATARIAN_CONTRIB.submitUrl). Nothing was sent."]);
    return;
  }

  state.submitting = true;
  updateSubmit();
  setStatus("submitting…");
  showProblems([]);

  const payload = {
    source: {
      name: state.source.name,
      what: state.source.what,
      where: state.source.where,
      ...(state.source.credit ? { credit: state.source.credit } : {}),
    },
    submitter: state.submitter || null,
    entries: state.entries.map((e) => ({ ...e })),
    image: { name: state.image.name, dataUrl: state.image.dataUrl },
    turnstileToken: state.turnstileToken || null,
  };

  try {
    const res = await fetch(SUBMIT_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok && body.ok) {
      showSubmitted(body.prUrl);
    } else {
      showProblems(body.error
        ? [body.error]
        : [`Submission failed (HTTP ${res.status}). Nothing was recorded.`]);
      setStatus("not submitted — see above", "is-error");
    }
  } catch (e) {
    showProblems([`Could not reach the submission service: ${e}. `
      + `Nothing was recorded.`]);
    setStatus("not submitted — see above", "is-error");
  } finally {
    state.submitting = false;
    // Turnstile tokens are single-use; force a fresh one for a retry.
    state.turnstileToken = null;
    if (window.turnstile) { try { window.turnstile.reset(); } catch (_) {} }
    updateSubmit();
  }
}

/** Replace the form with a thank-you and the PR link. */
function showSubmitted(prUrl) {
  setStatus("submitted — thank you", "is-ok");
  const done = $("submitted");
  done.hidden = false;
  const link = $("submittedLink");
  if (prUrl) {
    link.href = prUrl;
    link.textContent = prUrl;
    link.hidden = false;
  } else {
    link.hidden = true;
  }
  $("contribForm").hidden = true;
  done.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------

function wire() {
  // Source fields.
  for (const id of ["srcName", "srcWhat", "srcWhere", "submitter", "translatorName"]) {
    $(id).addEventListener("input", () => { readSourceFields(); updateSubmit(); });
  }
  $("srcConfidence").addEventListener("change", readSourceFields);
  $("translatorWho").addEventListener("change", () => {
    syncTranslatorField(); readSourceFields(); updateSubmit();
  });
  syncTranslatorField();

  // The self-serve "copy the submission JSON" button.
  $("copyJson").addEventListener("click", async () => {
    if (!state.selfServeJson) return;
    const state_el = $("copyState");
    try {
      await navigator.clipboard.writeText(state.selfServeJson);
      state_el.textContent = "copied";
    } catch {
      state_el.textContent = "copy failed — use the link instead";
    }
    setTimeout(() => { state_el.textContent = ""; }, 2500);
  });
  // A disabled self-serve link should not navigate.
  $("selfserveLink").addEventListener("click", (e) => {
    if ($("selfserveLink").classList.contains("is-disabled")) e.preventDefault();
  });

  // Image.
  wireDrop($("dropzone"), imageDropped);
  window.addEventListener("paste", (e) => {
    const item = [...(e.clipboardData?.items || [])]
      .find((i) => i.type.startsWith("image/"));
    if (item) imageDropped(item.getAsFile());
  });
  $("imageZoom").addEventListener("input", applyZoom);

  // Transcription.
  $("impDerive").addEventListener("click", deriveFromEnglish);
  $("impEnglish").addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); deriveFromEnglish(); }
  });
  let timer = null;
  $("impText").addEventListener("input", () => {
    clearTimeout(timer);
    timer = setTimeout(parseImport, 200);
  });
  $("impAdd").addEventListener("click", commitImport);
  $("impCheckAll").addEventListener("click", () => {
    for (const row of importRows) {
      if (row.needsCheck && !row.checked) {
        row.checked = true;
        importConfirmed.add(corpusKey(row.word));
      }
    }
    renderImportRows();
  });
  // The source name decides whether a row is a duplicate of a staged one.
  $("srcName").addEventListener("input", () => {
    for (const row of importRows) row.relation = importRelation(row);
    renderImportRows();
  });

  // The shared sounds controls.
  trackSoundField($("impText"));
  document.querySelectorAll(".sound-tools [data-insert]").forEach((b) => {
    const text = b.dataset.insert;
    b.addEventListener("click", () =>
      text === "$" || text === "%" ? appendOverride(text) : insertToken(text));
  });
  $("delToken").addEventListener("click", deleteToken);
  $("clearSpelling").addEventListener("click", () => {
    $("impText").value = "";
    parseImport();
  });

  createDrawPad($("drawpad"), { onPick: (hit) => insertToken(hit.code) });

  $("submitBtn").addEventListener("click", submit);

  window.addEventListener("beforeunload", (e) => {
    if (!state.entries.length && !importRows.length) return;
    e.preventDefault();
    e.returnValue = "";
  });
}

buildPalette();
wire();
renderImportRows();
renderStaged();
