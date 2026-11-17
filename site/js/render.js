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
 * was TYPED is resolved here too rather than taken literally: `-` means
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
 * bottoms and mirrored in all 3 tops. /ʊ/ (the "uu" glyph) is drawn the
 * same way — plain in the bottom slot, mirrored in the top.
 */
const DRAWN_BOTTOM_UP = new Set(["u", "ɔ", "ʊ"]);

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
 * /s/ is a full five-row caret with a sharp miter point. Where that point
 * faces the one-row overlap it is meant to MERGE with the glyph beside it.
 * The trouble is the miter: a bare vertex spikes ~10 units past itself, so
 * the point either overshoots into the neighbour's hollow interior (a stab)
 * or, pulled too far back, stops short of its ink (a gap). So the vertex is
 * placed (y 18 → 27) precisely so the miter TIP lands on the block seam,
 * where it is buried in the neighbour's own stroke at the shared centre
 * column and the two fuse — point-down on top of a cluster (`still`, onto
 * /t/'s or /k/'s edge), point-up on the bottom of one (`balance`). Forced
 * upright in a TOP slot (`rest`, `humansitters`) the point faces AWAY at the
 * far top edge, so it keeps its plain height — the flat base meets the seam.
 *
 * /z/'s two corner dots sit in its top row, which the overlap rides up into
 * the glyph above. Under a plain consonant BOTH drop (`goods`, `trends`,
 * `models`). Under an approximant only one collides with the rising l_c/r_c
 * stroke, so the OTHER survives: under /r/ the left dot stays (`waters`,
 * `stickers`), under /l/ the right (`models`, `criminals`). Under /m/ BOTH
 * stay (`games`, `gems`): /m/ is a ring, its bottom corners are empty, so
 * nothing rides up into the dots.
 *
 * A non-cluster /s/ or /z/ — sitting under or over a vowel — is left
 * whole. See AVATARIAN.md §12.6.
 */
/**
 * PER-BLOCK TWEAKS, set by hand in the designer's block review page and
 * shipped as window.AVATARIAN_BLOCK_TWEAKS (designs/blocks/tweaks.json), keyed
 * "top|bottom" in IPA:
 *
 *   dots   how far /z/'s dots drop, in viewBox units, where both survive
 *          (under /m/: `m|z`).
 *   reach  how far a join runs in this block: none | open | first | second
 *          (see joinsFor).
 *   top, bottom
 *          the label of an ALTERNATE drawing that slot's glyph uses in this
 *          block instead of its usual one (designs/<name>_alt_<label>.json;
 *          `ŋ|k` bottom: /k/ with its square dropped, `rethink`). Drawn as
 *          the block shows it: never flipped, no rail; its joins come from
 *          its own `connect` marks.
 *   rail   the approximant's line through its partner (below): none | full |
 *          first. `first` stops it at the partner's first ink in that column
 *          instead of running the full height — into the side of /m/'s ring
 *          (`ɹ|m`). `full` and `first` also ask for a rail where the default
 *          draws none, beside /w/ and /j/ (`m|j`, `n|j`).
 *
 * THE APPROXIMANT'S LINE RUNS THE FULL BLOCK. In a C-C block /l/ (left)
 * and /ɹ/ (right) draw a cluster form whose long side stops at the seam;
 * the PARTNER always carries that line on through its own rows as a "rail"
 * (`l|d`, `s|l`, `ʃ|l`). /w/ and /j/ keep theirs at the seam, for now. Where the partner already has a
 * stroke there (/k/'s side) the rail just lies on top of it.
 */
const BLOCK_TWEAKS = window.AVATARIAN_BLOCK_TWEAKS || {};
const RAIL_SIDE = { "l": 18, "ɹ": 82 };   // not /w/ or /j/: their lines stay at the seam
const RAIL_ASK = { "l": 18, "ɹ": 82, "w": 18, "j": 82 };   // ... unless a block's `rail` asks

