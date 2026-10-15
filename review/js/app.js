/**
 * The submission review console.
 *
 * Lists the open contribution pull requests the Worker has opened, draws
 * each with the product's own renderer (site/js/render.js against
 * blocks.css), and lets you edit the details, then approve — name it, and
 * the server merges the PR, folds the (possibly edited) submission into the
 * corpus, and pushes — or reject (close the PR).
 *
 * Edits are applied server-side over the merged staged file and validated
 * with the same build_corpus.check that guards every other write, so a bad
 * edit is refused before anything is merged. GitHub and git work all happen
 * in tools/review_server.py; this is the workflow around it.
 */

const $ = (id) => document.getElementById(id);

const state = { submissions: [], busy: false };

// Codes <-> IPA, the same way the contribute page and workbench do it, so
// an edited spelling is parsed by the product's own sounds.js.
function spellingToIPA(text) { return soundTextToWords(text).flatMap((w) => w.ipa); }
function ipaToSpelling(ipa) {
  return ipa && ipa.length ? wordsToSoundText([{ word: "", ipa }]) : "";
}

function banner(text, cls = "") {
  const el = $("banner");
  el.hidden = !text;
  el.textContent = text || "";
  el.className = "banner " + cls;
}

/** A source name guessed from what the source is, for the name field. */
function slugify(text) {
  return String(text || "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40);
}

async function load() {
  banner("loading…");
  try {
    const res = await fetch("/api/submissions");
    const body = await res.json();
    if (body.error) { banner(body.error, "is-error"); return; }
    state.submissions = body.submissions || [];
    $("repo").textContent = body.repo || "";
    render();
    banner("");
  } catch (e) {
    banner("Could not reach the review server: " + e, "is-error");
  }
}

function render() {
  const list = $("list");
  list.innerHTML = "";
  const n = state.submissions.length;
  $("count").textContent = n ? `${n} awaiting review` : "";
  if (!n) {
    list.innerHTML = '<p class="empty">No open submissions. When someone '
      + 'contributes, their pull request shows up here.</p>';
    return;
  }
  for (const sub of state.submissions) list.appendChild(card(sub));
}

function field(label, hint, control) {
  const wrap = document.createElement("label");
  wrap.className = "efield";
  wrap.innerHTML = `<span class="efield-label">${label}`
    + (hint ? ` <span class="efield-hint">${hint}</span>` : "") + `</span>`;
  wrap.appendChild(control);
  return wrap;
}

function card(sub) {
  const el = document.createElement("section");
  el.className = "card";
  el.dataset.number = sub.number;

  const srcs = sub.sources || [];
  const firstMeta = ((srcs[0] || {}).submission || {})._submission || {};

  const head = document.createElement("div");
  head.className = "card-head";
  head.innerHTML = `<a class="pr" target="_blank" rel="noopener"></a>`
    + `<span class="by"></span><span class="spacer"></span><span class="when"></span>`;
  head.querySelector(".pr").href = sub.url;
  head.querySelector(".pr").textContent =
    `PR #${sub.number}` + (srcs.length > 1 ? ` · ${srcs.length} sources` : "");
  head.querySelector(".by").textContent =
    "by " + (firstMeta.submitter || sub.author || "anonymous");
  head.querySelector(".when").textContent = new Date(sub.createdAt).toLocaleString();
  el.appendChild(head);

  // One editable block per staged source (a batch stages several).
  const blocks = [];
  for (const src of srcs) {
    const b = sourceBlock(sub, src);
    el.appendChild(b.el);
    if (b.collect) blocks.push(b);
  }

  el.appendChild(prActions(sub, blocks));
  return el;
}

/** One staged source: its image, editable fields + entries, and a name. */
function sourceBlock(sub, src) {
  const wrap = document.createElement("div");
  wrap.className = "source-block";

  const s = src.submission || {};
  const source = s.source || {};
  const meta = s._submission || {};
  const entries = s.entries || [];

  if (src.error || !s.source) {
    const bad = document.createElement("p");
    bad.className = "card-error";
    bad.textContent = `Couldn't read ${src.slug}: ` + (src.error || "malformed");
    wrap.appendChild(bad);
    return { el: wrap, collect: null };
  }

  const body = document.createElement("div");
  body.className = "card-body";

  const imgCol = document.createElement("div");
  imgCol.className = "img-col";
  if (src.imagePath) {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = "/api/image?branch=" + encodeURIComponent(sub.branch)
            + "&path=" + encodeURIComponent(src.imagePath);
    img.alt = "reference image";
    imgCol.appendChild(img);
  } else {
    imgCol.innerHTML = '<p class="no-image">no image</p>';
  }
  body.appendChild(imgCol);

  const info = document.createElement("div");
  info.className = "info-col";

  // The name this source will be filed under — the Worker already suggested
  // <category>.<slide> as the slug, so start from that; a placeholder gets a
  // guess from "what".
  const nameEl = document.createElement("input");
  nameEl.type = "text"; nameEl.className = "name-input";
  nameEl.value = /^submission-/.test(src.slug)
    ? (slugify(source.what) || src.slug) : src.slug;

  const whatEl = document.createElement("textarea");
  whatEl.rows = 2; whatEl.value = source.what || "";
  const whereEl = document.createElement("input");
  whereEl.type = "text"; whereEl.value = source.where || "";
  const creditEl = document.createElement("input");
  creditEl.type = "text"; creditEl.value = source.credit || "";
  info.append(
    field("Name", "how it is filed", nameEl),
    field("What", "and what it says", whatEl),
    field("Where", "", whereEl),
    field("Read by", "credit — blank if the source itself is translated", creditEl),
  );

  const words = document.createElement("div");
  words.className = "words";
  const rows = entries.map((entry) => entryRow(entry, words));
  info.appendChild(words);

  body.appendChild(info);
  wrap.appendChild(body);

  const collect = () => ({
    _submission: meta,
    source: {
      name: source.name,
      what: whatEl.value.trim(),
      where: whereEl.value.trim(),
      image: source.image,
      ...(creditEl.value.trim() ? { credit: creditEl.value.trim() } : {}),
    },
    entries: rows.map((r) => r.read()),
  });

  return { el: wrap, slug: src.slug, nameEl, collect };
}

/** One editable entry: live-rendered art + word + codes + confidence. */
function entryRow(entry, container) {
  const chip = document.createElement("div");
  chip.className = "word";
  let ipa = (entry.spelling || "").split(" ").filter(Boolean);

  const art = document.createElement("div");
  art.className = "word-art";
  const draw = () => {
    art.innerHTML = "";
    try { renderAvatarian(ipa, art); } catch (_) { art.textContent = "?"; }
  };
  draw();

  const word = document.createElement("input");
  word.type = "text"; word.className = "word-input";
  word.value = entry.gloss || entry.key || "";
  word.title = "the word this spells (display form)";

  const codes = document.createElement("input");
  codes.type = "text"; codes.className = "codes-input"; codes.spellcheck = false;
  codes.value = ipaToSpelling(ipa);
  codes.title = "the spelling, in codes — edit to fix a slot; - is a null";
  codes.addEventListener("input", () => {
    ipa = spellingToIPA(codes.value);
    draw();
    warn.textContent = ipa.length % 2 ? "odd — a null is missing" : "";
  });

  const conf = document.createElement("select");
  conf.className = "conf-input";
  for (const c of ["certain", "probable", "unclear"]) {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    if ((entry.confidence || "certain") === c) o.selected = true;
    conf.appendChild(o);
  }

  const warn = document.createElement("span");
  warn.className = "word-warn";

  chip.append(art, word, codes, conf, warn);
  container.appendChild(chip);

  return {
    read() {
      const out = { key: entry.key, spelling: ipa.join(" "), confidence: conf.value };
      const g = word.value.trim();
      if (g) out.gloss = g;
      if (entry.times && entry.times > 1) out.times = entry.times;
      if (entry.note) out.note = entry.note;
      return out;
    },
  };
}

function prActions(sub, blocks) {
  const wrap = document.createElement("div");
  wrap.className = "actions";

  if (blocks.length) {
    const approve = document.createElement("button");
    approve.className = "primary";
    approve.textContent = blocks.length > 1
      ? `approve all ${blocks.length} & publish` : "approve & publish";
    approve.addEventListener("click", () => doApprove(sub, blocks, wrap));
    wrap.appendChild(approve);
  }

  const reject = document.createElement("button");
  reject.className = "danger";
  reject.textContent = "reject";
  reject.addEventListener("click", () => doReject(sub, wrap));
  wrap.appendChild(reject);

  const status = document.createElement("span");
  status.className = "action-status";
  wrap.appendChild(status);

  const logBox = document.createElement("pre");
  logBox.className = "log"; logBox.hidden = true;
  wrap.appendChild(logBox);

  return wrap;
}

function setBusy(wrap, on) {
  state.busy = on;
  wrap.closest(".card").querySelectorAll("button, input, textarea, select")
    .forEach((b) => { b.disabled = on; });
}

function showLog(wrap, log, problems) {
  const box = wrap.querySelector(".log");
  const lines = [];
  if (problems && problems.length) lines.push(...problems.map((p) => "• " + p));
  if (log && log.length) {
    lines.push(...log.map((s) =>
      `${s.ok ? "✓" : "✗"} ${s.step}${s.err ? "\n    " + s.err : ""}`));
  }
  if (!lines.length) return;
  box.hidden = false;
  box.textContent = lines.join("\n");
}

async function doApprove(sub, blocks, wrap) {
  if (state.busy) return;
  const sources = blocks.map((b) => ({
    slug: b.slug, name: b.nameEl.value.trim(), submission: b.collect(),
  }));
  const blank = blocks.find((b) => !b.nameEl.value.trim());
  if (blank) { blank.nameEl.focus(); return; }
  const names = sources.map((s) => s.name);
  if (new Set(names).size !== names.length) {
    const status = wrap.querySelector(".action-status");
    status.textContent = "two sources have the same name — make them unique";
    status.className = "action-status is-error";
    return;
  }

  const status = wrap.querySelector(".action-status");
  setBusy(wrap, true);
  status.textContent = "publishing…";
  status.className = "action-status";
  wrap.querySelector(".log").hidden = true;
  try {
    const res = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: sub.number, sources }),
    });
    const body = await res.json();
    showLog(wrap, body.log, body.problems);
    if (body.ok) {
      const what = names.length > 1 ? `${names.length} sources` : `"${names[0]}"`;
      status.textContent = `published ${what} — live on next deploy`;
      status.className = "action-status is-ok";
      markDone(sub.number, `approved ${what}`);
    } else {
      status.textContent = body.error || "failed";
      status.className = "action-status is-error";
      setBusy(wrap, false);
    }
  } catch (e) {
    status.textContent = "error: " + e;
    status.className = "action-status is-error";
    setBusy(wrap, false);
  }
}

