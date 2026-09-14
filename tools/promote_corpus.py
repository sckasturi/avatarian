#!/usr/bin/env python3
"""
Fold a reviewed community submission into the attested corpus.

    python3 tools/promote_corpus.py --list             # what is waiting
    python3 tools/promote_corpus.py --check             # validate all (CI)
    python3 tools/promote_corpus.py fanny-poster.json   # promote one
    python3 tools/promote_corpus.py fanny-poster.json --dry-run
    python3 tools/promote_corpus.py --all               # promote everything

This is the merge-side counterpart to the public contribution page
(site/contribute.html). Submissions arrive as one self-contained JSON file
each under corpus/incoming/ — the Cloudflare Worker in contrib-worker/
drops them there and opens a pull request; see corpus/incoming/README.md.
Promoting one folds its `source` block and its `entries` into
corpus/attested.json and regenerates site/js/corpus.js.

WHAT DOES THE VALIDATING. Nothing here re-implements the corpus rules.
Promotion routes through `build_corpus.save`, the exact same all-or-
nothing write the workbench and the command line use: it validates the
folded corpus and writes NOTHING if anything is wrong, so a bad submission
cannot half-land. `--check` runs the same fold and `build_corpus.check`
without writing, which is what CI runs on a submission's pull request — so
a submission that would break the corpus fails the check before it is ever
merged, and the promote after merge cannot then surprise you.

WHY A STAGING FILE AT ALL. So the Worker never has to safely mutate the
canonical attested.json (concurrent submissions, a big JSON array). It
drops a self-contained record; the fold into the real corpus is this
reviewed, validated step. It mirrors how tools/promote.py ships a glyph
design: the authority stays in one generator, and the promote is just the
copy-paste made no longer by hand.
"""

import argparse
import json
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))

import build_corpus                                     # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
INCOMING = ROOT / "corpus" / "incoming"

# The entry fields the corpus stores. Anything else in a submission (a
# stray field, an injected key) is dropped rather than trusted — the
# submission comes from a stranger, so it is copied field by field, not
# spread wholesale.
ENTRY_FIELDS = ("key", "spelling", "source", "confidence", "gloss", "times", "note")
# `credit` is who read the Avatarian — carried through so the attribution
# survives promotion. build_corpus preserves arbitrary source fields, so it
# lands in attested.json untouched (the `_submission` metadata does not:
# it is process, not corpus).
SOURCE_FIELDS = ("what", "where", "image", "links", "credit")


def submissions():
    """Every staged submission file, sorted, ignoring the housekeeping ones."""
    if not INCOMING.exists():
        return []
    return sorted(
        p for p in INCOMING.glob("*.json")
        if p.name not in {".gitkeep"})


def load_submission(path):
    data = json.loads(path.read_text(encoding="utf-8"))
    source = data.get("source") or {}
    name = (source.get("name") or "").strip()
    if not name:
        raise ValueError(f"{path.name}: submission has no source.name")
    entries = data.get("entries") or []
    if not isinstance(entries, list) or not entries:
        raise ValueError(f"{path.name}: submission has no entries")
    return name, source, entries


def clean_source(source):
    """Copy only the fields a source is allowed, and only when filled."""
    return {k: source[k] for k in SOURCE_FIELDS
            if source.get(k) not in (None, "", [])}


def clean_entry(entry, source_name):
    """Copy an entry field by field, forcing its source to this submission's."""
    out = {}
    for k in ENTRY_FIELDS:
        if k in entry and entry[k] not in (None, ""):
            out[k] = entry[k]
    # The entry cites THIS source, whatever it claimed — the source name is
    # the one the file is filed under, not something a submission gets to
    # point elsewhere.
    out["source"] = source_name
    return out


