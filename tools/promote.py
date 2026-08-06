#!/usr/bin/env python3
"""
Put a design into the shipped glyph set.

    python3 tools/promote.py m              # ship designs/m.json
    python3 tools/promote.py m --dry-run    # show the edit, write nothing
    python3 tools/promote.py --all          # every design that differs

This is the step that used to be a copy-paste: render the design with
glyphspec, paste the entry into tools/build_glyphs.py, run build_glyphs,
run build_manifest, reload. Same steps, same order, same authority — it
is just no longer done by hand. The designer's "ship it" button posts to
/api/promote, which calls straight into here.

What it edits, and what it deliberately doesn't
-----------------------------------------------

build_glyphs.py stays the single definition of the shipped set, so the
entry really is written into it, in the same layout a human would use
(glyphspec.to_python already emits it that way). Only one entry moves:

  * the glyph's entry in CONSONANTS / VOWELS / MARKS_VOWEL /
    MARKS_CONSONANT, chosen by the design's height class;
  * its name is dropped from PLACEHOLDERS, if it was in there — shipping
    a drawing is exactly what stops it being a placeholder.

Comment lines sitting directly above an entry are regenerated from the
design's `notes` when it has any, and left alone when it doesn't. That
way a note written in the designer lands next to the shape it describes,
and a comment written by hand in build_glyphs.py isn't quietly eaten by
a design that has nothing to say.

FLIPS and VOWEL_4ROW are NOT written here. A design carries `flips` and
`rows` itself and build_glyphs.py reads them out of designs/ at build
time (see `design_overrides` there), so there is nothing to copy across.
"""

import argparse
import importlib
import io
import json
import pathlib
import re
import sys
from contextlib import redirect_stdout

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import glyphspec                                        # noqa: E402
import build_glyphs as bg                               # noqa: E402
import build_manifest                                   # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
DESIGNS = ROOT / "designs"
SOURCE = ROOT / "tools" / "build_glyphs.py"

# Height class -> the dict in build_glyphs.py that holds it.
DICT_FOR = {
    "consonant": "CONSONANTS",
    "vowel": "VOWELS",
    "mark": "MARKS_VOWEL",
    "mark_consonant": "MARKS_CONSONANT",
}


class PromoteError(Exception):
    pass


def load(name):
    p = DESIGNS / f"{name}.json"
    if not p.exists():
        raise PromoteError(f"no design at designs/{name}.json")
    if name not in bg.NAME_TO_IPA:
        raise PromoteError(
            f"{name} isn't a sound in build_glyphs.IPA_TO_NAME — a design "
            f"with no sound to belong to would ship as a dead entry")
    return json.loads(p.read_text(encoding="utf-8"))


def _dict_span(src, dict_name):
    """(start, end) of a top-level dict literal's BODY, exclusive of the
    `NAME = {` line and the closing brace."""
    m = re.search(rf"^{dict_name} = \{{\n", src, re.M)
    if not m:
        raise PromoteError(f"can't find `{dict_name} = {{` in build_glyphs.py")
    close = re.compile(r"^\}$", re.M).search(src, m.end())
    if not close:
        raise PromoteError(f"`{dict_name}` has no closing brace")
    return m.end(), close.start()


def _entry_span(src, start, end, name):
    """(start, end, comments) of one entry inside a dict body, or None.

    An entry runs from its own `    "name":` line to just before the next
    entry at the same indent (or the end of the dict). `comments` is the
    run of comment lines directly above it, which the caller may or may
    not want to replace.
    """
    body = src[start:end]
    m = re.search(rf'^    "{re.escape(name)}":', body, re.M)
    if not m:
        return None
    e_start = start + m.start()
    nxt = re.compile(r'^    "', re.M).search(body, m.end())
    e_end = start + nxt.start() if nxt else end

    # Walk back over any comment lines immediately above.
    c_start = e_start
    while True:
        prev = src.rfind("\n", start - 1, c_start - 1)
        line_start = prev + 1
        if line_start < start or not src[line_start:c_start].startswith("    #"):
            break
        c_start = line_start
    return e_start, e_end, src[c_start:e_start]


def edit_source(src, design):
    """build_glyphs.py with this design's entry written in. Returns
    (new_src, what) where `what` says which dict and whether the entry
    was replaced or added."""
    name = design.get("name")
    if not name:
        raise PromoteError("design has no name")
    kind = design.get("type", "consonant")
    dict_name = DICT_FOR.get(kind)
    if not dict_name:
        raise PromoteError(f"{name}: unknown height class {kind!r}")
    if not design.get("shapes"):
        raise PromoteError(f"{name}: nothing drawn yet")

    entry = glyphspec.to_python(design).rstrip("\n") + "\n"
    start, end = _dict_span(src, dict_name)
    found = _entry_span(src, start, end, name)

    if found:
        e_start, e_end, comments = found
        # A design with notes regenerates the comment above its entry
        # (glyphspec.to_python emits it as part of the entry, so cut the
        # old one away). A design with no notes leaves whatever comment
        # is written there ALONE — which means cutting nothing, because
        # src[:e_start] already contains it. Re-adding it here is how
        # this managed to duplicate the comment on every single promote,
        # so an entry could never converge and always "differed".
        cut = e_start - len(comments) if (design.get("notes") or "").strip() \
            else e_start
        new_src = src[:cut] + entry + src[e_end:]
        action = "replaced"
    else:
        new_src = src[:end] + entry + src[end:]
        action = "added"

    new_src, dropped = _drop_placeholder(new_src, name)
    return new_src, {"dict": dict_name, "action": action,
                     "placeholder": dropped, "entry": entry.rstrip("\n")}