function blockTweak(sym, slot, partner) {
  if (partner == null) return {};
  const p = parseSymbol(partner).sym;
  const key = slot === "top" ? sym + "|" + p : p + "|" + sym;
  return (window.AVATARIAN_BLOCK_TWEAKS || BLOCK_TWEAKS)[key] || {};
}

/** True when `sym` draws its cluster form beside `partner` in `slot`. */
function usesClusterForm(sym, slot, partner) {
  const entry = GLYPHS[sym];
  if (!entry || !entry.variants || !entry.variants.cluster || !isClusterPartner(partner)) return false;
  const p = parseSymbol(partner).sym;
  const rlPair = (sym === "ɹ" || sym === "l") && (p === "ɹ" || p === "l") && p !== sym;
  return !rlPair || slot === "bottom";
}

/**
 * The x of the rail this glyph carries for its partner, or null. Only the
 * glyph BESIDE the approximant draws it; the approximant's own stroke
 * already reaches the seam.
 */
function railFor(sym, slot, partner) {
  if (!isClusterPartner(partner) || isVowelSymbol(sym)) return null;
  const mode = blockTweak(sym, slot, partner).rail;
  if (mode === "none") return null;
  const p = parseSymbol(partner).sym;
  const other = slot === "top" ? "bottom" : "top";
  const side = mode === "full" || mode === "first" ? RAIL_ASK : RAIL_SIDE;
  if (!(p in side) || !usesClusterForm(p, other, sym)) return null;
  return side[p];
}

/**
 * How far a rail on column `x` runs when its block says `rail: first`: from
 * the seam end to the first ink this glyph has in that column, as [from, to]
 * in the glyph's own viewBox. Null when it runs the full height — the block
 * does not ask, or there is no ink to stop at.
 */
/**
 * A stroke that ends in the corner a full rail occupies — /s/'s leg at
 * (82, 82) under /ɹ/ — would lay its slanted square cap over the rail's own
 * square corner and poke out past it. Pull that end back half a stroke along
 * its line: the cap then sits wholly inside the rail and the corner is the
 * rail's, clean. Only straight, non-vertical runs into the corner are touched.
 *
 * A corner that POINTS into the rail part-way down — /p/'s diamond, whose side
 * vertex sits on the rail's column (`p|ɹ`, `p|l`) — pokes its miter tip out
 * through the far side of the rail. Split that vertex into a short run along
 * the column (RAIL_CUT either side): both new joins then put their miter on
 * the rail's outer edge, and the run itself lies under the rail.
 *
 * build_css_only.py ports this (inkprofile.tuck_under_rail) for the wiki's
 * masks; keep the two in step.
 */
const RAIL_CUT = 1;
function tuckUnderRail(svg, x) {
  const n = "(-?[\\d.]+)";
  const back = (ex, ey, px, py) => {
    const dx = ex - px, dy = ey - py, len = Math.hypot(dx, dy);
    if (!dx || !len) return null;                     // lies along the rail
    const r = (v) => Math.round(v * 100) / 100;
    return [r(ex - dx / len * HALF_STROKE), r(ey - dy / len * HALF_STROKE)];
  };
  return svg
    .replace(new RegExp(`([ML]) ${n} ${n} L ${x} (18|82)"`, "g"), (m, c, px, py, ey) => {
      const p = back(x, +ey, +px, +py);
      return p ? `${c} ${px} ${py} L ${p[0]} ${p[1]}"` : m;
    })
    .replace(new RegExp(`d="M ${x} (18|82) L ${n} ${n}`, "g"), (m, ey, px, py) => {
      const p = back(x, +ey, +px, +py);
      return p ? `d="M ${p[0]} ${p[1]} L ${px} ${py}` : m;
    })
    .replace(new RegExp(`${n} ${n} L ${x} ${n} L ${n} ${n}`, "g"), (m, px, py, vy, nx, ny) => {
      const v = +vy;
      if (!(v > 18 && v < 82)) return m;                        // the corners are above
      if ((px - x) * (nx - x) <= 0) return m;                   // not pointing at the rail
      if ((py - v) * (ny - v) >= 0) return m;                   // not a point either
      const a = v + Math.sign(py - v) * RAIL_CUT, b = v + Math.sign(ny - v) * RAIL_CUT;
      return `${px} ${py} L ${x} ${a} L ${x} ${b} L ${nx} ${ny}`;
    });
}

