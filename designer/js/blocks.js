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
  const seen = {};           // key -> [word, …]
  for (const [word, entry] of Object.entries((window.AVATARIAN_CORPUS || {}).words || {})) {
    let run = [];
    const flush = () => {
      if (run.length) resolveBlocks(run).forEach(({ top, bottom }) => {
        const k = keyOf(parseSymbol(top).sym, parseSymbol(bottom).sym);
        (seen[k] = seen[k] || []).includes(word) || seen[k].push(word);
      });
      run = [];
    };
    for (const tok of entry.ipa || []) {
      if (isMark(parseSymbol(tok).sym)) flush(); else run.push(tok);
    }
    flush();
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
    const f = feedback[key] || {};
    $("#note").value = f.note || "";
    statusButtons(f.status);
    $("#save").textContent = f.updated ? `saved ${f.updated.replace("T", " ").replace("Z", " UTC")}` : "";
    if (focus) $("#note").blur();
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
    noteTimer = setTimeout(() => save(key, { note }), 600);
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
