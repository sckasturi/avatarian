#!/usr/bin/env python3
"""
The corpus validator, and the one thing it must never do: write half.

`build_corpus.check()` is the gate everything goes through — the command
line and the workbench both call it, so a rule that is wrong here is
wrong in both places at once. These tests are mostly about the rules
*rejecting* things, because a corpus with a guess in it is worse than no
corpus, and the failure is silent: a wrong entry renders perfectly.

The staleness check at the end is a different kind of test. `corpus.js`
is generated, and nothing stops somebody committing an edit to
`attested.json` without rebuilding — at which point the site draws one
thing and the source of truth says another.
"""

import copy
import json
import pathlib
import sys
import tempfile
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))

import build_corpus as bc                                    # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent


def valid():
    """A minimal corpus that passes, as the base for each rejection case."""
    return {
        "sources": {"a-source": {"what": "a thing", "where": "somewhere"}},
        "entries": [
            {"key": "appa", "spelling": "ɑ ∅ p ∅ ɑ ∅",
             "source": "a-source", "confidence": "certain"},
        ],
    }


class Rules(unittest.TestCase):
    def assert_rejects(self, data, fragment):
        errors, _ = bc.check(data)
        self.assertTrue(errors, f"expected a problem mentioning {fragment!r}")
        joined = " | ".join(errors)
        self.assertIn(fragment, joined)

    def test_a_valid_corpus_passes(self):
        errors, records = bc.check(valid())
        self.assertEqual(errors, [])
        self.assertEqual(records["appa"]["ipa"], ["ɑ", "∅", "p", "∅", "ɑ", "∅"])

    def test_odd_symbol_count_is_rejected(self):
        # The one mistake that would quietly poison the data: a phoneme
        # list recorded where a spelling was meant. It renders fine.
        data = valid()
        data["entries"][0]["spelling"] = "t ɑ f"
        self.assert_rejects(data, "must be even")

    def test_a_symbol_with_no_glyph_is_rejected(self):
        data = valid()
        data["entries"][0]["spelling"] = "t ɑ f ʘ"
        self.assert_rejects(data, "no glyph")

    def test_an_override_does_not_hide_an_unknown_symbol(self):
        data = valid()
        data["entries"][0]["spelling"] = "ʘ$ t"
        self.assert_rejects(data, "no glyph")

    def test_a_key_needing_normalisation_is_rejected(self):
        # Not silently normalised: an entry whose key does not match the
        # form its own lookup uses would be present and unreachable.
        data = valid()
        data["entries"][0]["key"] = "Appa!"
        self.assert_rejects(data, "should be written as 'appa'")

    def test_a_duplicate_key_is_rejected(self):
        data = valid()
        data["entries"].append(copy.deepcopy(data["entries"][0]))
        self.assert_rejects(data, "duplicate key")

    def test_an_unknown_source_is_rejected(self):
        data = valid()
        data["entries"][0]["source"] = "nowhere"
        self.assert_rejects(data, "is not in sources")

    def test_a_bad_confidence_is_rejected(self):
        data = valid()
        data["entries"][0]["confidence"] = "pretty sure"
        self.assert_rejects(data, "confidence")

    def test_a_missing_image_is_rejected(self):
        # The image is provenance. A source citing one that isn't there
        # is a citation to nothing, which is the state this whole tool
        # exists to get out of.
        data = valid()
        data["sources"]["a-source"]["image"] = "not-here.png"
        self.assert_rejects(data, "is not in")

    def test_an_empty_spelling_is_rejected(self):
        data = valid()
        data["entries"][0]["spelling"] = "   "
        self.assert_rejects(data, "empty spelling")

    def test_phrase_keys_are_allowed(self):
        data = valid()
        data["entries"][0]["key"] = "ba sing se"
        errors, records = bc.check(data)
        self.assertEqual(errors, [])
        self.assertIn("ba sing se", records)


