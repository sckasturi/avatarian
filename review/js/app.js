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

  const s = sub.submission || {};
  const source = s.source || {};
  const meta = s._submission || {};
  const entries = s.entries || [];

  const head = document.createElement("div");
  head.className = "card-head";
  head.innerHTML = `<a class="pr" target="_blank" rel="noopener"></a>`
    + `<span class="by"></span><span class="spacer"></span><span class="when"></span>`;
  head.querySelector(".pr").href = sub.url;
  head.querySelector(".pr").textContent = `PR #${sub.number}`;
  head.querySelector(".by").textContent =
    "by " + (meta.submitter || sub.author || "anonymous");
  head.querySelector(".when").textContent = new Date(sub.createdAt).toLocaleString();
  el.appendChild(head);

  if (sub.error || !sub.submission) {
    const bad = document.createElement("p");
    bad.className = "card-error";
    bad.textContent = "Couldn't read this submission: " + (sub.error || "malformed");
    el.appendChild(bad);
    el.appendChild(actions(sub, source, null));
    return el;
  }

  const body = document.createElement("div");
  body.className = "card-body";

  const imgCol = document.createElement("div");
  imgCol.className = "img-col";
  if (sub.imagePath) {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = "/api/image?branch=" + encodeURIComponent(sub.branch)
            + "&path=" + encodeURIComponent(sub.imagePath);
    img.alt = "reference image";
    imgCol.appendChild(img);
  } else {
    imgCol.innerHTML = '<p class="no-image">no image</p>';
  }
  body.appendChild(imgCol);

  const info = document.createElement("div");
  info.className = "info-col";

  // Editable source fields.
  const whatEl = document.createElement("textarea");
  whatEl.rows = 2; whatEl.value = source.what || "";
  const whereEl = document.createElement("input");
  whereEl.type = "text"; whereEl.value = source.where || "";
  const creditEl = document.createElement("input");
  creditEl.type = "text"; creditEl.value = source.credit || "";
  info.append(
    field("What", "and what it says", whatEl),
    field("Where", "", whereEl),
    field("Read by", "credit — blank if the source itself is translated", creditEl),
  );

  // Editable entries.
  const words = document.createElement("div");
  words.className = "words";
  const rows = entries.map((entry) => entryRow(entry, words));
  info.appendChild(words);

  body.appendChild(info);
  el.appendChild(body);

  // Everything the approve needs, read live from the inputs.
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

  el.appendChild(actions(sub, source, collect));
  return el;
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
  codes.title = "the spelling, in codes — edit to fix a slot; 0 is a null";
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

function actions(sub, source, collect) {
  const wrap = document.createElement("div");
  wrap.className = "actions";

  if (collect) {
    const input = document.createElement("input");
    input.type = "text"; input.className = "name-input";
    input.value = slugify(source.what) || sub.slug;
    input.placeholder = "e.g. sonam";
    wrap.appendChild(field("Name the source", "", input));

    const approve = document.createElement("button");
    approve.className = "primary";
    approve.textContent = "approve & publish";
    approve.addEventListener("click", () => doApprove(sub, input.value.trim(), collect, wrap));
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

async function doApprove(sub, name, collect, wrap) {
  if (state.busy) return;
  if (!name) { wrap.querySelector(".name-input").focus(); return; }
  const status = wrap.querySelector(".action-status");
  setBusy(wrap, true);
  status.textContent = "publishing…";
  status.className = "action-status";
  wrap.querySelector(".log").hidden = true;
  try {
    const res = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        number: sub.number, slug: sub.slug, name, submission: collect(),
      }),
    });
    const body = await res.json();
    showLog(wrap, body.log, body.problems);
    if (body.ok) {
      status.textContent = `published as "${name}" — live on next deploy`;
      status.className = "action-status is-ok";
      markDone(sub.number, `approved as "${name}"`);
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
