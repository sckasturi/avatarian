/**
 * The submission review console.
 *
 * Lists the open contribution pull requests the Worker has opened, draws
 * each with the product's own renderer (site/js/render.js against
 * blocks.css), and lets you approve — name it, and the server merges the
 * PR, folds it into the corpus, and pushes — or reject (close the PR).
 *
 * Everything on GitHub and every git step happens server-side in
 * tools/review_server.py; this is the workflow around it.
 */

const $ = (id) => document.getElementById(id);

const state = { submissions: [], busy: false };

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
  $("count").textContent = n
    ? `${n} awaiting review`
    : "";
  if (!n) {
    list.innerHTML = '<p class="empty">No open submissions. When someone '
      + 'contributes, their pull request shows up here.</p>';
    return;
  }
  for (const sub of state.submissions) list.appendChild(card(sub));
}

function card(sub) {
  const el = document.createElement("section");
  el.className = "card";
  el.dataset.number = sub.number;

  const s = sub.submission || {};
  const source = s.source || {};
  const meta = s._submission || {};
  const entries = s.entries || [];

  // --- header: PR link, author, date ---
  const head = document.createElement("div");
  head.className = "card-head";
  head.innerHTML =
    `<a class="pr" target="_blank" rel="noopener"></a>`
    + `<span class="by"></span><span class="spacer"></span>`
    + `<span class="when"></span>`;
  const pr = head.querySelector(".pr");
  pr.href = sub.url;
  pr.textContent = `PR #${sub.number}`;
  head.querySelector(".by").textContent = "by " + (meta.submitter || sub.author || "anonymous");
  head.querySelector(".when").textContent = new Date(sub.createdAt).toLocaleString();
  el.appendChild(head);

  if (sub.error || !sub.submission) {
    const bad = document.createElement("p");
    bad.className = "card-error";
    bad.textContent = "Couldn't read this submission: " + (sub.error || "malformed");
    el.appendChild(bad);
    el.appendChild(actions(sub, source, /*canApprove*/ false));
    return el;
  }

  // --- body: image on the left, words on the right ---
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

  // What it is / where / how it was read.
  const facts = document.createElement("dl");
  facts.className = "facts";
  const fact = (k, v) => {
    if (!v) return;
    const dt = document.createElement("dt"); dt.textContent = k;
    const dd = document.createElement("dd"); dd.textContent = v;
    facts.append(dt, dd);
  };
  fact("What", source.what);
  fact("Where", source.where);
  fact("Read by", source.credit || (meta.submitter ? meta.submitter : ""));
  fact("Confidence", entries[0] && entries[0].confidence);
  info.appendChild(facts);

  // The words, drawn in Avatarian.
  const words = document.createElement("div");
  words.className = "words";
  for (const entry of entries) {
    words.appendChild(wordChip(entry));
  }
  info.appendChild(words);

  body.appendChild(info);
  el.appendChild(body);

  el.appendChild(actions(sub, source, true));
  return el;
}

function wordChip(entry) {
  const chip = document.createElement("div");
  chip.className = "word";
  const ipa = (entry.spelling || "").split(" ").filter(Boolean);

  const art = document.createElement("div");
  art.className = "word-art";
  try { renderAvatarian(ipa, art); } catch (_) { art.textContent = "?"; }

  const label = document.createElement("div");
  label.className = "word-label";
  label.textContent = entry.gloss || entry.key || "(unnamed)";

  const codes = document.createElement("div");
  codes.className = "word-codes";
  // Show the readable codes when sounds.js is available; fall back to IPA.
  try {
    codes.textContent = wordsToSoundText([{ word: "", ipa }]);
  } catch (_) { codes.textContent = ipa.join(" "); }

  chip.append(art, label, codes);
  if ((entry.times || 1) > 1) {
    const t = document.createElement("span");
    t.className = "word-times";
    t.textContent = entry.times + "×";
    chip.appendChild(t);
  }
  return chip;
}

function actions(sub, source, canApprove) {
  const wrap = document.createElement("div");
  wrap.className = "actions";

  if (canApprove) {
    const nameField = document.createElement("label");
    nameField.className = "name-field";
    nameField.innerHTML = '<span>Name the source</span>';
    const input = document.createElement("input");
    input.type = "text";
    input.className = "name-input";
    input.value = slugify(source.what) || sub.slug;
    input.placeholder = "e.g. sonam";
    nameField.appendChild(input);
    wrap.appendChild(nameField);

    const approve = document.createElement("button");
    approve.className = "primary";
    approve.textContent = "approve & publish";
    approve.addEventListener("click", () => doApprove(sub, input.value.trim(), wrap));
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
  logBox.className = "log";
  logBox.hidden = true;
  wrap.appendChild(logBox);

  return wrap;
}

function setBusy(wrap, on) {
  state.busy = on;
  wrap.querySelectorAll("button, input").forEach((b) => { b.disabled = on; });
}

function showLog(wrap, log) {
  if (!log || !log.length) return;
  const box = wrap.querySelector(".log");
  box.hidden = false;
  box.textContent = log.map((s) =>
    `${s.ok ? "✓" : "✗"} ${s.step}${s.err ? "\n    " + s.err : ""}`).join("\n");
}

async function doApprove(sub, name, wrap) {
  if (state.busy) return;
  if (!name) { wrap.querySelector(".name-input").focus(); return; }
  const status = wrap.querySelector(".action-status");
  setBusy(wrap, true);
  status.textContent = "publishing…";
  status.className = "action-status";
  try {
    const res = await fetch("/api/approve", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ number: sub.number, slug: sub.slug, name }),
    });
    const body = await res.json();
    showLog(wrap, body.log);
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
  if (comment === null) return;      // cancelled
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
