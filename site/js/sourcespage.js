/* The sources page (sources.html): every source image and the words read off it. Loaded last, after the scripts it uses;
 * see the <script> tags at the foot of the page for the order. */

"use strict";

// (The theme toggle is js/theme.js, loaded before this file.)

// --- the corpus ---------------------------------------------------------
const CORPUS = window.AVATARIAN_CORPUS || { words: {}, sources: {} };
const SOURCES = CORPUS.sources || {};

// Where clicking a source takes you: the original post if it recorded a
// URL, otherwise the reference image itself (shipped under site/sources/).
// Same rule as corpus.html so the two pages agree on what a source links to.
function sourceHref(id) {
  const s = SOURCES[id] || {};
  if (s.where && /^https?:\/\//.test(s.where)) return s.where;
  if (s.image) return "sources/" + encodeURIComponent(s.image);
  return null;
}

// Every source that cites a word — the winning spelling's sources, plus
// any a contested alternate came from.
function allSourcesOf(w) {
  const set = new Set(w.sources || []);
  for (const a of (w.alternates || [])) for (const s of (a.sources || [])) set.add(s);
  return [...set];
}

// The spelling a particular source contributed to a word. For an
// uncontested word that is just w.ipa; for a contested one the source may
// have written a losing alternate, and showing what IT wrote — rather than
// the corpus's winner — is the whole point of a per-source view.
function spellingInSource(w, id) {
  if ((w.sources || []).includes(id)) return { ipa: w.ipa, alt: false };
  for (const a of (w.alternates || [])) {
    if ((a.sources || []).includes(id)) return { ipa: a.ipa, alt: true };
  }
  return { ipa: w.ipa, alt: false };
}

// Invert the corpus: source id -> the words read off it. A word can carry
// a `gloss` distinct from its key; label by that where present.
const bySource = {};
for (const id of Object.keys(SOURCES)) bySource[id] = [];
for (const [key, w] of Object.entries(CORPUS.words || {})) {
  const label = w.gloss || key;
  for (const id of allSourcesOf(w)) {
    (bySource[id] || (bySource[id] = [])).push({ key, label, ...spellingInSource(w, id) });
  }
}
for (const id of Object.keys(bySource)) {
  bySource[id].sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));
}

// Group sources by category (the `instagram-1` of `instagram-1.1`). A
// category with 2+ slides gets a header; a lone source — or a name with no
// dot — stands on its own. Newest contributions lead (see the sort below).
function wordCount(id) { return (bySource[id] || []).length; }

const catMembers = {};                       // category -> [ids]
const loners = [];                           // ids that stand alone
for (const id of Object.keys(SOURCES)) {
  const { category } = categoryOf(id);
  if (category) (catMembers[category] = catMembers[category] || []).push(id);
  else loners.push(id);
}
// A category of one isn't worth a header.
for (const cat of Object.keys(catMembers)) {
  if (catMembers[cat].length < 2) { loners.push(...catMembers[cat]); delete catMembers[cat]; }
}

// Category groups, most recently contributed first. "Recency" is the source's
// position in attested.json — new sources are appended, so a larger index means
// a later contribution; a group ranks by its newest slide. Standalone sources
// are kept SEPARATE — in their own section below — so a lone source never flows
// into a group's tiling and looks like one of its slides.
const srcPos = {};
Object.keys(SOURCES).forEach((id, i) => { srcPos[id] = i; });
const recencyOf = (id) => (id in srcPos ? srcPos[id] : -1);

const groupUnits = [];
for (const cat of Object.keys(catMembers)) {
  const ids = catMembers[cat].slice().sort(slideOrder);
  groupUnits.push({ group: cat, ids, recency: Math.max(...ids.map(recencyOf)) });
}
groupUnits.sort((a, b) => b.recency - a.recency || a.group.localeCompare(b.group));
loners.sort((a, b) => recencyOf(b) - recencyOf(a) || a.localeCompare(b));

// --- render -------------------------------------------------------------

// Fold a source card to its head row (or unfold it), keeping its toggle in
// step — shared by the per-card button and a group's "collapse all".
function setCardCollapsed(el, on) {
  el.classList.toggle("is-collapsed", on);
  const t = el.querySelector(".source-collapse");
  if (t) {
    t.textContent = on ? "▸" : "▾";
    t.setAttribute("aria-expanded", String(!on));
    t.title = on ? "Expand this source" : "Collapse this source";
  }
}

