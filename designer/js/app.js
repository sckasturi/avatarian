/**
 * Wiring: the sound list, the toolbar, the previews and the output.
 *
 * The output panel deliberately asks the SERVER to render rather than
 * using the browser's copy of the geometry. designer/js/geom.js exists
 * so the canvas can redraw at pointer speed, but anything you copy out
 * of here — the SVG, the build_glyphs.py snippet — comes back from
 * tools/glyphspec.py, so what you paste is what the build will draw.
 */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const App = {
  tab: "python",
  rendered: {},
  _renderTimer: null,

  async boot() {
    Editor.mount($("#canvas"));
    Editor.onSelect = () => this.syncToolbar();
    Editor.onHint = (t) => { $("#hint").textContent = t; };

    addEventListener("resize", () => Editor.render());
    this.bindTheme();
    this.bindToolbar();
    this.bindUnderlays();
    this.bindOutput();
    this.bindKeys();
    Store.on((what) => this.onStore(what));

    try {
      await Store.boot();
    } catch (e) {
      $("#hint").textContent =
        "Can't reach the designer server — start it with: python3 tools/designer_server.py";
      $("#save-state").textContent = "offline";
      $("#save-state").className = "save-state error";
      return;
    }
    this.renderList();
    const first = location.hash.slice(1) || Store.catalog[0].name;
    this.openSound(Store.sound(first) ? first : Store.catalog[0].name);
  },

  // ── store events ────────────────────────────────────────────────

  onStore(what) {
    if (what === "open" || what === "change") {
      Editor.render();
      this.renderPreviews();
      this.queueRender();
      this.renderThumb(Store.design.name);
      this.syncToolbar();
      this.updateProgress();
    }
    if (what === "dirty") this.setSaveState("saving…", "dirty");
    if (what === "saved") {
      this.setSaveState("saved " + new Date().toLocaleTimeString(), "saved");
      this.showProblems(Store.problems);
    }
    if (what === "save-error") this.setSaveState(Store.error, "error");
  },

  setSaveState(text, cls) {
    const el = $("#save-state");
    el.textContent = text;
    el.className = "save-state " + (cls || "");
  },

  // ── the sound list ──────────────────────────────────────────────

  renderList() {
    const filter = ($("#filter").value || "").trim().toLowerCase();
    const groups = { consonant: "consonants", vowel: "vowels", mark: "marks" };
    const list = $("#sound-list");
    list.innerHTML = "";

    Object.entries(groups).forEach(([kind, label]) => {
      const rows = Store.catalog.filter(
        (s) => s.type === kind && matches(s, filter));
      if (!rows.length) return;
      const head = document.createElement("div");
      head.className = "group-head";
      head.textContent = `${label} · ${rows.length}`;
      list.appendChild(head);

      rows.forEach((s) => {
        const b = document.createElement("button");
        b.className = "sound" + (s.placeholder ? " placeholder" : "");
        b.dataset.name = s.name;
        b.innerHTML =
          `<span class="thumb" data-thumb="${s.name}"></span>` +
          `<span class="who"><span class="ipa">${s.ipa || "∅"}</span>` +
          `<span class="meta">${[s.name, s.arpabet, s.example].filter(Boolean).join(" · ")}</span></span>` +
          `<span class="tick" data-tick="${s.name}"></span>`;
        b.addEventListener("click", () => this.openSound(s.name));
        list.appendChild(b);
        this.renderThumb(s.name);
      });
    });
    this.markCurrent();
    this.updateProgress();
  },

  /** A design's own drawing if there is one, otherwise the glyph the set
   *  currently ships, ghosted — so the list shows at a glance what has
   *  been redrawn and what is still the old shape. */
  renderThumb(name) {
    const cell = document.querySelector(`[data-thumb="${name}"]`);
    if (!cell) return;
    const sound = Store.sound(name);
    const design = Store.designs[name];
    const tick = document.querySelector(`[data-tick="${name}"]`);
    if (design && design.shapes && design.shapes.length) {
      cell.className = "thumb";
      cell.innerHTML = GEOM.toSVG(design, "square");
      if (tick) tick.textContent = "✓";
    } else if (sound && sound.current) {
      cell.className = "thumb ghost";
      cell.innerHTML = sound.current;
      if (tick) tick.textContent = "";
    } else {
      cell.className = "thumb empty";
      cell.textContent = "—";
      if (tick) tick.textContent = "";
    }
  },

  markCurrent() {
    $$(".sound").forEach((b) =>
      b.classList.toggle("on", b.dataset.name === (Store.current || {}).name));
  },

  updateProgress() {
    const done = Store.catalog.filter((s) => Store.hasDesign(s.name)).length;
    $("#progress").textContent = `${done}/${Store.catalog.length}`;
  },

  openSound(name) {
    Editor.finishStroke();
    Store.open(name);
    const s = Store.current;
    Editor.underlays = { ref: s.reference, cur: s.current, curFlat: s.currentFlat };
    Editor.select(null);
    location.hash = name;
    document.body.classList.toggle("has-flat", s.type !== "consonant");

    $("#now").innerHTML =
      `<b class="ipa">${s.ipa || "∅"}</b> ${s.name}` +
      `<span class="fine"> · ${s.type} · ${s.grid[0]}×${s.grid[1]} grid` +
      (s.arpabet ? ` · ${s.arpabet}` : "") +
      (s.flips ? " · flips by slot" : "") +
      (s.placeholder ? " · no glyph in the set yet" : "") + "</span>";
    $("#pv-bot-cap").textContent = s.flips ? "bottom slot (flipped)" : "bottom slot";
    $("#pv-bot").classList.toggle("flip", !!s.flips);
    $("#notes").value = Store.design.notes || "";
    $("#out-note").textContent = s.note ? `Source: ${s.note}.` : "";

    this.markCurrent();
    this.setSaveState(Store.design.updated ? "on disk" : "not saved yet", "");
    this.showProblems([]);
    Editor.hint();
  },

  step(delta) {
    const i = Store.catalog.findIndex((s) => s.name === (Store.current || {}).name);
    const next = Store.catalog[Math.min(Store.catalog.length - 1, Math.max(0, i + delta))];
    if (next) this.openSound(next.name);
  },

  // ── previews ────────────────────────────────────────────────────

  renderPreviews() {
    const d = Store.design;
    if (!d) return;
    const square = GEOM.toSVG(d, "square");
    $("#pv-top").innerHTML = square;
    $("#pv-bot").innerHTML = square;
    if (d.type !== "consonant") $("#pv-flat").innerHTML = GEOM.toSVG(d, "flat");
  },

  showProblems(problems) {
    const box = $("#problems");
    if (!problems || !problems.length) { box.hidden = true; return; }
    box.hidden = false;
    box.innerHTML = "<b>check this</b><ul>"
      + problems.map((p) => `<li>${escapeHTML(p)}</li>`).join("") + "</ul>";
  },

  // ── output ──────────────────────────────────────────────────────

  bindOutput() {
    $$(".tab").forEach((t) => t.addEventListener("click", () => {
      this.tab = t.dataset.tab;
      $$(".tab").forEach((x) => x.classList.toggle("on", x === t));
      this.paintCode();
    }));
    $$(".tab")[0].classList.add("on");

    $("#copy").addEventListener("click", async () => {
      await navigator.clipboard.writeText($("#code code").textContent);
      $("#copy").textContent = "copied";
      setTimeout(() => { $("#copy").textContent = "copy"; }, 1200);
    });

    $("#notes").addEventListener("input", (e) => {
      Store.commit((d) => { d.notes = e.target.value; });
    });

    this.bindLoad();
  },

  // ── pasting a shape in ──────────────────────────────────────────

  bindLoad() {
    const box = $("#load-box");

    $("#load").addEventListener("click", async () => {
      const opening = box.hidden;
      box.hidden = !opening;
      if (!opening) return;
      this.fillLoadFrom();
      $("#load-text").value = "";
      $("#mirror-x").classList.remove("on");
      $("#mirror-y").classList.remove("on");
      $("#load-text").focus();
      // Offer the clipboard if the browser will give it up without a
      // fight; ⌘V into the box works regardless, so a refusal is fine.
      try {
        const t = await navigator.clipboard.readText();
        if (t && t.trim()) $("#load-text").value = t;
      } catch { /* no clipboard permission — they can paste by hand */ }
    });

    $("#load-cancel").addEventListener("click", () => { box.hidden = true; });

    $("#load-from").addEventListener("change", (e) => {
      const d = Store.designs[e.target.value];
      if (d) $("#load-text").value = JSON.stringify(d, null, 2);
      e.target.value = "";
    });

    // Mirror toggles in the paste box
    $("#mirror-x").addEventListener("click", () =>
      $("#mirror-x").classList.toggle("on"));
    $("#mirror-y").addEventListener("click", () =>
      $("#mirror-y").classList.toggle("on"));

    $("#load-apply").addEventListener("click", () => {
      const res = Importer.parse($("#load-text").value, {
        kind: Editor.kind, snap: Editor.snap, level: Editor.tidy,
        mirrorX: $("#mirror-x").classList.contains("on"),
        mirrorY: $("#mirror-y").classList.contains("on"),
      });
      if (res.error) return Editor.onHint(res.error);
      Editor.abandonDraft();
      Store.commit((d) => { d.shapes = res.shapes; });
      Editor.selectShape(0);
      box.hidden = true;
      const from = res.source ? ` from ${res.source}` : "";
      Editor.onHint(`loaded ${res.shapes.length} shape`
        + `${res.shapes.length === 1 ? "" : "s"}${from}`
        + `${res.note ? " — " + res.note : ""} · ⌘Z to undo`);
    });
  },

  /** Every glyph that has something drawn, as a source to copy from. */
  fillLoadFrom() {
    const sel = $("#load-from");
    const here = (Store.current || {}).name;
    sel.innerHTML = '<option value="">a glyph…</option>';
    Store.catalog
      .filter((s) => s.name !== here && Store.hasDesign(s.name))
      .forEach((s) => {
        const o = document.createElement("option");
        o.value = s.name;
        o.textContent = `${s.ipa || "∅"}  ${s.name}`;
        sel.appendChild(o);
      });
  },

  queueRender() {
    clearTimeout(this._renderTimer);
    this._renderTimer = setTimeout(async () => {
      try {
        this.rendered = await API.render(Store.design);
        this.showProblems(this.rendered.problems);
      } catch (e) {
        this.rendered = { error: String(e.message || e) };
      }
      this.paintCode();
    }, 220);
  },

  paintCode() {
    const r = this.rendered || {};
    const d = Store.design;
    let text = "";
    if (r.error) text = "// " + r.error;
    else if (this.tab === "python") text = r.python || "";
    else if (this.tab === "svg") {
      text = (r.square || "") + (r.flat ? "\n\n<!-- flat, 5×4 -->\n" + r.flat : "");
    } else text = d ? JSON.stringify(d, null, 2) : "";
    $("#code code").textContent = text;
  },

  // ── toolbar ─────────────────────────────────────────────────────

  bindToolbar() {
    $$(".tool").forEach((b) => b.addEventListener("click", () => this.setTool(b.dataset.tool)));
    $$(".seg").forEach((b) => b.addEventListener("click", () => {
      Editor.setSegType(b.dataset.seg);
      this.syncToolbar();
    }));
    $$(".dotsize").forEach((b) => b.addEventListener("click", () => {
      Editor.setDotSize(b.dataset.size);
      this.syncToolbar();
    }));
    $("#smooth").addEventListener("click", () => { Editor.smoothShape(); this.syncToolbar(); });
    $("#refit").addEventListener("click", () => Editor.refitSelected());
    $("#use-current").addEventListener("click", () => Editor.fromCurrentGlyph());
    $("#tidy").addEventListener("change", (e) => {
      Editor.tidy = e.target.value;
      // Changing tidiness with a brushed shape selected re-reads it, so
      // the setting is something you can judge rather than guess at.
      if (Editor.selectedShape() && Editor.selectedShape().trace) Editor.refitSelected();
    });
    $("#snap").addEventListener("change", (e) => { Editor.snap = Number(e.target.value); });
    $("#undo").addEventListener("click", () => this.undo());
    $("#redo").addEventListener("click", () => this.redo());
    // No confirmation dialog. Clearing is an ordinary commit, so ⌘Z
    // brings it straight back — and confirm() is auto-dismissed in some
    // embedded browsers, which silently turned this button into a
    // no-op. Undo is both the better guard and the one that works.
    $("#clear").addEventListener("click", () => {
      const n = (Store.design.shapes || []).length;
      if (!n) return Editor.onHint("nothing drawn here yet");
      Editor.clearAll();
      Editor.onHint(`cleared ${n} shape${n === 1 ? "" : "s"} — ⌘Z to bring it back`);
    });

    // In-place mirror of the current design
    $("#flip-x").addEventListener("click", () => this.flipDesign(true, false));
    $("#flip-y").addEventListener("click", () => this.flipDesign(false, true));
    $("#filter").addEventListener("input", () => this.renderList());
    $("#help-btn").addEventListener("click", () => { $("#help").hidden = false; });
    $("#help-close").addEventListener("click", () => { $("#help").hidden = true; });
    $("#help").addEventListener("click", (e) => {
      if (e.target.id === "help") $("#help").hidden = true;
    });
    this.setTool("brush");
  },

  setTool(tool) {
    if (tool !== "pen") Editor.finishStroke();
    Editor.tool = tool;
    Editor.render();
    Editor.hint();
    this.syncToolbar();
  },

  syncToolbar() {
    $$(".tool").forEach((b) => b.classList.toggle("on", b.dataset.tool === Editor.tool));
    const seg = Editor.selectedSeg();
    const active = seg ? (seg.seg || "line") : Editor.segType;
    $$(".seg").forEach((b) => b.classList.toggle("on", b.dataset.seg === active));
    const shape = Editor.selectedShape();
    const size = shape && shape.kind === "dot" ? shape.size : Editor.dotSize;
    $$(".dotsize").forEach((b) => b.classList.toggle("on", b.dataset.size === size));
    $("#undo").disabled = !Store.canUndo();
    $("#redo").disabled = !Store.canRedo();
  },

  bindUnderlays() {
    const sync = () => {
      Editor.show.ref = $("#u-ref").checked;
      Editor.show.cur = $("#u-cur").checked;
      Editor.show.ink = $("#u-ink").checked;
      Editor.show.opacity = Number($("#u-opacity").value) / 100;
      Editor.render();
    };
    ["#u-ref", "#u-cur", "#u-ink", "#u-opacity"].forEach((s) =>
      $(s).addEventListener("input", sync));
    sync();
  },

  bindTheme() {
    const btn = $("#theme-btn");
    const saved = localStorage.getItem("designer-theme");
    if (saved) document.documentElement.dataset.theme = saved;
    btn.addEventListener("click", () => {
      const now = document.documentElement.dataset.theme;
      const next = now === "dark" ? "light" : now === "light" ? "" : "dark";
      if (next) { document.documentElement.dataset.theme = next; localStorage.setItem("designer-theme", next); }
      else { delete document.documentElement.dataset.theme; localStorage.removeItem("designer-theme"); }
    });
  },

  // ── keys ────────────────────────────────────────────────────────

  bindKeys() {
    document.addEventListener("keydown", (e) => {
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
      const meta = e.metaKey || e.ctrlKey;

      if (meta && e.key.toLowerCase() === "s") { e.preventDefault(); return Store.save(); }
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        return e.shiftKey ? this.redo() : this.undo();
      }
      if (typing) return;

      if (e.shiftKey && (e.key === "H" || e.key === "h")) return this.flipDesign(true, false);
      if (e.shiftKey && (e.key === "V" || e.key === "v")) return this.flipDesign(false, true);

      switch (e.key) {
        case "b": case "B": return this.setTool("brush");
        case "v": case "V": return this.setTool("select");
        case "p": case "P": return this.setTool("pen");
        case "d": case "D": return this.setTool("dot");
        case "r": case "R": return Editor.refitSelected();
        case "1": return this.segKey("line");
        case "2": return this.segKey("arc");
        case "3": return this.segKey("curve");
        case "c": case "C": Editor.toggleClosed(); return this.syncToolbar();
        case "s": case "S": Editor.smoothShape(); return this.syncToolbar();
        case "Enter": return Editor.finishStroke();
        case "Escape":
          if (!$("#help").hidden) { $("#help").hidden = true; return; }
          if (Editor.drafting >= 0) return Editor.finishStroke();
          return Editor.select(null);
        case "Backspace": case "Delete":
          e.preventDefault();
          return Editor.deleteSelection();
        case "ArrowUp": e.preventDefault(); return this.step(-1);
        case "ArrowDown": e.preventDefault(); return this.step(1);
        default: break;
      }
    });
  },

  segKey(type) { Editor.setSegType(type); this.syncToolbar(); },

  // Undo swaps the whole design out, so anything the editor was holding
  // an index into has to go with it.
  flipDesign(x, y) {
    const shapes = (Store.design.shapes || []);
    if (!shapes.length) return Editor.onHint("nothing to mirror");
    const grid = GEOM.gridFor(Store.design.type || "consonant");
    const flipped = Importer.mirror(JSON.parse(JSON.stringify(shapes)), grid,
      { mirrorX: x, mirrorY: y });
    Editor.abandonDraft();
    Store.commit((d) => { d.shapes = flipped; });
    Editor.select(null);
    const how = x ? "left–right" : "top–bottom";
    Editor.onHint(`mirrored ${how} — ⌘Z to undo`);
  },

  undo() { Editor.abandonDraft(); Store.undo(); Editor.select(null); },
  redo() { Editor.abandonDraft(); Store.redo(); Editor.select(null); },
};

function matches(s, q) {
  if (!q) return true;
  return [s.name, s.ipa, s.arpabet, s.example, s.type]
    .filter(Boolean).join(" ").toLowerCase().includes(q);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

window.addEventListener("DOMContentLoaded", () => App.boot());
