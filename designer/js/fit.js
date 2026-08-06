/**
 * Turning a brush stroke into a glyph.
 *
 * You drag; this reads the gesture and writes the shape you meant —
 * lattice-snapped corners, straight runs that are actually straight,
 * curves that are actually circular arcs. The output is an ORDINARY
 * path in the design format, so everything downstream (the exporter,
 * the Python renderer, the build_glyphs.py snippet) is untouched. This
 * file is an input method, not a second geometry system, which is why
 * it has no counterpart in tools/glyphspec.py and nothing to keep in
 * step.
 *
 * The pipeline, in order:
 *
 *   1. clean      drop duplicate samples, resample to even spacing,
 *                 smooth out hand jitter
 *   2. break      find the corners — places where direction changes
 *                 fast — and the inflections, where a stroke stops
 *                 bending one way and starts bending the other
 *   3. snap       pull those break points onto the lattice
 *   4. describe   measure each run against its snapped chord: flat
 *                 enough is a line, otherwise a circular arc whose
 *                 bulge is the run's own sagitta
 *
 * Two things fall out of doing it in that order. Snapping happens on a
 * handful of break points rather than on every sample, so the lattice
 * decides the skeleton and the gesture only decides the curvature. And
 * because bulges are measured against the SNAPPED chord and then run
 * through the same quarter/half-circle snapping the drag handles use, a
 * hand-drawn corner lands on an exact quarter circle.
 *
 * A stroke also keeps a decimated copy of the raw gesture on the shape,
 * as `trace`. It is not used for rendering — glyphspec ignores keys it
 * doesn't know — but it means a stroke can be re-fitted at a different
 * tidiness later, and it records what was actually drawn as against
 * what was made of it.
 */

