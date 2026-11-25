"""Physical store layout in metres (x to the right, y downwards).

The same layout drives walking distances in the engine and drawing in the web UI,
so the animation and the model can never disagree.
"""

from __future__ import annotations

import math

STORE_WIDTH = 40.0
STORE_HEIGHT = 25.0

ENTRANCE = (3.0, 23.5)
EXIT = (37.0, 23.5)
CHECKOUT_POINT = (20.0, 12.5)  # where customers decide which counter to join

# Section rectangles: (x, y, width, height)
SECTION_RECTS = {
    "grocery": (2.0, 2.0, 8.5, 7.0),
    "beverages": (11.5, 2.0, 8.0, 7.0),
    "household": (20.5, 2.0, 8.0, 7.0),
    "personal_care": (29.5, 2.0, 8.5, 7.0),
}

COUNTER_Y = 21.0
COUNTER_X_MIN = 7.0
COUNTER_X_MAX = 33.0
QUEUE_SPACING = 0.9  # metres between people in a queue (drawing only)


def section_centre(name: str) -> tuple[float, float]:
    x, y, w, h = SECTION_RECTS[name]
    return (x + w / 2, y + h / 2)


def counter_positions(n: int) -> list[tuple[float, float]]:
    if n == 1:
        return [((COUNTER_X_MIN + COUNTER_X_MAX) / 2, COUNTER_Y)]
    step = (COUNTER_X_MAX - COUNTER_X_MIN) / (n - 1)
    return [(COUNTER_X_MIN + i * step, COUNTER_Y) for i in range(n)]


def distance(p: tuple[float, float], q: tuple[float, float]) -> float:
    return math.hypot(p[0] - q[0], p[1] - q[1])


def walk_minutes(
    p: tuple[float, float], q: tuple[float, float], speed_mps: float
) -> float:
    """T_walk = distance / (60 * v)."""
    return distance(p, q) / (60.0 * speed_mps)


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
        "counters": counter_positions(num_counters),
        "queue_spacing": QUEUE_SPACING,
    }
