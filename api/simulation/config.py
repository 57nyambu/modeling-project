"""Simulation parameters.

Every input to the model lives in one dataclass so a run is fully described by
(config, strategy). Times are in minutes; walking speeds are in metres/second.
"""

from __future__ import annotations

import math
from dataclasses import asdict, dataclass, field, fields

SECTIONS = ("grocery", "beverages", "household", "personal_care")
SECTION_LABELS = {
    "grocery": "Grocery",
    "beverages": "Beverages",
    "household": "Household",
    "personal_care": "Personal Care",
}

# Basket category limits (from the project brief).
SMALL_MAX_ITEMS = 5
MEDIUM_MAX_ITEMS = 15
EXPRESS_ITEM_LIMIT = 5  # customers with <= 5 items use express counters (Strategy 3)

ARRIVAL_PROFILES = ("constant", "peak")
SERVICE_MODELS = ("items", "exponential")
STRING_FIELDS = {"arrival_profile", "service_model"}
INT_FIELDS = {"seed", "num_counters", "num_express", "large_max_items"}


def _default_section_weights() -> dict[str, float]:
    return {
        "grocery": 0.40,
        "beverages": 0.20,
        "household": 0.20,
        "personal_care": 0.20,
    }


@dataclass
class SimulationConfig:
    # Run control
    duration: float = 240.0  # run length T (minutes)
    seed: int = 42

    # Arrivals: Poisson process, rate lambda (customers per minute).
    # "constant": homogeneous Poisson process with rate lambda.
    # "peak": non-homogeneous Poisson process with a mid-run peak,
    #   lambda(t) = lambda * ((1 - A/2) + A * sin^2(pi * t / T)),
    #   whose average over [0, T] is still lambda (see docs/03 section 3.2).
    arrival_rate: float = 1.4
    arrival_profile: str = "constant"
    peak_amplitude: float = 1.0  # A: 0 = flat, 1 = 0.5x at open/close and 1.5x at the peak

    # Checkout resources
    num_counters: int = 4
    num_express: int = 1  # used only by the express/normal strategy

    # Basket mix
    p_small: float = 0.45
    p_medium: float = 0.40
    p_large: float = 0.15
    large_max_items: int = 40  # "16 or more" needs an upper bound to sample

    # Shopping
    section_weights: dict[str, float] = field(default_factory=_default_section_weights)
    mean_pick_time: float = 0.5  # minutes per item, exponential
    walk_speed_min: float = 0.8  # m/s
    walk_speed_max: float = 1.4  # m/s

    # Checkout service: Gamma(items, scan) + Triangular(payment)
    scan_time_per_item: float = 0.05  # minutes (3 seconds), exponential per item
    payment_min: float = 0.5
    payment_mode: float = 1.0
    payment_max: float = 2.0

    # Validation mode: "items" (normal model) or "exponential" (M/M/c check)
    service_model: str = "items"
    exp_service_mean: float = 1.0

    # ------------------------------------------------------------------ #
    def validate(self) -> None:
        errors: list[str] = []

        def need(cond: bool, msg: str) -> None:
            if not cond:
                errors.append(msg)

        need(
            0 < self.duration <= 100_000,
            "duration must be between 0 and 100000 minutes",
        )
        need(
            0 < self.arrival_rate <= 20,
            "arrival_rate must be between 0 and 20 per minute",
        )
        need(
            self.arrival_profile in ARRIVAL_PROFILES,
            f"arrival_profile must be one of {', '.join(ARRIVAL_PROFILES)}",
        )
        need(
            0 <= self.peak_amplitude <= 1.9,
            "peak_amplitude must be between 0 and 1.9",
        )
        need(1 <= self.num_counters <= 10, "num_counters must be between 1 and 10")
        need(
            0 <= self.num_express <= self.num_counters,
            "num_express must be between 0 and num_counters",
        )
        for name in ("p_small", "p_medium", "p_large"):
            need(0 <= getattr(self, name) <= 1, f"{name} must be between 0 and 1")
        need(
            abs(self.p_small + self.p_medium + self.p_large - 1) < 1e-6,
            "basket probabilities must sum to 1",
        )
        need(self.large_max_items >= 16, "large_max_items must be at least 16")
        need(
            set(self.section_weights) == set(SECTIONS),
            f"section_weights must have keys {', '.join(SECTIONS)}",
        )
        if set(self.section_weights) == set(SECTIONS):
            need(
                all(w >= 0 for w in self.section_weights.values()),
                "section weights must be >= 0",
            )
            need(
                sum(self.section_weights.values()) > 0,
                "section weights must not all be zero",
            )
        need(self.mean_pick_time > 0, "mean_pick_time must be > 0")
        need(
            0 < self.walk_speed_min <= self.walk_speed_max,
            "walking speeds must satisfy 0 < min <= max",
        )
        need(self.scan_time_per_item > 0, "scan_time_per_item must be > 0")
        need(
            0 <= self.payment_min <= self.payment_mode <= self.payment_max
            and self.payment_min < self.payment_max,
            "payment times must satisfy min <= mode <= max and min < max",
        )
        need(
            self.service_model in SERVICE_MODELS,
            "service_model must be 'items' or 'exponential'",
        )
        need(self.exp_service_mean > 0, "exp_service_mean must be > 0")

        if errors:
            raise ValueError("; ".join(errors))

    # ------------------------------------------------------------------ #
    def arrival_rate_at(self, t: float) -> float:
        """lambda(t): the arrival rate at time t (customers per minute)."""
        if self.arrival_profile == "constant":
            return self.arrival_rate
        a = self.peak_amplitude
        return self.arrival_rate * ((1 - a / 2) + a * math.sin(math.pi * t / self.duration) ** 2)

    def peak_arrival_rate(self) -> float:
        """Upper bound lambda_max used by thinning."""
        if self.arrival_profile == "constant":
            return self.arrival_rate
        return self.arrival_rate * (1 + self.peak_amplitude / 2)

    def expected_service_time(self, items: int) -> float:
        """E[S | n]: what a customer can predict from a visible basket size."""
        if self.service_model == "exponential":
            return self.exp_service_mean
        return (
            items * self.scan_time_per_item
            + (self.payment_min + self.payment_mode + self.payment_max) / 3
        )

    def normalised_section_weights(self) -> list[float]:
        total = sum(self.section_weights[s] for s in SECTIONS)
        return [self.section_weights[s] / total for s in SECTIONS]

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict | None) -> "SimulationConfig":
        data = dict(data or {})
        known = {f.name for f in fields(cls)}
        unknown = set(data) - known
        if unknown:
            raise ValueError(f"unknown parameter(s): {', '.join(sorted(unknown))}")
        clean: dict = {}
        for key, value in data.items():
            try:
                if key == "section_weights":
                    if not isinstance(value, dict):
                        raise TypeError
                    clean[key] = {str(k): float(v) for k, v in value.items()}
                elif key in STRING_FIELDS:
                    clean[key] = str(value)
                elif key in INT_FIELDS:
                    number = float(value)
                    if not number.is_integer():
                        raise ValueError(f"{key} must be a whole number")
                    clean[key] = int(number)
                else:
                    clean[key] = float(value)
            except (TypeError, ValueError) as exc:
                if "whole number" in str(exc):
                    raise
                raise ValueError(f"{key} has an invalid value: {value!r}") from None
            if isinstance(clean[key], float) and not math.isfinite(clean[key]):
                raise ValueError(f"{key} must be a finite number")
        cfg = cls(**clean)
        cfg.validate()
        return cfg