const Fit = {
  // How hard to tidy. Bigger tolerances mean fewer, cleaner segments
  // and less faithfulness to the wobble of the hand.
  LEVELS: {
    close: { tol: 0.09, corner: 40, label: "close to the gesture" },
    normal: { tol: 0.16, corner: 48, label: "balanced" },
    clean: { tol: 0.28, corner: 58, label: "strongly regularised" },
  },

  STEP: 0.09,          // resample spacing, lattice units
  CORNER_SPAN: 0.34,   // how far either side of a sample to measure turn
  DOT_MAX: 0.8,        // a scribble smaller than this was meant as a dot
  CLOSE_MAX: 0.75,     // start and end this close means a closed shape
  MAX_TURN: 150,       // a run bending more than this is split in half
  MAX_DEPTH: 6,

  /**
   * Fit a raw gesture. `raw` is lattice-space points, unsnapped, in
   * order. Returns a shape ready to push into design.shapes, or null if
   * there was nothing there.
   */
  stroke(raw, { level = "normal", snap = 0.5, dotSize = "m" } = {}) {
    const opts = this.LEVELS[level] || this.LEVELS.normal;
    let pts = dedupe(raw, 0.012);
    if (pts.length < 2) return null;

    // A small scribble is a dot. Drawing one as a path would give a
    // knot of tiny segments, which is never what a blob meant.
    const box = bounds(pts);
    if (Math.max(box.w, box.h) < this.DOT_MAX) {
      const c = centroid(pts);
      return { kind: "dot", x: snapTo(c.x, snap), y: snapTo(c.y, snap), size: dotSize };
    }

    pts = smooth(resample(pts, this.STEP), 2);
    if (pts.length < 3) pts = dedupe(raw, 0.012);

    // 2. break points
    const marks = new Set([0, pts.length - 1]);
    for (const i of corners(pts, this.STEP, this.CORNER_SPAN, opts.corner)) marks.add(i);
    const ordered = [...marks].sort((a, b) => a - b);
    const acc = [];
    for (let k = 0; k < ordered.length - 1; k++) {
      breakRun(pts, ordered[k], ordered[k + 1], opts.tol, 0, acc, this);
    }
    for (const i of acc) marks.add(i);
    let idx = [...marks].sort((a, b) => a - b);

    // 3. snap, dropping break points that snapped onto their neighbour
    let verts = idx.map((i) => ({
      i,
      x: snapTo(pts[i].x, snap),
      y: snapTo(pts[i].y, snap),
    }));
    verts = verts.filter((v, k) =>
      k === 0 || v.x !== verts[k - 1].x || v.y !== verts[k - 1].y);
    if (verts.length < 2) return null;

    // Did the gesture come back to where it started?
    const closed = verts.length > 2 &&
      Math.hypot(verts[0].x - verts[verts.length - 1].x,
                 verts[0].y - verts[verts.length - 1].y) <= this.CLOSE_MAX;
    if (closed) verts.pop();
    if (verts.length < 2) return null;

    // 4. describe each run
    //
    // A run carries its own SAMPLE range as well as its two snapped
    // endpoints, because on a closed shape the two disagree: the last
    // run ends at the snapped first vertex, but its samples run to the
    // end of the gesture. Indexing it by the vertices instead gives an
    // empty range, and an empty range reads as a straight line — which
    // is a flat chord across what should be the closing curve.
    const runs = [];
    for (let k = 0; k < verts.length - 1; k++) {
      runs.push({ i0: verts[k].i, i1: verts[k + 1].i, a: verts[k], b: verts[k + 1] });
    }
    if (closed) {
      const last = verts[verts.length - 1];
      runs.push({ i0: last.i, i1: pts.length - 1, a: last, b: verts[0] });
    }

    const nodes = [{ x: verts[0].x, y: verts[0].y }];
    const shape = { kind: "path", closed, nodes };
    runs.forEach((run, k) => {
      const seg = describe(pts, run, opts.tol, snap);
      if (closed && k === runs.length - 1) shape.closeSeg = seg;
      else nodes.push({ x: run.b.x, y: run.b.y, ...seg });
    });

    shape.trace = decimate(raw, 64);
    return shape;
  },

  /** Re-fit a shape from the gesture it was drawn with. */
  refit(shape, opts) {
    if (!shape || !shape.trace || !shape.trace.length) return null;
    return this.stroke(shape.trace.map(([x, y]) => ({ x, y })), opts);
  },

  /**
   * Read an existing glyph SVG in as a design — the starting point when
   * a shape is nearly right already and you want to adjust it rather
   * than redraw it.
   *
   * The path is SAMPLED back into a gesture and put through the same
   * fitter a brush stroke uses, rather than transcribed command by
   * command. That is the point: transcribing would carry the old
   * drawing's off-lattice coordinates and hand-tuned cubics straight
   * into the design, and the whole reason for the lattice is that those
   * are what went wrong. Sampling gives the shape a second opinion —
   * corners land on lattice points and curves come back as real arcs.
   *
   * `frame` must be the one the SVG was written in, so a vowel's flat
   * copy is read with the flat frame.
   */
  fromSVG(svgText, frame, opts = {}) {
    const NS = "http://www.w3.org/2000/svg";
    const doc = new DOMParser().parseFromString(svgText, "image/svg+xml");
    if (doc.querySelector("parsererror")) return [];

    // Measuring a path needs a laid-out element, so borrow one off-screen.
    const host = document.createElementNS(NS, "svg");
    host.setAttribute("width", "0");
    host.setAttribute("height", "0");
    host.style.cssText = "position:absolute;left:-9999px;opacity:0";
    document.body.appendChild(host);

    const toLattice = (x, y) => ({
      x: (x - frame.ox) / frame.sx,
      y: (y - frame.oy) / frame.sy,
    });
    const out = [];
    try {
      for (const el of doc.querySelectorAll("path")) {
        for (const d of subpaths(el.getAttribute("d") || "")) {
          const p = document.createElementNS(NS, "path");
          p.setAttribute("d", d);
          host.appendChild(p);
          const len = p.getTotalLength();
          if (len > 1) {
            // About one sample per svg unit: finer than the fitter's own
            // resampling, so nothing is lost before it gets there.
            const n = Math.max(8, Math.round(len));
            const pts = [];
            for (let i = 0; i <= n; i++) {
              const q = p.getPointAtLength((i * len) / n);
              pts.push(toLattice(q.x, q.y));
            }
            const shape = this.stroke(pts, opts);
            if (shape) out.push(shape);
          }
          host.removeChild(p);
        }
      }
      for (const c of doc.querySelectorAll("circle")) {
        const at = toLattice(+c.getAttribute("cx"), +c.getAttribute("cy"));
        out.push({
          kind: "dot",
          x: snapTo(at.x, opts.snap ?? 0.5),
          y: snapTo(at.y, opts.snap ?? 0.5),
          size: dotSizeFor(+c.getAttribute("r")),
        });
      }
    } finally {
      host.remove();
    }
    return out;
  },
};

