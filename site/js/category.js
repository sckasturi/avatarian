/**
 * A source's CATEGORY, read off its name.
 *
 * The corpus names related sources as `<category>.<slide>` — `instagram-1.1`,
 * `instagram-1.2`, `sevenhavens-101.3` — so the slides of one post or the
 * signs of one episode already share a prefix. This splits a name on its LAST
 * dot into that category and slide, which is all the grouping on the sources
 * page (and the naming in the contribution flow) needs; no schema field.
 *
 * A name with no dot (`toph-letter`, `7h-promo`, `sevenhavens-101-102`) has no
 * category — it stands on its own.
 *
 * Standalone and DOM-free, like the other js/ helpers, so the review console
 * and tests can use it too.
 */
function categoryOf(id) {
  const s = String(id == null ? "" : id);
  const i = s.lastIndexOf(".");
  if (i <= 0 || i === s.length - 1) return { category: null, slide: null };
  return { category: s.slice(0, i), slide: s.slice(i + 1) };
}

/** Slides sort numerically where they are numbers (1, 2, 10), else by text. */
function slideOrder(a, b) {
  const na = parseFloat(categoryOf(a).slide), nb = parseFloat(categoryOf(b).slide);
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
  return String(a).localeCompare(String(b));
}

if (typeof module !== "undefined") {
  module.exports = { categoryOf, slideOrder };
}
