/**
 * Avatarian renderer.
 *
 * Turns an array of IPA symbols into fused blocks.
 *
 * GLYPHS — clean, geometrically-drawn SVGs (see tools/build_glyphs.py),
 * embedded inline by js/manifest.js rather than loaded as image files.
 * Inlining means the whole set is one small script: it works over
 * file://, needs no image hosting on the wiki, stays crisp at any size,
 * and inherits the surrounding text colour via currentColor.
 *
 * LAYOUT — blocks are PAIRS, not syllables.
 *
 * Phonemes are written in strict order, TWO to a block, top slot then
 * bottom slot, with blocks running left to right. Nothing about the
 * layout depends on a phoneme being a consonant or a vowel; a block is
 * just the next two sounds in the word.
 *
 *   please  /p l i z/    (p,l) (i,z)
 *   at      /æ t/        (æ,t)          <- vowel on TOP
 *   up      /ʌ p/        (ʌ,p)          <- vowel on TOP
 *   me      /m i/        (m,i)
 *   not     /n ɑ t/      (n,ɑ) (t,∅)
 *   mad     /m æ d/      (m,æ) (d,∅)
 *   wake    /w eɪ k/     (w,eɪ) (k,∅)
 *
 * This was read off a labelled writing sample ("please do not be mad at
 * me when you wake up, but") and holds for all twelve of its words. It
 * replaces an earlier syllable model — consonants clustered on top, the
 * vowel beneath — which happened to agree on CV words like "katara" and
 * disagreed on everything else.
 *
 * An odd phoneme count leaves the final bottom slot empty, and a null
 * filler is written there. Five of the sample's words need it. There are
 * two nulls and the pairing partner picks which — see NULL_IPA below.
 *
 * Some glyphs change form with the slot they land in — see VARIANTS in
 * tools/build_glyphs.py. Consonants are 5×5 grid, vowels 4×5 grid.
 * 4-row vowels fill all 4 rows and bridge to the consonant above;
 * 3-row vowels leave the top row empty (gap). Sizing lives in the CSS.
 *
 * This is deliberately not a font file: canon composes blocks (closer to
 * Hangul than to an alphabet), which no font format does well. The same
 * script runs standalone and on the wiki, so {{avatarian|hello}} and the
 * web app always stay in sync.
 */

const GLYPHS = (typeof window !== "undefined" && window.AVATARIAN_GLYPHS) || {};

const VOWELS = new Set([
  "i", "ɪ", "e", "ɛ", "æ", "ʌ", "ə", "u", "ʊ", "oʊ", "ɔ", "ɑ",
  "aɪ", "aʊ", "ɔɪ",
]);

/** Kept async for API compatibility; glyphs are already in memory. */
async function loadManifest() {
  return GLYPHS;
}

function glyphSVG(ipaSymbol) {
  const entry = GLYPHS[ipaSymbol];
  return entry ? entry.svg : null;
}

/**
 * The two null fillers. NEITHER IS A SOUND — they fill a slot that has
 * no phoneme in it, and they are part of the spelling rather than
 * padding.
 *
 *   ∅   a rounded ∪, vowel-height    (3 rows)
 *   ∅c  a squared ∪, consonant-height (5 rows)
 *
 * Which one is written is decided by the null's PAIRING PARTNER, not by
 * the slot it happens to fill:
 *
 *   a VOWEL     paired with a null takes the 5-height (tall) null
 *   a CONSONANT paired with a null takes the 3-height (short) null
 *
 * Confirmed from a reference sample. It is also what keeps a block nine
 * rows tall whatever is in it — 4 + 5 for a vowel and its null, 5 + 4
 * for a consonant and its null. The renderer used to write the cup into
 * every empty slot regardless, which left a vowel-plus-null block eight
 * rows tall and the wrong shape.
 */
const NULL_IPA = "∅";
const NULL_C_IPA = "∅c";
const NULLS = new Set([NULL_IPA, NULL_C_IPA]);

function isVowelSymbol(token) {
  if (token == null) return false;
  // A $/% orientation override rides on the token, so strip it before
  // asking what the sound is — "ɑ$" is still a vowel.
  const sym = parseSymbol(token).sym;
  const entry = GLYPHS[sym];
  if (entry && entry.type) return entry.type === "vowel";
  return VOWELS.has(sym);
}

/**
 * The null to write beside `partner`. A null next to a null (or next to
 * nothing) has no vowel to take its height from, so it stays short.
 */
