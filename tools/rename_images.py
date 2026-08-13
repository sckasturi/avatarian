#!/usr/bin/env python3
"""
Rename filed reference images to match the source they belong to.

    python3 tools/rename_images.py --dry-run     # say what would change
    python3 tools/rename_images.py               # do it

An image filed through the workbench used to be stored under the name of
whatever file was dropped, so `corpus/sources/` fills up with things like
`new-avatar-the-last-airbender-conscript-v0-clrg6ebgx8vg1-4.webp` — which
says nothing about which source it backs up. Re-dropping the same picture
makes another copy beside it, so the folder also collects near-duplicates
that nothing references.

Re-checking a spelling a year from now means finding its image, and that
is the entire reason these are kept. So the name should be the source's:

    cherries on top poster  ->  cherries-on-top-poster.png
    toph-letter             ->  toph-letter.webp

The workbench names new images this way already; this fixes the ones
filed before that. It is a separate script rather than part of `save`
because renaming files under a workbench that already has them open would
break the image it is showing — run it when nothing is unsaved.

Orphans are REPORTED, never deleted. An unreferenced image is usually a
duplicate from re-dropping, but it might equally be one you filed a
minute ago and have not saved against a source yet, and this script has
no way to tell those apart.
"""

import argparse
import json
import pathlib
import re
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import build_corpus                                     # noqa: E402

ROOT = build_corpus.ROOT
SRC = build_corpus.SRC
IMAGES = build_corpus.IMAGES


def slug(name):
    """The source name as a filename: lowercase, words joined by hyphens."""
    out = re.sub(r"[^a-z0-9]+", "-", str(name).lower()).strip("-")
    return out or "source"


def target_name(source_name, current):
    """What the image for this source should be called, keeping its suffix."""
    return slug(source_name) + pathlib.Path(current).suffix.lower()


def plan(data):
    """
    (renames, missing, orphans) — worked out before anything is touched.

    A rename is only planned when the file is actually there and the name
    is actually different, so running twice is a no-op.
    """
    renames, missing = [], []
    referenced = set()

    for name, source in (data.get("sources") or {}).items():
        current = source.get("image")
        if not current:
            continue
        referenced.add(current)
        if not (IMAGES / current).exists():
            missing.append((name, current))
            continue
        wanted = target_name(name, current)
        if wanted == current:
            continue
        # Never write over a different picture. If the name is taken,
        # number it rather than silently replacing what is there.
        final, n = wanted, 2
        while (IMAGES / final).exists() and (IMAGES / final) != (IMAGES / current):
            stem = pathlib.Path(wanted).stem
            final = f"{stem}-{n}{pathlib.Path(wanted).suffix}"
            n += 1
        renames.append((name, current, final))
        referenced.add(final)

    orphans = sorted(
        p.name for p in IMAGES.iterdir()
        if p.is_file() and not p.name.startswith(".")
        and p.name not in referenced)
    return renames, missing, orphans


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--dry-run", action="store_true",
                    help="say what would change and write nothing")
    args = ap.parse_args()

    data = build_corpus.load()
    renames, missing, orphans = plan(data)

    for name, current, wanted in renames:
        print(f"  {current}\n    -> {wanted}   ({name})")
    for name, current in missing:
        print(f"  ! source '{name}' points at '{current}', which is not there")
    if orphans:
        print(f"\n  {len(orphans)} image(s) no source references — left alone:")
        for o in orphans:
            print(f"    {o}")

    if not renames:
        print("\nNothing to rename." if not missing else "\nNo renames possible.")
        return 1 if missing else 0

    if args.dry_run:
        print(f"\n{len(renames)} would be renamed. Run without --dry-run to do it.")
        return 0

    # Files first, then the references, then a rebuild — and validate
    # before touching anything, so a corpus that would not save is not
    # also left with its images half-renamed.
    errors, _ = build_corpus.check(data)
    if errors:
        print("\nThe corpus has problems; fix them before renaming:",
              file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        return 1

    for name, current, wanted in renames:
        (IMAGES / current).rename(IMAGES / wanted)
        data["sources"][name]["image"] = wanted

    SRC.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    errors, records = build_corpus.check(data)
    if errors:
        print("\nRenamed, but the corpus now fails to validate:", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        return 1
    build_corpus.write_js(data.get("sources") or {}, records)
    print(f"\nRenamed {len(renames)} image(s) and updated "
          f"{SRC.relative_to(ROOT)}.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
