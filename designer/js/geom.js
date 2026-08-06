/**
 * The design format's geometry, ported from tools/glyphspec.py.
 *
 * This exists for the canvas only. Dragging a node has to redraw at
 * pointer speed, and round-tripping every frame through the server would
 * feel awful, so the live preview is computed here. Everything the
 * designer hands OUT — the SVG you copy, the source for build_glyphs.py —
 * comes back from POST /api/render, i.e. from the Python. When the two
 * disagree, the Python is right; keep this file in step with it.
 *
 * Coordinates are lattice units, y running down, (0,0) top-left.
 * See tools/glyphspec.py for the format itself.
 */

const GEO = {
  SW: 9,
  DEFAULT_DOT: "m",
  UNIT: 16,
  CONS_GRID: [5, 5],
  VOWEL_GRID: [5, 4],
};
// `m` (default) fills one grid cell — diameter = UNIT.
// `s` and `l` are escape hatches, not a style choice.
GEO.DOT_SIZES = { s: GEO.SW * 0.42, m: GEO.UNIT / 2, l: GEO.SW * 0.62 };
// Vowel height as a fraction of a consonant's. They stack flush in a
// block, so a consonant over a vowel is 5 + 4 = 9 units tall.
GEO.FLAT = GEO.VOWEL_GRID[1] / GEO.CONS_GRID[1];            // 4/5
// The lattice is centred in its box with enough margin that a stroke on
// the outermost row isn't clipped — stroke 9 needs 4.5. Clearance for
// the drawing, not a gap in the writing.
GEO.MARGIN_X = (100 - GEO.CONS_GRID[0] * GEO.UNIT) / 2;              // 10
GEO.MARGIN_Y_SQUARE = (100 - GEO.CONS_GRID[1] * GEO.UNIT) / 2;       // 10
GEO.MARGIN_Y_FLAT = (100 * GEO.FLAT - GEO.VOWEL_GRID[1] * GEO.UNIT) / 2;  // 8

/** How lattice coordinates land in a viewBox. sx !== sy only for the
 *  stretched square form of a vowel. */
function frameFor(kind, form) {
  if (kind === "consonant") {
    return { sx: GEO.UNIT, sy: GEO.UNIT, ox: GEO.MARGIN_X, oy: GEO.MARGIN_Y_SQUARE, h: 100 };
  }
  if (form === "flat") {
    return { sx: GEO.UNIT, sy: GEO.UNIT, ox: GEO.MARGIN_X, oy: GEO.MARGIN_Y_FLAT, h: 100 * GEO.FLAT };
  }
  return {
    sx: GEO.UNIT,
    sy: GEO.UNIT / GEO.FLAT,
    ox: GEO.MARGIN_X,
    oy: GEO.MARGIN_Y_FLAT / GEO.FLAT,
    h: 100,
  };
}

function gridFor(kind) {
  return kind === "consonant" ? [...GEO.CONS_GRID] : [...GEO.VOWEL_GRID];
}

const fx = (f, gx) => f.ox + gx * f.sx;
const fy = (f, gy) => f.oy + gy * f.sy;

function num(v) {
  const r = Math.round((v + Number.EPSILON) * 100) / 100;
  return String(r === 0 ? 0 : r);
}

/**
 * Circular arc through p0 and p1 whose midpoint sits `bulge` off the
 * chord: r follows from the sagitta, r = (b² + (c/2)²) / 2b. More than a
 * semicircle exactly when the sagitta exceeds half the chord.
 * Returns null when the bulge is too shallow to be an arc.
 */
function arcParams(p0, p1, bulge) {
  const b = Number(bulge) || 0;
  if (Math.abs(b) < 1e-4) return null;
  const c = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]);
  if (c < 1e-9) return null;
  const r = (b * b + (c / 2) ** 2) / (2 * Math.abs(b));
  return { r, large: Math.abs(b) > c / 2 ? 1 : 0, sweep: b > 0 ? 1 : 0 };
}

