/**
 * The lattice canvas: drawing, hit-testing, dragging.
 *
 * The canvas IS the glyph's viewBox — 100x100 for a consonant, 100x80
 * for a vowel — with the 5x5 / 5x4 lattice drawn inside it at the same
 * margin the exporter uses. That means the reference tracings and the
 * currently-drawn glyph can be laid underneath at 1:1 with no fudging,
 * and what you see sitting on the grid is where the ink will actually
 * land.
 *
 * A vowel is drawn in its NATIVE 5x4 form. The square 100x100 form used
 * by equal-height mode is the stretched one, and the exporter derives it
 * — you never draw it.
 *
 * Everything is redrawn from the design on each change rather than
 * diffed. At a few dozen elements that is cheaper than the bookkeeping,
 * and it means the canvas can never drift out of step with the data.
 */

const Editor = {
  el: null,
  tool: "brush",
  segType: "line",
  dotSize: "m",
  tidy: "normal",       // how hard the brush regularises — see fit.js
  snap: 0.5,
  sel: null,            // {kind:'node'|'dot'|'seg', shape, index}
  drafting: -1,         // index of the shape the stroke tool is extending
  show: { ref: true, cur: false, ink: true, opacity: 0.28 },
  underlays: { ref: null, cur: null },
  onSelect: () => {},
  onHint: () => {},

  _drag: null,

  mount(el) {
    this.el = el;
    el.addEventListener("pointerdown", (e) => this.down(e));
    el.addEventListener("pointermove", (e) => this.move(e));
    el.addEventListener("pointerup", (e) => this.up(e));
    el.addEventListener("pointercancel", () => this.cancelDrag());
    el.addEventListener("dblclick", (e) => { e.preventDefault(); this.finishStroke(); });
    el.addEventListener("pointerleave", () => { this._hover = null; this.render(); });
  },

  // ── frame ────────────────────────────────────────────────────────

  get design() { return Store.design; },
  get kind() { return (this.design && this.design.type) || "consonant"; },
  /** The design's own grid where it has one — a full-height mark may be
   *  wider than the default 1×9 — falling back to the kind's fixed grid. */
  get grid() { return (this.design && this.design.grid) || GEOM.gridFor(this.kind); },
  /** Vowel-height glyphs are drawn natively, i.e. in the flat frame. */
  get form() { return GEOM.isTall(this.kind) ? "square" : "flat"; },
  get frame() { return GEOM.frameFor(this.kind, this.form, this.grid[0]); },

  gx(x) { const f = this.frame; return f.ox + x * f.sx; },
  gy(y) { const f = this.frame; return f.oy + y * f.sy; },

  /** Pointer -> lattice units. */
  at(e, raw = false) {
    const f = this.frame;
    const r = this.el.getBoundingClientRect();
    const [w, h] = [f.w, f.h];
    const sx = ((e.clientX - r.left) / r.width) * w;
    const sy = ((e.clientY - r.top) / r.height) * h;
    let x = (sx - f.ox) / f.sx;
    let y = (sy - f.oy) / f.sy;
    if (!raw && this.snap > 0 && !e.shiftKey) {
      x = Math.round(x / this.snap) * this.snap;
      y = Math.round(y / this.snap) * this.snap;
    }
    return { x: round4(x), y: round4(y) };
  },

  // ── selection helpers ────────────────────────────────────────────

  shapes() { return (this.design && this.design.shapes) || []; },

  select(sel) {
    this.sel = sel;
    this.onSelect(sel);
    this.render();
  },

  selectedShape() {
    return this.sel ? this.shapes()[this.sel.shape] : null;
  },

  /** The segment metadata object the toolbar edits, if a segment or the
   *  node ending one is selected. */
  selectedSeg() {
    const s = this.selectedShape();
    if (!s || s.kind === "dot") return null;
    if (this.sel.kind === "seg") return segMeta(s, this.sel.index);
    if (this.sel.kind === "node" && this.sel.index > 0) return s.nodes[this.sel.index];
    return null;
  },

  /** The selected node itself, any index — what the connect control edits.
   *  Unlike selectedSeg it includes node 0, which has no arriving segment
   *  but can still grow a connection stroke. */
  selectedNode() {
    const s = this.selectedShape();
    if (!s || s.kind === "dot" || !this.sel || this.sel.kind !== "node") return null;
    return s.nodes[this.sel.index] || null;
  },

  // ── pointer ──────────────────────────────────────────────────────

  down(e) {
    if (!this.design || e.button !== 0) return;
    // Capture keeps a stroke alive when the pointer leaves the canvas
    // mid-gesture. It throws for a pointer the element never saw, which
    // is not a reason to drop the stroke.
    try { this.el.setPointerCapture(e.pointerId); } catch { /* not fatal */ }
    // The brush takes the gesture raw and unsnapped; fit.js decides
    // what it meant once the pointer comes up.
    if (this.tool === "brush") {
      this._brush = [this.at(e, true)];
      this.select(null);
      return;
    }

    const p = this.at(e);
    const hit = this.hitTest(e);

    if (this.tool === "dot") {
      Store.commit((d) => d.shapes.push({ kind: "dot", x: p.x, y: p.y, size: this.dotSize }));
      this.select({ kind: "dot", shape: this.shapes().length - 1 });
      return;
    }

    if (this.tool === "pen") return this.penDown(p, hit);

    // select
    if (hit && (hit.kind === "node" || hit.kind === "dot" || hit.kind === "handle")) {
      this.select(hit.kind === "handle"
        ? { kind: "seg", shape: hit.shape, index: hit.index }
        : { kind: hit.kind, shape: hit.shape, index: hit.index });
      Store.begin();
      this._drag = { ...hit, start: p };
      return;
    }
    if (hit && hit.kind === "seg") {
      this.select({ kind: "seg", shape: hit.shape, index: hit.index });
      return;
    }
    this.select(null);
  },

  move(e) {
    if (!this.design) return;

    if (this._brush) {
      const p = this.at(e, true);
      const last = this._brush[this._brush.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) > 0.02) {
        this._brush.push(p);
        this.render();
      }
      return;
    }

    if (!this._drag) {
      const hit = this.hitTest(e);
      const key = hit ? `${hit.kind}:${hit.shape}:${hit.index}` : null;
      if (key !== this._hover) { this._hover = key; this.render(); }
      if (this.tool === "pen" && this.drafting >= 0) {
        this._ghost = this.at(e);
        this.render();
      }
      return;
    }

    const p = this.at(e);
    const shape = this.shapes()[this._drag.shape];
    if (!shape) return;

    if (this._drag.kind === "dot") {
      shape.x = p.x; shape.y = p.y;
    } else if (this._drag.kind === "node") {
      shape.nodes[this._drag.index].x = p.x;
      shape.nodes[this._drag.index].y = p.y;
    } else if (this._drag.kind === "handle") {
      // Sideways from the chord bows the segment; a segment dragged off
      // its chord becomes an arc, and dragged back onto it goes straight
      // again. That is the whole arc UI — there is nothing else to learn.
      const raw = this.at(e, true);
      const [a, b] = segEnds(shape, this._drag.index);
      const dx = b.x - a.x, dy = b.y - a.y;
      const c = Math.hypot(dx, dy) || 1;
      const nx = dy / c, ny = -dx / c;
      let bulge = (raw.x - (a.x + b.x) / 2) * nx + (raw.y - (a.y + b.y) / 2) * ny;
      if (this.snap > 0 && !e.shiftKey) bulge = snapBulge(bulge, c, this.snap);
      const meta = segMeta(shape, this._drag.index);
      if (Math.abs(bulge) < 0.06) { meta.seg = "line"; delete meta.bulge; }
      else { meta.seg = "arc"; meta.bulge = round4(bulge); }
    }
    Store.touch();
  },

  up(e) {
    if (this._brush) {
      const raw = this._brush;
      this._brush = null;
      this.commitBrush(raw);
    }
    if (this._drag) { this._drag = null; Store.end(); }
    if (this.el.hasPointerCapture && this.el.hasPointerCapture(e.pointerId)) {
      this.el.releasePointerCapture(e.pointerId);
    }
  },

  cancelDrag() {
    this._brush = null;
    if (this._drag) { this._drag = null; Store.end(); }
  },

  /** Drop any gesture in progress. Undo and redo swap the whole design
   *  out from under the editor, so an index into the old shape list is
   *  worse than useless afterwards. */
  abandonDraft() {
    this.drafting = -1;
    this._brush = null;
    this._ghost = null;
  },

  fitOpts() {
    return { level: this.tidy, snap: this.snap, dotSize: this.dotSize };
  },

  commitBrush(raw) {
    const shape = Fit.stroke(raw, this.fitOpts());
    if (!shape) { this.render(); return; }
    Store.commit((d) => d.shapes.push(shape));
    this.selectShape(this.shapes().length - 1);
  },

  /** Run the gesture through the fitter again — after changing how hard
   *  it tidies, or the snap. The stroke keeps its raw trace, so this is
   *  always available and never compounds: it re-reads the gesture, it
   *  does not re-fit the fit. */
  refitSelected() {
    if (!this.sel) return;
    const i = this.sel.shape;
    const shape = this.shapes()[i];
    if (!shape || !shape.trace) return this.onHint("that shape wasn't brushed — nothing to re-read");
    const next = Fit.refit(shape, this.fitOpts());
    if (!next) return;
    Store.commit((d) => { d.shapes[i] = next; });
    this.selectShape(i);
  },

  /** Start from the glyph the set currently ships, instead of a blank
   *  lattice. Read through the fitter, so what lands is a proper design
   *  and not a copy of the old path's coordinates. */
  fromCurrentGlyph() {
    // A vowel's flat copy is the one that matches the editor's frame;
    // fall back to the square drawing, read with the square frame.
    const wantFlat = !GEOM.isTall(this.kind) && !!this.underlays.curFlat;
    const src = wantFlat ? this.underlays.curFlat : this.underlays.cur;
    if (!src) return this.onHint("this sound has no drawn glyph to start from");

    const frame = GEOM.frameFor(this.kind, wantFlat ? "flat" : "square");
    const shapes = Fit.fromSVG(src, frame, this.fitOpts());
    if (!shapes.length) return this.onHint("couldn't read anything off that glyph");

    Store.commit((d) => { d.shapes = shapes; });
    this.selectShape(0);
    this.onHint(`read ${shapes.length} shape${shapes.length === 1 ? "" : "s"}`
      + " off the current glyph — ⌘Z to undo");
  },

  selectShape(i) {
    const s = this.shapes()[i];
    if (!s) return this.select(null);
    this.select(s.kind === "dot"
      ? { kind: "dot", shape: i, index: 0 }
      : { kind: "node", shape: i, index: 0 });
  },

  // ── the stroke tool ──────────────────────────────────────────────

  penDown(p, hit) {
    const shapes = this.shapes();

    if (this.drafting >= 0) {
      const shape = shapes[this.drafting];
      // Clicking the first node again closes the shape.
      if (shape.nodes.length > 2 && near(shape.nodes[0], p, 0.34)) {
        Store.commit((d) => {
          d.shapes[this.drafting].closed = true;
          d.shapes[this.drafting].closeSeg = { seg: this.segType === "arc" ? "line" : this.segType };
        });
        return this.finishStroke();
      }
      const last = shape.nodes[shape.nodes.length - 1];
      if (near(last, p, 0.2)) return this.finishStroke();
      Store.commit((d) => d.shapes[this.drafting].nodes.push(
        { x: p.x, y: p.y, seg: this.segType }));
      this._ghost = null;
      this.render();
      return;
    }

    // Starting from an existing loose end extends that stroke instead of
    // beginning a new one — the usual way a shape gets finished later.
    if (hit && hit.kind === "node") {
      const shape = shapes[hit.shape];
      const isEnd = !shape.closed &&
        (hit.index === 0 || hit.index === shape.nodes.length - 1);
      if (isEnd) {
        if (hit.index === 0) Store.commit((d) => reversePath(d.shapes[hit.shape]));
        this.drafting = hit.shape;
        this.select({ kind: "node", shape: hit.shape, index: shapes[hit.shape].nodes.length - 1 });
        this.hint();
        return;
      }
    }

    Store.commit((d) => d.shapes.push({ kind: "path", closed: false, nodes: [{ x: p.x, y: p.y }] }));
    this.drafting = shapes.length - 1;
    this.select({ kind: "node", shape: this.drafting, index: 0 });
    this.hint();
  },

  finishStroke() {
    const i = this.drafting;
    this.drafting = -1;
    this._ghost = null;
    if (i >= 0) {
      const shape = this.shapes()[i];
      // A stroke of one point is a mis-click, not a drawing.
      if (shape && shape.kind !== "dot" && (shape.nodes || []).length < 2) {
        Store.commit((d) => d.shapes.splice(i, 1));
        this.select(null);
      }
    }
    this.hint();
    this.render();
  },

  // ── editing operations ───────────────────────────────────────────

  setSegType(type) {
    const s = this.selectedShape();
    if (!s || s.kind === "dot" || !this.sel) { this.segType = type; this.hint(); return; }
    const idx = this.sel.kind === "seg" ? this.sel.index
      : this.sel.kind === "node" && this.sel.index > 0 ? this.sel.index - 1 : -1;
    if (idx < 0) { this.segType = type; this.hint(); return; }
    Store.commit((d) => {
      const meta = segMeta(d.shapes[this.sel.shape], idx);
      meta.seg = type;
      if (type !== "arc") delete meta.bulge;
      else if (!meta.bulge) meta.bulge = defaultBulge(d.shapes[this.sel.shape], idx);
    });
    this.segType = type;
    this.render();
  },

  /** Give the selected node a connect direction (or clear it with null).
   *  The stroke then grows from that node to the glyph's edge — see
   *  connection_paths in glyphspec.py / geom.js. */
  setConnect(dir) {
    if (!this.sel || this.sel.kind !== "node") return;
    const shapeIdx = this.sel.shape, nodeIdx = this.sel.index;
    Store.commit((d) => {
      const n = d.shapes[shapeIdx] && d.shapes[shapeIdx].nodes[nodeIdx];
      if (!n) return;
      if (dir) n.connect = dir; else delete n.connect;
    });
    this.render();
  },

  setDotSize(size) {
    this.dotSize = size;
    const s = this.selectedShape();
    if (s && s.kind === "dot") Store.commit(() => { s.size = size; });
    this.render();
  },

  /** Make every segment of the selected shape (or all shapes) smooth. */
  smoothShape() {
    const s = this.selectedShape();
    if (!s || s.kind === "dot") return;
    Store.commit(() => {
      s.nodes.slice(1).forEach((n) => { n.seg = "curve"; delete n.bulge; });
      if (s.closed) s.closeSeg = { seg: "curve" };
    });
  },

  toggleClosed() {
    const s = this.selectedShape();
    if (!s || s.kind === "dot" || s.nodes.length < 3) return;
    Store.commit(() => {
      s.closed = !s.closed;
      if (s.closed) s.closeSeg = s.closeSeg || { seg: "line" };
    });
  },

  deleteSelection() {
    if (!this.sel) return;
    const { kind, shape, index } = this.sel;
    Store.commit((d) => {
      const s = d.shapes[shape];
      if (!s) return;
      if (kind === "dot" || s.kind === "dot") { d.shapes.splice(shape, 1); return; }
      if (kind === "node") {
        s.nodes.splice(index, 1);
        if (s.nodes.length) delete s.nodes[0].seg;
        if (s.nodes.length < 2) d.shapes.splice(shape, 1);
        return;
      }
      d.shapes.splice(shape, 1);           // a segment selection deletes the stroke
    });
    if (this.drafting >= this.shapes().length) this.drafting = -1;
    this.select(null);
  },

  clearAll() {
    this.drafting = -1;
    Store.commit((d) => { d.shapes = []; });
    this.select(null);
  },

  hint() {
    const s = this.selectedShape();
    if (this.tool === "brush") {
      return this.onHint(s && s.trace
        ? "drawn — R re-reads it, or drag its nodes to adjust"
        : "draw the shape in one go; corners, straights and arcs are read off it");
    }
    const draft = this.drafting >= 0 ? this.shapes()[this.drafting] : null;
    if (draft) {
      const n = (draft.nodes || []).length;
      return this.onHint(n < 2
        ? "click the next lattice point — Esc to abandon"
        : "keep clicking; Enter or double-click to finish, first point to close");
    }
    if (this.tool === "pen") return this.onHint("click a lattice point to start a stroke");
    if (this.tool === "dot") return this.onHint("click to place a dot");
    if (this.sel && this.sel.kind === "seg") {
      return this.onHint("drag the handle to bow it — 1 line, 2 arc, 3 curve");
    }
    if (s) return this.onHint("drag to move — ⌫ deletes, C closes the shape");
    this.onHint("");
  },

  // ── hit testing ──────────────────────────────────────────────────

  hitTest(e) {
    const p = this.at(e, true);
    const shapes = this.shapes();
    const R = 0.28;                       // lattice units

    // Handles first, then nodes and dots, then segment bodies — the
    // small things on top, the way they are drawn.
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.kind === "dot") continue;
      const segs = GEOM.segmentsOf(s);
      for (let k = 0; k < segs.length; k++) {
        if ((segs[k][2] || {}).seg === "curve") continue;
        if (near(handlePos(s, k), p, R)) return { kind: "handle", shape: i, index: k };
      }
    }
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.kind === "dot") { if (near(s, p, R)) return { kind: "dot", shape: i, index: 0 }; continue; }
      for (let k = s.nodes.length - 1; k >= 0; k--) {
        if (near(s.nodes[k], p, R)) return { kind: "node", shape: i, index: k };
      }
    }
    for (let i = shapes.length - 1; i >= 0; i--) {
      const s = shapes[i];
      if (s.kind === "dot") continue;
      const segs = GEOM.segmentsOf(s);
      for (let k = 0; k < segs.length; k++) {
        const [a, b] = [segs[k][0], segs[k][1]];
        if (distToSeg(p, a, b) < 0.2) return { kind: "seg", shape: i, index: k };
      }
    }
    return null;
  },

  // ── rendering ────────────────────────────────────────────────────

  render() {
    if (!this.el || !this.design) return;
    const f = this.frame;
    const [gw, gh] = this.grid;
    this.el.setAttribute("viewBox", `0 0 ${f.w} ${f.h}`);
    // Sized in pixels rather than left to CSS: an inline SVG with a
    // viewBox fills its box and would letterbox, and each height class
    // wants a different box — a consonant's square, a vowel's 100x80, a
    // punctuation mark's tall-narrow 36x164. Measuring is exact, and the
    // pane is the only constraint that matters.
    const wrap = this.el.parentElement;
    const pad = 32;
    const avail = {
      w: (wrap.clientWidth || 620) - pad,
      h: (wrap.clientHeight || 620) - pad,
    };
    // Fit the box within the pane preserving aspect: size the LONG side to
    // whichever of width/height binds, floored so a narrow mark stays
    // usable and capped so a big glyph doesn't overflow. A 1x9 mark is
    // bound by height and comes out tall and thin, not stretched to 280.
    const box = Math.max(f.w, f.h);
    const longPx = Math.max(280, Math.min(760, (avail.w * box) / f.w,
                                          (avail.h * box) / f.h));
    const scale = longPx / box;
    this.el.setAttribute("width", f.w * scale);
    this.el.setAttribute("height", f.h * scale);
    this.el.setAttribute("class", this.tool);

    const out = [];
    out.push(this.renderUnderlays());
    out.push(this.renderGrid(gw, gh, f));
    if (this.show.ink) {
      out.push(`<g class="ink" stroke-width="${GEOM.GEO.SW}" opacity="0.9">`
        + GEOM.body(this.design, this.form) + "</g>");
    }
    out.push(this.renderTraces());
    out.push(this.renderSkeleton());
    out.push(this.renderHandles());
    this.el.innerHTML = out.join("");
  },

  /** The gesture itself: live while the brush is down, and behind the
   *  selected shape afterwards, so you can see what the fit made of
   *  what you drew. */
  renderTraces() {
    const p = [];
    if (this._brush && this._brush.length > 1) {
      p.push(`<path class="brush-live" d="${this.polyD(this._brush)}"/>`);
    }
    const s = this.selectedShape();
    if (s && s.trace && s.trace.length > 1 && !this._brush) {
      p.push(`<path class="brush-trace" d="${
        this.polyD(s.trace.map(([x, y]) => ({ x, y })))}"/>`);
    }
    return p.join("");
  },

  polyD(pts) {
    return pts.map((q, i) =>
      `${i ? "L" : "M"} ${GEOM.num(this.gx(q.x))} ${GEOM.num(this.gy(q.y))}`).join(" ");
  },

  renderUnderlays() {
    const parts = [];
    const o = this.show.opacity;
    const flatBox = !GEOM.isTall(this.kind);
    // The key is only ever traced square, so a vowel's tracing has to be
    // squashed in y to sit on a shorter lattice — the same squash
    // build_glyphs.py does. The drawn glyph needs no such thing when the
    // set already ships an exact flat copy of it.
    const squash = ` transform="scale(1,${GEOM.GEO.FLAT})"`;

    if (this.show.ref && this.underlays.ref) {
      parts.push(`<g class="underlay u-ref" opacity="${o}"${flatBox ? squash : ""}>`
        + sized(this.underlays.ref) + "</g>");
    }
    if (this.show.cur) {
      const exact = flatBox && this.underlays.curFlat;
      const svg = exact ? this.underlays.curFlat : this.underlays.cur;
      if (svg) {
        parts.push(`<g class="underlay u-cur" opacity="${o}"`
          + `${flatBox && !exact ? squash : ""}>` + sized(svg) + "</g>");
      }
    }
    return parts.join("");
  },

  renderGrid(gw, gh, f) {
    const p = [];
    const x0 = f.ox, y0 = f.oy;
    const x1 = f.ox + gw * f.sx, y1 = f.oy + gh * f.sy;

    p.push(`<rect class="g-box" x="0.5" y="0.5" width="99" height="${f.h - 1}" rx="2"/>`);

    for (let i = 0; i <= gw * 2; i++) {
      const x = x0 + (i / 2) * f.sx;
      p.push(`<line class="${i % 2 ? "g-minor" : "g-major"}" x1="${x}" y1="${y0}" x2="${x}" y2="${y1}"/>`);
    }
    for (let j = 0; j <= gh * 2; j++) {
      const y = y0 + (j / 2) * f.sy;
      p.push(`<line class="${j % 2 ? "g-minor" : "g-major"}" x1="${x0}" y1="${y}" x2="${x1}" y2="${y}"/>`);
    }
    p.push(`<rect class="g-edge" x="${x0}" y="${y0}" width="${gw * f.sx}" height="${gh * f.sy}"/>`);
    for (let i = 0; i <= gw; i++) {
      for (let j = 0; j <= gh; j++) {
        p.push(`<circle class="g-lat" cx="${x0 + i * f.sx}" cy="${y0 + j * f.sy}" r="0.9"/>`);
      }
    }
    return `<g>${p.join("")}</g>`;
  },

  renderSkeleton() {
    const f = this.frame;
    const p = [];
    this.shapes().forEach((s, i) => {
      if (s.kind === "dot") return;
      const d = GEOM.pathD(s, f);
      if (d) p.push(`<path class="skeleton" d="${d}"/>`);
      if (i === this.drafting && this._ghost && s.nodes.length) {
        const last = s.nodes[s.nodes.length - 1];
        p.push(`<line class="rubber" x1="${this.gx(last.x)}" y1="${this.gy(last.y)}" `
          + `x2="${this.gx(this._ghost.x)}" y2="${this.gy(this._ghost.y)}"/>`);
      }
      if (this.sel && this.sel.kind === "seg" && this.sel.shape === i) {
        const seg = GEOM.segmentsOf(s)[this.sel.index];
        if (seg) {
          const one = { kind: "path", closed: false, nodes: [seg[0], { ...seg[1], ...(seg[2] || {}) }] };
          const sd = GEOM.pathD(one, f);
          if (sd) p.push(`<path class="seg-sel" d="${sd}"/>`);
        }
      }
    });
    return p.join("");
  },

  renderHandles() {
    const p = [];
    const selKey = this.sel ? `${this.sel.kind}:${this.sel.shape}:${this.sel.index}` : "";
    this.shapes().forEach((s, i) => {
      if (s.kind === "dot") {
        const r = GEOM.GEO.DOT_SIZES[s.size || "m"];
        // Drawn at exactly the ink's radius with no outline: a dot is
        // the same weight as a stroke, and a handle that added a ring
        // to it would misreport that by eye — which is the one thing
        // you look at the canvas to judge.
        p.push(`<circle class="dotmark" cx="${this.gx(s.x)}" cy="${this.gy(s.y)}" r="${r}"/>`);
        if (selKey === `dot:${i}:0`) {
          p.push(`<circle class="dot-sel" cx="${this.gx(s.x)}" cy="${this.gy(s.y)}" `
            + `r="${r + 2.2}"/>`);
        }
        return;
      }
      GEOM.segmentsOf(s).forEach((seg, k) => {
        const meta = seg[2] || {};
        const h = handlePos(s, k);
        const smooth = meta.seg === "curve";
        p.push(`<circle class="handle${smooth ? " curve" : ""}" `
          + `cx="${this.gx(h.x)}" cy="${this.gy(h.y)}" r="${smooth ? 1.2 : 1.6}"/>`);
      });
      s.nodes.forEach((n, k) => {
        const on = selKey === `node:${i}:${k}` ? " sel" : "";
        const first = k === 0 && !s.closed ? " first" : "";
        p.push(`<circle class="node${on}${first}" cx="${this.gx(n.x)}" cy="${this.gy(n.y)}" r="2.1"/>`);
      });
    });
    return p.join("");
  },
};