function railReach(sym, slot, partner, x, form, flipped) {
  if (blockTweak(sym, slot, partner).rail !== "first") return null;
  const seam = slot === "top" ? 82 : 18;            // as displayed
  const from = flipped ? 100 - seam : seam;         // in the glyph's own box
  const d = from < 50 ? 1 : -1;
  let best = null;
  for (const [p, q] of (form.ink || {})[x] || []) {
    const dist = ((d > 0 ? p : q) - from) * d;
    if (dist >= 0 && (best == null || dist < best)) best = dist;
  }
  return best == null ? null : [from, from + d * best];
}

/**
 * Which form of a glyph a slot draws, and which way up — the decisions
 * makeGlyph acts on, with no DOM in sight, so a glyph can ask the same of
 * its block partner (joinsFor needs to know how the partner is drawn).
 *
 * In a two-consonant block, a glyph with an independently-drawn CLUSTER
 * form (variants.cluster) draws it AS-IS, no flip — that is how /l/ and /r/
 * change shape against a consonant. The r/l pair is the exception: its TOP
 * glyph keeps its base form and only the BOTTOM takes the cluster form
 * (world = r_v over l_c). A `_c` suffix asks for the cluster body
 * explicitly, even with no consonant beside it.
 *
 * The cluster form is drawn in its bottom-slot orientation (the key's l_b
 * tracing), so it STILL flips top-to-bottom when it lands in a TOP slot. An
 * explicit `_c` has no slot to read, so it shows bottom-oriented (as drawn)
 * and flips only when `$` forces the top orientation.
 */
function resolveGlyph(token, slot, partner) {
  const { sym, forced, variant } = parseSymbol(token);
  const entry = GLYPHS[sym];
  if (!entry) return { sym, entry: null };
  // An explicit $/% override wins; otherwise the glyph's own rule does.
  // A DRAWN_BOTTOM_UP glyph's art is stored upside-down, so a raw forced
  // orientation would pick the opposite visual form. Invert the forced
  // value for those, so `$` means the top-slot form and `%` the bottom
  // one for EVERY glyph — no per-glyph swap to remember.
  let orientation = forced || orientationOf(sym, entry, slot, partner);
  if (forced && DRAWN_BOTTOM_UP.has(sym)) {
    orientation = forced === "top" ? "bottom" : "top";
  }
  // A block can name an alternate drawing for this slot (BLOCK_TWEAKS `top`
  // / `bottom`). Typed overrides ($ % _c) say otherwise and win.
  const alt = !forced && !variant ? blockTweak(sym, slot, partner)[slot] : null;
  if (alt && entry.variants && entry.variants[alt]) {
    return { sym, entry, ccForm: null, flipped: false, form: entry.variants[alt], alt };
  }
  const wantCluster = variant === "cluster";
  let ccForm = null;
  if (entry.variants && entry.variants.cluster) {
    if (wantCluster) ccForm = entry.variants.cluster;
    else if (usesClusterForm(sym, slot, partner)) ccForm = entry.variants.cluster;
  }
  const flipped = ccForm
    ? (wantCluster ? forced === "top" : slot === "top")
    : orientation === "bottom";
  return { sym, entry, ccForm, flipped, form: ccForm || entry };
}

