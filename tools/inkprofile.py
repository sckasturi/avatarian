#!/usr/bin/env python3
"""
Where a glyph's ink sits along a lattice column — the "ink profile" that
lets one glyph's stroke reach another's without anyone drawing the pair.

A JOIN (render.js `joinsFor`, AVATARIAN.md §11) is a straight stroke that
grows from an EMITTER — a design node carrying `connect: up|down` — across
the block seam until it meets the partner glyph's ink. To know where that
is, the build walks each glyph's finished SVG once and records, for every
column an emitter can sit on, the y of each stroke that column crosses:

    column_hits(svg, 50)  ->  [[18, 18], [42, 42], [58, 82]]

Each entry is an interval [y0, y1] in the glyph's own viewBox units,
top to bottom. A stroke crossing the column is a point (y0 == y1); a
vertical stroke lying ON the column is a run. Dots are not ink: a stem
runs to a stroke, never into a dot, and a dot standing in the column
blocks the join instead (`column_dots`).

That is one small list per glyph form — data that grows with the number
of glyphs, not with the number of pairs — and it is all the renderer (and
the wiki's Lua port) needs to work a join out for any pairing.
"""

import math
import re

STEP = 0.4          # sampling step along a path, viewBox units
NEAR = 1.0          # a sample this close to the column counts as on it
GAP = 2.0           # samples further apart than this are separate strokes
POINT = 8.0         # a run shorter than this is a crossing, kept as a point
ON = 0.1            # a sample this close is ON the column, not merely near it

_TOKEN = re.compile(r"[MLACZmlacz]|-?\d*\.?\d+(?:[eE][-+]?\d+)?")


