/* ------------------------------------------------------------------ *
 * Avatarian wiki gadget — the render step.
 *
 * This is the TAIL of the bundle: tools/build_wiki_bundle.py concatenates
 * the glyph manifest, sounds.js and render.js ahead of it, so by the time
 * this runs the globals it needs (renderAvatarian, soundTextToWords) are
 * defined.
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

      // A single bare glyph — {{Avatarian|glyph=ng}} — with no pairing and
      // no null, for a chart or key. Drawn before the sounds path so a
      // glyph= span never falls through to block rendering.
      var glyph = (span.getAttribute("data-avatarian-glyph") || "").trim();
      if (glyph) {
        renderGlyph(glyph, span);
        var gipa = cleanIpa(ipaOf(soundTextToWords(glyph)));
        span.title = "/" + gipa + "/";
        span.setAttribute("data-avatarian-ipa", "/" + gipa + "/");
        span.setAttribute("data-avatarian-done", "1");
        return;
      }

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
      var ipa = cleanIpa(ipaSeq);

      // Draw each `/`-separated word as its own group, so words keep a
      // space between them — one renderAvatarian call over the whole line
      // would butt them together. The outer span stays THE word: it carries
      // the size, the title, the copy IPA and the selection highlight;
      // each part just rows its own blocks.
      span.innerHTML = "";
      words.forEach(function (w) {
        var part = document.createElement("span");
        renderAvatarian(w.ipa, part);           // this tags `part` .avatarian-word
        part.className = "avatarian-word-part";  // ...replace so size isn't doubled
        // One tooltip for the whole line (like {{Chinese}}), not one per
        // glyph: render.js titles each glyph, so strip them.
        Array.prototype.forEach.call(part.querySelectorAll("[title]"),
          function (el) { el.removeAttribute("title"); });
        span.appendChild(part);
      });
      span.title = (caption ? caption + " " : "") + "/" + ipa + "/";
      // The glyphs are inline SVG and copy as nothing, so stash the IPA for
      // the copy handler below to substitute when this word is selected.
      span.setAttribute("data-avatarian-ipa", "/" + ipa + "/");
      span.setAttribute("data-avatarian-done", "1");
    });
  }

  // Copy: when a selection includes rendered words, put their IPA into the
  // clipboard text — the SVG glyphs themselves copy as nothing, so without
  // this you'd get blanks where the Avatarian was. Selections with no
  // Avatarian in them are left completely alone.
  function onCopy(e) {
    var sel = window.getSelection();
    if (!sel || !sel.rangeCount || sel.isCollapsed) return;
    var frag = sel.getRangeAt(0).cloneContents();
    if (!frag.querySelector || !frag.querySelector("span.avatarian-word")) return;
    Array.prototype.forEach.call(frag.querySelectorAll("span.avatarian-word"),
      function (w) {
        var ipa = w.getAttribute("data-avatarian-ipa") || "";
        w.parentNode.replaceChild(document.createTextNode(ipa), w);
      });
    (e.clipboardData || window.clipboardData).setData("text/plain", frag.textContent);
    e.preventDefault();
  }

  // Show a word as selected. The glyphs are SVG, and the browser's native
  // selection highlight only paints text, so a word caught in a selection
  // otherwise stays un-highlighted while the words around it turn blue.
  // Give any word the selection touches a highlight class instead.
  function onSelectionChange() {
    var sel = window.getSelection();
    var ranges = [];
    if (sel && !sel.isCollapsed) {
      for (var i = 0; i < sel.rangeCount; i++) ranges.push(sel.getRangeAt(i));
    }
    // Range.intersectsNode is reliable here where Selection.containsNode is
    // not — the latter misses a word whose only content is SVG.
    Array.prototype.forEach.call(document.querySelectorAll("span.avatarian-word"),
      function (w) {
        var hit = ranges.some(function (r) { return r.intersectsNode(w); });
        w.classList.toggle("avatarian-selected", hit);
      });
  }

  // The loader in Common.js only fetches this bundle once a span is on the
  // page and the DOM is ready, so it can run straight away; the guard is
  // belt-and-suspenders.
  document.addEventListener("copy", onCopy);
  document.addEventListener("selectionchange", onSelectionChange);
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderAllSpans);
  } else {
    renderAllSpans();
  }
})();