function nullFor(partner) {
  return isVowelSymbol(partner) ? NULL_C_IPA : NULL_IPA;
}

/**
 * ORIENTATION. SOME glyphs mirror top-to-bottom with the slot they land
 * in — æ's cup becomes a cap, /ɑ/'s Y inverts — and those carry a
 * `flips` flag from the manifest (see FLIPS in tools/build_glyphs.py).
 * Most glyphs do not, and are drawn the same way in either slot, so this
 * is NOT applied to everything.
 *
 * A trailing marker overrides the slot:
 *
 *   s$   force the TOP orientation      s%   force the BOTTOM one
 *
 * Needed where the slot doesn't decide it. /s/ is the live case:
 * "students" writes both of its /s/ in top slots yet uses a different
 * orientation for each.
 *
 * A `_c` suffix asks for a glyph's CLUSTER form on its own, with no
 * consonant beside it — `l_c`, `r_c`, mainly to show it in a table. It
 * combines with the orientation marker: bare `r_c` is bottom-oriented (as
 * drawn), `r_c$` is top-oriented (flipped), `r_c%` is bottom. On a glyph
 * with no cluster form the suffix is simply ignored.
 */
const VARIANT_MARKERS = { "$": "top", "%": "bottom" };

function parseSymbol(token) {
  const forced = VARIANT_MARKERS[token.slice(-1)] || null;
  let rest = forced ? token.slice(0, -1) : token;
  let variant = null;
  if (rest.endsWith("_c")) { variant = "cluster"; rest = rest.slice(0, -2); }
  return { sym: rest, forced, variant };
}

/**
 * Group a flat IPA symbol list into blocks of two, in order. An odd
 * count leaves the last bottom slot empty, marked here as null so the
 * caller can write the ∅ filler into it.
 */
function pairUp(ipaSeq) {
  const blocks = [];
  for (let i = 0; i < ipaSeq.length; i += 2) {
    blocks.push({ top: ipaSeq[i], bottom: ipaSeq[i + 1] ?? null });
  }
  return blocks;
}

/**
 * Pair a sequence AND decide its nulls — the block model, with no DOM in
 * sight.
 *
 * This used to be three lines inside the render loop, which meant the
 * structural rules of the script could only be checked by rendering to
 * elements and reading them back. Splitting it out is what lets
 * `tests/blocks.test.js` assert the model directly, including against
 * every attested spelling in the corpus.
 *
 * An empty bottom slot is written, not skipped — the null is part of the
 * spelling, so dropping it would silently shorten the word. A null that
 * was TYPED is resolved here too rather than taken literally: `0` means
 * "a null", and the sound beside it says which one. That applies
 * mid-word, where canon puts nulls the renderer cannot derive — (u,∅)
 * takes the tall one, (s,∅) the short one.
 */
function resolveBlocks(ipaSeq) {
  return pairUp(ipaSeq).map((pair) => {
    const top = NULLS.has(pair.top) ? nullFor(pair.bottom) : pair.top;
    const bottom = pair.bottom == null || NULLS.has(pair.bottom)
      ? nullFor(top)
      : pair.bottom;
    return { top, bottom };
  });
}

/** Height classes, in lattice rows. A block is meant to total nine. */
const TALL_TYPES = new Set(["consonant", "null_consonant"]);

/**
 * How many of a block's nine rows this symbol occupies: 5 for a
 * consonant-height slot, 4 for a vowel-height one.
 *
 * NOT the number of rows the drawing fills — a 3-row vowel leaves one of
 * its four empty, and that gap is the point (see the V-C and C-V rules).
 * This is the slot, which is what has to add up.
 */
function slotRows(token) {
  if (token == null) return 0;
  const sym = parseSymbol(token).sym;
  const entry = GLYPHS[sym];
  if (entry && entry.type) return TALL_TYPES.has(entry.type) ? 5 : 4;
  return VOWELS.has(sym) ? 4 : 5;
}

/**
 * A glyph that is in the source but could not be made out.
 *
 * Distinct from a sound with no glyph drawn yet (`avatarian-missing`,
 * which is item 18's /x/): that one is a gap in THIS TOOL, and it will be
 * filled by drawing the glyph. This one is a gap in the READING, and no
 * amount of work here closes it — only a better look at the source.
 */
const UNREADABLE = "*";