/** Split a `d` into its subpaths, so sampling doesn't run a phantom
 *  line from the end of one to the start of the next. Every glyph in
 *  this project is authored with absolute commands, so splitting on the
 *  moveto is safe; a relative `m` would need the running point. */
function subpaths(d) {
  return d.match(/[Mm][^Mm]*/g) || (d.trim() ? [d] : []);
}

function dotSizeFor(r) {
  let best = Fit.DEFAULT_DOT || "m", diff = Infinity;
  for (const [name, size] of Object.entries(GEOM.GEO.DOT_SIZES)) {
    if (Math.abs(size - r) < diff) { diff = Math.abs(size - r); best = name; }
  }
  return best;
}

// ── cleaning ───────────────────────────────────────────────────────

function dedupe(pts, eps) {
  const out = [];
  for (const p of pts) {
    const q = out[out.length - 1];
    if (!q || Math.hypot(p.x - q.x, p.y - q.y) > eps) out.push({ x: p.x, y: p.y });
  }
  return out;
}

/** Even spacing along the stroke. Curvature and turn measurements below
 *  all assume it, and a raw gesture is anything but — pointer samples
 *  bunch up wherever the hand slowed down, which is exactly at the
 *  corners the measurements care about. */
function resample(pts, step) {
  const out = [{ ...pts[0] }];
  let carry = 0;
  for (let i = 1; i < pts.length; i++) {
    const a = pts[i - 1], b = pts[i];
    let d = Math.hypot(b.x - a.x, b.y - a.y);
    if (d < 1e-9) continue;
    let t = (step - carry) / d;
    while (t <= 1) {
      out.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      t += step / d;
    }
    carry = (1 - (t - step / d)) * d;
  }
  const last = pts[pts.length - 1];
  const tail = out[out.length - 1];
  if (Math.hypot(last.x - tail.x, last.y - tail.y) > step * 0.4) out.push({ ...last });
  return out;
}

/** Three-tap average, ends pinned. Takes the tremor out without moving
 *  where the stroke starts or finishes. */
function smooth(pts, passes) {
  let cur = pts;
  for (let p = 0; p < passes; p++) {
    const next = [cur[0]];
    for (let i = 1; i < cur.length - 1; i++) {
      next.push({
        x: (cur[i - 1].x + 2 * cur[i].x + cur[i + 1].x) / 4,
        y: (cur[i - 1].y + 2 * cur[i].y + cur[i + 1].y) / 4,
      });
    }
    next.push(cur[cur.length - 1]);
    cur = next;
  }
  return cur;
}

// ── measurement ────────────────────────────────────────────────────

function bounds(pts) {
  const xs = pts.map((p) => p.x), ys = pts.map((p) => p.y);
  const x0 = Math.min(...xs), x1 = Math.max(...xs);
  const y0 = Math.min(...ys), y1 = Math.max(...ys);
  return { x0, y0, w: x1 - x0, h: y1 - y0 };
}

function centroid(pts) {
  const s = pts.reduce((a, p) => ({ x: a.x + p.x, y: a.y + p.y }), { x: 0, y: 0 });
  return { x: s.x / pts.length, y: s.y / pts.length };
}

function snapTo(v, snap) {
  const r = snap > 0 ? Math.round(v / snap) * snap : v;
  return Math.round(r * 10000) / 10000;
}

