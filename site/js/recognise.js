/**
 * Draw a glyph, get ranked matches.
 *
 * Avatarian is a far easier recognition problem than handwriting
 * generally: 42 classes, all built from arcs, straight runs and dots on a
 * small lattice, and the thing being matched is a shape rather than a
 * personal hand. So this is geometry against the shipped set — no model,
 * no training data, and nothing to download.
 *
 * WHERE THE REFERENCE SHAPES COME FROM. `js/manifest.js` already carries
 * every glyph's SVG inline, because the whole "font" travels as one file.
 * That means the reference data for recognition is *already on the page*:
 * this samples points along each glyph's own paths with the browser's
 * `getPointAtLength`, which is exact and costs nothing to ship. The
 * alternative — precomputing point clouds in Python and bundling them —
 * would have added a build step and a second copy of every glyph that
 * could drift from the first.
 *
 * HOW MATCHING WORKS. Both sides become point clouds, each normalised
 * into a unit box by its own bounding box with the aspect ratio kept.
 * Score is the symmetric mean nearest-neighbour distance (a chamfer
 * distance), lowest wins.
 *
 * Deliberately NOT used: stroke order, stroke direction, and where the
 * pen lifted. They carry real information and a recogniser could exploit
 * them, but they encode how the *designer* drew a glyph, and there is no
 * reason a person copying one off a reference image would take the same
 * route. Stroke COUNT is used, at a low weight, because it is much more
 * stable than either.
 *
 * Keeping the aspect ratio is what separates the shapes that would
 * otherwise collide: normalising each axis independently makes every
 * glyph fill a square, and a wide flat cup starts looking like a tall
 * narrow one.
 */

/** Points sampled along each reference glyph, built once on first use. */
let REFERENCES = null;

/** Roughly how far apart samples sit along a path, in viewBox units. */
const STEP = 4;

/** Cap per glyph, so a long path can't dominate the cost. */
const MAX_POINTS = 140;

/**
 * How much a stroke-count mismatch costs, per stroke, against a chamfer
 * distance that runs about 0–0.4 for plausible matches.
 *
 * Low on purpose. Somebody copying a shape off a reference image draws
 * what they see, and whether that comes out as one stroke or three is
 * mostly about where they happened to lift the pen. It breaks ties
 * between shapes that are genuinely close; it should never overturn a
 * clearly better shape match.
 */
const STROKE_PENALTY = 0.015;

/**
 * Sample one SVG geometry element into points, in its own viewBox space.
 *
 * A circle is a dot. It samples as a small ring plus its centre, which is
 * what a drawn dot's cloud looks like — people scribble a blob rather
 * than trace a circle, and a blob's points sit inside the ring at about
 * the ring's own radius.
 */
function samplePoints(el, out) {
  if (el.tagName === "circle") {
    const cx = +el.getAttribute("cx"), cy = +el.getAttribute("cy");
    const r = +el.getAttribute("r") || 1;
    out.push([cx, cy]);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
    return;
  }
  const len = el.getTotalLength();
  if (!len) return;
  const n = Math.max(2, Math.min(MAX_POINTS, Math.round(len / STEP)));
  for (let i = 0; i <= n; i++) {
    const p = el.getPointAtLength((i / n) * len);
    out.push([p.x, p.y]);
  }
}

/**
 * Build the reference clouds. Lazy, and once.
 *
 * The SVG has to be in the document for `getPointAtLength` to be reliable
 * across browsers, so it goes into an off-screen holder rather than a
 * `display: none` one — display:none removes the element from layout and
 * takes some geometry APIs with it.
 */
function references() {
  if (REFERENCES) return REFERENCES;
  REFERENCES = [];
  const glyphs = (typeof window !== "undefined" && window.AVATARIAN_GLYPHS) || {};

  const holder = document.createElement("div");
  holder.setAttribute("aria-hidden", "true");
  holder.style.cssText =
    "position:absolute;left:-9999px;top:0;width:100px;height:100px;overflow:hidden";
  document.body.appendChild(holder);

  for (const [ipa, entry] of Object.entries(glyphs)) {
    // /x/ ships as a dashed placeholder box. Matching a drawn glyph
    // against a rectangle nobody drew would be noise in every ranking.
    if (entry.status === "PLACEHOLDER") continue;

    // The flat form where there is one: it is the vowel at its native
    // 5x4 proportions, while the square form is that drawing stretched
    // to a consonant's height. Since aspect ratio is part of the score,
    // matching against the stretched copy would be matching a distortion.
    holder.innerHTML = entry.flat || entry.svg;
    const svg = holder.querySelector("svg");
    if (!svg) continue;

    const points = [];
    let strokes = 0;
    svg.querySelectorAll("path, circle").forEach((el) => {
      strokes += 1;
      samplePoints(el, points);
    });
    if (!points.length) continue;

    const shape = normalise(points);
    REFERENCES.push({
      ipa, name: entry.name, type: entry.type, strokes,
      points: shape, flipped: false,
    });

    // A glyph is DRAWN once, in its top-slot form, and some mirror
    // top-to-bottom when they land in a bottom slot — æ's cup becomes a
    // cap, /ɑ/'s Y inverts. Without a mirrored candidate, somebody
    // copying a cap off a reference image draws a shape the matcher has
    // never seen, and the whole point of this is reading glyphs off
    // reference images.
    //
    // Only glyphs that actually flip get one. A mirrored drawing of a
    // glyph that does not flip is not that glyph, and adding candidates
    // nothing writes would be inventing evidence.
    if (entry.flips) {
      REFERENCES.push({
        ipa, name: entry.name, type: entry.type, strokes,
        points: mirrorY(shape), flipped: true,
      });
    }
  }

  holder.remove();
  return REFERENCES;
}

