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
    this.bindAttrs();
    this.bindShip();
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
    // The live preview needs the catalog, so it comes up after boot.
    // If the site's scripts didn't load it just stays absent — the rest
    // of the designer doesn't depend on it.
    this.live = Live.boot();
    if (!this.live) $("#live-note").textContent =
      "live preview unavailable — site/js/render.js didn't load";
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
    const groups = { consonant: "consonants", vowel: "vowels", mark: "marks",
                     cluster: "cluster forms" };
    // `group` is the heading; `type` is the height class, and the two
    // nulls differ on it — both are marks, at different heights.
    const groupOf = (s) => s.group || s.type;
    const list = $("#sound-list");
    list.innerHTML = "";

    Object.entries(groups).forEach(([kind, label]) => {
      const rows = Store.catalog.filter(
        (s) => groupOf(s) === kind && matches(s, filter));
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
          `<span class="meta">${[s.name, s.code, s.example].filter(Boolean).join(" · ")}</span></span>` +
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
    document.body.classList.toggle("has-flat", !GEOM.isTall(s.type));
    // Only a real vowel has a 3-row/4-row form. The nulls are marks:
    // each is written at one height and there is nothing to choose.
    document.body.classList.toggle("has-rows", s.type === "vowel");
    // A full-height mark is the one glyph whose width is a choice: a
    // question mark may want two or three columns where a period needs one.
    document.body.classList.toggle("has-cols", s.type === "mark_full");

    $("#now").innerHTML =
      `<b class="ipa">${s.ipa || "∅"}</b> ${s.name}` +
      `<span class="fine"> · ${s.type} · <span id="now-grid">${s.grid[0]}×${s.grid[1]}</span> grid` +
      (s.code ? ` · ${s.code}` : "") +
      (s.placeholder ? " · no glyph in the set yet" : "") + "</span>";
    $("#notes").value = Store.design.notes || "";
    $("#out-note").textContent = s.note ? `Source: ${s.note}.` : "";
    this.syncAttrs();
    $("#ship-note").textContent = "";

    this.markCurrent();
    this.setSaveState(Store.design.updated ? "on disk" : "not saved yet", "");
    this.showProblems([]);
    Editor.hint();
  },

  // ── flips / rows ────────────────────────────────────────────────
  //
  // These live in the design, not in build_glyphs.py: the designer is
  // where you find out that a glyph flips, or that it wants its top
  // row, so it is where you should be able to say so. build_glyphs.py
  // reads them back out of designs/ at build time and its own FLIPS /
  // VOWEL_4ROW sets stay the fallback for anything undrawn.

  bindAttrs() {
    $("#a-flips").addEventListener("change", (e) => {
      Store.commit((d) => { d.flips = e.target.checked; });
      this.syncAttrs();
    });
    $$(".rowbtn").forEach((b) => b.addEventListener("click", () => {
      Store.commit((d) => { d.rows = Number(b.dataset.rows); });
      this.syncAttrs();
    }));
    // Changing a mark's width rewrites its grid and reshapes the lattice,
    // so the canvas has to redraw — unlike the row toggle, which only
    // changes how the same lattice is read.
    $$(".colbtn").forEach((b) => b.addEventListener("click", () => {
      Store.commit((d) => { d.grid = [Number(b.dataset.cols), (d.grid && d.grid[1]) || 9]; });
      this.syncAttrs();
      Editor.render();
    }));
  },

  /** The design wins where it says something; the build's current value
   *  is what shows until it does. */
  flipsNow() {
    const d = Store.design || {};
    return typeof d.flips === "boolean" ? d.flips : !!(Store.current || {}).flips;
  },

  rowsNow() {
    const d = Store.design || {};
    return d.rows || (Store.current || {}).rows || 3;
  },

  colsNow() {
    const d = Store.design || {};
    return (d.grid && d.grid[0]) || 1;
  },

  syncAttrs() {
    const flips = this.flipsNow();
    const rows = this.rowsNow();
    const cols = this.colsNow();
    $("#a-flips").checked = flips;
    $$(".rowbtn").forEach((b) =>
      b.classList.toggle("on", Number(b.dataset.rows) === rows));
    $$(".colbtn").forEach((b) =>
      b.classList.toggle("on", Number(b.dataset.cols) === cols));
    const gridEl = document.querySelector("#now-grid");
    if (gridEl) gridEl.textContent = `${Editor.grid[0]}×${Editor.grid[1]}`;
    $("#pv-bot-cap").textContent = flips ? "bottom slot (flipped)" : "bottom slot";
    $("#pv-bot").classList.toggle("flip", flips);
  },

  // ── ship it ─────────────────────────────────────────────────────

  bindShip() {
    $("#ship").addEventListener("click", () => this.ship(false));
    $("#ship-all").addEventListener("click", () => this.shipAll(false));
  },

  /**
   * Ship everything that differs from what the set currently draws.
   *
   * Two presses, and the first one is the useful half: it lists which
   * glyphs would actually change without touching anything. A bulk edit
   * to the glyph set should be something you agree to after seeing the
   * list, not something one click does — several designs have drifted
   * from their shipped glyph and nobody has decided which direction is
   * right. Placeholders are excluded either way; those ADD a glyph, so
   * ship them one at a time.
   */
  async shipAll(confirmed) {
    const bar = $("#ship-all-bar");
    const say = (text, cls) => {
      bar.hidden = false;
      bar.className = "ship-bar " + (cls || "");
      bar.textContent = text;
      return bar;
    };
    $("#ship-all").disabled = true;
    say(confirmed ? "shipping…" : "checking what differs…");
    try {
      const res = await API.promoteAll(!confirmed);
      const names = res.changed || [];
      if (!names.length) {
        say(`nothing to do — all ${res.considered} designs match what ships.`, "ok");
      } else if (confirmed) {
        say(`shipped ${names.length} — reload the site to see them.`, "ok");
        await this.reloadShipped((Store.current || {}).name);
      } else {
        say(`${names.length} of ${res.considered} designs differ from the `
          + `glyph they ship: ${names.join(", ")}. `);
        const go = document.createElement("button");
        go.textContent = `ship all ${names.length}`;
        go.addEventListener("click", () => this.shipAll(true));
        bar.appendChild(go);
      }
      (res.failed || []).forEach((f) => {
        const li = document.createElement("span");
        li.className = "ship-bar-fail";
        li.textContent = `${f.name}: ${f.error}`;
        bar.appendChild(li);
      });
    } catch (e) {
      say(String(e.message || e), "bad");
    } finally {
      $("#ship-all").disabled = false;
      const x = document.createElement("button");
      x.className = "ship-bar-close";
      x.textContent = "×";
      x.title = "dismiss";
      x.addEventListener("click", () => { bar.hidden = true; });
      bar.appendChild(x);
    }
  },

  /**
   * Write this design into build_glyphs.py and rebuild the set.
   *
   * A sound that is still a PLACEHOLDER has no glyph in the set at all,
   * so shipping one ADDS a glyph rather than changing one. That is a
   * bigger step, so it takes a second press.
   */
  async ship(allowInvented) {
    const name = (Store.current || {}).name;
    if (!name) return;
    const note = $("#ship-note");
    if (!Store.hasDesign(name)) {
      note.className = "fine bad";
      note.textContent = "nothing drawn here yet";
      return;
    }
    // Flush any pending autosave: the server ships what is ON DISK.
    await Store.save(Store.design);
    $("#ship").disabled = true;
    note.className = "fine";
    note.textContent = "shipping…";
    try {
      const res = await API.promote(name, allowInvented);
      note.className = "fine ok";
      note.textContent = res.changed
        ? `${res.action} in ${res.dict}`
          + (res.placeholder ? ", out of PLACEHOLDERS" : "")
          + " · rebuilt — reload the site to see it"
        : "already identical to what ships";
      await this.reloadShipped(name);
    } catch (e) {
      const msg = String(e.message || e);
      note.className = "fine bad";
      if (/no glyph in the set yet/.test(msg)) {
        note.textContent = msg + " ";
        const again = document.createElement("button");
        again.className = "tiny";
        again.textContent = "ship anyway";
        again.addEventListener("click", () => this.ship(true));
        note.appendChild(again);
      } else {
        note.textContent = msg;
      }
    } finally {
      $("#ship").disabled = false;
    }
  },

  /** Re-read the catalog after a build so the underlays, the flip flag
   *  and the placeholder state are the ones that just got written. */
  async reloadShipped(name) {
    await Store.boot();
    const s = Store.sound(name);
    if (s) {
      // Store.current still points at the row from before the build.
      Store.current = s;
      Editor.underlays = { ref: s.reference, cur: s.current, curFlat: s.currentFlat };
      if (this.live) Live.adopt(s.key);
    }
    this.renderList();
    this.syncAttrs();
    Editor.render();
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
    if (!GEOM.isTall(d.type)) $("#pv-flat").innerHTML = GEOM.toSVG(d, "flat");
  },

  showProblems(problems) {
    const box = $("#problems");
    // Empty it as well as hiding it. Leaving the last glyph's problems
    // sitting in the DOM means anything reading the panel back — a test,
    // the inspector — sees a warning that belongs to a different letter.
    if (!problems || !problems.length) {
      box.hidden = true;
      box.innerHTML = "";
      return;
    }
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
      // The preview draws from the SERVER's SVG, not the canvas port,
      // so what it shows is what the build would draw.
      if (this.live) Live.sync(Store.current, Store.design, this.rendered);
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
    $$(".conn").forEach((b) => b.addEventListener("click", () => {
      const dir = b.dataset.connect;
      Editor.setConnect(dir === "none" ? null : dir);
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
    // The connect pad edits the selected node; show it only then, and
    // light the button for the direction that node currently carries.
    const node = Editor.selectedNode();
    $("#connect-group").hidden = !node;
    const conn = (node && node.connect) || "none";
    $$(".conn").forEach((b) => b.classList.toggle("on", b.dataset.connect === conn));
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
  return [s.name, s.ipa, s.code, s.example, s.type]
    .filter(Boolean).join(" ").toLowerCase().includes(q);
}

function escapeHTML(s) {
  return String(s).replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
}

window.addEventListener("DOMContentLoaded", () => App.boot());
