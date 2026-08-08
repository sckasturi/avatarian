#!/usr/bin/env python3
"""
Regenerate site/js/corpus.js from corpus/attested.json.

The corpus is the list of words somebody has actually SEEN written in
Avatarian. It wins the lookup chain ahead of EXCEPTIONS, and it differs
from everything below it in kind: the others produce a phoneme list and
let the pairing rule decide the blocks, while a corpus entry IS the
finished block structure. `appa` is the proof — canon writes three blocks
where pairing predicts two, and no phoneme list can say that.

It ships as generated JS for the same reason the glyphs do: the site is
static, works over file://, and has no server to fetch JSON from. Unlike
the pronunciation dictionary this is small enough to load eagerly and
small enough for the wiki gadget to carry.

This module is also the validator, and it is strict on purpose — a corpus
with a guess in it is worse than no corpus:

  * every symbol must exist in the glyph manifest, so an entry can always
    be drawn;
  * the token count must be EVEN, because a spelling is whole blocks and
    the nulls are written out. An odd count means somebody recorded a
    phoneme list instead of a spelling, which is exactly the mistake the
    corpus exists to prevent;
  * keys are normalised the way g2p normalises, so a lookup can't miss;
  * `source` must name a real entry in `sources`.

Run after editing corpus/attested.json:

    python3 tools/build_corpus.py

`check()` and `save()` are also what tools/corpus_server.py calls, so the
workbench and the command line enforce exactly the same rules — there is
no way to write an entry through the UI that the CLI would reject.
"""

import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "corpus" / "attested.json"
IMAGES = ROOT / "corpus" / "sources"
MANIFEST = ROOT / "site" / "assets" / "glyph_manifest.json"
DST = ROOT / "site" / "js" / "corpus.js"

CONFIDENCE = ("certain", "probable", "unclear")
OVERRIDES = ("$", "%")

HEADER = """/* Auto-generated — do not edit by hand.
 * Source: corpus/attested.json    Regenerate: python3 tools/build_corpus.py
 * Or edit it in the workbench: python3 tools/corpus_server.py
 *
 * The attested corpus: words somebody has SEEN written in Avatarian,
 * stored as the finished block structure flattened two-slots-per-block,
 * in IPA. See CORPUS.md.
 *
 * This wins the lookup chain in g2p.js, ahead of EXCEPTIONS. Everything
 * below it produces phonemes and lets pairUp() choose the blocks; these
 * entries already ARE the blocks. Because nulls are written out and the
 * token count is even, pairUp() reproduces them exactly rather than
 * having to be bypassed. */
"""


def symbols():
    """Every IPA symbol that has a glyph, so an entry can always be drawn."""
    return set(json.loads(MANIFEST.read_text(encoding="utf-8")))


def load():
    return json.loads(SRC.read_text(encoding="utf-8"))


def normalise_key(key):
    """
    The lookup key, normalised the way g2p.wordToIPA normalises a word:
    lowercased, anything but a letter or apostrophe dropped. Applied per
    word so a multi-word phrase key survives with single spaces.
    """
    words = []
    for word in str(key).lower().split():
        kept = "".join(c for c in word if c.isalpha() or c == "'")
        if kept:
            words.append(kept)
    return " ".join(words)


def check_spelling(spelling, known, where, errors):
    tokens = str(spelling).split()
    if not tokens:
        errors.append(f"{where}: empty spelling")
        return tokens
    if len(tokens) % 2:
        errors.append(
            f"{where}: {len(tokens)} symbols — a spelling is whole blocks, so "
            f"the count must be even. Write the null out (a trailing "
            f"'∅' is usually what's missing)."
        )
    for token in tokens:
        body = token[:-1] if token[-1:] in OVERRIDES else token
        if body not in known:
            errors.append(f"{where}: no glyph for '{body}' (in '{token}')")
    return tokens


def check(data):
    """
    Validate the whole corpus. Returns (errors, records) where `records`
    is the compiled key -> entry mapping the JS ships. Records are built
    even when there are errors, so a UI can still show what it has.
    """
    known = symbols()
    sources = data.get("sources") or {}
    errors = []
    records = {}

    for entry in data.get("entries") or []:
        raw = entry.get("key", "")
        key = normalise_key(raw)
        where = f"'{raw}'"
        if not key:
            errors.append(f"{where}: key normalises to nothing")
            continue
        if key != raw:
            errors.append(f"{where}: key should be written as '{key}'")
        if key in records:
            errors.append(f"{where}: duplicate key")

        tokens = check_spelling(entry.get("spelling", ""), known, where, errors)

        confidence = entry.get("confidence") or "certain"
        if confidence not in CONFIDENCE:
            errors.append(f"{where}: confidence '{confidence}' is not one of "
                          + "/".join(CONFIDENCE))
        if entry.get("source") not in sources:
            errors.append(f"{where}: source '{entry.get('source')}' is not in sources")

        record = {"ipa": tokens, "source": entry.get("source"),
                  "confidence": confidence}
        if entry.get("gloss"):
            record["gloss"] = entry["gloss"]
        if entry.get("note"):
            record["note"] = entry["note"]
        records[key] = record

    for name, source in sources.items():
        image = source.get("image")
        if image and not (IMAGES / image).exists():
            errors.append(f"source '{name}': image '{image}' is not in "
                          f"{IMAGES.relative_to(ROOT)}/")

    return errors, records


def write_js(sources, records):
    body = json.dumps({"sources": sources, "words": records},
                      ensure_ascii=False, indent=2)
    DST.write_text(f"{HEADER}window.AVATARIAN_CORPUS = {body};\n", encoding="utf-8")
    return DST


def order_entries(data):
    """
    Entries grouped by source in the order the sources are declared, then
    by key. Deterministic, so a save from the workbench produces a small
    diff instead of reshuffling the file.
    """
    order = {name: i for i, name in enumerate(data.get("sources") or {})}
    return sorted(data.get("entries") or [],
                  key=lambda e: (order.get(e.get("source"), 10 ** 6),
                                 normalise_key(e.get("key", ""))))


def save(data):
    """
    Validate, then write both the JSON and the generated JS. Writes
    nothing at all if anything is wrong — a half-saved corpus is worse
    than a rejected edit.

    `_readme` and any other top-level keys are carried through from the
    file on disk, so the notes at the top survive a save from the UI.
    """
    errors, records = check(data)
    if errors:
        return errors, None

    out = load() if SRC.exists() else {}
    out["sources"] = data.get("sources") or {}
    out["entries"] = order_entries(data)
    SRC.parent.mkdir(parents=True, exist_ok=True)
    SRC.write_text(json.dumps(out, ensure_ascii=False, indent=2) + "\n",
                   encoding="utf-8")
    write_js(out["sources"], records)
    return [], records


def main():
    data = load()
    errors, records = check(data)
    if errors:
        print(f"{SRC.relative_to(ROOT)} has {len(errors)} problem(s):",
              file=sys.stderr)
        for e in errors:
            print("  " + e, file=sys.stderr)
        return 1

    write_js(data.get("sources") or {}, records)
    phrases = sum(1 for k in records if " " in k)
    unsure = sum(1 for v in records.values() if v["confidence"] != "certain")
    print(f"Wrote {DST.relative_to(ROOT)} — {len(records)} entries "
          f"({phrases} phrase(s), {unsure} not certain) "
          f"from {len(data.get('sources') or {})} source(s), "
          f"{DST.stat().st_size // 1024} KB")
    return 0


if __name__ == "__main__":
    sys.exit(main())
