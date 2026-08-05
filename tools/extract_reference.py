#!/usr/bin/env python3
"""
Cut the hand-lettered reference key into one SVG per sound.

`reference/avatarian_key.svg` is a single Inkscape export: every glyph in
the chart lives in ONE giant filled <path>, with the IPA labels sitting
alongside as separate <text> elements. This script splits that path into
its subpaths, clusters neighbouring subpaths back into glyphs, and writes
each glyph out on the same 100x100 grid the drawn set uses, so the two
can be shown side by side.

These are the ORIGINAL traced shapes — the ground truth we compare the
drawn set against. They are not the glyphs the tool renders; see
tools/build_glyphs.py for those.

Cluster -> sound mapping is an explicit table keyed on each cluster's
centroid in the key's own coordinate space (see CELLS). It is hand-
verified against the chart rather than inferred from label proximity,
because the chart's labels sit inconsistently (some left of their glyph,
some right) and two glyphs carry no label at all.

Run:  python3 tools/extract_reference.py
"""

import json
import math
import pathlib
import re
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "reference" / "avatarian_key.svg"
OUT = ROOT / "site" / "assets" / "reference"
MANIFEST_JSON = ROOT / "site" / "assets" / "reference_manifest.json"

BOX = 100.0      # target viewBox
PAD = 6.0        # inset on each side, so shapes don't touch the edge
MERGE_GAP = 2.0  # subpaths closer than this belong to the same glyph

# Centroid of each cluster in the key's coordinate space -> filename stem.
# `None` means "a real mark in the chart that we cannot yet name".
CELLS = {
    # --- consonants -------------------------------------------------
    (71, -54): "m",     (104, -54): "n",   (137, -54): "glot",  (201, -54): "ng",
    (71, -38): "b",     (104, -38): "d",                        (202, -38): "g",
    (72, -22): "p",     (104, -22): "t",                        (202, -21): "k",
    (72, -5): "f",      (104, -5): "th",   (136, -6): "s",      (201, -5): "h",
    (71, 11): "v",      (104, 10): "dh",   (136, 11): "z",
    (72, 27): "w",      (137, 28): "r",    (169, 27): "y",
    # The chart draws /l/ in both orientations, stacked inside one cell —
    # which is why they were once extracted under a single name and
    # merged into one two-hook figure. `l` is the top orientation, `l_b`
    # the bottom one; the renderer derives the latter by mirroring.
    (104, 19): "l_b",   (104, 29): "l",
    # --- vowels -----------------------------------------------------
    (104, 49): None,    # unlabelled mark, one row above the vowel block
    (71, 60): "i",      (104, 60): "glot_v",  (136, 60): "uu",
    (71, 75): "ih",
    (71, 92): "ei",     (104, 92): "schwa",   (135, 93): "ow",
    (71, 109): "eh",    (104, 109): "uh",
    (71, 125): "ae",    (84, 125): "ae_b",
    (71, 141): "ai",                          (137, 141): "au",
}

# Filename stem -> the IPA symbol it renders, for the comparison view.
# Stems absent here are shown but not tied to a sound.
NAME_TO_IPA = {
    "m": "m", "n": "n", "ŋ": "ŋ", "ng": "ŋ", "b": "b", "d": "d", "g": "g",
    "p": "p", "t": "t", "k": "k", "f": "f", "th": "θ", "s": "s", "h": "h",
    "v": "v", "dh": "ð", "z": "z", "w": "w", "r": "r", "y": "j",
    "glot": "ʔ",
    "i": "i", "uu": "u", "ih": "ɪ", "ei": "e", "schwa": "ə", "ow": "oʊ",
    "eh": "ɛ", "uh": "ʌ", "ai": "aɪ", "au": "aʊ",
    # Both orientations of a glyph belong to the same sound.
    "l": "l", "l_b": "l", "ae": "æ", "ae_b": "æ",
}

NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")
SVG_NS = "{http://www.w3.org/2000/svg}"


# ---------------------------------------------------------------------------
# minimal path parsing — the key only uses M/m L/l H/h V/v C/c Z/z
# ---------------------------------------------------------------------------

def tokenize(d):
    out, i = [], 0
    while i < len(d):
        c = d[i]
        if c.isalpha():
            out.append(c)
            i += 1
        elif c in " ,\n\t\r":
            i += 1
        else:
            m = NUM.match(d, i)
            if not m:
                raise ValueError(f"unparsable path data near {d[i:i + 30]!r}")
            out.append(float(m.group()))
            i = m.end()
    return out


