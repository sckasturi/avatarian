# TOC words

MediaWiki strips every class from a heading when it builds the table of
contents, so an `{{Avatarian}}` word in a heading shows up in the TOC as plain
text. `tools/build_css_only.py` (`TOC_WORDS`) redraws a few chosen TOC lines in
CSS, matching on the TOC link's anchor. Each word here is one SVG used as a mask.

## Adding or re-exporting a word

1. Open a live wiki page whose heading has the word, e.g.
   `==== Book One: Survival ({{Avatarian|s uh r 0 v eye v uh l 0|Survival}}) ====`.
2. Paste this in the browser console. It reads each glyph's position and mask off
   the laid-out heading, so the SVG matches the wiki CSS exactly:

   ```js
   copy((() => {
     const word = document.querySelector(".mw-headline .av-word");
     const bs = [...word.querySelectorAll(".av-glyph")].map(g => ({ g, r: g.getBoundingClientRect() }));
     const x0 = Math.min(...bs.map(b => b.r.left)), y0 = Math.min(...bs.map(b => b.r.top));
     const k = 100 / parseFloat(getComputedStyle(word).fontSize), f = n => (n * k).toFixed(2);
     const parts = bs.map(({ g, r }) => {
       const src = decodeURIComponent(getComputedStyle(g).webkitMaskImage.match(/svg\+xml,(.*)"\)/)[1]);
       const y = (r.top - y0) * k, h = r.height * k;
       const el = src.replace(' xmlns="http://www.w3.org/2000/svg"', "").replace("<svg ",
         `<svg x="${f(r.left - x0)}" y="${y.toFixed(2)}" width="${f(r.width)}" height="${h.toFixed(2)}" preserveAspectRatio="none" overflow="visible" `);
       return g.classList.contains("av-flipped")
         ? `<g transform="translate(0,${(2 * y + h).toFixed(2)}) scale(1,-1)">${el}</g>` : el;
     });
     const W = f(Math.max(...bs.map(b => b.r.right)) - x0), H = f(Math.max(...bs.map(b => b.r.bottom)) - y0);
     return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}">${parts.join("")}</svg>`;
   })());
   ```
3. Save the clipboard as `wiki/toc-words/<word>.svg`. Add a row to `TOC_WORDS`
   with the anchor (the TOC link's `href` without the `#`) and the text before
   and after the word.
4. Re-run `python3 tools/build_css_only.py` and re-paste the CSS.

Re-export a word whenever its glyphs or the block layout change. These SVGs are
snapshots and don't regenerate from the glyph manifest.
