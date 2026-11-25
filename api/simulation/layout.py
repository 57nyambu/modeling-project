"""Physical store layout and walkways, in metres (x to the right, y downwards).

The same layout drives walking distances in the engine and drawing in the web UI,
so the animation and the model can never disagree.

Walkway network
---------------
Customers cannot walk through shelving. Each section has two shelving runs
(gondolas), which leave three aisles. The aisles line up across all four
sections, so each aisle row runs the full width of the store. Customers change
aisle row only at a cross-aisle: at the outer ends of the shelving and in the
gaps between sections. In front of the sections is open floor (the main aisle)
that leads to the checkouts, and a walkway on the left leads up from the
entrance.

A walk is the shortest path on this network. Its length L gives the walking time
T_walk = L / (60 v), with v the customer's speed in metres per second.
"""

from __future__ import annotations

import math
from itertools import pairwise

Point = tuple[float, float]

STORE_WIDTH = 40.0
STORE_HEIGHT = 25.0

ENTRANCE = (3.0, 23.5)
EXIT = (37.0, 23.5)
CHECKOUT_POINT = (20.0, 12.5)  # where customers decide which counter to join

# Section rectangles: (x, y, width, height). All share y and height, so their
# aisles line up.
SECTION_RECTS = {
    "grocery": (2.0, 2.0, 8.5, 7.0),
    "beverages": (11.5, 2.0, 8.0, 7.0),
    "household": (20.5, 2.0, 8.0, 7.0),
    "personal_care": (29.5, 2.0, 8.5, 7.0),
}

HEADER_DEPTH = 1.2  # department sign strip along the back of each section
GONDOLA_DEPTH = 0.7  # depth of one shelving run
GONDOLA_INSET = 0.8  # gap between a shelving run and the section's side edge
SPOT_MARGIN = 1.1  # shopping spots stay this far from a section's side edges

COUNTER_Y = 21.0
COUNTER_X_MIN = 7.0
COUNTER_X_MAX = 33.0
QUEUE_SPACING = 0.8  # metres between people in a queue (drawing only)

# Walkway from the entrance up the left side of the store to the open floor.
ENTRY_TURN = (ENTRANCE[0], CHECKOUT_POINT[1])
# After paying, customers walk below the counters to the exit (drawing only).
EXIT_WALK_Y = 23.4


def _section_geometry() -> tuple[list[float], list[float]]:
    """Aisle centre lines and shelving tops, identical for every section."""
    _, y, _, h = next(iter(SECTION_RECTS.values()))
    top = y + HEADER_DEPTH
    gap = (h - HEADER_DEPTH - 2 * GONDOLA_DEPTH) / 3
    aisles = [top + gap * i + GONDOLA_DEPTH * i + gap / 2 for i in range(3)]
    shelves = [top + gap * (i + 1) + GONDOLA_DEPTH * i for i in range(2)]
    return aisles, shelves


AISLE_ROWS, _SHELF_TOPS = _section_geometry()  # y of aisles 0 (back), 1, 2 (front)
FRONT_ROW = 2  # the front aisle opens onto the main aisle


def _cross_aisles() -> list[float]:
    rects = sorted(SECTION_RECTS.values())
    xs = [rects[0][0] + GONDOLA_INSET / 2]
    for (ax, _, aw, _), (bx, _, _, _) in pairwise(rects):
        xs.append((ax + aw + bx) / 2)
    last = rects[-1]
    xs.append(last[0] + last[2] - GONDOLA_INSET / 2)
    return xs


CROSS_AISLES = _cross_aisles()  # x positions where customers can change aisle row


def gondolas(name: str) -> list[tuple[float, float, float, float]]:
    """The two shelving runs of a section as (x, y, width, height)."""
    x, _, w, _ = SECTION_RECTS[name]
    return [(x + GONDOLA_INSET, top, w - 2 * GONDOLA_INSET, GONDOLA_DEPTH) for top in _SHELF_TOPS]


def shopping_spot(name: str, row: int, u: float) -> Point:
    """Where a customer stands to shop: aisle `row` of the section, a fraction u along it."""
    x, _, w, _ = SECTION_RECTS[name]
    return (x + SPOT_MARGIN + u * (w - 2 * SPOT_MARGIN), AISLE_ROWS[row])


def counter_positions(n: int) -> list[Point]:
    if n == 1:
        return [((COUNTER_X_MIN + COUNTER_X_MAX) / 2, COUNTER_Y)]
    step = (COUNTER_X_MAX - COUNTER_X_MIN) / (n - 1)
    return [(COUNTER_X_MIN + i * step, COUNTER_Y) for i in range(n)]


