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

    ONE ENTRY IS ONE SIGHTING, not one word. A word seen in two sources
    is two entries, and that used to be a "duplicate key" error — which
    meant the only way to record a second sighting was to overwrite the
    first. For a file whose whole job is preserving observations, that
    was exactly backwards.

    So the unique thing is (key, source, spelling), and entries sharing a
    key are GROUPED here rather than rejected:

      same spelling, another source   corroboration. Counted, and the
                                      count is the point — a word seen on
                                      three posters is stronger evidence
                                      than one seen once.
      a different spelling            a conflict, and both are kept as
                                      alternates. Nothing is overwritten,
                                      ever. Two sources disagreeing is a
                                      finding about the script, and
                                      deleting one of them destroys it.

    The record still carries `ipa`, so the lookup chain is unchanged:
    `count`, `sources`, `alternates` and `contested` are additive. The
    rendered spelling is the most-attested one, ties broken by confidence
    and then by the order sources are declared in — deterministic, so a
    rebuild never reshuffles the site.
    """
    known = symbols()
    sources = data.get("sources") or {}
    errors = []
    grouped = {}
    seen = set()

    source_order = {name: i for i, name in enumerate(sources)}

    for entry in data.get("entries") or []:
        raw = entry.get("key", "")
        key = normalise_key(raw)
        where = f"'{raw}'"
        if not key:
            errors.append(f"{where}: key normalises to nothing")
            continue
        if key != raw:
            errors.append(f"{where}: key should be written as '{key}'")

        tokens = check_spelling(entry.get("spelling", ""), known, where, errors)

        confidence = entry.get("confidence") or "certain"
        if confidence not in CONFIDENCE:
            errors.append(f"{where}: confidence '{confidence}' is not one of "
                          + "/".join(CONFIDENCE))
        source = entry.get("source")
        if source not in sources:
            errors.append(f"{where}: source '{source}' is not in sources")

        # The same word, spelled the same way, cited to the same source
        # twice is not corroboration — it is the same observation entered
        # twice, and counting it would inflate the evidence.
        fingerprint = (key, source, " ".join(tokens))
        if fingerprint in seen:
            errors.append(f"{where}: already recorded from source "
                          f"'{source}' with this spelling")
            continue
        seen.add(fingerprint)

        # How many times this exact spelling appears in that one source.
        # A word written three times on one poster is three observations
        # of the spelling — enough to rule out a slip of the pen — so it
        # is counted. It is NOT three sources, and the two are tracked
        # separately for exactly that reason.
        times = entry.get("times", 1)
        if not isinstance(times, int) or isinstance(times, bool) or times < 1:
            errors.append(f"{where}: times must be a whole number 1 or more, "
                          f"not {times!r}")
            times = 1

        grouped.setdefault(key, []).append({
            "ipa": tokens,
            "source": source,
            "confidence": confidence,
            "times": times,
            "gloss": entry.get("gloss") or "",
            "note": entry.get("note") or "",
        })

    records = {key: compile_record(sightings, source_order)
               for key, sightings in grouped.items()}

    for name, source in sources.items():
        image = source.get("image")
        if image and not (IMAGES / image).exists():
            errors.append(f"source '{name}': image '{image}' is not in "
                          f"{IMAGES.relative_to(ROOT)}/")

    return errors, records


def confidence_rank(value):
    """
    How much a sighting counts for, best first.

    An unrecognised value ranks last rather than raising: `check` reports
    it as an error but still has to finish building the records, because
    the workbench shows what it has alongside the problems.
    """
    try:
        return CONFIDENCE.index(value)
    except ValueError:
        return len(CONFIDENCE)


def compile_record(sightings, source_order):
    """
    Every sighting of one word, folded into the record the site ships.

    Sightings are bucketed by spelling; each bucket is one candidate with
    its own count and sources. The winner is the most-attested candidate,
    and `alternates` holds the rest — present only when they exist, so a
    word nobody disagrees about carries no extra weight in the file.
    """
    buckets = {}
    for s in sightings:
        buckets.setdefault(" ".join(s["ipa"]), []).append(s)

    candidates = []
    for spelling, group in buckets.items():
        best = min(group, key=lambda s: confidence_rank(s["confidence"]))
        candidates.append({
            "ipa": group[0]["ipa"],
            # Every time the spelling was seen, repeats within one source
            # included; and the distinct sources it was seen in.
            "count": sum(s["times"] for s in group),
            "sources": [s["source"] for s in group],
            "confidence": best["confidence"],
            "_order": min(source_order.get(s["source"], 10 ** 6) for s in group),
        })

    # INDEPENDENT SOURCES RANK FIRST, total sightings only after that.
    # A word written five times on one poster is one hand agreeing with
    # itself; written once each on two posters, it is two. Ranking by the
    # raw total would let a single repetitive source outvote genuine
    # corroboration, which is the failure this whole file exists to
    # prevent. Then the most confident, then the earliest source — which
    # is arbitrary, but stable, so a rebuild never reshuffles the site.
    candidates.sort(key=lambda c: (-len(c["sources"]),
                                   -c["count"],
                                   confidence_rank(c["confidence"]),
                                   c["_order"]))
    for c in candidates:
        del c["_order"]

    winner, alternates = candidates[0], candidates[1:]
    record = {
        "ipa": winner["ipa"],
        "count": winner["count"],
        "sources": winner["sources"],
        "confidence": winner["confidence"],
        # Kept for anything still reading the old shape: the first source
        # that attests the spelling actually being drawn.
        "source": winner["sources"][0],
    }
    if alternates:
        record["alternates"] = alternates
        record["contested"] = True

    # A gloss or note belongs to the word, not to one sighting of it.
    for field in ("gloss", "note"):
        values = [s[field] for s in sightings if s[field]]
        if values:
            record[field] = values[0] if len(values) == 1 else " · ".join(
                dict.fromkeys(values))
    return record


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
    sightings = len(data.get("entries") or [])
    contested = [k for k, v in records.items() if v.get("contested")]
    print(f"Wrote {DST.relative_to(ROOT)} — {len(records)} words "
          f"from {sightings} sighting(s) "
          f"({phrases} phrase(s), {unsure} not certain) "
          f"across {len(data.get('sources') or {})} source(s), "
          f"{DST.stat().st_size // 1024} KB")
    # Contested words are the interesting output of having a corpus at
    # all, so they are named rather than counted.
    if contested:
        print(f"  {len(contested)} contested — sources disagree on the "
              f"spelling: {', '.join(sorted(contested))}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