/** Signed distance of each sample from the chord a→b, measured along
 *  the LEFT normal — the same sign convention `bulge` uses, so a
 *  deviation can be handed straight over as one. */
function deviations(pts, i0, i1, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const c = Math.hypot(dx, dy) || 1;
  const nx = dy / c, ny = -dx / c;
  const out = [];
  for (let i = i0; i <= i1; i++) {
    out.push((pts[i].x - a.x) * nx + (pts[i].y - a.y) * ny);
  }
  return out;
}

/** Total absolute turning across a run, in degrees. A run that bends
 *  more than half a circle can't be one honest arc. */
function turnOf(pts, i0, i1) {
  let total = 0;
  for (let i = i0 + 1; i < i1; i++) {
    const ax = pts[i].x - pts[i - 1].x, ay = pts[i].y - pts[i - 1].y;
    const bx = pts[i + 1].x - pts[i].x, by = pts[i + 1].y - pts[i].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) continue;
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    total += Math.acos(cos);
  }
  return (total * 180) / Math.PI;
}

/**
 * Corners: samples where the direction swings hard over a short span.
 *
 * Measuring across a fixed span is what separates a corner from a
 * curve. A drawn right-angle turns 90° within a third of a cell; a
 * quarter-circle of radius 2½ spreads the same 90° over four cells, so
 * across the same span it barely turns 15°.
 */
function corners(pts, step, span, angleDeg) {
  const k = Math.max(2, Math.round(span / step));
  const turn = new Array(pts.length).fill(0);
  for (let i = k; i < pts.length - k; i++) {
    const ax = pts[i].x - pts[i - k].x, ay = pts[i].y - pts[i - k].y;
    const bx = pts[i + k].x - pts[i].x, by = pts[i + k].y - pts[i].y;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    if (la < 1e-9 || lb < 1e-9) continue;
    const cos = Math.max(-1, Math.min(1, (ax * bx + ay * by) / (la * lb)));
    turn[i] = (Math.acos(cos) * 180) / Math.PI;
  }
  // Keep only the sharpest sample in each neighbourhood, or a single
  // corner comes back as a cluster of them.
  const sup = Math.max(2, Math.round(0.5 / step));
  const out = [];
  for (let i = 0; i < turn.length; i++) {
    if (turn[i] < angleDeg) continue;
    let best = true;
    for (let j = Math.max(0, i - sup); j <= Math.min(turn.length - 1, i + sup); j++) {
      if (turn[j] > turn[i]) { best = false; break; }
    }
    if (best && (!out.length || i - out[out.length - 1] > sup)) out.push(i);
  }
  return out;
}

/**
 * Split a run until each piece is something one segment can say:
 * straight, or a single circular arc bending one way by less than half
 * a turn.
 */
function breakRun(pts, i0, i1, tol, depth, acc, cfg) {
  if (i1 - i0 < 2 || depth >= cfg.MAX_DEPTH) return;

  // Too much bend for one arc — halve it and look again.
  if (turnOf(pts, i0, i1) > cfg.MAX_TURN) {
    const mid = (i0 + i1) >> 1;
    acc.push(mid);
    breakRun(pts, i0, mid, tol, depth + 1, acc, cfg);
    breakRun(pts, mid, i1, tol, depth + 1, acc, cfg);
    return;
  }

  const devs = deviations(pts, i0, i1, pts[i0], pts[i1]);
  let hi = 0, iHi = -1, lo = 0, iLo = -1;
  devs.forEach((d, k) => {
    if (d > hi) { hi = d; iHi = i0 + k; }
    if (d < lo) { lo = d; iLo = i0 + k; }
  });

  // Bends both ways: an S. Split where it crosses back over the chord,
  // so each half bends one way only.
  if (hi > tol && -lo > tol) {
    const from = Math.min(iHi, iLo), to = Math.max(iHi, iLo);
    const sign = Math.sign(devs[from - i0]);
    let cross = -1;
    for (let i = from; i <= to; i++) {
      if (Math.sign(devs[i - i0]) !== sign) { cross = i; break; }
    }
    if (cross > i0 && cross < i1) {
      acc.push(cross);
      breakRun(pts, i0, cross, tol, depth + 1, acc, cfg);
      breakRun(pts, cross, i1, tol, depth + 1, acc, cfg);
      return;
    }
  }

  const peak = hi >= -lo ? hi : lo;
  const iPeak = hi >= -lo ? iHi : iLo;
  if (Math.abs(peak) <= tol) return;                 // straight enough

  // A circular arc is deepest at its middle. A run whose deepest point
  // sits well off-centre is some other shape wearing an arc's clothes,
  // so break it there and describe the halves separately.
  const frac = (iPeak - i0) / (i1 - i0);
  if (frac < 0.3 || frac > 0.7) {
    acc.push(iPeak);
    breakRun(pts, i0, iPeak, tol, depth + 1, acc, cfg);
    breakRun(pts, iPeak, i1, tol, depth + 1, acc, cfg);
  }
}