def _drop_placeholder(src, name):
    """Take a name out of the PLACEHOLDERS dict. Shipping a drawing is
    what stops a sound being a placeholder, so this isn't optional."""
    start, end = _dict_span(src, "PLACEHOLDERS")
    body = src[start:end]
    pat = re.compile(rf'\s*"{re.escape(name)}":\s*"[^"]*",')
    m = pat.search(body)
    if not m:
        return src, False
    body = body[:m.start()] + body[m.end():]
    # Re-wrap: the dict is authored as flowed lines, and cutting an entry
    # out of the middle can leave a ragged one.
    entries = re.findall(r'"[^"]+":\s*"[^"]*",', body)
    lines, cur = [], "   "
    for e in entries:
        if len(cur) + len(e) + 1 > 74:
            lines.append(cur)
            cur = "   "
        cur += " " + e
    if cur.strip():
        lines.append(cur)
    return src[:start] + "\n".join(lines) + "\n" + src[end:], True


def rebuild():
    """Re-run the two build scripts, in the order they must run in, with
    build_glyphs re-imported so the edit above is what gets drawn."""
    out = io.StringIO()
    with redirect_stdout(out):
        importlib.reload(bg)
        bg.main()
        importlib.reload(build_manifest)
        build_manifest.main()
    return out.getvalue().strip()


def shippable():
    """Every design that could be shipped, in a stable order.

    Placeholders are NOT here: adding a glyph the set doesn't have is a
    bigger step than adjusting one it does, and shouldn't ride along in
    a bulk run. Name one explicitly to ship it.
    """
    return [p.stem for p in sorted(DESIGNS.glob("*.json"))
            if p.stem in bg.NAME_TO_IPA
            and p.stem not in bg.PLACEHOLDERS
            and json.loads(p.read_text(encoding="utf-8")).get("shapes")]


def promote_all(names=None, dry_run=False):
    """Ship every design that differs from what ships.

    Every entry is edited against the running source and the build runs
    ONCE at the end — rebuilding per glyph would redraw the whole set
    for each one, and would leave the tree half-built if one failed.
    """
    src = SOURCE.read_text(encoding="utf-8")
    results, failed = [], []
    for name in (names if names is not None else shippable()):
        try:
            design = load(name)
            new_src, what = edit_source(src, design)
        except PromoteError as e:
            failed.append({"name": name, "error": str(e)})
            continue
        what["name"] = name
        what["changed"] = new_src != src
        if what["changed"]:
            src = new_src
        results.append(what)

    changed = [r for r in results if r["changed"]]
    out = {"results": results, "failed": failed,
           "changed": [r["name"] for r in changed],
           "considered": len(results)}
    if dry_run:
        return out
    if changed:
        SOURCE.write_text(src, encoding="utf-8")
        out["build"] = rebuild()
    return out


def promote(name, design=None, dry_run=False, allow_invented=False):
    """Ship one design. `allow_invented` is the gate on a sound that is
    still a PLACEHOLDER, i.e. one the set has no glyph for at all.
    Adding a glyph is a bigger step than adjusting one, and bulk runs
    skip these entirely, so naming it takes a second press."""
    design = design or load(name)
    if name in bg.PLACEHOLDERS and not allow_invented:
        raise PromoteError(
            f"{name} ({bg.PLACEHOLDERS[name]}) has no glyph in the set yet — "
            f"shipping this adds one rather than changing one. Press again, "
            f"or pass --force, to go ahead.")
    src = SOURCE.read_text(encoding="utf-8")
    new_src, what = edit_source(src, design)
    what["name"] = name
    what["changed"] = new_src != src
    if dry_run:
        what["source"] = new_src
        return what
    if what["changed"]:
        SOURCE.write_text(new_src, encoding="utf-8")
    what["build"] = rebuild()
    return what


def main():
    ap = argparse.ArgumentParser(
        description=__doc__,
        formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("name", nargs="?", help="design stem, e.g. m or schwa")
    ap.add_argument("--all", action="store_true",
                    help="every design that has something drawn")
    ap.add_argument("--dry-run", action="store_true",
                    help="print the entry that would be written, change nothing")
    ap.add_argument("--force", action="store_true",
                    help="ship a sound that is still a PLACEHOLDER, i.e. one "
                         "the set has no glyph for yet")
    args = ap.parse_args()

    if not args.name and not args.all:
        ap.error("give a design name, or --all")

    if args.all:
        out = promote_all(dry_run=args.dry_run)
        for r in out["results"]:
            note = ", out of PLACEHOLDERS" if r["placeholder"] else ""
            mark = "" if r["changed"] else " (no change)"
            print(f"{'# ' if args.dry_run else ''}"
                  f"{r['name']}: {r['action']} in {r['dict']}{note}{mark}")
            if args.dry_run and r["changed"]:
                print(r["entry"])
        for f in out["failed"]:
            print(f"{f['name']}: {f['error']}", file=sys.stderr)
        print(f"\n{len(out['changed'])} of {out['considered']} differ"
              f"{': ' + ', '.join(out['changed']) if out['changed'] else ''}")
        if out.get("build"):
            print(out["build"])
        return

    try:
        res = promote(args.name, dry_run=args.dry_run,
                      allow_invented=args.force)
    except PromoteError as e:
        sys.exit(f"{args.name}: {e}")
    note = ", out of PLACEHOLDERS" if res["placeholder"] else ""
    if args.dry_run:
        print(f"# {args.name}: {res['action']} in {res['dict']}{note}")
        print(res["entry"])
        return
    print(f"{args.name}: {res['action']} in {res['dict']}{note}"
          + ("" if res["changed"] else " (no change)"))
    if res.get("build"):
        print(res["build"])


if __name__ == "__main__":
    main()