def fold(base, path):
    """
    Fold one submission into a corpus dict, returning a NEW dict.

    Additive and non-destructive: a source already present keeps its
    fields and gains only the ones the submission fills, and entries are
    appended. `build_corpus.check` is what then decides whether the result
    is legal — this only assembles it.
    """
    name, source, entries = load_submission(path)
    sources = dict(base.get("sources") or {})
    sources[name] = {**sources.get(name, {}), **clean_source(source)}
    folded = list(base.get("entries") or [])
    folded += [clean_entry(e, name) for e in entries]
    return {"sources": sources, "entries": folded}


def fold_all(base, paths):
    data = base
    for path in paths:
        data = fold(data, path)
    return data


def base_corpus():
    data = build_corpus.load() if build_corpus.SRC.exists() else {}
    return {"sources": data.get("sources") or {},
            "entries": data.get("entries") or []}


def cmd_list():
    paths = submissions()
    if not paths:
        print("corpus/incoming/ is empty — nothing waiting.")
        return 0
    print(f"{len(paths)} submission(s) waiting:")
    for path in paths:
        try:
            name, _, entries = load_submission(path)
            words = ", ".join(sorted({e.get("key", "?") for e in entries}))
            print(f"  {path.name}  — source '{name}', {len(entries)} entr"
                  f"{'y' if len(entries) == 1 else 'ies'}: {words}")
        except Exception as e:                           # noqa: BLE001
            print(f"  {path.name}  — UNREADABLE: {e}")
    return 0


def cmd_check():
    """Fold everything waiting and validate, writing nothing. CI's gate."""
    paths = submissions()
    if not paths:
        print("No submissions to check.")
        return 0
    try:
        folded = fold_all(base_corpus(), paths)
    except Exception as e:                               # noqa: BLE001
        print(f"Could not assemble the submissions: {e}", file=sys.stderr)
        return 1
    errors, records = build_corpus.check(folded)
    if errors:
        print(f"{len(paths)} submission(s) would break the corpus — "
              f"{len(errors)} problem(s):", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        return 1
    print(f"{len(paths)} submission(s) fold cleanly — "
          f"{len(records)} words after promotion.")
    return 0


def promote(paths, dry_run):
    folded = fold_all(base_corpus(), paths)
    if dry_run:
        errors, records = build_corpus.check(folded)
        print(f"Would promote {len(paths)} submission(s):")
        for path in paths:
            print(f"  {path.name}")
        print(f"Corpus would hold {len(records)} words, "
              f"{len(folded['entries'])} sightings.")
        if errors:
            print(f"\nBUT {len(errors)} problem(s) — promotion would be "
                  f"rejected:", file=sys.stderr)
            for e in errors:
                print("  " + e, file=sys.stderr)
            return 1
        print("No problems — safe to promote.")
        return 0

    # save() is all-or-nothing: it writes nothing if the folded corpus is
    # invalid, so the incoming files are only deleted once the write has
    # actually happened.
    errors, records = build_corpus.save(folded)
    if errors:
        print(f"Promotion rejected — {len(errors)} problem(s), nothing "
              f"written:", file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        return 1

    for path in paths:
        path.unlink()
    print(f"Promoted {len(paths)} submission(s). Corpus now holds "
          f"{len(records)} words. Regenerated site/js/corpus.js.")
    print("Review the diff, commit, and the site redeploys on push.")
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("file", nargs="?", help="one submission filename in corpus/incoming/")
    ap.add_argument("--all", action="store_true", help="promote every waiting submission")
    ap.add_argument("--list", action="store_true", help="list what is waiting")
    ap.add_argument("--check", action="store_true",
                    help="fold all and validate without writing (what CI runs)")
    ap.add_argument("--dry-run", action="store_true",
                    help="show the fold, write nothing")
    args = ap.parse_args()

    if args.list:
        return cmd_list()
    if args.check:
        return cmd_check()

    if args.all:
        paths = submissions()
        if not paths:
            print("Nothing to promote.")
            return 0
    elif args.file:
        path = INCOMING / args.file
        if not path.exists():
            print(f"No such submission: {path.relative_to(ROOT)}", file=sys.stderr)
            return 1
        paths = [path]
    else:
        ap.error("give a submission filename, or --all / --list / --check")

    return promote(paths, args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
