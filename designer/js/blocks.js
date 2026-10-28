/**
 * Block review — every pairing of two glyphs, drawn by the site's own
 * renderer, in a matrix per block type, with a note and a good/wrong mark
 * per block. Feedback is saved to feedback/blocks.json through
 * tools/designer_server.py (/api/block-feedback), keyed "top|bottom" in IPA,
 * so it can be read back later to decide how blocks should be designed.
 *
 * Rows are the top glyph, columns the bottom glyph:
 *   C–C   consonant over consonant (the one-row overlap)
 *   V–C   vowel over consonant
 *   C–V   consonant over vowel
 */
(function () {
  const $ = (s) => document.querySelector(s);
  const GLYPHS = window.AVATARIAN_GLYPHS || {};
  const drawn = (type) => Object.entries(GLYPHS)
    .filter(([, g]) => g.type === type && g.status !== "PLACEHOLDER")
    .map(([ipa]) => ipa);
  const CONS = drawn("consonant");
  const VOWS = drawn("vowel");
  const KINDS = {
    cc: { label: "C–C", rows: CONS, cols: CONS },
    vc: { label: "V–C", rows: VOWS, cols: CONS },
    cv: { label: "C–V", rows: CONS, cols: VOWS },
  };
  const code = (ipa) => (typeof soundToCode === "function" ? soundToCode(ipa) : ipa);
  const keyOf = (top, bottom) => top + "|" + bottom;

  let feedback = {};
  let kind = "cc";
  let sel = null;            // { r, c }
  const cells = new Map();   // key -> td

  // ── how often each block occurs in the corpus ──────────────────────
  // Paired exactly as the site pairs them: marks (punctuation, numerals,
  // the possessive) break the run, and each run is resolved on its own.
  // Every spelling counts (a contested word's alternates too), and each
  // block remembers which sources wrote it, in which words, for the tabs.
  const CORPUS = window.AVATARIAN_CORPUS || {};
  const SOURCES = CORPUS.sources || {};
  const seen = {};           // key -> [word, …]
  const bySource = {};       // key -> { source: [word, …] }
  function blocksOf(ipa) {
    const keys = [];
    let run = [];
    const flush = () => {
      if (run.length) resolveBlocks(run).forEach(({ top, bottom }) =>
        keys.push(keyOf(parseSymbol(top).sym, parseSymbol(bottom).sym)));
      run = [];
    };
    for (const tok of ipa || []) {
      if (isMark(parseSymbol(tok).sym)) flush(); else run.push(tok);
    }
    flush();
    return keys;
  }
  const addOnce = (list, x) => { if (!list.includes(x)) list.push(x); };
  for (const [word, entry] of Object.entries(CORPUS.words || {})) {
    for (const sp of [entry, ...(entry.alternates || [])]) {
      for (const k of blocksOf(sp.ipa)) {
        addOnce(seen[k] = seen[k] || [], word);
        const per = bySource[k] = bySource[k] || {};
        for (const src of sp.sources || []) addOnce(per[src] = per[src] || [], word);
      }
    }
  }

  // ── the matrix ─────────────────────────────────────────────────────
  function header(ipa) {
    return `${code(ipa)}<span class="ipa">/${ipa}/</span>`;
  }

  function build() {
    const { rows, cols } = KINDS[kind];
    const table = $("#matrix");
    table.innerHTML = "";
    cells.clear();
    const head = table.createTHead().insertRow();
    head.appendChild(document.createElement("th")).innerHTML = "top ↓ · bottom →";
    cols.forEach((c) => { head.appendChild(document.createElement("th")).innerHTML = header(c); });
    const body = table.createTBody();
    rows.forEach((top, r) => {
      const tr = body.insertRow();
      tr.appendChild(document.createElement("th")).innerHTML = header(top);
      cols.forEach((bottom, c) => {
        const td = tr.insertCell();
        const key = keyOf(top, bottom);
        td.className = "br-cell";
        td.dataset.key = key;
        td.dataset.r = r;
        td.dataset.c = c;
        const word = document.createElement("span");
        renderAvatarian([top, bottom], word);
        td.appendChild(word);
        if (seen[key]) {
          const n = document.createElement("span");
          n.className = "count";
          n.textContent = seen[key].length;
          td.appendChild(n);
        }
        td.addEventListener("click", () => select(r, c));
        cells.set(key, td);
        paint(key);
      });
    });
    applyFilter();
    counts();
    if (sel) select(Math.min(sel.r, rows.length - 1), Math.min(sel.c, cols.length - 1), false);
  }

  function paint(key) {
    const td = cells.get(key);
    if (!td) return;
    const f = feedback[key] || {};
    td.classList.toggle("good", f.status === "good");
    td.classList.toggle("bad", f.status === "bad");
    let dot = td.querySelector(".noted");
    if (f.note && !dot) {
      dot = document.createElement("span");
      dot.className = "noted";
      td.appendChild(dot);
    } else if (!f.note && dot) dot.remove();
    td.title = `${keyLabel(key)}${f.note ? "\n" + f.note : ""}`;
  }

  function keyLabel(key) {
    const [t, b] = key.split("|");
    return `${code(t)} ${code(b)}  (/${t}/ over /${b}/)`;
  }

  function matches(key) {
    const f = feedback[key] || {};
    switch ($("#show").value) {
      case "unreviewed": return !f.status;
      case "bad": return f.status === "bad";
      case "good": return f.status === "good";
      case "noted": return !!f.note;
      case "seen": return !!seen[key];
      default: return true;
    }
  }

  function applyFilter() {
    for (const [key, td] of cells) td.classList.toggle("dim", !matches(key));
  }

  function counts() {
    let all = 0, done = 0;
    for (const [k, def] of Object.entries(KINDS)) {
      const total = def.rows.length * def.cols.length;
      let reviewed = 0;
      def.rows.forEach((t) => def.cols.forEach((b) => {
        if ((feedback[keyOf(t, b)] || {}).status) reviewed++;
      }));
      document.querySelector(`.br-tab[data-kind="${k}"] span`).textContent = `${reviewed}/${total}`;
      all += total;
      done += reviewed;
    }
    $("#progress").textContent = `${done} of ${all} reviewed`;
  }

  // ── the side panel ─────────────────────────────────────────────────
  function select(r, c, focus = true) {
    const { rows, cols } = KINDS[kind];
    if (r < 0 || c < 0 || r >= rows.length || c >= cols.length) return;
    sel = { r, c };
    const key = keyOf(rows[r], cols[c]);
    for (const td of cells.values()) td.classList.remove("sel");
    const td = cells.get(key);
    td.classList.add("sel");
    td.scrollIntoView({ block: "nearest", inline: "nearest" });

    $("#panel").hidden = false;
    const big = $("#big");
    big.innerHTML = "";
    const word = document.createElement("span");
    renderAvatarian([rows[r], cols[c]], word);
    big.appendChild(word);
    $("#title").innerHTML = `${code(rows[r])} ${code(cols[c])} `
      + `<span class="fine">/${rows[r]}/ over /${cols[c]}/ · ${KINDS[kind].label}</span>`;
    const words = seen[key] || [];
    $("#seen").textContent = words.length
      ? `In the corpus: ${words.slice(0, 12).join(", ")}${words.length > 12 ? ` (+${words.length - 12} more)` : ""}`
      : "Not seen in the corpus.";
    showSources(key);
    const f = feedback[key] || {};
    $("#note").value = f.note || "";
    statusButtons(f.status);
    presets();
    $("#save").textContent = f.updated ? `saved ${f.updated.replace("T", " ").replace("Z", " UTC")}` : "";
    if (focus) $("#note").blur();
  }

  // ── where the block is written: one tab per source ─────────────────
  // Sources with the most words using the block first. The image opens
  // full size on click; the words from that source are drawn under it.
  let srcTab = null;         // the source last looked at, kept across blocks
  function showSources(key) {
    const box = $("#sources");
    const per = bySource[key] || {};
    const ids = Object.keys(per).filter((id) => SOURCES[id])
      .sort((a, b) => per[b].length - per[a].length || a.localeCompare(b));
    box.innerHTML = "";
    if (!ids.length) return;
    const tabs = document.createElement("div");
    tabs.className = "br-src-tabs";
    const view = document.createElement("div");
    view.className = "br-src-view";
    const open = (id) => {
      srcTab = id;
      tabs.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === id));
      const s = SOURCES[id];
      view.innerHTML = "";
      if (s.image) {
        const img = document.createElement("img");
        img.src = "/site/sources/" + encodeURIComponent(s.image);
        img.alt = id;
        img.title = "click to open full size";
        img.addEventListener("click", () => lightbox(img.src));
        view.appendChild(img);
      }
      const words = document.createElement("div");
      words.className = "br-src-words";
      for (const w of per[id]) {
        const item = document.createElement("span");
        const art = document.createElement("span");
        const e = CORPUS.words[w];
        const sp = [e, ...(e.alternates || [])].find((x) => (x.sources || []).includes(id)) || e;
        renderAvatarian(sp.ipa, art);
        item.appendChild(art);
        item.append(" " + w);
        words.appendChild(item);
      }
      view.appendChild(words);
      const meta = document.createElement("div");
      meta.className = "br-src-meta";
      meta.textContent = [s.where, s.credit && "credit: " + s.credit].filter(Boolean).join(" · ");
      view.appendChild(meta);
    };
    for (const id of ids) {
      const b = document.createElement("button");
      b.dataset.id = id;
      b.textContent = id + (per[id].length > 1 ? ` ·${per[id].length}` : "");
      b.title = (SOURCES[id].what || "").slice(0, 300);
      b.addEventListener("click", () => open(id));
      tabs.appendChild(b);
    }
    box.append(tabs, view);
    open(ids.includes(srcTab) ? srcTab : ids[0]);
  }

  function lightbox(src) {
    const lb = document.createElement("div");
    lb.className = "br-lightbox";
    const img = document.createElement("img");
    img.src = src;
    lb.appendChild(img);
    const close = () => { lb.remove(); document.removeEventListener("keydown", esc, true); };
    const esc = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(); } };
    lb.addEventListener("click", close);
    document.addEventListener("keydown", esc, true);
    document.body.appendChild(lb);
  }

  // ── quick notes ────────────────────────────────────────────────────
  // Every distinct line written in any note becomes a pick, most used
  // first, so a complaint typed once can be reapplied with 1–9. Picking
  // toggles the line in the current note. A note always means "wrong".
  let presetList = [];
  function noteLines(note) {
    return (note || "").split("\n").map((l) => l.trim()).filter(Boolean);
  }
  function presets() {
    const uses = new Map();
    for (const f of Object.values(feedback)) {
      for (const l of new Set(noteLines(f.note))) uses.set(l, (uses.get(l) || 0) + 1);
    }
    presetList = [...uses].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([l]) => l);
    const mine = new Set(noteLines($("#note").value));
    const box = $("#presets");
    box.innerHTML = "";
    presetList.forEach((l, i) => {
      const b = document.createElement("button");
      b.className = "ghost" + (mine.has(l) ? " on" : "");
      b.innerHTML = (i < 9 ? `<kbd>${i + 1}</kbd> ` : "") + escapeHtml(l)
        + ` <span class="uses">${uses.get(l)}</span>`;
      b.addEventListener("click", () => pick(i));
      box.appendChild(b);
    });
  }
  function escapeHtml(t) {
    return t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }
  function pick(i) {
    const key = currentKey();
    const line = presetList[i];
    if (!key || line == null) return;
    const lines = noteLines($("#note").value);
    const at = lines.indexOf(line);
    if (at >= 0) lines.splice(at, 1); else lines.push(line);
    const note = lines.join("\n");
    $("#note").value = note;
    clearTimeout(noteTimer);
    const patch = { note };
    if (note && (feedback[key] || {}).status !== "bad") { patch.status = "bad"; statusButtons("bad"); }
    save(key, patch);
  }

  function currentKey() {
    if (!sel) return null;
    const { rows, cols } = KINDS[kind];
    return keyOf(rows[sel.r], cols[sel.c]);
  }

  function statusButtons(status) {
    document.querySelectorAll(".br-status button").forEach((b) =>
      b.classList.toggle("on", !!status && b.dataset.status === status));
  }

  async function save(key, patch) {
    const prev = feedback[key] || {};
    const next = { status: prev.status || "", note: prev.note || "", ...patch };
    $("#save").textContent = "saving…";
    try {
      const r = await fetch("/api/block-feedback", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key, ...next }),
      });
      const res = await r.json();
      if (res.error) throw new Error(res.error);
      if (res.saved) feedback[key] = res.saved; else delete feedback[key];
      if (key === currentKey()) {
        $("#save").textContent = res.saved ? "saved" : "cleared";
        presets();
      }
    } catch (e) {
      $("#save").textContent = "not saved: " + (e.message || e);
    }
    paint(key);
    applyFilter();
    counts();
  }

  function setStatus(status) {
    const key = currentKey();
    if (!key) return;
    statusButtons(status);
    save(key, { status });
  }

  let noteTimer = null;
  $("#note").addEventListener("input", () => {
    const key = currentKey();
    if (!key) return;
    clearTimeout(noteTimer);
    $("#save").textContent = "…";
    const note = $("#note").value;
    // Writing anything means the block is wrong; mark it straight away.
    const patch = { note };
    if (note.trim() && (feedback[key] || {}).status !== "bad") {
      patch.status = "bad";
      statusButtons("bad");
    }
    noteTimer = setTimeout(() => save(key, patch), 600);
  });

  document.querySelectorAll(".br-status button").forEach((b) =>
    b.addEventListener("click", () => setStatus(b.dataset.status)));

  function step(dr, dc) {
    if (!sel) return select(0, 0);
    select(sel.r + dr, sel.c + dc);
  }

  function nextUnreviewed() {
    const { rows, cols } = KINDS[kind];
    const start = sel ? sel.r * cols.length + sel.c + 1 : 0;
    const total = rows.length * cols.length;
    for (let i = 0; i < total; i++) {
      const n = (start + i) % total;
      const r = Math.floor(n / cols.length), c = n % cols.length;
      if (!(feedback[keyOf(rows[r], cols[c])] || {}).status) return select(r, c);
    }
  }

  $("#prev").addEventListener("click", () => step(0, -1));
  $("#next").addEventListener("click", () => step(0, 1));
  $("#next-un").addEventListener("click", nextUnreviewed);

  document.addEventListener("keydown", (e) => {
    if (e.target.matches("textarea, input, select")) {
      if (e.key === "Escape") e.target.blur();
      return;
    }
    const k = e.key;
    if (k === "ArrowRight") step(0, 1);
    else if (k === "ArrowLeft") step(0, -1);
    else if (k === "ArrowDown") step(1, 0);
    else if (k === "ArrowUp") step(-1, 0);
    else if (k === "g") setStatus("good");
    else if (k === "b") setStatus("bad");
    else if (k === "c") setStatus("");
    else if (k === "n") nextUnreviewed();
    else if (k === "Enter" && sel) { $("#note").focus(); }
    else if (/^[1-9]$/.test(k) && !e.metaKey && !e.ctrlKey) pick(+k - 1);
    else return;
    e.preventDefault();
  });

  // ── tabs, filter, size, theme, copy ────────────────────────────────
  function setKind(k) {
    kind = k;
    try { localStorage.setItem("blocks-kind", k); } catch (e) { /* storage off */ }
    document.querySelectorAll(".br-tab").forEach((b) => b.classList.toggle("on", b.dataset.kind === k));
    build();
  }
  document.querySelectorAll(".br-tab").forEach((b) =>
    b.addEventListener("click", () => setKind(b.dataset.kind)));
  $("#show").addEventListener("change", applyFilter);
  const size = $("#size");
  const applySize = () => $("#matrix").style.setProperty("--av-size", size.value + "px");
  size.addEventListener("input", applySize);
  applySize();

  const saved = (() => { try { return localStorage.getItem("designer-theme"); } catch (e) { return null; } })();
  if (saved) document.documentElement.dataset.theme = saved;
  $("#theme-btn").addEventListener("click", () => {
    const now = document.documentElement.dataset.theme;
    const next = now === "dark" ? "light" : now === "light" ? "" : "dark";
    try {
      if (next) { document.documentElement.dataset.theme = next; localStorage.setItem("designer-theme", next); }
      else { delete document.documentElement.dataset.theme; localStorage.removeItem("designer-theme"); }
    } catch (e) { /* storage off */ }
  });

  $("#copy-all").addEventListener("click", async () => {
    const lines = [];
    for (const [k, def] of Object.entries(KINDS)) {
      def.rows.forEach((t) => def.cols.forEach((b) => {
        const f = feedback[keyOf(t, b)];
        if (!f) return;
        const mark = f.status === "good" ? "✓" : f.status === "bad" ? "✗" : "·";
        lines.push(`${mark} ${def.label} ${keyLabel(keyOf(t, b))}${f.note ? ": " + f.note : ""}`);
      }));
    }
    const text = lines.join("\n") || "(no feedback yet)";
    try {
      await navigator.clipboard.writeText(text);
      $("#copy-all").textContent = `copied ${lines.length}`;
    } catch (e) {
      $("#copy-all").textContent = "copy failed";
    }
    setTimeout(() => { $("#copy-all").textContent = "copy notes"; }, 1500);
  });

  // ── boot ───────────────────────────────────────────────────────────
  fetch("/api/block-feedback", { cache: "no-store" })
    .then((r) => r.json())
    .catch(() => ({}))
    .then((data) => {
      feedback = data || {};
      let k = "cc";
      try { k = localStorage.getItem("blocks-kind") || "cc"; } catch (e) { /* storage off */ }
      setKind(KINDS[k] ? k : "cc");
    });
})();