/**
 * JOINS — one glyph's stroke running on until it meets its partner's ink.
 *
 * Most of what reads as two glyphs "fusing" in the sources is this and
 * nothing more: a vowel's centre stem does not stop at the block seam, it
 * carries on to whatever the partner has drawn in that column — the bar
 * under /n/ (`knew`), the arc inside /ð/ (`they`), the crossing of /f/
 * (`afar`). Drawing each pairing would be a drawing per PAIR; instead:
 *
 *   EMITTERS   a design node marked `connect: up|down` (the designer's
 *              connect compass) says "this stroke end wants to reach the
 *              partner". Marked once per glyph. manifest `emit`.
 *   INK        the build records where every glyph's strokes sit on the
 *              columns emitters use (tools/inkprofile.py). manifest `ink`.
 *   THE RULE   an emitter that faces its partner grows a straight stroke
 *              to the partner's FIRST ink in that column. No ink there, no
 *              stroke — nothing dangles.
 *
 * So a join is worked out, never drawn, and the partner needs no marking.
 *
 * A 3-row vowel and a null take no join: the vowel's empty row is a gap
 * that stays a gap (`ellora`, `seven`), and nothing attested runs into a
 * null. A dot standing in the way blocks one. Only the base form emits; a cluster form's long side is the rail's
 * business (railFor).
 *
 * `reach` in the block's tweak (designs/blocks/tweaks.json, set in the
 * block review page) overrides the default per pair:
 *
 *   none     no join in this block
 *   first    to the first ink, even into a 3-row vowel or a null
 *   second   on THROUGH the first ink to the next (`would`: the stem
 *            passes /w/'s bar and runs up to its arc)
 *
 * Geometry is in viewBox units (16 to a lattice row). A slot's box is 100
 * tall for a consonant-height glyph and 80 for a vowel-height one, and the
 * boxes overlap exactly as blocks.css stacks them.
 */
const JOIN_REACH = new Set(["none", "open", "first", "second"]);
const HALF_STROKE = 4.5;   // half the glyphs' stroke-width, what a square cap adds
const JOIN_MAX = 40;   // 2.5 rows — the longest join the sources show
// Where the ink is further off than that, the stem RISES this far into the
// opening and stops, touching nothing. The end is cut butt, so 20 puts the
// visible tip about one row past where the plain glyph's square cap ends.
const JOIN_OPEN = 20;
// A dot this close to the stem's end is REPLACED by it: the dot is not drawn
// and the stem runs up to where its far edge was (/b/ over a stem, `big`,
// `books`). A dot further off blocks the join instead.
const JOIN_DOT = 20;
const SLOT_PULL = 18, SLOT_PULL_CC = 36, ROW = 16;

function boxHeight(entry) { return TALL_TYPES.has(entry.type) ? 100 : 80; }

/** Where a resolved glyph's box sits in its block, as blocks.css lays it out. */
function placeGlyph(r, slot, topHeight, cc) {
  const H = boxHeight(r.entry);
  const short = H === 80, threeRow = short && r.entry.rows !== 4;
  // The 3-row shift rules of blocks.css: pulled up a row on top (unless
  // flipped), pushed down a row at the bottom when flipped.
  let shift = 0;
  if (threeRow && slot === "top" && !r.flipped) shift = -ROW;
  if (threeRow && slot === "bottom" && r.flipped) shift = ROW;
  const y0 = slot === "top" ? 0 : topHeight - (cc ? SLOT_PULL_CC : SLOT_PULL);
  return { y0, H, shift, flipped: r.flipped };
}

/** A y in a glyph's own viewBox -> a y in its slot's box. */
function toSlot(pl, y) { return pl.shift + (pl.flipped ? pl.H - y : y); }

/** Takes a join by default: a consonant, or a vowel that fills its top row. */
function receivesJoin(entry) {
  if (entry.type === "consonant") return true;
  return entry.type === "vowel" && entry.rows === 4;
}

/**
 * The joins `token` draws toward `partner`: [{ x, y, dir, len, a, b }].
 * x/y/dir/len are in the glyph's OWN viewBox (a stroke from (x,y) running
 * `len` along dir, so it rides the glyph's flip); a/b are the same stroke's
 * two ends in the slot's box, for a renderer that cannot draw inside the
 * glyph (the wiki's av-join span).
 */