/**
 * Which way a segment is travelling at one of its ends, as a unit
 * vector: `end` 0 for where it leaves `a`, 1 for where it reaches `b`.
 *
 * A line travels the same way throughout. An arc's tangent makes the
 * tangent-chord angle with its chord — half the central angle, which is
 * asin(half-chord / r), or its supplement once the arc is past a
 * semicircle — leaning toward the bulge on the way out and away from it
 * on the way in.
 */
function tangentAt(a, b, meta, end) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const c = Math.hypot(dx, dy);
  if (c < 1e-9) return null;
  const ux = dx / c, uy = dy / c;
  meta = meta || {};
  if (meta.seg !== "arc") return [ux, uy];

  const got = arcParams([a.x, a.y], [b.x, b.y], meta.bulge);
  if (!got) return [ux, uy];
  let beta = Math.asin(Math.min(1, c / 2 / got.r));
  if (got.large) beta = Math.PI - beta;
  const nx = uy, ny = -ux;                  // left of travel
  let lean = Math.sin(beta) * ((meta.bulge || 0) > 0 ? 1 : -1);
  if (end !== 0) lean = -lean;
  return [Math.cos(beta) * ux + lean * nx, Math.cos(beta) * uy + lean * ny];
}

/**
 * A Catmull-Rom spline through `points`, as cubic control pairs.
 *
 * Interior tangents are the usual (P[i+1] − P[i−1]) / 2. The ends take
 * m0/mn when given, which is how a run picks up the direction of the
 * line or arc it joins; without them the end tangent falls back to the
 * end chord, the ordinary natural-end treatment.
 */
function spline(pts, m0, mn) {
  const n = pts.length;
  const tang = [];
  for (let i = 0; i < n; i++) {
    if (i === 0 && m0) tang.push(m0);
    else if (i === n - 1 && mn) tang.push(mn);
    else if (i === 0) tang.push([pts[1][0] - pts[0][0], pts[1][1] - pts[0][1]]);
    else if (i === n - 1) tang.push([pts[n - 1][0] - pts[n - 2][0], pts[n - 1][1] - pts[n - 2][1]]);
    else tang.push([(pts[i + 1][0] - pts[i - 1][0]) / 2, (pts[i + 1][1] - pts[i - 1][1]) / 2]);
  }
  const out = [];
  for (let i = 0; i < n - 1; i++) {
    out.push([
      [pts[i][0] + tang[i][0] / 3, pts[i][1] + tang[i][1] / 3],
      [pts[i + 1][0] - tang[i + 1][0] / 3, pts[i + 1][1] - tang[i + 1][1] / 3],
      pts[i + 1],
    ]);
  }
  return out;
}

/** The tangent to hand `spline` where a run meets `seg`. Direction comes
 *  from the neighbour so the join is smooth; length comes from the run's
 *  own end chord, so the curve keeps its own proportions rather than
 *  being pulled about by how long its neighbour happens to be. */
function endTangent(seg, pts, atStart) {
  if (!seg) return null;
  const dir = tangentAt(seg[0], seg[1], seg[2], atStart ? 1 : 0);
  if (!dir) return null;
  const a = atStart ? pts[0] : pts[pts.length - 1];
  const b = atStart ? pts[1] : pts[pts.length - 2];
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
  return [dir[0] * len, dir[1] * len];
}

/** (from, to, segmentMeta) triples, including the closing segment. */
function segmentsOf(shape) {
  const nodes = shape.nodes || [];
  const segs = [];
  for (let i = 1; i < nodes.length; i++) segs.push([nodes[i - 1], nodes[i], nodes[i]]);
  if (shape.closed && nodes.length > 2) {
    segs.push([nodes[nodes.length - 1], nodes[0], shape.closeSeg || { seg: "line" }]);
  }
  return segs;
}