// ── geometry helpers ───────────────────────────────────────────────
// round4 is defined in import.js (shared)

/**
 * Turn an open path round, so its start becomes the end and the stroke
 * tool can carry on from there.
 *
 * The node order is the easy half. A `seg` describes the segment
 * ARRIVING at its node, so reversing has to walk the segments back one
 * node as well — otherwise every segment ends up describing its
 * neighbour. Arcs also flip: `bulge` is signed relative to the
 * direction of travel, and the travel just reversed.
 */
function reversePath(shape) {
  const old = shape.nodes;
  const last = old.length - 1;
  shape.nodes = old.map((_, i) => {
    const at = old[last - i];
    const node = { x: at.x, y: at.y };
    if (i === 0) return node;                 // the new start takes none
    const from = old[last - i + 1];           // the segment we just walked
    if (from.seg) node.seg = from.seg;
    if (from.bulge != null) node.bulge = round4(-from.bulge);
    return node;
  });
}

function near(a, b, r) {
  return Math.abs(a.x - b.x) <= r && Math.abs(a.y - b.y) <= r;
}

function segEnds(shape, k) {
  const seg = GEOM.segmentsOf(shape)[k];
  return seg ? [seg[0], seg[1]] : [shape.nodes[0], shape.nodes[0]];
}

