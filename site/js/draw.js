/**
 * The drawing pad — draw a glyph, pick it from the ranked matches.
 *
 * Shared by the main page and the transcription workbench, which want the
 * same thing for different reasons: on the main page it is a way in for
 * somebody who can see a glyph but doesn't know its code, and in the
 * workbench it is faster than hunting a 42-cell palette for a shape you
 * are looking straight at.
 *
 * Scoring lives in js/recognise.js. This file is only the surface: a
 * canvas, the strokes, and what to do with a pick.
 *
 *   createDrawPad(container, { onPick, limit })
 *
 * `onPick` gets { ipa, name, type, score }. What that means is the
 * caller's business — the main page appends a code to the sounds box, the
 * workbench appends it to the spelling being transcribed.
 */

/** The lattice a consonant is drawn on, as a guide behind the ink. */
const GUIDE_CELLS = 5;

function createDrawPad(container, options = {}) {
  const { onPick = () => {}, limit = 6 } = options;

  container.classList.add("drawpad");
  container.innerHTML = `
    <div class="drawpad-surface">
      <canvas class="drawpad-canvas"></canvas>
      <p class="drawpad-hint">Draw a glyph here</p>
    </div>
    <div class="drawpad-bar">
      <button type="button" class="drawpad-btn" data-act="undo"
              title="Remove the last stroke">undo stroke</button>
      <button type="button" class="drawpad-btn" data-act="clear">clear</button>
    </div>
    <div class="drawpad-results" aria-live="polite"></div>`;

  const canvas = container.querySelector(".drawpad-canvas");
  const results = container.querySelector(".drawpad-results");
  const hint = container.querySelector(".drawpad-hint");
  const ctx = canvas.getContext("2d");

  /** Strokes, each an array of {x, y} in CSS pixels within the canvas. */
  let strokes = [];
  let drawing = null;

  // --- painting ---------------------------------------------------------

  function resize() {
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    paint();
  }

  function paint() {
    const rect = canvas.getBoundingClientRect();
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);

    // The lattice, faintly. Avatarian is built on it, and drawing to a
    // grid gets people closer to the proportions the set was drawn at —
    // which is most of what the score is measuring.
    const ink = getComputedStyle(container).color;
    ctx.save();
    ctx.globalAlpha = 0.14;
    ctx.strokeStyle = ink;
    ctx.lineWidth = 1;
    for (let i = 1; i < GUIDE_CELLS; i++) {
      const x = (w / GUIDE_CELLS) * i, y = (h / GUIDE_CELLS) * i;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
    }
    ctx.restore();

    ctx.save();
    ctx.strokeStyle = ink;
    ctx.lineWidth = Math.max(3, Math.min(w, h) * 0.055);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    for (const stroke of strokes) {
      if (stroke.length === 1) {
        // A tap is a dot, and a zero-length line draws nothing with a
        // round cap on some browsers. Draw it as a disc.
        ctx.beginPath();
        ctx.arc(stroke[0].x, stroke[0].y, ctx.lineWidth / 2, 0, Math.PI * 2);
        ctx.fillStyle = ink;
        ctx.fill();
        continue;
      }
      ctx.beginPath();
      ctx.moveTo(stroke[0].x, stroke[0].y);
      for (let i = 1; i < stroke.length; i++) ctx.lineTo(stroke[i].x, stroke[i].y);
      ctx.stroke();
    }
    ctx.restore();

    hint.hidden = strokes.length > 0;
  }

  // --- input ------------------------------------------------------------

  function pointAt(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    // Synthetic events have no real pointer to capture and throw here.
    try { canvas.setPointerCapture(event.pointerId); } catch (e) { /* fine */ }
    drawing = [pointAt(event)];
    strokes.push(drawing);
    paint();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drawing) return;
    const p = pointAt(event);
    const last = drawing[drawing.length - 1];
    // Drop samples that land on top of the last one: they cost time in
    // the matcher and add nothing to the shape.
    if (Math.hypot(p.x - last.x, p.y - last.y) < 1.5) return;
    drawing.push(p);
    paint();
  });

  function endStroke() {
    if (!drawing) return;
    drawing = null;
    match();
  }
  canvas.addEventListener("pointerup", endStroke);
  canvas.addEventListener("pointercancel", endStroke);
  canvas.addEventListener("pointerleave", endStroke);

  container.querySelector('[data-act="undo"]').addEventListener("click", () => {
    strokes.pop();
    paint();
    match();
  });
  container.querySelector('[data-act="clear"]').addEventListener("click", clear);

  function clear() {
    strokes = [];
    drawing = null;
    paint();
    results.innerHTML = "";
  }

  // --- matching ---------------------------------------------------------

  /**
   * How a score is described to the reader. The numbers come from what
   * the chamfer distance actually does on this glyph set: a careful
   * copy lands under 0.1, a recognisable-but-loose one under 0.18, and
   * past about 0.25 the ranking is mostly arbitrary.
   *
   * Saying so matters more than it looks. The failure mode of a
   * recogniser is a confident wrong answer, and this is a transcription
   * tool — a wrong glyph accepted here becomes a wrong entry in the
   * corpus, which is the one thing the corpus exists to prevent.
   */
  function quality(score) {
    if (score < 0.1) return "close";
    if (score < 0.18) return "near";
    return "loose";
  }

  function match() {
    const drawn = strokes.filter(s => s.length);
    if (!drawn.length) { results.innerHTML = ""; return; }

    const ranked = rankGesture(drawn, limit);
    results.innerHTML = "";
    if (!ranked.length) return;

    const glyphs = window.AVATARIAN_GLYPHS || {};
    const codes = typeof IPA_TO_CODE !== "undefined" ? IPA_TO_CODE : {};

    ranked.forEach((hit, i) => {
      const entry = glyphs[hit.ipa] || {};
      // A mirrored match carries its orientation into the code. `%`
      // forces the bottom form, which is exactly what you mean when you
      // have copied a shape the way it appears in a bottom slot — and
      // recording it is the difference between a spelling that says
      // which way up the glyph was and one that leaves it to be guessed.
      const code = (codes[hit.ipa] || hit.ipa) + (hit.flipped ? "%" : "");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "drawpad-hit drawpad-" + quality(hit.score);
      if (i === 0) btn.classList.add("is-best");
      if (hit.flipped) btn.classList.add("is-flipped");
      btn.title = `${code} — ${quality(hit.score)} match (${hit.score.toFixed(3)})`
        + (hit.flipped ? ", bottom-slot form" : "");
      btn.innerHTML =
        `<span class="drawpad-hit-glyph">${entry.flat || entry.svg || ""}</span>` +
        `<span class="drawpad-hit-code"></span>`;
      btn.querySelector(".drawpad-hit-code").textContent = code;
      btn.addEventListener("click", () => {
        onPick({ ...hit, code });
        clear();
      });
      results.appendChild(btn);
    });
  }

  // The canvas has no intrinsic size, so it has to be measured after the
  // browser has laid it out — and again whenever that changes.
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resize).observe(canvas);
  } else {
    window.addEventListener("resize", resize);
  }
  requestAnimationFrame(resize);

  return { clear, repaint: paint, get strokes() { return strokes; } };
}

if (typeof module !== "undefined") {
  module.exports = { createDrawPad };
}
