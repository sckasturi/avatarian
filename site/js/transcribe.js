/**
 * The transcription workflow's shared pieces.
 *
 * Two pages read a source and record what is written on it: the local
 * workbench (workbench/js/app.js, which saves to the repo) and the public
 * contribute page (site/js/contribute.js, which can only submit). The
 * second began as a copy of the first, and these functions were the part
 * of the copy that never needed to differ. They live here once so a fix to
 * the palette or the repeat-counting cannot land in one page and not the
 * other.
 *
 * Like everything in site/js/ this is a classic script sharing one global
 * scope. Each function reaches for things its PAGE defines — `$`, `state`,
 * `importRows`, `importRelation`, `paintFlags`, `insertToken`, and the
 * elements the page's HTML carries — so load this before the page's own
 * script, after g2p.js, sounds.js and render.js. What is still written
 * twice (the import rows, the flags, the token editing) differs between
 * the two pages in ways that are deliberate: one saves, one stages.
 */

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

function trackSoundField(el) {
  el.addEventListener("focus", () => { activeSoundField = el; });
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
