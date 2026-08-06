/**
 * State, history and persistence for the designer.
 *
 * One design is open at a time. Every mutation goes through `commit`,
 * which snapshots for undo, notifies listeners, and schedules a save.
 * Saves are debounced and always to disk — designs/<name>.json is the
 * single copy, so there is no separate "unsaved buffer" to lose. Nothing
 * is kept in localStorage on purpose: two tabs would then disagree about
 * what a glyph looks like, and the files are the truth.
 */

const API = {
  async catalog() { return get("/api/catalog"); },
  async designs() { return get("/api/designs"); },
  async save(name, design) {
    return send("PUT", `/api/designs/${name}`, design);
  },
  async remove(name) { return send("DELETE", `/api/designs/${name}`); },
  async render(design) { return send("POST", "/api/render", design); },
  /** Ship a design into build_glyphs.py and rebuild. `allowInvented`
   *  is the second press on a sound that has no reference material. */
  async promote(name, allowInvented) {
    return send("POST", `/api/promote/${name}`, { allowInvented: !!allowInvented });
  },
  /** Every design that differs from what ships. `dryRun` reports the
   *  list without touching anything. */
  async promoteAll(dryRun) {
    return send("POST", "/api/promote-all", { dryRun: !!dryRun });
  },
};

async function get(url) {
  const r = await fetch(url, { cache: "no-store" });
  if (!r.ok) throw new Error(`${r.status} ${url}`);
  return r.json();
}

async function send(method, url, body) {
  const r = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `${r.status} ${url}`);
  return data;
}

const Store = {
  catalog: [],          // every sound, from the server
  extraRefs: {},
  designs: {},          // name -> design, everything on disk
  current: null,        // the sound row being edited
  design: null,         // its design (created blank if new)

  _undo: [],
  _redo: [],
  _listeners: [],
  _saveTimer: null,
  _saving: false,
  _pending: false,

  on(fn) { this._listeners.push(fn); },
  emit(what) { this._listeners.forEach((fn) => fn(what)); },

  async boot() {
    const [cat, designs] = await Promise.all([API.catalog(), API.designs()]);
    this.catalog = cat.sounds;
    this.extraRefs = cat.extraReferences || {};
    this.geometry = cat.geometry;
    this.designs = designs;
    this.emit("catalog");
  },

  sound(name) { return this.catalog.find((s) => s.name === name); },

  /** True once a glyph has something drawn in it. */
  hasDesign(name) {
    const d = this.designs[name];
    return !!(d && d.shapes && d.shapes.length);
  },

  open(name) {
    const row = this.sound(name);
    if (!row) return;
    // Flush before switching: leaving an edit on a timer while the
    // editor moves on is how it goes missing.
    if (this._queued) this.save(this._queued);
    this.current = row;
    this.design = this.designs[name] || blankDesign(row);
    this._undo = [];
    this._redo = [];
    this.emit("open");
  },

  /** Snapshot, apply, notify, schedule a save. `mutate` edits in place. */
  commit(mutate) {
    if (!this.design) return;
    const before = JSON.stringify(this.design);
    mutate(this.design);
    if (JSON.stringify(this.design) === before) return;
    this._push(before);
    this.designs[this.design.name] = this.design;
    this.emit("change");
    this.scheduleSave();
  },

  /**
   * A drag is one undo step, not one per pointermove. Between begin and
   * end the design is edited directly and `touch` just repaints; the
   * whole gesture lands on the history at the end, and only if it
   * actually moved something.
   */
  begin() { this._tx = JSON.stringify(this.design); },
  touch() {
    this.designs[this.design.name] = this.design;
    this.emit("change");
  },
  end() {
    if (this._tx == null) return;
    const before = this._tx;
    this._tx = null;
    if (JSON.stringify(this.design) === before) return;
    this._push(before);
    this.emit("change");
    this.scheduleSave();
  },

  _push(before) {
    this._undo.push(before);
    if (this._undo.length > 200) this._undo.shift();
    this._redo.length = 0;
  },

  undo() { this._step(this._undo, this._redo); },
  redo() { this._step(this._redo, this._undo); },
  _step(from, to) {
    if (!from.length) return;
    to.push(JSON.stringify(this.design));
    this.design = JSON.parse(from.pop());
    this.designs[this.design.name] = this.design;
    this.emit("change");
    this.scheduleSave();
  },
  canUndo() { return this._undo.length > 0; },
  canRedo() { return this._redo.length > 0; },

  /**
   * Debounced write.
   *
   * The pending save remembers WHICH design it is for. Reading
   * `this.design` when the timer fires instead looks obviously fine and
   * silently loses work: edit a glyph, switch to another inside the
   * debounce window, and the timer writes the new glyph — the edit you
   * just made never reaches disk, and the other design gets saved twice.
   */
  scheduleSave() {
    this.emit("dirty");
    clearTimeout(this._saveTimer);
    this._queued = this.design;
    this._saveTimer = setTimeout(() => this.save(), 600);
  },

  async save(design = this._queued || this.design) {
    clearTimeout(this._saveTimer);
    if (!design) return;
    if (this._saving) { this._pending = design; return; }
    this._saving = true;
    if (this._queued === design) this._queued = null;
    try {
      const res = await API.save(design.name, design);
      design.updated = res.updated;
      this.problems = res.problems || [];
      this.emit("saved");
    } catch (e) {
      this.error = String(e.message || e);
      this.emit("save-error");
    } finally {
      this._saving = false;
      const next = this._pending;
      this._pending = null;
      if (next) this.save(next);
    }
  },
};

function blankDesign(row) {
  return {
    name: row.name,
    ipa: row.ipa,
    type: row.type,
    grid: row.grid,
    notes: "",
    shapes: [],
  };
}

window.Store = Store;
window.API = API;