/**
 * The mark for a slot that could not be read.
 *
 * Drawn here rather than added to the glyph manifest, on purpose: the
 * manifest is letters of the script, and this is not one. Both validators
 * exempt `?` precisely because it has no glyph, so giving it one would
 * make them contradict themselves.
 *
 * A six-pointed asterisk in the script's geometry — 100x100 box, square
 * caps, miter joins — so it sits in a word without looking pasted in, and
 * reads as "a glyph is here and nobody knows which" on its own. (It once
 * carried a dashed frame too; removed as visual noise.)
 */
const UNREADABLE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none"'
  + ' stroke="currentColor" stroke-linecap="square" stroke-linejoin="miter">'
  // A six-pointed asterisk, matching the `*` you type. It was a question
  // mark until `?` became the punctuation and `*` took this job over —
  // a box holding the wrong character is worse than no character.
  + '<path d="M 50 20 L 50 80" stroke-width="9"/>'
  + '<path d="M 24 35 L 76 65" stroke-width="9"/>'
  + '<path d="M 24 65 L 76 35" stroke-width="9"/>'
  + '</svg>';

/**
 * THE APPROXIMANTS TURN INSIDE A CLUSTER. Read off the corpus: across
 * seventeen consonants seen in a bottom slot, the only ones that ever
 * mirror are /r l w j/ — exactly the English approximants — and they do
 * it when the block holds two consonants, 28 times against 1.
 *
 * Under a VOWEL they stay upright: /r/ is plain in all six such blocks
 * (are, ear, fire, choir, organic, warrior). So this is not the by-slot
 * flip that æ ɑ ɪ e aɪ ə take; it depends on what shares the block.
 *
 * `l` (and `r`) are handled instead by the CLUSTER FORM mechanism — in a
 * two-consonant block they draw a distinct body, not a flip of the base
 * (see the cluster-form block in makeGlyph). Neither flips by slot with a
 * vowel: /l/ is plain in every vowel pairing (school, all, lord, still),
 * which is why /l/ is NOT in FLIPS. So only /w/ and /j/, which have no
 * cluster form drawn yet, still fall through to this plain C-C-bottom flip.
 */
const TURNS_IN_CLUSTER = new Set(["ɹ", "j", "w"]);

/**
 * /s/ TURNS ON TOP OF A CLUSTER, and only there. Across the corpus this is
 * exact — mirrored in all 11 blocks where it sits above another consonant,
 * upright in all 19 above a vowel or null and all 9 in a bottom slot. So it
 * is derived from the glyph beneath, not by slot; no per-word override is
 * needed (the corpus once carried redundant s$/s% and no longer does).
 */
const TURNS_ABOVE_CLUSTER = new Set(["s"]);

/**
 * Glyphs whose saved drawing is the BOTTOM-slot form rather than the top.
 * They flip like any other, but the art is stored the other way up, so
 * the slot test is inverted. Read off the corpus: /u/ is plain in all 18
 * bottom slots and mirrored in 7 of its 9 top ones, /ɔ/ plain in 12
 * bottoms and mirrored in all 3 tops.
 */
const DRAWN_BOTTOM_UP = new Set(["u", "ɔ"]);

/** True when the block partner is another consonant — i.e. a C-C block. */
function isClusterPartner(partner) {
  return partner != null && !isVowelSymbol(partner)
         && !NULLS.has(parseSymbol(partner).sym);
}

/** Which way round this glyph goes, before any explicit $/% override. */
function orientationOf(sym, entry, slot, partner) {
  if (DRAWN_BOTTOM_UP.has(sym)) return slot === "bottom" ? "top" : "bottom";
  if (entry.flips) return slot;
  const clustered = isClusterPartner(partner);
  if (clustered && slot === "bottom" && TURNS_IN_CLUSTER.has(sym)) return "bottom";
  if (clustered && slot === "top" && TURNS_ABOVE_CLUSTER.has(sym)) return "bottom";
  return "top";
}

