"""Customer generation (all randomness lives here).

Customers are generated *before* a run from the seed. Every strategy then
processes the identical list, which is the Common Random Numbers technique:
differences between strategies come from the strategy, not from luck.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from . import layout
from .config import MEDIUM_MAX_ITEMS, SECTIONS, SMALL_MAX_ITEMS, SimulationConfig


Point = tuple[float, float]

# Shopping spots come from their own random stream, so adding or changing the
# layout never shifts the arrivals, baskets or service times drawn from the seed.
PLACEMENT_STREAM = 99


@dataclass(frozen=True)
class SectionVisit:
    section: str
    items: int
    shop_time: float  # minutes spent picking items in this section
    walk_in_time: float  # minutes walking to this section from the previous point
    spot: Point | None = None  # where the customer stands to shop (metres)


@dataclass(frozen=True)
class CustomerProfile:
    id: int
    arrival_time: float
    category: str  # "small" | "medium" | "large"
    items: int
    walk_speed: float  # m/s
    visits: tuple[SectionVisit, ...]
    walk_to_checkout: float  # minutes from last section to the checkout point
    service_time: float  # actual cashier time (hidden from other customers)
    expected_service_time: float  # E[S | n], visible estimate used by SEWT
    # Walking routes as corner points: one into each visit, then one to the checkout
    paths: tuple[tuple[Point, ...], ...] = ()


def basket_category(items: int) -> str:
    if items <= SMALL_MAX_ITEMS:
        return "small"
    if items <= MEDIUM_MAX_ITEMS:
        return "medium"
    return "large"


def generate_arrival_times(
    rng: np.random.Generator, rate: float, duration: float
) -> list[float]:
    """Poisson process: cumulative sum of Exponential(rate) inter-arrival times."""
    times: list[float] = []
    t = 0.0
    while True:
        u = rng.random()
        t += -np.log(1.0 - u) / rate  # inverse transform, 1-u avoids log(0)
        if t > duration:
            return times
        times.append(t)


def generate_arrival_times_thinning(
    rng: np.random.Generator, cfg: SimulationConfig
) -> list[float]:
    """Non-homogeneous Poisson process by thinning (Lewis and Shedler, 1979).

    Candidates are generated at the peak rate lambda_max; a candidate at time t
    is kept with probability lambda(t) / lambda_max.
    """
    lam_max = cfg.peak_arrival_rate()
    times: list[float] = []
    t = 0.0
    while True:
        u = rng.random()
        t += -np.log(1.0 - u) / lam_max
        if t > cfg.duration:
            return times
        if rng.random() <= cfg.arrival_rate_at(t) / lam_max:
            times.append(t)


def sample_items(rng: np.random.Generator, cfg: SimulationConfig) -> int:
    category = rng.choice(3, p=[cfg.p_small, cfg.p_medium, cfg.p_large])
    if category == 0:
        return int(rng.integers(1, SMALL_MAX_ITEMS + 1))
    if category == 1:
        return int(rng.integers(SMALL_MAX_ITEMS + 1, MEDIUM_MAX_ITEMS + 1))
    return int(rng.integers(MEDIUM_MAX_ITEMS + 1, cfg.large_max_items + 1))


def sample_service_time(
    rng: np.random.Generator, cfg: SimulationConfig, items: int
) -> float:
    if cfg.service_model == "exponential":
        return float(rng.exponential(cfg.exp_service_mean))
    scanning = float(
        rng.gamma(shape=items, scale=cfg.scan_time_per_item)
    )  # sum of n Exp(s)
    payment = float(rng.triangular(cfg.payment_min, cfg.payment_mode, cfg.payment_max))
    return scanning + payment


def generate_customers(cfg: SimulationConfig) -> list[CustomerProfile]:
    cfg.validate()
    rng = np.random.default_rng(cfg.seed)
    place = np.random.default_rng([cfg.seed, PLACEMENT_STREAM])
    weights = cfg.normalised_section_weights()
    if cfg.arrival_profile == "constant":
        arrivals = generate_arrival_times(rng, cfg.arrival_rate, cfg.duration)
    else:
        arrivals = generate_arrival_times_thinning(rng, cfg)

    customers: list[CustomerProfile] = []
    for cid, arrival in enumerate(arrivals, start=1):
        items = sample_items(rng, cfg)
        speed = float(rng.uniform(cfg.walk_speed_min, cfg.walk_speed_max))
        split = rng.multinomial(items, weights)

        visits: list[SectionVisit] = []
        paths: list[tuple[Point, ...]] = []
        position = layout.ENTRANCE
        for section, k in zip(SECTIONS, split):
            if k == 0:
                continue
            # A random aisle of the section and a random place along it
            spot = layout.shopping_spot(
                section, int(place.integers(0, len(layout.AISLE_ROWS))), float(place.random())
            )
            path = layout.route(position, spot)
            shop = float(rng.gamma(shape=int(k), scale=cfg.mean_pick_time))  # Erlang(k)
            visits.append(
                SectionVisit(section, int(k), shop, layout.route_minutes(path, speed), spot)
            )
            paths.append(tuple(path))
            position = spot
        to_checkout = layout.route(position, layout.CHECKOUT_POINT)
        paths.append(tuple(to_checkout))

        customers.append(
            CustomerProfile(
                id=cid,
                arrival_time=float(arrival),
                category=basket_category(items),
                items=items,
                walk_speed=speed,
                visits=tuple(visits),
                walk_to_checkout=layout.route_minutes(to_checkout, speed),
                service_time=sample_service_time(rng, cfg, items),
                expected_service_time=cfg.expected_service_time(items),
                paths=tuple(paths),
            )
        )
    return customers
