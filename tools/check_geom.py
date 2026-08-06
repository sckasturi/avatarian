#!/usr/bin/env python3
"""
Check that designer/js/geom.js still agrees with tools/glyphspec.py.

    python3 tools/check_geom.py

The designer draws its canvas with the JavaScript port so a drag can
redraw at pointer speed, and emits everything you copy through the
Python. That is only safe while the two produce the same geometry, and
"keep them in step" is the kind of instruction that quietly stops being
true. So: generate a pile of designs covering every segment type, every
grid, both forms, and diff the two renderers byte for byte.

Needs node on PATH. Skips with a notice if there isn't one, rather than
failing — the designer itself doesn't need node to run.
"""

import json
import pathlib
import random
import shutil
import subprocess
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import glyphspec                                        # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
GEOM_JS = ROOT / "designer" / "js" / "geom.js"

# geom.js publishes onto `window`; give it one, then render whatever
# comes in on stdin exactly the way the designer's canvas would.
DRIVER = """
globalThis.window = globalThis;
require(%s);
const designs = JSON.parse(require('fs').readFileSync(0, 'utf8'));
console.log(JSON.stringify(designs.map(
  ([d, form]) => window.GEOM.toSVG(d, form))));
"""


def cases():
    """Designs covering each segment type, both grids, and the awkward
    corners: closed paths, arcs past a semicircle, curve runs starting
    mid-path, dots at every size."""
    rnd = random.Random(20260805)
    out = []

    def node(seg=None, bulge=None):
        n = {"x": rnd.randrange(0, 11) / 2, "y": rnd.randrange(0, 7) / 2}
        if seg:
            n["seg"] = seg
            if bulge is not None:
                n["bulge"] = bulge
        return n

    for kind, grid in (("consonant", [5, 5]), ("vowel", [5, 3]),
                       ("mark", [5, 3]), ("mark_consonant", [5, 5])):
        for i in range(40):
            segs = ["line", "arc", "curve"]
            nodes = [node()]
            for k in range(rnd.randrange(1, 6)):
                seg = segs[rnd.randrange(3)]
                bulge = None
                if seg == "arc":
                    # Both directions, and past a semicircle, so the
                    # large-arc and sweep flags both get exercised.
                    bulge = round(rnd.uniform(-3, 3), 4)
                nodes.append(node(seg, bulge))
            shape = {"kind": "path", "closed": bool(rnd.randrange(2)), "nodes": nodes}
            if shape["closed"]:
                shape["closeSeg"] = {"seg": segs[rnd.randrange(3)],
                                     "bulge": round(rnd.uniform(-2, 2), 4)}
            shapes = [shape]
            for k in range(rnd.randrange(0, 3)):
                shapes.append({"kind": "dot",
                               "x": rnd.randrange(0, 11) / 2,
                               "y": rnd.randrange(0, 7) / 2,
                               "size": "sml"[rnd.randrange(3)]})
            d = {"name": f"{kind}{i}", "ipa": None, "type": kind,
                 "grid": grid, "shapes": shapes}
            for form in glyphspec.forms_for(d):
                out.append((d, form))

    # Degenerate shapes the editor can hand over mid-gesture.
    out.append(({"name": "empty", "type": "consonant", "grid": [5, 5],
                 "shapes": []}, "square"))
    out.append(({"name": "one", "type": "consonant", "grid": [5, 5],
                 "shapes": [{"kind": "path", "nodes": [{"x": 1, "y": 1}]}]}, "square"))
    out.append(({"name": "flat0", "type": "vowel", "grid": [5, 3], "shapes": [
        {"kind": "path", "closed": False, "nodes": [
            {"x": 0, "y": 0}, {"x": 5, "y": 3, "seg": "arc", "bulge": 0}]}]}, "flat"))
    return out


def main():
    node = shutil.which("node")
    if not node:
        print("node not found — skipping the geom.js parity check.")
        return 0

    pairs = cases()
    mine = [glyphspec.to_svg(d, form) for d, form in pairs]

    proc = subprocess.run(
        [node, "-e", DRIVER % json.dumps(str(GEOM_JS))],
        input=json.dumps(pairs), capture_output=True, text=True)
    if proc.returncode != 0:
        print("node failed:\n" + proc.stderr, file=sys.stderr)
        return 2
    theirs = json.loads(proc.stdout)

    bad = [(i, a, b) for i, (a, b) in enumerate(zip(mine, theirs)) if a != b]
    if not bad:
        print(f"geom.js and glyphspec.py agree on all {len(pairs)} cases.")
        return 0

    print(f"{len(bad)} of {len(pairs)} cases disagree.\n")
    for i, a, b in bad[:5]:
        d, form = pairs[i]
        print(f"--- {d['name']} ({form})")
        print("  design:", json.dumps(d["shapes"]))
        print("  python:", a)
        print("  js    :", b, "\n")
    return 1


if __name__ == "__main__":
    sys.exit(main())