function joinsFor(token, slot, partner) {
  if (partner == null) return [];
  const me = resolveGlyph(token, slot, partner);
  const other = slot === "top" ? "bottom" : "top";
  const them = resolveGlyph(partner, other, token);
  // A cluster form does not emit; an alternate drawing has emitters of its own.
  const emit = me.entry && (me.alt ? me.form.emit : me.entry.emit);
  if (!me.entry || !them.entry || me.ccForm || !emit) return [];
  const reach = blockTweak(me.sym, slot, partner).reach;
  if (reach === "none") return [];
  if (!JOIN_REACH.has(reach) && !receivesJoin(them.entry)) return [];
  const cc = me.entry.type === "consonant" && them.entry.type === "consonant";
  const top = slot === "top" ? me : them;
  const mine = placeGlyph(me, slot, boxHeight(top.entry), cc);
  const theirs = placeGlyph(them, other, boxHeight(top.entry), cc);
  const out = [];
  const roots = (me.alt ? me.form.root : me.entry.root) || [];
  for (const [i, [x, y, dir]] of emit.entries()) {
    const D = mine.flipped ? -dir : dir;            // direction on the page
    if (D !== (slot === "top" ? 1 : -1)) continue;  // faces the outer edge
    const Y = mine.y0 + toSlot(mine, y);
    // Everything the stem could run to, as { len } from its end: the
    // partner's strokes, a mouth it would close (`bar`), a dot at the seam.
    const hits = [];
    for (const [p, q] of (them.form.ink || {})[x] || []) {
      const u = theirs.y0 + toSlot(theirs, p), v = theirs.y0 + toSlot(theirs, q);
      const lo = Math.min(u, v), hi = Math.max(u, v);
      if (D > 0 ? hi < Y : lo > Y) continue;        // behind the emitter
      hits.push({ len: Math.max(0, D > 0 ? lo - Y : Y - hi) });
    }
    for (const [gy, x0, x1] of (them.form.gaps || {})[x] || []) {
      const d = (theirs.y0 + toSlot(theirs, gy) - Y) * D;
      if (d > 0) hits.push({ len: d, bar: [x0, x1, gy] });
    }
    for (const [p, q] of (them.form.dots || {})[x] || []) {
      const u = (theirs.y0 + toSlot(theirs, p) - Y) * D, v = (theirs.y0 + toSlot(theirs, q) - Y) * D;
      const near = Math.min(u, v);
      if (near > 0 && near <= JOIN_DOT) hits.push({ len: Math.max(u, v), dot: [p, q] });
    }
    if (!hits.length) continue;
    hits.sort((m, n) => m.len - n.len);
    const hit = hits[Math.min(reach === "second" ? 1 : 0, hits.length - 1)];
    let len = hit.len;
    if (len <= 0) continue;                         // already touching
    // A stem does not climb deep into its partner looking for ink: under an
    // arch (/f/ over /ɑ/, `afar`) it rises a little way into the opening and
    // stops short of the crossing. Past JOIN_MAX that is the default; `reach`
    // can ask for it (`open`) or for the full run (`first`) in any block.
    const open = !hit.bar && !hit.dot && len > JOIN_OPEN && (reach === "open" || (!JOIN_REACH.has(reach) && len > JOIN_MAX));
    // A dot standing in the column between the two blocks the join: a stem
    // runs to a stroke, never through a dot (/s/'s, inside its caret). An
    // explicit reach has been looked at by a person, and stands.
    if (!JOIN_REACH.has(reach) && !hit.dot && ((them.form.dots || {})[x] || []).some(([p, q]) => {
      const u = theirs.y0 + toSlot(theirs, p) - Y, v = theirs.y0 + toSlot(theirs, q) - Y;
      return Math.max(u * D, v * D) > 0 && Math.min(u * D, v * D) < len;
    })) continue;
    if (open) len = JOIN_OPEN;      // after the dot check: no rise toward a dot
    const a = toSlot(mine, y);
    out.push({ x, y, dir, len, a, b: a + D * len, ...(open ? { open } : {}),
      // the stem's other end, where the wiki starts its one-piece stem
      ...(roots[i] == null ? {} : { root: toSlot(mine, roots[i]) }),
      ...(hit.bar && !open ? { bar: hit.bar } : {}), ...(hit.dot ? { dot: hit.dot } : {}) });
  }
  return out;
}

