/* ------------------------------------------------------------------ *
 * Avatarian wiki gadget — the render step.
 *
 * This is the TAIL of the bundle: tools/build_wiki_bundle.py concatenates
 * the glyph manifest, the ARPAbet table, sounds.js and render.js ahead of
 * it, so by the time this runs the globals it needs (renderAvatarian,
 * soundTextToWords) are defined.
 *
 * It finds every {{Avatarian}} span the template left on the page and
 * replaces it with real glyphs, drawing the SOUNDS the template carries.
 * Nothing here loads anything — the whole bundle is one script served by
 * the wiki itself.
 * ------------------------------------------------------------------ */
(function () {
  // Flatten a list of parsed words into one IPA sequence.
  function ipaOf(words) {
    var seq = [];
    words.forEach(function (w) { seq = seq.concat(w.ipa); });
    return seq;
  }

  // The IPA to show in the tooltip: drop the nulls (∅, ∅c), the $/%
  // orientation overrides, and the punctuation marks — all spelling
  // machinery, not pronunciation.
  function cleanIpa(seq) {
    return seq
      .filter(function (t) { return t !== "∅" && t !== "∅c" && !/^[.,?!]$/.test(t); })
      .map(function (t) { return t.replace(/[$%]/g, ""); })
      .join(" ");
  }

  function renderAllSpans() {
    var spans = document.querySelectorAll("span.avatarian-word");
    Array.prototype.forEach.call(spans, function (span) {
      if (span.getAttribute("data-avatarian-done")) return;   // idempotent

      // The word is given in SOUNDS — exactly the spelling to draw. The
      // label is parameter 2, or any (caption) written inside the sounds.
      var sounds = (span.getAttribute("data-avatarian-sounds") || "").trim();
      var label = (span.getAttribute("data-avatarian-label") || "").trim();
      var words = soundTextToWords(sounds);
      var ipaSeq = ipaOf(words);

      // Nothing to draw — leave the plain fallback text the template set.
      if (!ipaSeq.length) return;

      var caption = label || words.map(function (w) { return w.word; })
        .filter(Boolean).join(" ");
      renderAvatarian(ipaSeq, span);
      // One tooltip for the WHOLE word (like the {{Chinese}} template), not
      // one per glyph. render.js puts a title on each glyph; strip those so
      // the word-level title below shows on hover anywhere in the word.
      Array.prototype.forEach.call(span.querySelectorAll("[title]"),
        function (el) { el.removeAttribute("title"); });
      span.title = (caption ? caption + " " : "") + "/" + cleanIpa(ipaSeq) + "/";
      span.setAttribute("data-avatarian-done", "1");
    });
  }

  // The loader in Common.js only fetches this bundle once a span is on the
  // page and the DOM is ready, so it can run straight away; the guard is
  // belt-and-suspenders.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderAllSpans);
  } else {
    renderAllSpans();
  }
})();