function sourceCard(id) {
  const s = SOURCES[id] || {};
  const words = bySource[id] || [];

  const el = document.createElement("div");
  el.className = "source-card";
  // Word-heavy sources take up more width (span columns) so all their words
  // show, tiled wide, rather than stacking into a tower in one column.
  if (words.length >= 17) el.classList.add("span3");
  else if (words.length >= 7) el.classList.add("span2");
  // A stable anchor so a single source is directly linkable:
  // sources.html#source-<id> jumps to and rings this card.
  el.id = "source-" + id;
  // Filter target: the id, the venue/URL, the transcription text, and who
  // translated it, so searching "festival", "instagram" or "Bundas" all work.
  const credit = typeof s.credit === "string" ? s.credit : (s.credit && s.credit.name) || "";
  el.dataset.hay = (id + " " + (s.where || "") + " " + (s.what || "") + " " + credit).toLowerCase();

  const href = sourceHref(id);
  if (s.image) {
    const a = document.createElement("a");
    a.className = "source-thumb";
    if (href) { a.href = href; a.target = "_blank"; a.rel = "noopener"; }
    const img = document.createElement("img");
    img.src = "sources/" + encodeURIComponent(s.image);
    img.alt = "Reference image: " + id;
    img.loading = "lazy";
    a.appendChild(img);
    el.appendChild(a);
  } else {
    const ph = document.createElement("div");
    ph.className = "source-noimg";
    ph.textContent = "no image";
    el.appendChild(ph);
  }

  const body = document.createElement("div");
  body.className = "source-body";

  const head = document.createElement("div");
  head.className = "source-head";
  const info = document.createElement("div");
  info.className = "source-info";
  head.appendChild(info);
  // The id doubles as the link to this card — click it (or copy its address)
  // to share a link straight to this one source.
  const idEl = document.createElement("a");
  idEl.className = "source-id";
  idEl.href = "#source-" + id;
  idEl.textContent = id;
  idEl.title = "Link to this source";
  info.appendChild(idEl);

  // The credit popup hangs off the `where` label; a source with no `where`
  // gets a plain "credit" label to hang it on instead.
  let whereEl = null;
  if (s.where) {
    const where = whereEl = document.createElement("span");
    where.className = "source-where";
    if (/^https?:\/\//.test(s.where)) {
      const a = document.createElement("a");
      a.href = s.where; a.target = "_blank"; a.rel = "noopener";
      a.textContent = "original post ↗";
      where.appendChild(a);
    } else {
      const sp = document.createElement("span");
      sp.textContent = s.where;
      where.appendChild(sp);
    }
    info.appendChild(where);
  }

  // Extra named links a source carries (schema: `links: [{text, url}]`).
  // Used where `where` is a provenance label, not a URL — e.g. the movie
  // letters, which are "movie" but also have a reddit transcription. The
  // thumbnail still links to the image (sourceHref), so this is the only
  // way out to the post.
  for (const lk of (s.links || [])) {
    if (!lk || !lk.url) continue;
    const w = document.createElement("span");
    w.className = "source-where";
    const a = document.createElement("a");
    a.href = lk.url; a.target = "_blank"; a.rel = "noopener";
    a.textContent = (lk.text || "link") + " ↗";
    w.appendChild(a);
    info.appendChild(w);
  }

  // Who did the reading, when the source names one. `credit` is optional
  // and may be a plain name or `{name, url}` (a wiki/Reddit profile). It
  // rides through build_corpus verbatim like the rest of the source object.
  if (s.credit) {
    const who = typeof s.credit === "string" ? { name: s.credit } : s.credit;
    if (who && who.name) {
      const au = document.createElement("span");
      au.className = "source-author";
      au.append("translated by ");
      if (who.url) {
        const a = document.createElement("a");
        a.href = who.url; a.target = "_blank"; a.rel = "noopener";
        a.textContent = who.name;
        au.appendChild(a);
      } else {
        au.append(who.name);
      }
      au.id = "credit-" + id;
      let host = whereEl;
      if (!host) {
        host = document.createElement("span");
        host.className = "source-where";
        const sp = document.createElement("span");
        sp.textContent = "credit";
        host.appendChild(sp);
        info.insertBefore(host, idEl.nextSibling);
      }
      host.classList.add("has-credit");
      host.setAttribute("aria-describedby", au.id);
      // A plain-text label isn't focusable, so make it so: that's what lets
      // a tap (phone) or Tab (keyboard) open the popup.
      if (!host.querySelector("a")) host.tabIndex = 0;
      host.appendChild(au);
    }
  }

  const meta = document.createElement("div");
  meta.className = "source-meta";
  head.appendChild(meta);
  const cnt = document.createElement("span");
  cnt.className = "source-count";
  cnt.textContent = words.length === 1 ? "1 word" : words.length + " words";
  meta.appendChild(cnt);

  // Collapse this one source down to its head row.
  const collapse = document.createElement("button");
  collapse.type = "button";
  collapse.className = "source-collapse";
  collapse.textContent = "▾";
  collapse.setAttribute("aria-expanded", "true");
  collapse.title = "Collapse this source";
  collapse.addEventListener("click",
    () => setCardCollapsed(el, !el.classList.contains("is-collapsed")));
  meta.appendChild(collapse);
  body.appendChild(head);

  if (s.what) {
    const what = document.createElement("p");
    what.className = "source-what";
    what.textContent = "“" + s.what + "”";
    what.title = s.what;      // the full transcription, since it's clamped
    body.appendChild(what);
  }

  if (words.length) {
    const grid = document.createElement("div");
    grid.className = "source-words";
    words.forEach((w, i) => {
      const chip = document.createElement("a");
      chip.className = "source-word";
      chip.href = "corpus.html?q=" + encodeURIComponent(w.label);
      chip.title = w.alt
        ? `“${w.label}”: this source's spelling differs from the corpus's most-attested one`
        : w.label;

      const drawn = document.createElement("div");
      drawn.className = "avatarian-word";
      renderAvatarian(w.ipa, drawn);
      chip.appendChild(drawn);

      const en = document.createElement("span");
      en.className = "sw-en" + (w.alt ? " is-alt" : "");
      en.textContent = w.label;
      chip.appendChild(en);

      grid.appendChild(chip);
    });
    body.appendChild(grid);
  } else {
    const none = document.createElement("p");
    none.className = "source-empty";
    none.textContent = "No words catalogued from this source yet.";
    body.appendChild(none);
  }

  el.appendChild(body);
  return el;
}

