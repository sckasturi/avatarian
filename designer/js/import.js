/**
 * Loading a shape in from somewhere else.
 *
 * The output panel can hand out three things — a design JSON, an SVG,
 * and a build_glyphs.py entry — so it takes all three back. That is the
 * baseline workflow: copy a letter that is nearly what you want, open
 * the one you're drawing, paste, and adjust. It also means anything
 * quoted at you in a chat or a commit can go straight in.
 *
 * The three arrive by different routes, and the difference matters:
 *
 *   design JSON   already lattice data. Taken AS IS — re-fitting
 *                 something that is already on the grid would only
 *                 round it a second time and drift it.
 *   svg / python  drawing coordinates, not lattice ones. Sampled back
 *                 into a gesture and put through the fitter, exactly
 *                 like the "use it" button.
 *
 * Nothing is rescaled to fit a different grid. A consonant shape
 * dropped on a vowel's shorter lattice hangs over the bottom, and the
 * problems panel says so — a baseline you can see and drag is more
 * use than one that has been silently squashed to fit.
 */

const Importer = {
  /**
   * text -> { shapes, note } or { error }.
   * `kind` is the TARGET glyph's kind, which decides how a drawing's
   * coordinates are read back onto the lattice.
   */
  parse(text, { kind = "consonant", snap = 0.5, level = "normal",
                mirrorX = false, mirrorY = false } = {}) {
    const t = (text || "").trim();
    if (!t) return { error: "nothing to load" };
    const opts = { snap, level };

    let res;
    if (t.startsWith("{") || t.startsWith("[")) res = this.fromDesign(t, kind);
    else if (/<svg|<path|<circle/i.test(t)) res = this.fromSVG(t, kind, opts);
    else if (/\b(path|dot)\s*\(/.test(t)) res = this.fromPython(t, kind, opts);
    else return {
      error: "not a design JSON, an SVG, or a build_glyphs.py entry — "
        + "paste one of the three the output panel produces",
    };

    if (res.shapes && (mirrorX || mirrorY)) {
      res.shapes = this.mirror(res.shapes, GEOM.gridFor(kind), { mirrorX, mirrorY });
      const how = mirrorX && mirrorY ? "turned round"
        : mirrorX ? "mirrored left–right" : "mirrored top–bottom";
      res.note = res.note ? `${how}, ${res.note}` : how;
    }
    return res;
  },

  /**
   * Reflect shapes in the lattice, about the centre of `grid`.
   *
   * Half this script is mirrors — /ə/ against /ɜ/, æ's cup against its
   * cap, the two /l/ orientations, and every top/bottom flip form — so
   * the cheapest way to draw one of a pair is to copy the other.
   *
   * Coordinates are the easy half. `bulge` is signed relative to the
   * LEFT of travel, and a reflection swaps left for right, so it has to
   * be negated — but only for a single reflection. Doing both axes is a
   * 180° rotation, which preserves handedness and leaves bulges alone.
   * Get this wrong and every arc in a mirrored shape bows the wrong way,
   * which reads as the fit having failed rather than as a sign error.
   */
  mirror(shapes, grid, { mirrorX = false, mirrorY = false } = {}) {
    if (!mirrorX && !mirrorY) return shapes;
    const [w, h] = grid;
    const flipHandedness = mirrorX !== mirrorY;      // exactly one axis
    const fx = (x) => (mirrorX ? round4(w - x) : x);
    const fy = (y) => (mirrorY ? round4(h - y) : y);
    const bend = (b) => (b == null ? b : round4(flipHandedness ? -b : b));

    return shapes.map((s) => {
      if (s.kind === "dot") return { ...s, x: fx(s.x), y: fy(s.y) };
      const out = {
        ...s,
        nodes: (s.nodes || []).map((n) => {
          const m = { ...n, x: fx(n.x), y: fy(n.y) };
          if (m.bulge != null) m.bulge = bend(m.bulge);
          return m;
        }),
      };
      if (s.closeSeg) {
        out.closeSeg = { ...s.closeSeg };
        if (out.closeSeg.bulge != null) out.closeSeg.bulge = bend(out.closeSeg.bulge);
      }
      // Keep the gesture in step, so re-reading a mirrored stroke still
      // re-reads the shape you can see rather than the one you copied.
      if (s.trace) out.trace = s.trace.map(([x, y]) => [fx(x), fy(y)]);
      return out;
    });
  },

  fromDesign(text, kind) {
    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return { error: "that isn't valid JSON: " + e.message };
    }
    const shapes = Array.isArray(data) ? data : data.shapes;
    if (!Array.isArray(shapes)) return { error: "no `shapes` in that JSON" };
    if (!shapes.length) return { error: "that design has nothing drawn in it" };
    if (!shapes.every((s) => s && (s.kind === "dot" || Array.isArray(s.nodes)))) {
      return { error: "that doesn't look like a list of shapes" };
    }

    const from = data.grid;
    const to = GEOM.gridFor(kind);
    const note = from && (from[0] !== to[0] || from[1] !== to[1])
      ? `drawn on a ${from[0]}×${from[1]} grid, this one is ${to[0]}×${to[1]}`
        + " — anything hanging off the lattice is flagged below"
      : "";
    return { shapes: JSON.parse(JSON.stringify(shapes)), note, source: data.name };
  },

  fromSVG(text, kind, opts) {
    const box = /viewBox\s*=\s*"[\d.\-]+\s+[\d.\-]+\s+([\d.]+)\s+([\d.]+)"/i.exec(text);
    const h = box ? parseFloat(box[2]) : 100;
    const shapes = Fit.fromSVG(text, frameForBox(h, kind), opts);
    if (!shapes.length) return { error: "couldn't read a path or a dot out of that" };
    return { shapes, note: "read through the fitter, so it landed on the lattice" };
  },

  /**
   * A build_glyphs.py entry: `path("M …" "…")` and `dot(x, y[, r])`,
   * possibly across several lines and joined with `+`. Rebuilt as an
   * SVG and handed to the same reader — the bodies are plain path data
   * and circles, so there is nothing else to interpret.
   */
  fromPython(text, kind, opts) {
    const parts = [];
    const paths = text.matchAll(/\bpath\s*\(\s*((?:"[^"]*"\s*)+)\)/g);
    for (const m of paths) {
      const d = [...m[1].matchAll(/"([^"]*)"/g)].map((q) => q[1]).join("");
      if (d.trim()) parts.push(`<path d="${d}"/>`);
    }
    const dots = text.matchAll(
      /\bdot\s*\(\s*(-?[\d.]+)\s*,\s*(-?[\d.]+)\s*(?:,\s*(-?[\d.]+)\s*)?\)/g);
    for (const m of dots) {
      // build_glyphs' dot() defaults to DOT; only the big ones say so.
      const r = m[3] !== undefined ? m[3] : GEOM.GEO.DOT_SIZES.m;
      parts.push(`<circle cx="${m[1]}" cy="${m[2]}" r="${r}"/>`);
    }
    if (!parts.length) return { error: "no path(...) or dot(...) in that snippet" };
    // build_glyphs always authors the square body, whatever the sound.
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">`
      + parts.join("") + "</svg>";
    const out = this.fromSVG(svg, kind, opts);
    if (out.shapes) out.note = "read through the fitter, so it landed on the lattice";
    return out;
  },
};

/**
 * Which frame a pasted drawing was written in.
 *
 * A 100x80 box is a vowel's flat drawing and can only be one thing. A
 * 100x100 box is ambiguous — a consonant, or a vowel's stretched
 * copy — so it is read as whatever the TARGET is, which is right
 * whenever you are pasting like for like and adjustable when you're not.
 */
const round4 = (v) => Math.round(v * 10000) / 10000;

function frameForBox(h, kind) {
  const flatBox = 100 * GEOM.GEO.FLAT;
  if (Math.abs(h - flatBox) < 1) return GEOM.frameFor("vowel", "flat");
  return GEOM.frameFor(kind, "square");
}

window.Importer = Importer;
