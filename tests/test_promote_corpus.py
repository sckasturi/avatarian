"""
Folding a community submission into the corpus (tools/promote_corpus.py).

A submission is a stranger's JSON. The fold is what decides which of its
fields reach attested.json, so the properties worth pinning are the ones
that keep a submission from saying more than it is allowed to: it cannot
cite a source other than its own, cannot smuggle extra fields in, and
cannot overwrite what an existing source already records.
"""

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))

import build_corpus as bc                                    # noqa: E402
import promote_corpus as pc                                  # noqa: E402


def base():
    return {
        "sources": {"old": {"what": "a letter", "where": "film"}},
        "entries": [{"key": "appa", "spelling": "ɑ ∅ p ∅ ɑ ∅",
                     "source": "old", "confidence": "certain"}],
    }


def submission(**over):
    data = {
        "_submission": {"at": "now", "ua": "a browser"},
        "source": {"name": "submission-abc-1", "what": "a sign",
                   "where": "episode 2", "credit": "a reader"},
        "entries": [{"key": "appa", "spelling": "ɑ ∅ p ∅ ɑ ∅",
                     "source": "old", "confidence": "certain",
                     "evil": "extra"}],
    }
    data.update(over)
    return data


class Fold(unittest.TestCase):
    def test_a_fold_adds_and_leaves_the_base_alone(self):
        before = base()
        out = pc.fold_submission(before, submission())
        self.assertEqual(before, base())                  # not mutated
        self.assertEqual(len(out["entries"]), 2)
        self.assertIn("submission-abc-1", out["sources"])
        errors, records = bc.check(out)
        self.assertEqual(errors, [])
        self.assertEqual(records["appa"]["count"], 2)

    def test_an_entry_cites_its_own_source_whatever_it_claimed(self):
        out = pc.fold_submission(base(), submission())
        self.assertEqual(out["entries"][-1]["source"], "submission-abc-1")

    def test_rename_names_the_source_and_repoints_its_entries(self):
        out = pc.fold_submission(base(), submission(), rename="reddit.7")
        self.assertIn("reddit.7", out["sources"])
        self.assertNotIn("submission-abc-1", out["sources"])
        self.assertEqual(out["entries"][-1]["source"], "reddit.7")

    def test_only_known_fields_survive(self):
        out = pc.fold_submission(base(), submission())
        self.assertNotIn("evil", out["entries"][-1])
        self.assertNotIn("name", out["sources"]["submission-abc-1"])
        self.assertNotIn("_submission", out)

    def test_an_existing_source_keeps_its_fields(self):
        sub = submission(source={"name": "old", "what": "", "credit": "x"})
        out = pc.fold_submission(base(), sub)
        self.assertEqual(out["sources"]["old"],
                         {"what": "a letter", "where": "film", "credit": "x"})

    def test_a_submission_with_nothing_in_it_is_refused(self):
        with self.assertRaises(ValueError):
            pc.fold_submission(base(), submission(entries=[]))
        with self.assertRaises(ValueError):
            pc.fold_submission(base(), submission(source={}))


if __name__ == "__main__":
    unittest.main()