/**
 * Fit a cloud into a unit box, keeping its aspect ratio and centring the
 * shorter axis.
 *
 * A degenerate extent — a single dot, a perfectly straight line — would
 * divide by zero, so the span has a floor. That floor is also what stops
 * a dot from being blown up to fill the box and matched against
 * everything: below it, a small mark stays small.
 */
function normalise(points) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const w = maxX - minX, h = maxY - minY;
  const span = Math.max(w, h, 1e-6);
  // A mark smaller than a fifth of the box is a dot, not a shape drawn
  // small; keep it at its true relative size rather than magnifying it.
  const scale = 1 / Math.max(span, 0.2);
  const offX = (1 - w * scale) / 2, offY = (1 - h * scale) / 2;
  return points.map(([x, y]) =>
    [(x - minX) * scale + offX, (y - minY) * scale + offY]);
}

/**
 * Reflect a normalised cloud top-to-bottom.
 *
 * Safe to do after `normalise` rather than before: the shape sits inside
 * the unit box, centred on its short axis and spanning 0–1 on its long
 * one, so reflecting about y = 0.5 mirrors the shape exactly and leaves
 * it normalised. Which means the mirrored copy costs one pass over the
 * points, not a second round of sampling.
 */
function mirrorY(points) {
  return points.map(([x, y]) => [x, 1 - y]);
}

/** Mean distance from every point of `a` to its nearest point in `b`. */
function meanNearest(a, b) {
  let total = 0;
  for (let i = 0; i < a.length; i++) {
    const ax = a[i][0], ay = a[i][1];
    let best = Infinity;
    for (let j = 0; j < b.length; j++) {
      const dx = ax - b[j][0], dy = ay - b[j][1];
      const d = dx * dx + dy * dy;
      if (d < best) best = d;
    }
    total += Math.sqrt(best);
  }
  return total / a.length;
}

/**
 * Symmetric, because one-directional chamfer rewards the wrong thing: a
 * short mark sitting on top of a long glyph scores perfectly in the
 * short-to-long direction while missing most of the shape.
 */
function chamfer(a, b) {
  return (meanNearest(a, b) + meanNearest(b, a)) / 2;
}

/** Thin a cloud down to at most n points, evenly along its own order. */
function thin(points, n) {
  if (points.length <= n) return points;
  const out = [];
  for (let i = 0; i < n; i++) out.push(points[Math.floor(i * points.length / n)]);
  return out;
}

/**
 * Rank the glyph set against a drawn gesture.
 *
 * `strokes` is an array of strokes, each an array of {x, y} in any
 * coordinate space — normalisation makes the scale and position of the
 * drawing surface irrelevant, which is what lets the same code serve a
 * small pad on the main page and a large one in the workbench.
 *
 * Returns [{ ipa, name, type, score }], best first. `score` is a
 * distance, so lower is better; anything under about 0.1 is a good match
 * and over about 0.25 is probably not the glyph.
 */
function rankGesture(strokes, limit = 6) {
  const flat = [];
  for (const s of strokes) for (const p of s) flat.push([p.x, p.y]);
  if (flat.length < 2) return [];

  const drawn = normalise(thin(flat, MAX_POINTS));
  const drawnStrokes = strokes.filter(s => s.length > 1).length || strokes.length;

  // One row per GLYPH, not per candidate: a flipping glyph has two
  // reference clouds, and offering both would fill the list with pairs
  // that look identical for anything near-symmetric. Keeping the better
  // orientation is also what makes the answer useful — it says which way
  // up you drew it.
  const best = new Map();
  for (const ref of references()) {
    const score = chamfer(drawn, ref.points)
      + Math.abs(ref.strokes - drawnStrokes) * STROKE_PENALTY;
    const seen = best.get(ref.ipa);
    if (!seen || score < seen.score) {
      best.set(ref.ipa, {
        ipa: ref.ipa, name: ref.name, type: ref.type,
        flipped: ref.flipped, score,
      });
    }
  }

  return [...best.values()]
    .sort((a, b) => a.score - b.score)
    .slice(0, limit);
}

if (typeof module !== "undefined") {
  module.exports = { rankGesture, normalise, chamfer };
}
