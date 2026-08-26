/**
 * The live preview: this glyph, in real blocks, in the real product.
 *
 * The designer's other previews show a glyph on its own, which is the
 * one place none of the current questions live. Whether a vowel's
 * connecting stroke reaches the consonant above it, whether a 3-row
 * vowel leaves the gap it should, whether a flip points the stem at its
 * neighbour — all of that is only visible with the glyph's PARTNER next
 * to it, at product size.
 *
 * So this doesn't reimplement the renderer. It loads the site's own
 * js/render.js and css/blocks.css over /site/ and calls renderAvatarian
 * exactly as index.html does. The only trick is that
 * the glyph being edited is swapped into the manifest first:
 *
 *     window.AVATARIAN_GLYPHS[key] = { ...shipped, svg, flat, rows, flips }
 *
 * render.js reads that object by key on every call, so writing to it is
 * enough — and because the SVG comes back from POST /api/render, i.e.
 * from glyphspec.py, the preview is drawn from the same source the
 * build would use, not from the canvas's JS port.
 *
 * The manifest entry stays overridden for the rest of the session. That
 * is deliberate: switching glyphs leaves the previous one's live shape
 * in place, so a word shows every glyph you have edited this sitting
 * rather than one live glyph among stale neighbours.
 */

const Live = {
  ready: false,
  shipped: {},           // key -> the manifest entry as it was on disk
  partner: "auto",
  phrase: "",
  _els: {},

  /** The site's manifest/renderer are loaded as plain scripts, so this
   *  is just a readiness check — index.html's own load order. */
  boot() {
    this.ready = typeof window.renderAvatarian === "function"
      && !!window.AVATARIAN_GLYPHS;
    if (!this.ready) return false;
    this._els = {
      blocks: document.querySelector("#live-blocks"),
      word: document.querySelector("#live-word"),
      phrase: document.querySelector("#live-phrase"),
      partner: document.querySelector("#live-partner"),
      note: document.querySelector("#live-note"),
    };
    this.fillPartners();
    this._els.partner.addEventListener("change", (e) => {
      this.partner = e.target.value;
      this.draw();
    });
    this._els.phrase.addEventListener("input", () => {
      this.phrase = this._els.phrase.value;
      this.draw();
    });
    return true;
  },

  /** Anything with a drawn glyph is a candidate partner; the defaults
   *  below cover the three block types without picking one. */
  fillPartners() {
    const sel = this._els.partner;
    sel.innerHTML = "";
    const auto = document.createElement("option");
    auto.value = "auto";
    auto.textContent = "every block type";
    sel.appendChild(auto);
    Store.catalog
      .filter((s) => !s.placeholder && s.ipa)
      .forEach((s) => {
        const o = document.createElement("option");
        o.value = s.key;
        o.textContent = `with ${s.ipa}  ${s.name}`;
        sel.appendChild(o);
      });
  },

  /**
   * Put the design's current drawing into the manifest under its own
   * symbol. `rendered` is what came back from /api/render.
   */
  sync(sound, design, rendered) {
    if (!this.ready || !sound || !rendered) return;
    const key = sound.key;
    if (!(key in this.shipped)) {
      this.shipped[key] = window.AVATARIAN_GLYPHS[key] || null;
    }
    const drawn = (design.shapes || []).length > 0;
    if (!drawn) {
      // Nothing drawn yet — show whatever the set ships, so the preview
      // reads as "no change" rather than as an empty block.
      if (this.shipped[key]) window.AVATARIAN_GLYPHS[key] = this.shipped[key];
      else delete window.AVATARIAN_GLYPHS[key];
      return this.draw();
    }
    const entry = {
      name: design.name,
      status: "drawn",
      type: this.renderType(design.type),
      svg: rendered.square,
    };
    if (rendered.flat) entry.flat = rendered.flat;
    const flips = typeof design.flips === "boolean" ? design.flips : sound.flips;
    if (flips) entry.flips = true;
    const rows = design.rows || sound.rows;
    if (rows === 4) entry.rows = 4;
    window.AVATARIAN_GLYPHS[key] = entry;
    this.draw();
  },

  /** The design's height class -> the `type` render.js expects, which
   *  is what its CSS class is built from (avatarian-null etc). */
  renderType(kind) {
    return { mark: "null", mark_consonant: "null_consonant" }[kind] || kind;
  },

  /** Sensible partners when "every block type" is selected: enough to
   *  show the glyph above and below something, against a consonant and
   *  against both a 4-row and a 3-row vowel. */
  autoPairs(sound) {
    const has = (k) => !!window.AVATARIAN_GLYPHS[k];
    const cons = has("t") ? "t" : "p";
    const four = has("ɑ") ? "ɑ" : "u";      // 4-row vowel
    const three = has("i") ? "i" : "ɛ";     // 3-row vowel
    const me = sound.key;
    if (glyphIsTall(sound.type)) {
      // A consonant: show it over each vowel height, under a vowel, and
      // in a C-C block, plus paired with the null it would take.
      return [
        [me, four], [me, three], [four, me], [cons, me], [me, "∅"],
      ];
    }
    // A vowel or vowel-height mark: the mirror of the above.
    return [
      [cons, me], [me, cons], [me, "∅c"],
    ];
  },

  draw() {
    if (!this.ready) return;
    const sound = Store.current;
    if (!sound) return;

    // Block types
    const blocks = this._els.blocks;
    blocks.innerHTML = "";
    const pairs = this.partner === "auto"
      ? this.autoPairs(sound)
      : [[sound.key, this.partner], [this.partner, sound.key]];
    pairs.forEach(([top, bottom]) => {
      const fig = document.createElement("figure");
      const holder = document.createElement("span");
      renderAvatarian([top, bottom], holder);
      fig.appendChild(holder);
      const cap = document.createElement("figcaption");
      cap.textContent = `${label(top)} ${label(bottom)}`;
      fig.appendChild(cap);
      blocks.appendChild(fig);
    });

    // A whole word, in the same syntax the app takes.
    const text = this.phrase.trim() || defaultPhrase(sound);
    const word = this._els.word;
    word.innerHTML = "";
    let unknown = [];
    soundTextToWords(text).forEach((w) => {
      const unit = document.createElement("span");
      unit.className = "live-unit";
      const holder = document.createElement("span");
      renderAvatarian(w.ipa, holder);
      unit.appendChild(holder);
      if (w.word) {
        const cap = document.createElement("span");
        cap.className = "live-cap";
        cap.textContent = w.word;
        unit.appendChild(cap);
      }
      word.appendChild(unit);
      unknown = unknown.concat(
        w.ipa.map((t) => splitOverride(t).body)
          .filter((sym) => !window.AVATARIAN_GLYPHS[sym]));
    });
    this._els.note.textContent = unknown.length
      ? "not a known sound: " + [...new Set(unknown)].join(" ")
      : "";
  },

  /** After shipping, the override IS what the set ships — the build
   *  just wrote this drawing into it. So the entry becomes the new
   *  baseline rather than something to revert to. */
  adopt(key) {
    const entry = window.AVATARIAN_GLYPHS[key];
    if (entry) this.shipped[key] = entry;
  },
};

function glyphIsTall(kind) {
  return GEOM.isTall(kind);
}

/** How a symbol reads in a caption: its readable code where it has one. */
function label(key) {
  if (key === "∅") return "0";
  if (key === "∅c") return "0c";
  const s = Store.catalog.find((x) => x.key === key);
  return (s && (s.code || s.ipa)) || key;
}

/**
 * The word the sound list already offers as this glyph's example, run
 * through g2p so the preview opens on something real rather than blank.
 * Falls back to the glyph beside a null when there is no example.
 */
function defaultPhrase(sound) {
  const word = sound.example;
  if (!word || word.startsWith("(")) {
    return (sound.code || sound.ipa || "0") + " 0";
  }
  const words = sentenceToIPA(word);
  if (!words.length) return (sound.code || sound.ipa) + " 0";
  return words.map((w) => w.ipa.map((s) => IPA_TO_CODE[s] || s).join(" ")
    + (w.word ? ` (${w.word})` : "")).join("  /  ");
}

window.Live = Live;
