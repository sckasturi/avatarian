"""
The ink profile — where a glyph's strokes meet a lattice column
(tools/inkprofile.py). It is what lets a join be worked out for any pairing
instead of drawn per pair, so the cases here are the shapes joins actually
have to find: a bar crossing the column, a stroke lying along it, an arc,
and a dot (which a stem never runs into).
"""

import pathlib
import sys
import unittest

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent.parent / "tools"))

import inkprofile as ink

SVG = '<svg viewBox="0 0 100 100">{}</svg>'


class ColumnHits(unittest.TestCase):
    def test_a_crossing_bar_is_a_point(self):
        svg = SVG.format('<path d="M 18 82 L 82 82"/>')
        self.assertEqual(ink.column_hits(svg, 50), [[82, 82]])

    def test_a_stroke_along_the_column_is_a_run(self):
        svg = SVG.format('<path d="M 50 16 L 50 64"/>')
        self.assertEqual(ink.column_hits(svg, 50), [[16, 64]])

    def test_strokes_come_back_top_to_bottom(self):
        svg = SVG.format('<path d="M 18 82 L 82 82"/><path d="M 18 18 L 82 18"/>')
        self.assertEqual(ink.column_hits(svg, 50), [[18, 18], [82, 82]])

    def test_an_arc_is_found_where_it_crosses(self):
        # A semicircle from (18,50) to (82,50) bulging up: its top is y=18.
        svg = SVG.format('<path d="M 18 50 A 32 32 0 0 1 82 50"/>')
        self.assertEqual(ink.column_hits(svg, 50), [[18, 18]])

    def test_a_closed_path_counts_its_closing_edge(self):
        svg = SVG.format('<path d="M 18 18 L 82 18 L 82 82 L 18 82 Z"/>')
        self.assertEqual(ink.column_hits(svg, 18), [[18, 82]])

    def test_dots_are_not_ink(self):
        svg = SVG.format('<circle cx="50" cy="50" r="8"/>')
        self.assertEqual(ink.column_hits(svg, 50), [])

    def test_a_column_with_nothing_on_it_is_empty(self):
        svg = SVG.format('<path d="M 18 18 L 18 82"/>')
        self.assertEqual(ink.column_hits(svg, 50), [])


class ColumnGaps(unittest.TestCase):
    def test_two_loose_ends_either_side_are_a_gap(self):
        svg = SVG.format('<path d="M 34 82 L 18 82 L 18 18 L 82 18 L 82 82 L 66 82"/>')
        self.assertEqual(ink.column_gaps(svg, 50), [[82, 34, 66]])

    def test_a_whole_open_side_is_not_a_gap(self):
        svg = SVG.format('<path d="M 18 82 L 18 18 L 82 18 L 82 82"/>')
        self.assertEqual(ink.column_gaps(svg, 50), [])

    def test_a_closed_shape_has_no_gap(self):
        svg = SVG.format('<path d="M 18 18 L 82 18 L 82 82 L 18 82 Z"/>')
        self.assertEqual(ink.column_gaps(svg, 50), [])


if __name__ == "__main__":
    unittest.main()