class Saving(unittest.TestCase):
    """`save()` must write everything or nothing."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        tmp = pathlib.Path(self.tmp.name)
        self.src, self.dst = bc.SRC, bc.DST
        bc.SRC = tmp / "attested.json"
        bc.DST = tmp / "corpus.js"
        bc.SRC.write_text(json.dumps(
            {"_readme": ["keep me"], **valid()}, ensure_ascii=False), encoding="utf-8")

    def tearDown(self):
        bc.SRC, bc.DST = self.src, self.dst
        self.tmp.cleanup()

    def test_a_rejected_save_writes_nothing(self):
        before = bc.SRC.read_text(encoding="utf-8")
        data = valid()
        data["entries"][0]["spelling"] = "t ɑ f"          # odd
        errors, records = bc.save(data)
        self.assertTrue(errors)
        self.assertIsNone(records)
        self.assertEqual(bc.SRC.read_text(encoding="utf-8"), before,
                         "a rejected save modified the file")
        self.assertFalse(bc.DST.exists(), "a rejected save generated JS")

    def test_a_good_save_writes_both_files(self):
        errors, records = bc.save(valid())
        self.assertEqual(errors, [])
        self.assertIn("appa", records)
        self.assertTrue(bc.DST.exists())
        self.assertIn("AVATARIAN_CORPUS", bc.DST.read_text(encoding="utf-8"))

    def test_saving_keeps_the_notes_at_the_top_of_the_file(self):
        # The workbench posts sources and entries; everything else in the
        # file has to survive being written by a tool that doesn't know
        # about it.
        bc.save(valid())
        self.assertEqual(
            json.loads(bc.SRC.read_text(encoding="utf-8"))["_readme"], ["keep me"])

    def test_entries_are_written_in_a_stable_order(self):
        # So a save from the UI produces a small diff instead of
        # reshuffling the file.
        data = valid()
        data["sources"]["b-source"] = {"what": "", "where": ""}
        data["entries"] = [
            {"key": "zebra", "spelling": "z i", "source": "b-source"},
            {"key": "apple", "spelling": "æ p", "source": "a-source"},
            {"key": "acorn", "spelling": "e k", "source": "a-source"},
        ]
        bc.save(data)
        first = bc.SRC.read_text(encoding="utf-8")
        bc.save(json.loads(first))
        self.assertEqual(first, bc.SRC.read_text(encoding="utf-8"),
                         "saving twice changed the file")
        keys = [e["key"] for e in json.loads(first)["entries"]]
        self.assertEqual(keys, ["acorn", "apple", "zebra"],
                         "grouped by source order, then by key")


class Freshness(unittest.TestCase):
    def test_the_generated_corpus_matches_the_source(self):
        # site/js/corpus.js is generated. Nothing stops an edit to
        # attested.json being committed without a rebuild, and the
        # symptom is the site drawing something the source of truth
        # disagrees with.
        data = bc.load()
        errors, records = bc.check(data)
        self.assertEqual(errors, [], "the committed corpus does not validate")

        text = bc.DST.read_text(encoding="utf-8")
        start = text.index("{", text.index("AVATARIAN_CORPUS"))
        shipped = json.loads(text[start:text.rindex("}") + 1])

        # Name the entries that differ. Asserting the two dicts against
        # each other produces a six-thousand-character diff that unittest
        # then truncates, which tells you something is wrong and nothing
        # about what.
        differing = sorted(
            set(shipped["words"]) ^ set(records)
            | {k for k in set(shipped["words"]) & set(records)
               if shipped["words"][k] != records[k]}
        )
        self.assertEqual(
            differing, [],
            "site/js/corpus.js is stale — run tools/build_corpus.py.\n"
            "  differs on: " + ", ".join(differing))

        self.assertEqual(
            sorted(shipped["sources"]), sorted(data.get("sources") or {}),
            "site/js/corpus.js has a different source list — "
            "run tools/build_corpus.py")


if __name__ == "__main__":
    unittest.main(verbosity=2)