def subpaths(d):
    """Split path data into subpaths of absolute (cmd, coords) segments."""
    toks = tokenize(d)
    subs, cur, i = [], None, 0
    x = y = sx = sy = 0.0
    cmd = None
    while i < len(toks):
        if isinstance(toks[i], str):
            cmd = toks[i]
            i += 1
        if cmd in "Mm":
            ax, ay = toks[i], toks[i + 1]
            i += 2
            if cmd == "m":
                ax, ay = x + ax, y + ay
            x, y = sx, sy = ax, ay
            cur = [("M", [x, y])]
            subs.append(cur)
            cmd = "L" if cmd == "M" else "l"   # implicit lineto follows moveto
        elif cmd in "Ll":
            ax, ay = toks[i], toks[i + 1]
            i += 2
            if cmd == "l":
                ax, ay = x + ax, y + ay
            x, y = ax, ay
            cur.append(("L", [x, y]))
        elif cmd in "Hh":
            ax = toks[i]
            i += 1
            x = x + ax if cmd == "h" else ax
            cur.append(("L", [x, y]))
        elif cmd in "Vv":
            ay = toks[i]
            i += 1
            y = y + ay if cmd == "v" else ay
            cur.append(("L", [x, y]))
        elif cmd in "Cc":
            p = toks[i:i + 6]
            i += 6
            if cmd == "c":
                p = [p[0] + x, p[1] + y, p[2] + x, p[3] + y, p[4] + x, p[5] + y]
            x, y = p[4], p[5]
            cur.append(("C", p))
        elif cmd in "Zz":
            cur.append(("Z", []))
            x, y = sx, sy
            if i < len(toks) and not isinstance(toks[i], str):
                raise ValueError("coordinates after closepath")
        else:
            raise ValueError(f"unsupported path command {cmd!r}")
    return subs


def bbox(sub):
    """Control-point bounds. Loose for curves, but only used for grouping."""
    xs = [p[k] for _, p in sub for k in range(0, len(p), 2)]
    ys = [p[k] for _, p in sub for k in range(1, len(p), 2)]
    return min(xs), min(ys), max(xs), max(ys)


def union(boxes):
    return (min(b[0] for b in boxes), min(b[1] for b in boxes),
            max(b[2] for b in boxes), max(b[3] for b in boxes))


def gap(a, b):
    dx = max(0.0, max(a[0], b[0]) - min(a[2], b[2]))
    dy = max(0.0, max(a[1], b[1]) - min(a[3], b[3]))
    return math.hypot(dx, dy)


def cluster(subs):
    """Union-find neighbouring subpaths into glyphs."""
    boxes = [bbox(s) for s in subs]
    parent = list(range(len(subs)))

    def find(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    for i in range(len(subs)):
        for j in range(i + 1, len(subs)):
            if gap(boxes[i], boxes[j]) <= MERGE_GAP:
                a, b = find(i), find(j)
                if a != b:
                    parent[a] = b

    groups = {}
    for i in range(len(subs)):
        groups.setdefault(find(i), []).append(i)
    return [sorted(g) for g in groups.values()], boxes


def emit(subs, idxs, box):
    """Serialise a cluster into a 100x100 viewBox, aspect preserved.

    All of a glyph's subpaths stay in ONE <path> so the nonzero fill rule
    still carves out counters (the dot inside /m/, and so on).
    """
    x0, y0, x1, y1 = box
    w, h = x1 - x0, y1 - y0
    scale = (BOX - 2 * PAD) / max(w, h)
    ox = (BOX - w * scale) / 2 - x0 * scale
    oy = (BOX - h * scale) / 2 - y0 * scale

    def pt(px, py):
        return f"{px * scale + ox:.3f} {py * scale + oy:.3f}"

    parts = []
    for i in idxs:
        for c, p in subs[i]:
            if c == "Z":
                parts.append("Z")
            else:
                parts.append(c + " " + " ".join(
                    pt(p[k], p[k + 1]) for k in range(0, len(p), 2)))
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">'
        f'<path d="{" ".join(parts)}" fill="currentColor"/></svg>'
    )


def main():
    tree = ET.parse(SRC)
    paths = [p for p in tree.iter(SVG_NS + "path") if p.get("d")]
    if len(paths) != 1:
        raise SystemExit(f"expected one <path> in the key, found {len(paths)}")

    subs = subpaths(paths[0].get("d"))
    groups, boxes = cluster(subs)

    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.svg"):
        old.unlink()

    seen, unmapped = {}, []
    for idxs in groups:
        box = union([boxes[i] for i in idxs])
        key = (round((box[0] + box[2]) / 2), round((box[1] + box[3]) / 2))
        if key not in CELLS:
            unmapped.append(key)
            continue
        name = CELLS[key]
        if name is None:
            continue
        seen.setdefault(name, []).append((idxs, box))

    manifest = {}
    for name, hits in sorted(seen.items()):
        idxs = [i for h in hits for i in h[0]]
        box = union([h[1] for h in hits])
        (OUT / f"{name}.svg").write_text(emit(subs, idxs, box), encoding="utf-8")
        manifest[name] = {
            "file": f"{name}.svg",
            "ipa": NAME_TO_IPA.get(name),
        }

    MANIFEST_JSON.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"{len(subs)} subpaths -> {len(groups)} clusters -> "
          f"{len(manifest)} reference glyphs")
    print(f"Manifest: {MANIFEST_JSON.relative_to(ROOT)}")
    if unmapped:
        print("WARNING unmapped clusters at:", unmapped)
    missing = [k for k, v in CELLS.items() if v and v not in seen]
    if missing:
        print("WARNING CELLS entries that matched nothing:", missing)


if __name__ == "__main__":
    main()