/**
 * SOME GLYPHS ARE DRAWN DIFFERENTLY IN A C-C BLOCK, where the one-row
 * overlap (blocks.css) crowds them against their neighbour.
 *
 * /s/ is a full five-row caret whose sharp point sits on the lattice
 * edge; the overlap brings the neighbour up to that edge, so the point is
 * the one scrap of ink in the shared row and reads as poking through the
 * glyph beside it (flat-topped consonants fuse there instead). Its vertex
 * insets one lattice row (y 18 → 31) so the point lands on the block
 * boundary — but ONLY when the point faces the overlap: point-down on top of
 * a cluster (`still`), point-up on the bottom of one (`balance`, `sula's`).
 * Forced upright in a TOP slot (`rest`, `humansitters`), the point is at the
 * far top edge, so it keeps full height instead of pulling down off the top.
 *
 * /z/'s two corner dots sit in its top row, which the overlap rides up into
 * the glyph above. Under a plain consonant BOTH drop (`goods`, `trends`,
 * `models`). Under an approximant only one collides with the rising l_c/r_c
 * stroke, so the OTHER survives: under /r/ the left dot stays (`waters`,
 * `stickers`), under /l/ the right (`models`, `criminals`).
 *
 * A non-cluster /s/ or /z/ — sitting under or over a vowel — is left
 * whole. See AVATARIAN.md §12.6.
 */
function clusterForm(sym, svg, partner, slot, flipped) {
  if (sym === "s") {
    // Inset the vertex only when the POINT faces the one-row overlap: the
    // bottom of a top slot (flipped point-down, `still`) or the top of a
    // bottom slot (upright point-up, `balance`, `sula's`). Forced the other
    // way — upright in a top slot (`rest`, `humansitters`) — the point is at
    // the far edge and must keep full height, or it pulls off the top.
    const pointAtOverlap = slot === "top" ? flipped : !flipped;
    return pointAtOverlap ? svg.replace("L 50 18 L", "L 50 31 L") : svg;
  }
  if (sym === "z") {
    const p = partner != null ? parseSymbol(partner).sym : null;
    if (p === "ɹ") return svg.replace(/<circle cx="74"[^>]*>/, "");  // keep left
    if (p === "l") return svg.replace(/<circle cx="26"[^>]*>/, "");  // keep right
    return svg.replace(/<circle[^>]*>/g, "");
  }
  return svg;
}

function makeGlyph(token, slot, partner) {
  const { sym, forced, variant } = parseSymbol(token);
  const span = document.createElement("span");

  if (sym === UNREADABLE) {
    // Consonant-height, because it is the taller slot and an unread glyph
    // could be either — a block that is too tall reads as a gap, one that
    // is too short reads as a vowel it may not be.
    span.className = "avatarian-glyph avatarian-consonant avatarian-unreadable";
    span.title = "A glyph is here in the source but could not be made out";
    span.innerHTML = UNREADABLE_SVG;
    span.querySelector("svg").classList.add("g-square");
    span.dataset.glyph = "unreadable";
    return span;
  }

  const entry = GLYPHS[sym];
  const kind = entry
    ? entry.type || (VOWELS.has(sym) ? "vowel" : "consonant")
    : VOWELS.has(sym) ? "vowel" : "consonant";
  span.className = "avatarian-glyph avatarian-" + kind;
  if (entry && entry.rows === 4) span.classList.add("avatarian-4row");
  span.title = sym;
  if (entry) {
    const form = entry;
    // An explicit $/% override wins; otherwise the glyph's own rule does.
    // A DRAWN_BOTTOM_UP glyph's art is stored upside-down, so a raw forced
    // orientation would pick the opposite visual form. Invert the forced
    // value for those, so `$` means the top-slot form and `%` the bottom
    // one for EVERY glyph — no per-glyph swap to remember.
    let orientation = forced || orientationOf(sym, entry, slot, partner);
    if (forced && DRAWN_BOTTOM_UP.has(sym)) {
      orientation = forced === "top" ? "bottom" : "top";
    }
    // In a two-consonant block, a glyph with an independently-drawn CLUSTER
    // form (form.variants.cluster) draws it AS-IS, no flip — that is how /l/
    // and /r/ change shape against a consonant. The r/l pair is the exception:
    // its TOP glyph keeps its base form and only the BOTTOM takes the cluster
    // form (world = r_v over l_c; a hypothetical l/r = l_v over r_c). A glyph
    // with no cluster form behaves exactly as before.
    // A `_c` suffix (l_c, r_c) asks for the cluster body explicitly, even
    // with no consonant beside it, so the form can be shown on its own.
    // Otherwise the cluster body is chosen by context, as in a real block.
    const wantCluster = variant === "cluster";
    let ccForm = null;
    if (form.variants && form.variants.cluster) {
      if (wantCluster) {
        ccForm = form.variants.cluster;
      } else if (isClusterPartner(partner)) {
        const pSym = parseSymbol(partner).sym;
        const rlPair = (sym === "ɹ" || sym === "l")
                       && (pSym === "ɹ" || pSym === "l") && pSym !== sym;
        if (!rlPair || slot === "bottom") ccForm = form.variants.cluster;
      }
    }
    // The cluster form is drawn in its bottom-slot orientation (the key's l_b
    // tracing), so it STILL flips top-to-bottom when it lands in a TOP slot.
    // An explicit `_c` has no slot to read, so it shows bottom-oriented (as
    // drawn) by default and flips only when `$` forces the top orientation:
    // `r_c` bottom, `r_c$` top, `r_c%` bottom. A glyph with no cluster form
    // flips by its own rule, as before.
    let flipped;
    if (ccForm) {
      flipped = wantCluster ? forced === "top" : slot === "top";
    } else {
      flipped = orientation === "bottom";
    }
    if (flipped) span.classList.add("avatarian-flipped");
    // A few glyphs redraw in a C-C block (see clusterForm): /s/'s point
    // insets, /z/ drops its dots.
    const base = ccForm ? ccForm.svg : form.svg;
    const svg = isClusterPartner(partner) ? clusterForm(sym, base, partner, slot, flipped) : base;
    // Both drawings ride along and CSS shows one. The flat copy is the
    // same glyph re-laid-out at 4/5 height rather than a squashed copy
    // of the square one, so stroke weight and dots match exactly in
    // either height mode. Consonants have no flat form and keep theirs.
    //
    // The <svg> elements are tagged directly rather than wrapped: a
    // wrapper <span> is inline, cannot take a height, and collapses the
    // SVG inside it to nothing.
    span.innerHTML = svg + (ccForm ? (ccForm.flat || "") : (form.flat || ""));
    const drawings = span.querySelectorAll("svg");
    drawings[0].classList.add("g-square");
    if (drawings[1]) drawings[1].classList.add("g-flat");
    // Which form actually got written, so the rendered DOM says what it
    // chose — reading it back off the SVG is unreliable once the browser
    // has reserialised it.
    // `%` keeps its by-slot meaning for plain glyphs; a cluster form records
    // "_c" and lets the avatarian-flipped class carry its orientation, so the
    // marker never contradicts the `_c$`/`_c%` a caller typed.
    span.dataset.glyph = form.name + (ccForm ? "_c" : (flipped ? "%" : ""));
    if (entry.status === "PLACEHOLDER") span.classList.add("avatarian-placeholder");
  } else {
    span.textContent = sym;
    span.classList.add("avatarian-missing");
  }
  return span;
}

