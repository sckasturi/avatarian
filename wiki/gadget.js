/* ------------------------------------------------------------------ *
 * Avatarian wiki gadget — the render step.
 *
 * This is the TAIL of the bundle: tools/build_wiki_bundle.py concatenates
 * the site's manifest.js, corpus.js, g2p.js, sounds.js and render.js
 * ahead of it, so by the time this runs every global it needs
 * (renderAvatarian, soundTextToWords, sentenceToIPA) is defined.
 *
 * It finds every {{Avatarian}} span the template left on the page and
 * replaces it with real glyphs. Nothing here loads anything — the whole
 * bundle is one script served by the wiki itself.
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
      var en = (span.getAttribute("data-avatarian-en") || "").trim();
      var sounds = (span.getAttribute("data-avatarian-sounds") || "").trim();
      var label = (span.getAttribute("data-avatarian-label") || "").trim();

      var ipaSeq, caption;
      if (en) {
        // English -> the same approximate conversion the translator uses.
        ipaSeq = ipaOf(sentenceToIPA(en));
        caption = en;
      } else {
        // Sounds -> exactly the spelling given. The label is parameter 2,
        // or any (caption) written inside the sounds, or nothing.
        var words = soundTextToWords(sounds);
        ipaSeq = ipaOf(words);
        caption = label || words.map(function (w) { return w.word; })
          .filter(Boolean).join(" ");
      }

      // Nothing to draw — leave the plain fallback text the template set.
      if (!ipaSeq.length) return;

      renderAvatarian(ipaSeq, span);
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
