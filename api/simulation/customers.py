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


@dataclass(frozen=True)
class SectionVisit:
    section: str
    items: int
    shop_time: float  # minutes spent picking items in this section
    walk_in_time: float  # minutes walking to this section from the previous point


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
    weights = cfg.normalised_section_weights()
    arrivals = generate_arrival_times(rng, cfg.arrival_rate, cfg.duration)

    customers: list[CustomerProfile] = []
    for cid, arrival in enumerate(arrivals, start=1):
        items = sample_items(rng, cfg)
        speed = float(rng.uniform(cfg.walk_speed_min, cfg.walk_speed_max))
        split = rng.multinomial(items, weights)

        visits: list[SectionVisit] = []
        position = layout.ENTRANCE
        for section, k in zip(SECTIONS, split):
            if k == 0:
                continue
            centre = layout.section_centre(section)
            walk = layout.walk_minutes(position, centre, speed)
            shop = float(rng.gamma(shape=int(k), scale=cfg.mean_pick_time))  # Erlang(k)
            visits.append(SectionVisit(section, int(k), shop, walk))
            position = centre

        customers.append(
            CustomerProfile(
                id=cid,
                arrival_time=float(arrival),
                category=basket_category(items),
                items=items,
                walk_speed=speed,
                visits=tuple(visits),
                walk_to_checkout=layout.walk_minutes(
                    position, layout.CHECKOUT_POINT, speed
                ),
                service_time=sample_service_time(rng, cfg, items),
                expected_service_time=cfg.expected_service_time(items),
            )
        )
    return customers
