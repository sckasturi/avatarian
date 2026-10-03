/**
 * The source preview popup — the floating panel that shows where a word was
 * seen written: the reference image(s), each source's provenance, and, for a
 * contested word, every distinct spelling with the sources behind it.
 *
 * Shared by the corpus page (hovering a word card) and the translator
 * (hovering an attested word in the output), so the two show exactly the
 * same thing rather than drifting. It needs the corpus's `sources` map and a
 * `renderAvatarian`; both are passed to createSourcePopup(), which also
 * falls back to the globals the pages already load.
 *
 * A word object here carries what corpus.js stores plus a display label:
 *   { label, key, ipa, sources, count, alternates, contested }
 * The corpus page passes its card's word; the translator builds one from the
 * corpus record and the caption.
 */

// One popup per page; these hold its state once createSourcePopup runs.
let POP_SOURCES = {};
let POP_RENDER = null;
let POP_MAIN = null;   // the main panel (#pop)
let POP_SUB = null;    // the per-thumbnail tooltip (#pop2)
let popHideTimer = null;
let subHideTimer = null;

/**
 * Every source that cites a word — the winning spelling's sources plus any
 * a contested alternate came from. Kept here (not just on the corpus page)
 * because both callers need the same "where has this been seen" answer.
 */
function allSourcesOf(w) {
  const set = new Set(w.sources || []);
  for (const a of (w.alternates || [])) for (const s of (a.sources || [])) set.add(s);
  return [...set];
}

/**
 * Where a source links to: the original post if it recorded a URL, else the
 * reference image shipped under site/sources/. Null when there is nothing to
 * open. The path is relative, so it resolves the same from every page in the
 * site root (corpus.html and index.html both sit there).
 */