/**
 * What one run between two SNAPPED lattice points is: a line, or an arc
 * with a bulge.
 *
 * Curvature is measured against the gesture's OWN endpoints, not the
 * snapped ones. Measuring against the snapped chord sounds simpler and
 * is wrong: pulling an endpoint half a cell tilts the chord under a
 * perfectly straight run and reads the tilt back as a bow. So the
 * sagitta is taken from the raw run and then scaled onto the snapped
 * chord, which keeps the arc's proportions while letting the lattice
 * own the endpoints.
 *
 * The result goes through the same quarter/half-circle snapping the
 * drag handles use, which is what turns a hand-drawn shoulder into an
 * exact quarter circle rather than an almost-quarter-circle.
 */
function describe(pts, run, tol, snap) {
  const { i0, i1, a, b } = run;
  const rawA = pts[i0], rawB = pts[i1];
  const devs = deviations(pts, i0, i1, rawA, rawB);
  if (devs.length < 3) return { seg: "line" };

  const mid = devs[Math.round((devs.length - 1) / 2)];
  let peak = 0;
  for (const d of devs) if (Math.abs(d) > Math.abs(peak)) peak = d;
  if (Math.abs(peak) <= tol) return { seg: "line" };

  // The sagitta is the deviation at the middle of the run; the peak is
  // only a fallback for a run so short the middle sample is noise.
  const sag = Math.abs(mid) > tol * 0.5 ? mid : peak;

  const rawChord = Math.hypot(rawB.x - rawA.x, rawB.y - rawA.y);
  const chord = Math.hypot(b.x - a.x, b.y - a.y);
  if (rawChord < 1e-6 || chord < 1e-6) return { seg: "line" };

  const bulge = snapBulgeValue(sag * (chord / rawChord), chord, snap);
  if (!bulge) return { seg: "line" };
  return { seg: "arc", bulge };
}

const QUARTER_SAG = (1 - Math.SQRT1_2) / Math.SQRT2;   // ≈ 0.2071

/** Same rule as dragging a segment's handle: lattice increments, plus
 *  the exact quarter and half circle, which no multiple of ¼ hits. */
function snapBulgeValue(b, chord, snap) {
  if (snap <= 0) return Math.round(b * 10000) / 10000;
  const step = snap / 2;
  const grid = Math.round(b / step) * step;
  let best = grid, bestD = Math.abs(grid - b);
  for (const s of [chord * QUARTER_SAG, chord / 2, -chord * QUARTER_SAG, -chord / 2]) {
    const d = Math.abs(s - b) - step * 0.75;
    if (d < bestD) { best = s; bestD = d; }
  }
  return Math.round(best * 10000) / 10000;
}

/** A readable record of the gesture, small enough to sit in the JSON. */
function decimate(pts, max) {
  if (pts.length <= max) return pts.map((p) => [r3(p.x), r3(p.y)]);
  const out = [];
  for (let i = 0; i < max; i++) {
    out.push(pts[Math.round((i * (pts.length - 1)) / (max - 1))]);
  }
  return out.map((p) => [r3(p.x), r3(p.y)]);
}

const r3 = (v) => Math.round(v * 1000) / 1000;

window.Fit = Fit;