/** The object carrying a segment's type: the node it arrives at, or the
 *  path's closeSeg for the closing one. */
function segMeta(shape, k) {
  const n = shape.nodes.length;
  if (shape.closed && k === n - 1) {
    shape.closeSeg = shape.closeSeg || { seg: "line" };
    return shape.closeSeg;
  }
  return shape.nodes[k + 1];
}

/** Where a segment's drag handle sits: the chord midpoint pushed out by
 *  the bulge, i.e. the arc's own midpoint. */
function handlePos(shape, k) {
  const [a, b] = segEnds(shape, k);
  const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
  const meta = shape.closed && k === shape.nodes.length - 1
    ? (shape.closeSeg || {}) : (shape.nodes[k + 1] || {});
  const bulge = meta.seg === "arc" ? (meta.bulge || 0) : 0;
  if (!bulge) return { x: mx, y: my };
  const dx = b.x - a.x, dy = b.y - a.y;
  const c = Math.hypot(dx, dy) || 1;
  return { x: mx + (dy / c) * bulge, y: my + (-dx / c) * bulge };
}

/** The sagitta that makes a chord a quarter-circle: r − r·cos45°, over
 *  a chord of r√2. Sagitta = chord · (1 − √½) / √2. */
const QUARTER = (1 - Math.SQRT1_2) / Math.SQRT2;    // ≈ 0.2071

