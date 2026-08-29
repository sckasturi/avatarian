"""
Connection strokes — a node's `connect` direction grows a stroke to the
glyph's edge so it meets the block partner at the seam (glyphspec.py).

The geom.js port is checked against these same functions byte-for-byte by
tools/check_geom.py; this pins the behaviour itself — where the stroke
lands and that a plain node adds nothing.
"""

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))

import glyphspec as g


class EdgeTarget(unittest.TestCase):
    def test_cardinals_run_to_the_facing_edge(self):
        self.assertEqual(g._edge_target(2.5, 3, 0, 1, 5, 5), (2.5, 5.0))   # down
        self.assertEqual(g._edge_target(2.5, 2, 0, -1, 5, 5), (2.5, 0.0))  # up
        self.assertEqual(g._edge_target(3, 2, -1, 0, 5, 5), (0.0, 2.0))    # left
        self.assertEqual(g._edge_target(1, 2, 1, 0, 5, 5), (5.0, 2.0))     # right

    def test_diagonal_stops_at_whichever_edge_comes_first(self):
        # down-right from (4,2): x reaches 5 at t=1 before y reaches 5 (t=3)
        self.assertEqual(g._edge_target(4, 2, 1, 1, 5, 5), (5.0, 3.0))

    def test_a_node_already_on_the_edge_does_not_extend(self):
        # y is already at the bottom, so "down" has nowhere to go.
        self.assertEqual(g._edge_target(2.5, 5, 0, 1, 5, 5), (2.5, 5.0))


class Body(unittest.TestCase):
    def _cons(self, connect=None):
        node = {"x": 2.5, "y": 3, "seg": "line"}
        if connect:
            node["connect"] = connect
        return {"type": "consonant", "grid": [5, 5], "shapes": [
            {"kind": "path", "closed": False,
             "nodes": [{"x": 2.5, "y": 1}, node]}]}

    def test_connect_adds_the_extension_stroke(self):
        body = g.body(self._cons("down"))
        # the drawn stroke, then the extension from the node to the edge
        self.assertIn('<path d="M 50 26 L 50 58"/>', body)
        self.assertIn('<path d="M 50 58 L 50 90"/>', body)

    def test_a_plain_node_adds_nothing(self):
        self.assertEqual(g.body(self._cons()).count("<path"), 1)

    def test_an_unknown_direction_is_ignored(self):
        self.assertEqual(g.body(self._cons("sideways")).count("<path"), 1)


if __name__ == "__main__":
    unittest.main()