def distance(p: Point, q: Point) -> float:
    return math.hypot(p[0] - q[0], p[1] - q[1])


def path_length(path: list[Point] | tuple[Point, ...]) -> float:
    return sum(distance(p, q) for p, q in pairwise(path))


def route_minutes(path: list[Point] | tuple[Point, ...], speed_mps: float) -> float:
    """T_walk = L / (60 * v), where L is the length of the route in metres."""
    return path_length(path) / (60.0 * speed_mps)


# --------------------------------------------------------------------------- #
# Routing
# --------------------------------------------------------------------------- #
def _row(p: Point) -> int | None:
    """Index of the aisle row the point stands in, or None for the open floor."""
    for i, y in enumerate(AISLE_ROWS):
        if abs(p[1] - y) < 1e-9:
            return i
    return None


def _clean(path: list[Point]) -> list[Point]:
    """Drop repeated points and points that do not change direction."""
    out: list[Point] = []
    for p in path:
        if out and distance(out[-1], p) < 1e-9:
            continue
        if len(out) >= 2:
            (ax, ay), (bx, by) = out[-2], out[-1]
            if abs((bx - ax) * (p[1] - ay) - (by - ay) * (p[0] - ax)) < 1e-9 and (
                (bx - ax) * (p[0] - bx) + (by - ay) * (p[1] - by) >= 0
            ):
                out[-1] = p  # collinear and same direction
                continue
        out.append(p)
    return out


def _shortest(candidates: list[list[Point]], target: Point) -> list[Point]:
    # Ties (several cross-aisles give the same length) go to the change of row
    # nearest the target, so customers stay in their aisle as long as possible.
    def key(path: list[Point]) -> tuple[float, float]:
        turn = path[-2] if len(path) >= 2 else path[-1]
        return (round(path_length(path), 9), abs(turn[0] - target[0]))

    return _clean(min(candidates, key=key))


def _floor_to_spot(p: Point, spot: Point) -> list[Point]:
    """From a point on the open floor into an aisle."""
    row = _row(spot)
    if row == FRONT_ROW:
        return [p, spot]  # the front aisle opens onto the main aisle
    y_front = AISLE_ROWS[FRONT_ROW]
    return _shortest(
        [[p, (v, y_front), (v, spot[1]), spot] for v in CROSS_AISLES], spot
    )


def route(a: Point, b: Point) -> list[Point]:
    """Shortest walk from a to b along the walkways, as a list of corner points.

    a and b are the entrance, a shopping spot (a point on an aisle row) or a
    point on the open floor such as the checkout decision point.
    """
    if a == ENTRANCE:
        return _clean([ENTRANCE, *route(ENTRY_TURN, b)])
    if b == ENTRANCE:
        return list(reversed(route(b, a)))
    ra, rb = _row(a), _row(b)
    if ra is None and rb is None:
        return [a, b]  # the open floor has no obstacles
    if ra is None:
        return _floor_to_spot(a, b)
    if rb is None:
        return list(reversed(_floor_to_spot(b, a)))
    if ra == rb:
        return [a, b]  # aisle rows run the full width of the store
    return _shortest([[a, (v, a[1]), (v, b[1]), b] for v in CROSS_AISLES], b)


def example_route() -> dict:
    """A representative customer's walk, used by the layout diagram."""
    spots = [
        ("grocery", shopping_spot("grocery", 1, 0.55)),
        ("household", shopping_spot("household", 0, 0.35)),
        ("personal_care", shopping_spot("personal_care", FRONT_ROW, 0.6)),
    ]
    points = [ENTRANCE] + [p for _, p in spots] + [CHECKOUT_POINT]
    return {
        "stops": [{"section": name, "point": p} for name, p in spots],
        "paths": [route(p, q) for p, q in pairwise(points)],
    }


def layout_dict(num_counters: int) -> dict:
    return {
        "width": STORE_WIDTH,
        "height": STORE_HEIGHT,
        "entrance": ENTRANCE,
        "exit": EXIT,
        "checkout_point": CHECKOUT_POINT,
        "sections": {
            k: {"x": r[0], "y": r[1], "w": r[2], "h": r[3]}
            for k, r in SECTION_RECTS.items()
        },
        "shelves": {
            k: [{"x": g[0], "y": g[1], "w": g[2], "h": g[3]} for g in gondolas(k)]
            for k in SECTION_RECTS
        },
        "header_depth": HEADER_DEPTH,
        "aisle_rows": AISLE_ROWS,
        "cross_aisles": CROSS_AISLES,
        "entry_turn": ENTRY_TURN,
        "exit_walk_y": EXIT_WALK_Y,
        "counters": counter_positions(num_counters),
        "queue_spacing": QUEUE_SPACING,
    }