/** A gentle default when a segment is made an arc from the toolbar
 *  rather than by dragging: a quarter-circle's worth of sagitta. */
function defaultBulge(shape, k) {
  const [a, b] = segEnds(shape, k);
  return round4(Math.hypot(b.x - a.x, b.y - a.y) * QUARTER);
}

/**
 * Snap a dragged bulge.
 *
 * The plain lattice increments are the baseline, but the two bulges
 * worth having exactly are the ones that make the arc a true quarter
 * and half circle — four quarter-arcs round a lattice square is how a
 * ring gets drawn, and no multiple of ¼ hits it (a quarter needs
 * 0.7322 on a 3.54 chord). So those two are candidates as well, with a
 * bias so they win the moment you are anywhere near them.
 */
function snapBulge(b, chord, snap) {
  const step = snap / 2;
  const grid = Math.round(b / step) * step;
  const special = [chord * QUARTER, chord / 2, -chord * QUARTER, -chord / 2];
  let best = grid;
  let bestD = Math.abs(grid - b);
  for (const s of special) {
    const d = Math.abs(s - b) - step * 0.75;        // the bias
    if (d < bestD) { best = s; bestD = d; }
  }
  return round4(best);
}

function distToSeg(p, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const len = dx * dx + dy * dy;
  const t = len ? Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len)) : 0;
  return Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
}

/** Nested SVG needs an explicit user-unit size; without one the browser
 *  reads it as 100% of the outer viewport and letterboxes it. Taken from
 *  the drawing's own viewBox so a 100x80 flat glyph isn't stretched to a
 *  square. Every glyph and tracing here is authored without width or
 *  height, so adding them is enough. */
function sized(svgText) {
  const vb = /viewBox="\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)/.exec(svgText);
  const [w, h] = vb ? [vb[1], vb[2]] : [100, 100];
  return svgText.replace(/<svg\b/, `<svg width="${w}" height="${h}"`);
}

window.Editor = Editor;
