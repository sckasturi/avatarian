"""
Shipping a design into the glyph set (tools/promote.py).

`promote` works by rewriting one entry inside the source of
tools/build_glyphs.py. Editing source with string surgery is the kind of
thing that goes wrong quietly — it once ate the comment above a
neighbouring entry, and once duplicated a comment on every run so an entry
never converged. These pin the edit on a small stand-in source.
"""

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))

import promote                                               # noqa: E402

SRC = '''CONSONANTS = {
    # a note about m
    "m": path("M 0 0"),
    # a note about n
    "n": path("M 1 1"),
}

VOWELS = {
}

PLACEHOLDERS = {
    "p": "p", "b": "b",
}
'''


def design(name, notes=""):
    return {"name": name, "type": "consonant", "grid": [5, 5], "notes": notes,
            "shapes": [{"kind": "path", "closed": False,
                        "nodes": [{"x": 0.5, "y": 0.5},
                                  {"x": 4.5, "y": 4.5, "seg": "line"}]}]}


class EditSource(unittest.TestCase):
    def test_replacing_an_entry_leaves_its_neighbours_whole(self):
        out, what = promote.edit_source(SRC, design("m"))
        self.assertEqual(what["action"], "replaced")
        self.assertNotIn('path("M 0 0")', out)
        self.assertIn("    # a note about m\n", out)
        self.assertIn('    # a note about n\n    "n": path("M 1 1"),\n', out)

    def test_an_edit_converges(self):
        once, _ = promote.edit_source(SRC, design("m"))
        twice, _ = promote.edit_source(once, design("m"))
        self.assertEqual(once, twice)
        noted, _ = promote.edit_source(SRC, design("m", notes="why it is so"))
        again, _ = promote.edit_source(noted, design("m", notes="why it is so"))
        self.assertEqual(noted, again)

    def test_a_new_entry_is_added_and_leaves_the_placeholders(self):
        out, what = promote.edit_source(SRC, design("p"))
        self.assertEqual((what["action"], what["placeholder"]), ("added", True))
        self.assertIn('"p": path(', out.split("VOWELS")[0])
        tail = out.split("PLACEHOLDERS")[1]
        self.assertNotIn('"p"', tail)
        self.assertIn('"b": "b",', tail)

    def test_an_empty_or_unknown_design_is_refused(self):
        with self.assertRaises(promote.PromoteError):
            promote.edit_source(SRC, {"name": "m", "type": "consonant", "shapes": []})
        with self.assertRaises(promote.PromoteError):
            promote.edit_source(SRC, {"name": "m", "type": "nonsense",
                                      "shapes": [1]})


if __name__ == "__main__":
    unittest.main()