def _arc(p0, rx, ry, rot, large, sweep, p1):
    """Sample an SVG elliptical arc (endpoint form) from p0 to p1."""
    (x0, y0), (x1, y1) = p0, p1
    if rx == 0 or ry == 0 or (x0 == x1 and y0 == y1):
        return [p1]
    phi = math.radians(rot)
    cp, sp = math.cos(phi), math.sin(phi)
    dx, dy = (x0 - x1) / 2, (y0 - y1) / 2
    xp, yp = cp * dx + sp * dy, -sp * dx + cp * dy
    rx, ry = abs(rx), abs(ry)
    lam = xp * xp / (rx * rx) + yp * yp / (ry * ry)
    if lam > 1:
        rx, ry = rx * math.sqrt(lam), ry * math.sqrt(lam)
    num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp
    den = rx * rx * yp * yp + ry * ry * xp * xp
    k = math.sqrt(max(0.0, num / den)) if den else 0.0
    if large == sweep:
        k = -k
    cxp, cyp = k * rx * yp / ry, -k * ry * xp / rx
    cx = cp * cxp - sp * cyp + (x0 + x1) / 2
    cy = sp * cxp + cp * cyp + (y0 + y1) / 2

    def angle(ux, uy, vx, vy):
        a = math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
        return a

    t0 = angle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry)
    dt = angle((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry)
    if not sweep and dt > 0:
        dt -= 2 * math.pi
    elif sweep and dt < 0:
        dt += 2 * math.pi
    n = max(2, int(abs(dt) * max(rx, ry) / STEP))
    out = []
    for i in range(1, n + 1):
        t = t0 + dt * i / n
        ex, ey = rx * math.cos(t), ry * math.sin(t)
        out.append((cp * ex - sp * ey + cx, sp * ex + cp * ey + cy))
    return out


def _line(p0, p1):
    n = max(1, int(math.hypot(p1[0] - p0[0], p1[1] - p0[1]) / STEP))
    return [(p0[0] + (p1[0] - p0[0]) * i / n, p0[1] + (p1[1] - p0[1]) * i / n)
            for i in range(1, n + 1)]


def _cubic(p0, c1, c2, p1):
    chord = (math.hypot(c1[0] - p0[0], c1[1] - p0[1])
             + math.hypot(c2[0] - c1[0], c2[1] - c1[1])
             + math.hypot(p1[0] - c2[0], p1[1] - c2[1]))
    n = max(2, int(chord / STEP))
    out = []
    for i in range(1, n + 1):
        t = i / n
        a, b, c, d = (1 - t) ** 3, 3 * (1 - t) ** 2 * t, 3 * (1 - t) * t * t, t ** 3
        out.append((a * p0[0] + b * c1[0] + c * c2[0] + d * p1[0],
                    a * p0[1] + b * c1[1] + c * c2[1] + d * p1[1]))
    return out


def path_points(d):
    """Every sample point along one path `d` (absolute M L A C Z only — the
    commands glyphspec emits)."""
    toks = _TOKEN.findall(d)
    pts, i, cur, start, cmd = [], 0, (0.0, 0.0), (0.0, 0.0), None

    def take(n):
        nonlocal i
        vals = [float(t) for t in toks[i:i + n]]
        i += n
        return vals

    while i < len(toks):
        if toks[i].isalpha():
            cmd = toks[i]
            i += 1
            if cmd in "Zz":
                pts += _line(cur, start)
                cur = start
            continue
        if cmd == "M":
            cur = start = tuple(take(2))
            pts.append(cur)
            cmd = "L"                      # further pairs are implicit lineto
        elif cmd == "L":
            p = tuple(take(2))
            pts += _line(cur, p)
            cur = p
        elif cmd == "A":
            rx, ry, rot, large, sweep, x, y = take(7)
            pts += _arc(cur, rx, ry, rot, bool(large), bool(sweep), (x, y))
            cur = (x, y)
        elif cmd == "C":
            x1, y1, x2, y2, x, y = take(6)
            pts += _cubic(cur, (x1, y1), (x2, y2), (x, y))
            cur = (x, y)
        else:
            raise ValueError(f"path command {cmd!r} is not one glyphspec emits")
    return pts


def column_hits(svg, x):
    """The [y0, y1] intervals where the strokes of `svg` meet column `x`,
    sorted top to bottom, as whole viewBox units."""
    near = sorted((py, abs(px - x)) for d in re.findall(r'<path[^>]* d="([^"]+)"', svg)
                  for px, py in path_points(d) if abs(px - x) <= NEAR)
    runs = []
    for y, off in near:
        if runs and y - runs[-1][-1][0] <= GAP:
            runs[-1].append((y, off))
        else:
            runs.append([(y, off)])
    out = []
    for run in runs:
        a, b = run[0][0], run[-1][0]
        if b - a >= POINT:
            # A long run is a stroke lying ON the column — or a curve that only
            # brushes it (the side of /m/'s ring). The curve stays within NEAR
            # for a long way but is truly on the column at one place; keep
            # that place, so a rail or join meets it flush and not a unit shy.
            on = [y for y, off in run if off <= ON]
            if on and on[-1] - on[0] >= POINT:
                out.append([round(on[0]), round(on[-1])])
                continue
            if on:
                a, b = on[0], on[-1]
            else:
                a = b = min(run, key=lambda s: s[1])[0]
        mid = round((a + b) / 2)
        out.append([mid, mid])
    return out


def column_dots(svg, x, half_stroke=4.5):
    """The [y0, y1] extent of every dot a stroke running down column `x`
    would touch, top to bottom, as whole viewBox units. A join does not run
    through a dot, so these BLOCK it rather than receive it."""
    out = []
    for tag in re.findall(r"<circle[^>]*>", svg):
        attr = dict(re.findall(r'(\w+)="([^"]*)"', tag))
        cx, cy, r = (float(attr.get(k, 0)) for k in ("cx", "cy", "r"))
        if abs(cx - x) < r + half_stroke:
            out.append([round(cy - r), round(cy + r)])
    return sorted(out)


def column_gaps(svg, x, reach=20.0):
    """The [y, x0, x1] of every GAP a stroke leaves open across column `x`:
    two loose stroke ends at one height, one each side of the column and
    each within `reach` of it — the mouth in the foot of /g/. A stem that
    arrives there closes it: the join runs to that height and a bar is drawn
    across from end to end, so /g/ over a stem reads as a full square."""
    ends = []
    for d in re.findall(r'<path[^>]* d="([^"]+)"', svg):
        if re.search(r"[Zz]", d):
            continue
        pts = path_points(d)
        ends += [pts[0], pts[-1]]
    hits = column_hits(svg, x)
    out = []
    for i, (ax, ay) in enumerate(ends):
        for bx, by in ends[i + 1:]:
            lo, hi = min(ax, bx), max(ax, bx)
            if abs(ay - by) > 1 or not (lo < x < hi):
                continue
            if x - lo > reach or hi - x > reach:
                continue
            y = round((ay + by) / 2)
            if any(p - 1 <= y <= q + 1 for p, q in hits):
                continue                    # already ink there, nothing to close
            out.append([y, round(lo), round(hi)])
    return sorted(out)


if __name__ == "__main__":
    import pathlib
    import sys
    for name in sys.argv[1:]:
        svg = pathlib.Path(name).read_text(encoding="utf-8")
        print(name, column_hits(svg, 50))