const list = document.getElementById("list");
const frag = document.createDocumentFragment();
const cards = [];        // every source card, for filtering + deep-links
const groups = [];       // { head, members } so a header can hide when empty

// A section: a full-width header (spanning all columns) and its cards. Used
// for a category and for the standalone "Other sources" bucket.
function renderSection(label, anchorId, ids, opts) {
  opts = opts || {};
  const head = document.createElement("h2");
  head.className = "cat-head";
  head.id = anchorId;

  let labelEl;
  if (opts.link) {
    labelEl = document.createElement("a");
    labelEl.className = "cat-link";
    labelEl.href = "#" + anchorId;
    labelEl.title = "Link to this category";
  } else {
    labelEl = document.createElement("span");
  }
  labelEl.textContent = label;

  const count = document.createElement("span");
  count.className = "cat-count";
  count.textContent = ` · ${ids.length} ${opts.unit || "images"}`;

  const members = [];
  const collapseAll = document.createElement("button");
  collapseAll.type = "button";
  collapseAll.className = "cat-collapse";
  collapseAll.textContent = "collapse all";
  collapseAll.addEventListener("click", () => {
    const anyOpen = members.some((c) => !c.classList.contains("is-collapsed"));
    members.forEach((c) => setCardCollapsed(c, anyOpen));
    collapseAll.textContent = anyOpen ? "expand all" : "collapse all";
  });

  head.append(labelEl, count, collapseAll);
  frag.appendChild(head);
  for (const id of ids) {
    const c = sourceCard(id);
    c.classList.add("in-cat");
    frag.appendChild(c);
    cards.push(c);
    members.push(c);
  }
  groups.push({ head, members });
}

for (const u of groupUnits) {
  renderSection(u.group, "cat-" + u.group, u.ids, { link: true, unit: "images" });
}
if (loners.length) {
  if (groupUnits.length) {
    // The standalone sources — letters, stamps, one-off signs — in their own
    // section so they don't bleed into a category's tiles.
    renderSection("Other sources", "cat-other", loners, { unit: "sources" });
  } else {
    for (const id of loners) {
      const c = sourceCard(id);
      frag.appendChild(c);
      cards.push(c);
    }
  }
}
list.appendChild(frag);

// --- filtering ----------------------------------------------------------
const search = document.getElementById("search");
const countEl = document.getElementById("count");
const emptyEl = document.getElementById("empty");

function applyFilter() {
  const q = search.value.trim().toLowerCase();
  let shown = 0;
  for (const el of cards) {
    const show = !q || el.dataset.hay.includes(q);
    el.hidden = !show;
    if (show) shown++;
  }
  // A category header hides when none of its slides are showing.
  for (const g of groups) g.head.hidden = !g.members.some(c => !c.hidden);
  emptyEl.hidden = shown > 0;
  const total = cards.length;
  countEl.textContent = shown === total
    ? `${total} sources`
    : `${shown} of ${total} sources`;
}
search.addEventListener("input", applyFilter);
applyFilter();

// Deep-link to one source: sources.html#source-<id>, or ?source=<id> (the
// same id the corpus page's filter uses). The cards are built above, after
// the browser's own hash scroll has already run and found nothing, so scroll
// the target into view ourselves; the :target CSS rings it. A filter is
// cleared first so the linked card can't be hidden.
(function focusLinkedSource() {
  const p = new URLSearchParams(location.search);
  const param = p.get("source");
  if (param && SOURCES[param]) location.hash = "source-" + param;
  const hash = decodeURIComponent(location.hash || "").slice(1);
  if (!hash) return;
  const el = document.getElementById(hash);
  if (!el) return;
  if (search.value) { search.value = ""; applyFilter(); }
  el.scrollIntoView({ block: "start" });
})();