function sourceHref(id) {
  const s = POP_SOURCES[id] || {};
  if (s.where && /^https?:\/\//.test(s.where)) return s.where;
  if (s.image) return "sources/" + encodeURIComponent(s.image);
  return null;
}

// The sources page's own card for this source — the hub with its image,
// provenance, author and every word read off it. A source's name and
// thumbnail in the popup link here, so clicking a source (on the corpus page
// or in the translator) lands on its card. The post itself stays reachable
// from the "open the post ↗" line.
function sourcePageHref(id) {
  return "sources.html#source-" + id;
}

/**
 * The distinct spellings of a word, each with the sources behind it — the
 * winning one first, then the alternates. A contested word's preview
 * collapses to these, so `the` is two rows (two spellings), not six.
 */
function spellingGroups(w) {
  const groups = [{ ipa: w.ipa, sources: w.sources || [], count: w.count || 0 }];
  for (const a of (w.alternates || [])) {
    groups.push({ ipa: a.ipa, sources: a.sources || [], count: a.count || 0 });
  }
  return groups;
}

/**
 * Show the slice of a source's text AROUND the word — "…found something out
 * and it is really big!…" — rather than always the opening. Falls back to
 * the start if the word isn't in the text verbatim (some sources describe
 * their contents rather than quote them). The match is bolded.
 */
function fillWhat(el, text, word) {
  const esc = String(word || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const m = esc ? new RegExp("\\b" + esc + "\\b", "i").exec(text) : null;
  if (!m) {
    el.textContent = text.length > 120 ? text.slice(0, 120) + "…" : text;
    return;
  }
  const pad = 42;
  const start = Math.max(0, m.index - pad);
  const end = Math.min(text.length, m.index + m[0].length + pad);
  el.append((start > 0 ? "…" : "") + text.slice(start, m.index));
  const hit = document.createElement("strong");
  hit.textContent = text.slice(m.index, m.index + m[0].length);
  el.appendChild(hit);
  el.append(text.slice(m.index + m[0].length, end) + (end < text.length ? "…" : ""));
}

// The second tooltip: a source's name and the text around the word, shown
// over a thumbnail in the contested preview. pointer-events:none in CSS, so
// it never steals the hover from the thumb.
function popShowSub(thumb, id, w) {
  clearTimeout(subHideTimer);
  clearTimeout(popHideTimer);        // moving onto a thumb keeps the main panel open
  const s = POP_SOURCES[id] || {};
  POP_SUB.innerHTML = "";
  const name = document.createElement("div");
  name.className = "p2-name";
  name.textContent = id;
  POP_SUB.appendChild(name);
  if (s.where) {
    const where = document.createElement("div");
    where.className = "p2-where";
    where.textContent = /^https?:\/\//.test(s.where) ? "open the post ↗" : s.where;
    POP_SUB.appendChild(where);
  }
  if (s.what) {
    const what = document.createElement("div");
    what.className = "p2-what";
    fillWhat(what, s.what, w.key);
    POP_SUB.appendChild(what);
  }
  POP_SUB.classList.add("show");
  const r = thumb.getBoundingClientRect();
  const pw = POP_SUB.offsetWidth, ph = POP_SUB.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = r.bottom + 6;
  if (top + ph > window.innerHeight - 8) top = r.top - ph - 6;
  POP_SUB.style.left = left + "px";
  POP_SUB.style.top = Math.max(8, top) + "px";
}
function popHideSub() { subHideTimer = setTimeout(() => POP_SUB.classList.remove("show"), 100); }

// A source as a small clickable thumbnail of its reference image.
function sourceThumb(id, w) {
  const s = POP_SOURCES[id] || {};
  // The thumbnail links to the source's card on the sources page.
  const href = sourcePageHref(id);
  const el = document.createElement("a");
  el.className = "pop-thumb";
  el.href = href; el.target = "_blank"; el.rel = "noopener";
  if (s.image) {
    const img = document.createElement("img");
    img.loading = "lazy";
    img.src = "sources/" + encodeURIComponent(s.image);
    img.alt = id;
    el.appendChild(img);
  } else {
    el.textContent = id;
  }
  el.addEventListener("mouseenter", () => popShowSub(el, id, w));
  el.addEventListener("mouseleave", popHideSub);
  return el;
}

function popBuild(w) {
  POP_MAIN.innerHTML = "";
  const title = document.createElement("div");
  title.className = "pop-title";
  title.textContent = w.label || w.key || "";
  POP_MAIN.appendChild(title);

  // Contested: one row per DISTINCT spelling — the spelling drawn with its
  // count on the left, the sources that used it as thumbnails on the right.
  if (w.contested) {
    for (const g of spellingGroups(w)) {
      const grp = document.createElement("div");
      grp.className = "pop-group";
      const left = document.createElement("div");
      left.className = "pop-gleft";
      const sp = document.createElement("div");
      sp.className = "avatarian-word pop-spelling";
      if (POP_RENDER) POP_RENDER(g.ipa, sp);
      left.appendChild(sp);
      const meta = document.createElement("div");
      meta.className = "pop-gmeta";
      meta.textContent = g.count === 1 ? "seen once" : `seen ${g.count}×`;
      left.appendChild(meta);
      grp.appendChild(left);
      const thumbs = document.createElement("div");
      thumbs.className = "pop-thumbs";
      for (const id of g.sources) thumbs.appendChild(sourceThumb(id, w));
      grp.appendChild(thumbs);
      POP_MAIN.appendChild(grp);
    }
    return;
  }

  // Uncontested: one row per source — its reference image and the text slice
  // around the word.
  for (const id of allSourcesOf(w)) {
    const s = POP_SOURCES[id] || {};
    const row = document.createElement("div");
    row.className = "pop-src";
    if (s.image) {
      const img = document.createElement("img");
      img.loading = "lazy";
      img.src = "sources/" + encodeURIComponent(s.image);
      img.alt = "reference for " + id;
      row.appendChild(img);
    }
    const info = document.createElement("div");
    // The source name links to its card on the sources page; the post itself
    // stays reachable from the "open the post ↗" line below.
    const name = document.createElement("a");
    name.className = "pop-name";
    name.textContent = id;
    name.href = sourcePageHref(id); name.target = "_blank"; name.rel = "noopener";
    info.appendChild(name);
    if (s.where) {
      const where = document.createElement("div");
      where.className = "pop-where";
      // A real link to the post now that the name/thumbnail go to the sources
      // page — so the popup still reaches the original post directly.
      if (/^https?:\/\//.test(s.where)) {
        const a = document.createElement("a");
        a.href = s.where; a.target = "_blank"; a.rel = "noopener";
        a.textContent = "open the post ↗";
        where.appendChild(a);
      } else {
        where.textContent = s.where;
      }
      info.appendChild(where);
    }
    // Extra named links (schema: `links: [{text, url}]`) — for a source whose
    // `where` is a label, not a URL, so it still has a way out.
    for (const lk of (s.links || [])) {
      if (!lk || !lk.url) continue;
      const l = document.createElement("div");
      l.className = "pop-where";
      const a = document.createElement("a");
      a.href = lk.url; a.target = "_blank"; a.rel = "noopener";
      a.textContent = (lk.text || "link") + " ↗";
      l.appendChild(a);
      info.appendChild(l);
    }
    if (s.what) {
      const what = document.createElement("div");
      what.className = "pop-what";
      fillWhat(what, s.what, w.key);
      info.appendChild(what);
    }
    row.appendChild(info);
    POP_MAIN.appendChild(row);
  }
}

function popPlace(anchor) {
  POP_MAIN.classList.add("show");        // show first so it can be measured
  const r = anchor.getBoundingClientRect();
  const pw = POP_MAIN.offsetWidth, ph = POP_MAIN.offsetHeight;
  let left = r.left + r.width / 2 - pw / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - pw - 8));
  let top = r.bottom + 8;
  if (top + ph > window.innerHeight - 8) top = r.top - ph - 8;   // flip up
  top = Math.max(8, top);
  POP_MAIN.style.left = left + "px";
  POP_MAIN.style.top = top + "px";
}

function popShow(anchor, w) { clearTimeout(popHideTimer); popBuild(w); popPlace(anchor); }
function popHide() { popHideTimer = setTimeout(() => POP_MAIN.classList.remove("show"), 140); }

/**
 * Build the popup once and return its controls. `sources` is the corpus's
 * `sources` map; `renderFn` draws a spelling (renderAvatarian). Call once per
 * page, after the body exists, then wire an anchor's hover/focus to
 * `.show(anchor, word)` and its leave/blur to `.hide()`.
 */
function createSourcePopup(sources, renderFn) {
  POP_SOURCES = sources
    || (typeof window !== "undefined" && window.AVATARIAN_CORPUS && window.AVATARIAN_CORPUS.sources)
    || {};
  POP_RENDER = renderFn || (typeof renderAvatarian === "function" ? renderAvatarian : null);

  POP_MAIN = document.createElement("div");
  POP_MAIN.id = "pop";
  document.body.appendChild(POP_MAIN);

  POP_SUB = document.createElement("div");
  POP_SUB.id = "pop2";
  document.body.appendChild(POP_SUB);

  // Keep the panel open while the pointer is on it, so a link inside is
  // clickable; leaving it (or its thumbnails) closes both.
  POP_MAIN.addEventListener("mouseenter", () => clearTimeout(popHideTimer));
  POP_MAIN.addEventListener("mouseleave", () => { popHide(); popHideSub(); });

  return { show: popShow, hide: popHide, main: POP_MAIN, sub: POP_SUB };
}

if (typeof module !== "undefined") {
  module.exports = {
    createSourcePopup, allSourcesOf, sourceHref, spellingGroups, fillWhat,
  };
}