function clusterForm(sym, svg, partner, slot, flipped) {
  if (sym === "s") {
    // Place the vertex so the miter TIP lands on the seam and fuses with the
    // neighbour's stroke there — ONLY when the POINT faces the one-row overlap:
    // the bottom of a top slot (flipped point-down, `still`) or the top of a
    // bottom slot (upright point-up, `balance`, `sula's`). Forced the other
    // way — upright in a top slot (`rest`, `humansitters`) — the point is at
    // the far edge facing away, so it keeps full height.
    const pointAtOverlap = slot === "top" ? flipped : !flipped;
    return pointAtOverlap ? svg.replace("L 50 18 L", "L 50 27 L") : svg;
  }
  if (sym === "z") {
    const p = partner != null ? parseSymbol(partner).sym : null;
    // Which dot is which goes by the side of the centre line it sits on,
    // so the dots can move in the designer without breaking this.
    const drop = (side) => svg.replace(/<circle cx="([\d.]+)"[^>]*>/g,
      (c, cx) => ((+cx < 50) === (side === "left") ? "" : c));
    if (p === "ɹ") return drop("right");                             // keep left
    if (p === "l") return drop("left");                              // keep right
    if (p === "m") {                                                 // keep both
      const dy = +(blockTweak(sym, slot, partner).dots || 0);
      return dy ? svg.replace(/(<circle [^>]*cy=")([\d.]+)/g, (m, a, cy) => a + (+cy + dy)) : svg;
    }
    return svg.replace(/<circle[^>]*>/g, "");
  }
  return svg;
}

function makeGlyph(token, slot, partner) {
  const { sym } = parseSymbol(token);
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
    // Which form, which way up — see resolveGlyph.
    const { ccForm, flipped, alt, form: resolved } = resolveGlyph(token, slot, partner);
    if (flipped) span.classList.add("avatarian-flipped");
    // A few glyphs redraw in a C-C block (see clusterForm): /s/'s point
    // insets, /z/ drops its dots.
    // An alternate (resolveGlyph) is drawn exactly as its design has it.
    const drawForm = alt ? resolved : (ccForm || form);
    const base = drawForm.svg;
    let svg = !alt && isClusterPartner(partner) ? clusterForm(sym, base, partner, slot, flipped) : base;
    // A rail (see railFor) is a full-height line on the approximant's
    // side. It is symmetric top to bottom, so a flipped glyph needs no care.
    const rail = alt ? null : railFor(sym, slot, partner);
    if (rail != null) {
      const part = railReach(sym, slot, partner, rail, drawForm, flipped);
      if (!part) {
        const tucked = tuckUnderRail(svg, rail);
        // The wiki draws the tucked shape as its own mask (`_t<x>`).
        if (tucked !== svg) span.dataset.tuck = String(rail);
        svg = tucked.replace("</svg>", `<path d="M ${rail} 18 L ${rail} 82"/></svg>`);
        span.dataset.rail = rail < 50 ? "l" : "r";
      } else if (part[0] !== part[1]) {
        // Stops at the ink: cut square there, with the usual cap's reach at
        // the seam end so it meets the approximant's own line.
        const [from, to] = part, d = Math.sign(to - from);
        svg = svg.replace("</svg>",
          `<path stroke-linecap="butt" d="M ${rail} ${from - d * HALF_STROKE} L ${rail} ${to}"/></svg>`);
        span.dataset.rail = rail < 50 ? "l" : "r";
        const shown = (y) => (flipped ? 100 - y : y);
        span.dataset.railspan = shown(from) + "," + shown(to);
      }
    }
    // Both drawings ride along and CSS shows one. The flat copy is the
    // same glyph re-laid-out at 4/5 height rather than a squashed copy
    // of the square one, so stroke weight and dots match exactly in
    // either height mode. Consonants have no flat form and keep theirs.
    //
    // The <svg> elements are tagged directly rather than wrapped: a
    // wrapper <span> is inline, cannot take a height, and collapses the
    // SVG inside it to nothing.
    // Joins (see joinsFor): each one a stroke from an emitter to the
    // partner's ink, drawn inside this glyph's own SVG so it takes the same
    // weight, colour and flip. It runs past the box; blocks.css lets it.
    // The far end is cut square ON the partner's centreline (a butt cap, not
    // the glyphs' square one): its two corners are then at most half a
    // stroke from that centreline, so they stay buried in the partner's
    // stroke however it slants — a square cap pokes a corner out the far
    // side of a diagonal (/v/ over a stem, `envoys`).
    let flat = drawForm.flat || "";
    const joins = joinsFor(token, slot, partner);
    if (joins.length) {
      // Where the emitter is the loose end of a vertical stroke (every stem
      // is), the join is made by MOVING that end: one stroke, one outline. A
      // second stroke laid over the stem's cap is the same shape on paper,
      // but its edges are anti-aliased twice where the two overlap and show
      // as a notch at some sizes. The glyphs' square cap adds half a stroke,
      // so the end stops that much short and lands cut square on the
      // partner's centreline, as above. Anything else gets its own stroke.
      const grow = (src) => {
        for (const j of joins) {
          const to = j.y + j.dir * (j.len - HALF_STROKE);
          const head = new RegExp(`d="M ${j.x} ${j.y} L ${j.x} `, "g");
          const tail = new RegExp(`( ${j.x} [\\d.]+ L ${j.x} )${j.y}"`, "g");
          if (j.len >= HALF_STROKE && (head.test(src) || tail.test(src))) {
            src = src.replace(head, `d="M ${j.x} ${to} L ${j.x} `).replace(tail, `$1${to}"`);
          } else {
            src = src.replace("</svg>",
              `<path stroke-linecap="butt" d="M ${j.x} ${j.y} L ${j.x} ${j.y + j.dir * j.len}"/></svg>`);
          }
        }
        return src;
      };
      if (flat) flat = grow(flat);
      else svg = grow(svg);
      span.dataset.join = joins.map((j) => [j.x, j.a, j.b, ...(j.bar || []).slice(0, 2)].join(",")).join(";");
      if (joins.some((j) => j.root != null)) span.dataset.stem = joins.map((j) => j.root ?? "").join(";");
    }
    // The other half of a join into a dot: the partner's stem replaces it,
    // so this glyph leaves that dot out (/b/ over a stem).
    for (const j of joinsFor(partner, slot === "top" ? "bottom" : "top", token)) {
      if (j.bar) {
        // ... and of a join into a mouth: this glyph closes it. Where the
        // mouth is the two ends of one stroke (/g/'s foot), closing the path
        // does it with a clean corner each side; otherwise a bar across.
        const [x0, x1, gy] = j.bar;
        const loop = new RegExp(`(d="M (?:${x0}|${x1}) ${gy} [^"]* (?:${x0}|${x1}) ${gy})"`);
        const close = (src) => loop.test(src) ? src.replace(loop, '$1 Z"')
          : src.replace("</svg>", `<path stroke-linecap="butt" d="M ${x0} ${gy} L ${x1} ${gy}"/></svg>`);
        svg = close(svg);
        if (flat) flat = close(flat);
      }
      if (!j.dot) continue;
      const gone = new RegExp(`<circle cx="${j.x}" cy="${(j.dot[0] + j.dot[1]) / 2}"[^>]*>`);
      svg = svg.replace(gone, "");
      flat = flat.replace(gone, "");
      span.dataset.nodot = "1";
    }
    span.innerHTML = svg + flat;
    const drawings = span.querySelectorAll("svg");
    drawings[0].classList.add("g-square");
    if (drawings[1]) drawings[1].classList.add("g-flat");
    // Which form actually got written, so the rendered DOM says what it
    // chose — reading it back off the SVG is unreliable once the browser
    // has reserialised it.
    // `%` keeps its by-slot meaning for plain glyphs; a cluster form records
    // "_c" and lets the avatarian-flipped class carry its orientation, so the
    // marker never contradicts the `_c$`/`_c%` a caller typed.
    span.dataset.glyph = alt ? drawForm.name : form.name + (ccForm ? "_c" : (flipped ? "%" : ""));
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
    if (isMark(parseSymbol(token).sym)) {
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
      // A mark (. , ? ! or a numeral) is drawn on its own path, not paired;
      // route it there so a lone `?` gives a real mark, not a mis-sized
      // letter box.
      const sym = parseSymbol(token).sym;
      container.appendChild(
        isMark(sym) ? makeMark(sym) : makeGlyph(token, "top", null));
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
  // Two dots straddling the period's row, a row's gap between — a colon.
  ":": { name: "colon",
         d: '<path d="M 18 66 L 18 66.5"/><path d="M 18 98 L 18 98.5"/>' },
  // A stroke through the bottom two rows: the same weight as the period,
  // given length rather than a tail, which one column has no room for.
  ",": { name: "comma",
         d: '<path d="M 18 122 L 18 146"/>' },
  // A full stroke over a dot, the shape everyone already reads as this.
  "!": { name: "exclamation",
         d: '<path d="M 18 18 L 18 98"/><path d="M 18 146 L 18 146.5"/>' },
  // The same, broken: a question is an interrupted statement. The gap is
  // one row, which is the smallest the lattice can say anything with.
  // Typed `--` (a lone `-` is the null). Drawn in the designer; no inline copy.
  "--": { name: "hyphen" },
  "?": { name: "question",
         d: '<path d="M 18 18 L 18 50"/><path d="M 18 82 L 18 98"/>'
            + '<path d="M 18 146 L 18 146.5"/>' },
};

/**
 * The numerals: the same height class as punctuation — nine rows, unpaired,
 * standing beside the writing — but three lattice columns wide (68×164).
 * Keyed by the digit itself and typed as it (the null is `-`, sounds.js).
 * There is no inline
 * copy: each one comes from the manifest, where an undrawn numeral ships a
 * dashed placeholder at its real width.
 */
const NUMERALS = {
  "0": { name: "zero" }, "1": { name: "one" }, "2": { name: "two" },
  "3": { name: "three" }, "4": { name: "four" }, "5": { name: "five" },
  "6": { name: "six" }, "7": { name: "seven" }, "8": { name: "eight" },
  "9": { name: "nine" },
};

const NUMERAL_BOX = 'viewBox="0 0 68 164" fill="none" stroke="currentColor"'
  + ' stroke-width="6" stroke-dasharray="10 9" opacity="0.75"';

/**
 * Marks that belong to a word rather than a sentence: the possessive `'s`,
 * one character rather than the sounds /ɛ s/. Nine rows like punctuation,
 * five columns wide (100x164), drawn beside the word.
 */
const WORD_MARKS = {
  "'s": { name: "possessive" },
};

/** Is this symbol a mark — drawn on its own, never in a slot? */
function isMark(sym) {
  return !!(PUNCTUATION[sym] || NUMERALS[sym] || WORD_MARKS[sym]);
}

function makeMark(sym) {
  const mark = PUNCTUATION[sym] || NUMERALS[sym] || WORD_MARKS[sym];
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
    : mark.d
      ? `<svg xmlns="http://www.w3.org/2000/svg" ${MARK_BOX}>` + mark.d + "</svg>"
      : `<svg xmlns="http://www.w3.org/2000/svg" ${NUMERAL_BOX}>`
        + '<rect x="8" y="14" width="52" height="136" rx="10"/></svg>';
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
    resolveGlyph, joinsFor, railFor, railReach,
    NULL_IPA, NULL_C_IPA, NULLS, nullFor, isVowelSymbol, parseSymbol,
    PUNCTUATION, NUMERALS, WORD_MARKS, isMark,
  };
}