function makeSlot(ipaSymbol, slot, partner) {
  const cell = document.createElement("span");
  cell.className = "avatarian-slot avatarian-slot-" + slot;
  cell.appendChild(makeGlyph(ipaSymbol, slot, partner));
  return cell;
}

/**
 * Render an IPA sequence into a container as fused blocks of two
 * phonemes, written top then bottom.
 */
function renderAvatarian(ipaSeq, container) {
  container.innerHTML = "";
  container.classList.add("avatarian-word");

  // PUNCTUATION IS NOT PAIRED. A mark is one column wide and nine rows
  // tall — the height of a whole block, not of a slot — so it stands
  // beside the writing rather than inside it. It also breaks the run:
  // the blocks either side of it pair among themselves, or a comma in
  // the middle of a word would drag the sounds after it into the wrong
  // slots.
  let run = [];
  const flush = () => {
    resolveBlocks(run).forEach(({ top, bottom }) => {
      const block = document.createElement("span");
      block.className = "avatarian-block";
      // Each slot is told what shares its block: the approximants and /s/
      // turn according to the company they keep, not the slot alone.
      block.appendChild(makeSlot(top, "top", bottom));
      block.appendChild(makeSlot(bottom, "bottom", top));
      // Mark a two-consonant block so CSS can give it the deeper C-C
      // pull-up with a plain class instead of a :has() selector — :has()
      // isn't in older browsers and MediaWiki's CSS linter rejects it.
      // Same condition :has() checked: the block holds no vowel or null.
      if (!block.querySelector(".avatarian-vowel, .avatarian-null, .avatarian-null_consonant")) {
        block.classList.add("avatarian-cc");
      }
      container.appendChild(block);
    });
    run = [];
  };

  for (const token of ipaSeq) {
    if (PUNCTUATION[parseSymbol(token).sym]) {
      flush();
      container.appendChild(makeMark(parseSymbol(token).sym));
    } else {
      run.push(token);
    }
  }
  flush();
  return container;
}