function pathD(shape, f) {
  const nodes = shape.nodes || [];
  if (nodes.length < 2) return null;
  const segs = segmentsOf(shape);
  const d = ["M", num(fx(f, nodes[0].x)), num(fy(f, nodes[0].y))];

  let i = 0;
  while (i < segs.length) {
    const [a, b, meta] = segs[i];
    const kind = (meta && meta.seg) || "line";

    if (kind === "curve") {
      const start = i;
      while (i < segs.length && ((segs[i][2] && segs[i][2].seg) || "line") === "curve") i++;
      const run = segs.slice(start, i);
      const pts = [[run[0][0].x, run[0][0].y], ...run.map((s) => [s[1].x, s[1].y])];

      const closed = !!shape.closed && nodes.length > 2;
      let m0, mn;
      if (closed && run.length === segs.length) {
        // The run goes all the way round: no neighbour to borrow from,
        // so close the spline on itself instead. The first and last
        // points are the same node, and this is the tangent that
        // carries through it.
        const m = [(pts[1][0] - pts[pts.length - 2][0]) / 2,
                   (pts[1][1] - pts[pts.length - 2][1]) / 2];
        m0 = m; mn = m;
      } else {
        // Wrap round a closed path to find the neighbours.
        const prevSeg = start > 0 ? segs[start - 1] : (closed ? segs[segs.length - 1] : null);
        const nextSeg = i < segs.length ? segs[i] : (closed ? segs[0] : null);
        m0 = endTangent(prevSeg, pts, true);
        mn = endTangent(nextSeg, pts, false);
      }

      for (const [c1, c2, p] of spline(pts, m0, mn)) {
        d.push("C", num(fx(f, c1[0])), num(fy(f, c1[1])),
                    num(fx(f, c2[0])), num(fy(f, c2[1])),
                    num(fx(f, p[0])), num(fy(f, p[1])));
      }
      continue;
    }

    if (kind === "arc") {
      const got = arcParams([a.x, a.y], [b.x, b.y], meta.bulge);
      if (got) {
        // An anisotropic frame turns the circle into an axis-aligned
        // ellipse, which is what rx !== ry describes.
        d.push("A", num(got.r * f.sx), num(got.r * f.sy), "0",
               String(got.large), String(got.sweep),
               num(fx(f, b.x)), num(fy(f, b.y)));
        i++;
        continue;
      }
    }

    d.push("L", num(fx(f, b.x)), num(fy(f, b.y)));
    i++;
  }

  if (shape.closed && nodes.length > 2) d.push("Z");
  return d.join(" ");
}

function dotSVG(shape, f) {
  const r = GEO.DOT_SIZES[shape.size || GEO.DEFAULT_DOT] ?? GEO.DOT_SIZES.m;
  // Radius is deliberately unscaled: a dot is a dot at any height, and
  // scaling it in the stretched square form would make it an ellipse.
  return `<circle cx="${num(fx(f, shape.x))}" cy="${num(fy(f, shape.y))}" r="${num(r)}" fill="currentColor" stroke="none"/>`;
}

function body(design, form = "square") {
  const f = frameFor(design.type || "consonant", form);
  return (design.shapes || [])
    .map((s) => (s.kind === "dot" ? dotSVG(s, f) : (pathD(s, f) ? `<path d="${pathD(s, f)}"/>` : "")))
    .join("");
}

function toSVG(design, form = "square") {
  const f = frameFor(design.type || "consonant", form);
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 ${num(f.h)}" ` +
    `fill="none" stroke="currentColor" stroke-width="${GEO.SW}" ` +
    `stroke-linecap="square" stroke-linejoin="miter">${body(design, form)}</svg>`
  );
}

function formsFor(design) {
  return design.type === "consonant" ? ["square"] : ["square", "flat"];
}

/** The lattice-space path for the editor's own overlay, at a given
 *  pixels-per-unit. Same geometry, no margins — the canvas draws the
 *  lattice itself rather than a viewBox. */
function editorPath(shape, scale) {
  return pathD(shape, { sx: scale, sy: scale, ox: 0, oy: 0, h: 0 });
}

window.GEOM = {
  GEO, frameFor, gridFor, toSVG, body, pathD, dotSVG, formsFor,
  editorPath, arcParams, segmentsOf, tangentAt, num,
};
