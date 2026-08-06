#!/usr/bin/env python3
"""
Turn lattice designs into SVG, or into source for build_glyphs.py.

Designs live in designs/<name>.json and are drawn in the designer
(python3 tools/designer_server.py). This is the command-line side of the
same interpreter — see tools/glyphspec.py for the format and geometry.

    python3 tools/designs_to_svg.py --report
        What has been designed, what hasn't, and anything that looks off.

    python3 tools/designs_to_svg.py m
        The square SVG for one design, on stdout.

    python3 tools/designs_to_svg.py m --form flat
        The 100x80 form (vowels and marks only).

    python3 tools/designs_to_svg.py m --python
        The same drawing as a CONSONANTS/VOWELS entry, ready to paste
        into tools/build_glyphs.py. This is the handoff: a design is a
        record of what was drawn on the grid, and promoting it into the
        glyph set is a deliberate edit, not an automatic rebuild.

    python3 tools/designs_to_svg.py --all --out /tmp/preview
        Every design written out as a file, for eyeballing in bulk.
"""

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import glyphspec                                        # noqa: E402
import build_glyphs as bg                               # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
DESIGNS = ROOT / "designs"


def load(name):
    p = DESIGNS / f"{name}.json"
    if not p.exists():
        return None
    return json.loads(p.read_text(encoding="utf-8"))


def load_all():
    if not DESIGNS.exists():
        return {}
    out = {}
    for p in sorted(DESIGNS.glob("*.json")):
        try:
            out[p.stem] = json.loads(p.read_text(encoding="utf-8"))
        except json.JSONDecodeError as e:
            print(f"WARNING {p.name}: {e}", file=sys.stderr)
    return out


def catalog():
    """Every sound the script needs a glyph for, in a stable order:
    consonants, vowels, then marks. Read straight off build_glyphs so
    the two can't drift apart."""
    rows = []
    for ipa, name in bg.IPA_TO_NAME.items():
        kind = bg.glyph_type(ipa)
        rows.append({
            "name": name,
            "ipa": None if ipa in (bg.NULL_IPA, bg.NULL_C_IPA) else ipa,
            "type": "mark" if kind in ("null", "null_consonant") else kind,
            "placeholder": name in bg.PLACEHOLDERS,
            "flips": ipa in bg.FLIPS,
        })
    order = {"consonant": 0, "vowel": 1, "mark": 2}
    rows.sort(key=lambda r: (order[r["type"]], r["name"]))
    return rows


def report():
    designs = load_all()
    rows = catalog()
    done = [r for r in rows if r["name"] in designs]
    todo = [r for r in rows if r["name"] not in designs]

    print(f"{len(done)}/{len(rows)} sounds have a design.\n")

    if done:
        print("designed")
        for r in done:
            d = designs[r["name"]]
            shapes = d.get("shapes", [])
            paths = sum(1 for s in shapes if s.get("kind") != "dot")
            dots = sum(1 for s in shapes if s.get("kind") == "dot")
            note = f"  {d['notes'][:44]}" if d.get("notes") else ""
            print(f"  {r['name']:<10} {r['ipa'] or '∅':<3} {r['type']:<10}"
                  f" {paths} path(s), {dots} dot(s){note}")
        print()

    if todo:
        print("not yet designed")
        for r in todo:
            flag = "  (no glyph in the set either)" if r["placeholder"] else ""
            print(f"  {r['name']:<10} {r['ipa'] or '∅':<3} {r['type']}{flag}")
        print()

    known = {r["name"] for r in rows}
    orphans = [n for n in designs if n not in known]
    if orphans:
        print("designs with no matching sound:", ", ".join(orphans), "\n")

    problems = []
    for name, d in designs.items():
        for p in glyphspec.validate(d):
            problems.append(f"  {name}: {p}")
    if problems:
        print("problems")
        print("\n".join(problems))
    else:
        print("No problems found.")


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("name", nargs="?", help="design stem, e.g. m or schwa")
    ap.add_argument("--form", choices=["square", "flat"], default="square")
    ap.add_argument("--python", action="store_true",
                    help="emit a build_glyphs.py entry instead of SVG")
    ap.add_argument("--all", action="store_true", help="every design")
    ap.add_argument("--out", type=pathlib.Path,
                    help="directory to write to instead of stdout")
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()

    if args.report or (not args.name and not args.all):
        report()
        return

    designs = load_all() if args.all else {}
    if args.name:
        d = load(args.name)
        if d is None:
            sys.exit(f"No design for {args.name!r}. "
                     f"Draw one at http://localhost:8792/")
        designs = {args.name: d}

    if args.out:
        args.out.mkdir(parents=True, exist_ok=True)

    for name, d in designs.items():
        if args.python:
            text, ext = glyphspec.to_python(d), ".py"
        else:
            forms = glyphspec.forms_for(d)
            form = args.form if args.form in forms else "square"
            text, ext = glyphspec.to_svg(d, form), ".svg"

        if args.out:
            suffix = "_flat" if (not args.python and args.form == "flat"
                                 and "flat" in glyphspec.forms_for(d)) else ""
            path = args.out / f"{name}{suffix}{ext}"
            path.write_text(text + "\n", encoding="utf-8")
            print(f"wrote {path}")
        else:
            if len(designs) > 1:
                print(f"\n# --- {name} " + "-" * 40)
            print(text)


if __name__ == "__main__":
    main()