/**
 * Draw ONE glyph on its own — no pairing, no null — for a chart or key
 * where you want the bare letter, not a written block. A block always
 * fills its empty slot with a null (that is the script), so the normal
 * render can't show a lone letter; this bypasses pairing entirely.
 *
 * Takes the same sound codes the "Sounds" box does (`p`, `ee`, `ng`), so a
 * caller writes `ng`, not IPA. Each code that resolves to a glyph is
 * drawn in its citation (top-slot) form; a vowel shows its flat drawing.
 * More than one code draws them side by side, still nullless.
 */
function renderGlyph(code, container) {
  container.innerHTML = "";
  // `avatarian-solo` marks a lone glyph so CSS can size it as a display
  // letter, not shrink it to inline-text height the way a word is.
  container.classList.add("avatarian-word", "avatarian-solo");
  soundTextToWords(String(code == null ? "" : code).trim()).forEach((w) => {
    for (const token of w.ipa) {
      // A mark (. , ? !) is drawn on its own path, not paired; route it
      // there so a lone `?` gives a real mark, not a mis-sized letter box.
      const sym = parseSymbol(token).sym;
      container.appendChild(
        PUNCTUATION[sym] ? makeMark(sym) : makeGlyph(token, "top", null));
    }
  });
  return container;
}

/**
 * The punctuation marks: one lattice column wide, nine rows tall.
 *
 * A NEW HEIGHT CLASS. Every letter is five rows (consonant) or four
 * (vowel), and they stack to nine. A mark is the whole nine on its own,
 * which is why it cannot live in a slot.
 *
 * They are written as themselves — `,` `.` `?` `!`. The unreadable-glyph
 * marker moved to `*` to free `?` up for the one people already know.
 *
 * Drawn in the script's geometry: a 16-unit column with the same 10 units
 * of margin the letters get, 9 rows of 16 running from y=10 to y=154.
 * Row centres are therefore 2 + 16n.
 */
const MARK_BOX = 'viewBox="0 0 36 164" fill="none" stroke="currentColor"'
  + ' stroke-width="9" stroke-linecap="square" stroke-linejoin="miter"';

const PUNCTUATION = {
  // A dot on the baseline — the bottom row, beside the word's last block.
  ".": { name: "period",
         d: '<path d="M 18 146 L 18 146.5"/>' },
  // A stroke through the bottom two rows: the same weight as the period,
  // given length rather than a tail, which one column has no room for.
  ",": { name: "comma",
         d: '<path d="M 18 122 L 18 146"/>' },
  // A full stroke over a dot, the shape everyone already reads as this.
  "!": { name: "exclamation",
         d: '<path d="M 18 18 L 18 98"/><path d="M 18 146 L 18 146.5"/>' },
  // The same, broken: a question is an interrupted statement. The gap is
  // one row, which is the smallest the lattice can say anything with.
  "?": { name: "question",
         d: '<path d="M 18 18 L 18 50"/><path d="M 18 82 L 18 98"/>'
            + '<path d="M 18 146 L 18 146.5"/>' },
};

function makeMark(sym) {
  const mark = PUNCTUATION[sym];
  const span = document.createElement("span");
  span.className = "avatarian-mark avatarian-mark-" + mark.name;
  span.title = mark.name;
  span.dataset.glyph = mark.name;
  // The mark now ships through the glyph manifest like every letter, so
  // it can be redrawn in the designer. Prefer that; the inline copy below
  // is the fallback for a page with no manifest, or a build that hasn't run.
  const fromManifest = GLYPHS[sym];
  const svg = (fromManifest && fromManifest.svg)
    ? fromManifest.svg
    : `<svg xmlns="http://www.w3.org/2000/svg" ${MARK_BOX}>` + mark.d + "</svg>";
  span.innerHTML = svg;
  // A mark is nine rows tall but may be more than one column wide (a
  // question mark). The CSS assumes a 1-column 36×164; set the real
  // aspect ratio from the viewBox so a wider mark keeps its proportions
  // instead of being squeezed into one column's width.
  const vb = /viewBox="0 0 ([\d.]+) ([\d.]+)/.exec(svg);
  if (vb) span.style.aspectRatio = `${vb[1]} / ${vb[2]}`;
  return span;
}

if (typeof module !== "undefined") {
  module.exports = {
    renderAvatarian, renderGlyph, pairUp, resolveBlocks, slotRows, glyphSVG, VOWELS,
    NULL_IPA, NULL_C_IPA, NULLS, nullFor, isVowelSymbol, parseSymbol,
  };
}