async function doReject(sub, wrap) {
  if (state.busy) return;
  const comment = prompt(
    "Reject PR #" + sub.number + "? Optional message to the contributor "
    + "(shown on the closed PR):", "");
  if (comment === null) return;
  const status = wrap.querySelector(".action-status");
  setBusy(wrap, true);
  status.textContent = "closing…";
  try {
    const res = await fetch("/api/reject", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: sub.number, comment }),
    });
    const body = await res.json();
    if (body.ok) {
      markDone(sub.number, "rejected");
    } else {
      status.textContent = body.error || "failed";
      status.className = "action-status is-error";
      setBusy(wrap, false);
    }
  } catch (e) {
    status.textContent = "error: " + e;
    status.className = "action-status is-error";
    setBusy(wrap, false);
  }
}

/** Collapse a handled card to a one-line resolved state. */
function markDone(number, verdict) {
  state.busy = false;
  const card = document.querySelector(`.card[data-number="${number}"]`);
  if (card) {
    card.classList.add("is-done");
    card.innerHTML = `<div class="done">PR #${number} — ${verdict}</div>`;
  }
  state.submissions = state.submissions.filter((s) => s.number !== number);
  const n = state.submissions.length;
  $("count").textContent = n ? `${n} awaiting review` : "all clear";
}

$("refresh").addEventListener("click", load);
load();
