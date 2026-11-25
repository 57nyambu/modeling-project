"""Performance measures (formulas in docs/03-mathematical-model.md, section 3.6)."""

from __future__ import annotations

import numpy as np
import pandas as pd

from . import layout
from .engine import SimulationResult


def customers_dataframe(result: SimulationResult) -> pd.DataFrame:
    rows = []
    for r in result.customers:
        p = r.profile
        rows.append(
            {
                "id": p.id,
                "category": p.category,
                "items": p.items,
                "arrival": p.arrival_time,
                "checkout_arrival": r.checkout_arrival,
                "counter": r.counter,
                "service_start": r.service_start,
                "departure": r.departure,
                "service_time_required": p.service_time,
                "state_at_end": r.state_at_end,
            }
        )
    df = pd.DataFrame(rows)
    if df.empty:
        df = pd.DataFrame(
            columns=[
                "id",
                "category",
                "items",
                "arrival",
                "checkout_arrival",
                "counter",
                "service_start",
                "departure",
                "service_time_required",
                "state_at_end",
            ]
        )
    df["wait"] = df["service_start"] - df["checkout_arrival"]
    df["service"] = df["departure"] - df["service_start"]
    df["time_in_store"] = df["departure"] - df["arrival"]
    return df


def _mean(series: pd.Series) -> float:
    s = series.dropna()
    return float(s.mean()) if len(s) else 0.0


def _max(series: pd.Series) -> float:
    s = series.dropna()
    return float(s.max()) if len(s) else 0.0


def compute_metrics(result: SimulationResult) -> dict:
    T = result.config.duration
    df = customers_dataframe(result)
    started = df[df["service_start"].notna()]
    served = df[df["departure"].notna()]

    counters = []
    for c in result.counters:
        counters.append(
            {
                "counter": c.index + 1,
                "type": "express" if c.express else "normal",
                "served": c.served,
                "utilisation": c.busy_time / T,  # rho_c = busy time / T
                "avg_queue_length": c.queue_area / T,  # (1/T) * integral Q_c(t) dt
                "max_queue_length": c.max_queue,
                "avg_wait": _mean(started.loc[started["counter"] == c.index, "wait"]),
            }
        )

    n_c = len(result.counters)
    avg_q_total = sum(c["avg_queue_length"] for c in counters)
    states = df["state_at_end"].value_counts().to_dict()

    by_category = {}
    for cat in ("small", "medium", "large"):
        sub = df[df["category"] == cat]
        by_category[cat] = {
            "generated": int(len(sub)),
            "served": int(sub["departure"].notna().sum()),
            "avg_wait": _mean(sub["wait"]),
            "avg_time_in_store": _mean(sub["time_in_store"]),
        }

    # Little's Law consistency check: L_q ~= lambda_eff * W_q
    lambda_eff = len(started) / T if T else 0.0
    avg_wait = _mean(started["wait"])

    return {
        "strategy": result.strategy_key,
        "strategy_label": result.strategy_label,
        "duration": T,
        "customers_generated": int(len(df)),
        "customers_served": int(len(served)),
        "customers_started_service": int(len(started)),
        "avg_wait": avg_wait,
        "max_wait": _max(started["wait"]),
        "avg_queue_length": avg_q_total / n_c,  # mean over counters
        "avg_total_waiting": avg_q_total,  # people waiting anywhere
        "max_queue_length": int(max(c["max_queue_length"] for c in counters)),
        "avg_service_time": _mean(served["service"]),
        "avg_time_in_store": _mean(served["time_in_store"]),
        "utilisation": float(np.mean([c["utilisation"] for c in counters])),
        "remaining": int(len(df) - len(served)),
        "remaining_breakdown": {
            "shopping": int(states.get("shopping", 0)),
            "waiting": int(states.get("waiting", 0)),
            "in_service": int(states.get("in_service", 0)),
        },
        "pct_waited_over_5_min": (
            float((started["wait"] > 5).mean() * 100) if len(started) else 0.0
        ),
        "littles_law": {"lq_observed": avg_q_total, "lambda_wq": lambda_eff * avg_wait},
        "counters": counters,
        "by_category": by_category,
        "events_processed": result.events_processed,
    }


def time_series(result: SimulationResult, step: float | None = None) -> dict:
    """Step functions sampled on a regular grid for charts."""
    T = result.config.duration
    step = step or max(T / 400, 0.25)
    grid = np.arange(0, T + 1e-9, step)

    def sample(series: list[tuple[float, int]]) -> list[int]:
        times = np.array([s[0] for s in series])
        values = np.array([s[1] for s in series])
        idx = np.searchsorted(times, grid, side="right") - 1
        return values[np.clip(idx, 0, len(values) - 1)].tolist()

    return {
        "t": [round(float(x), 3) for x in grid],
        "in_store": sample(result.system_series),
        "queues": [sample(c.queue_series) for c in result.counters],
    }


def build_trace(result: SimulationResult) -> dict:
    """Compact per-customer timeline for the 2D animation (replayed in the browser)."""

    def r3(x):
        return None if x is None else round(float(x), 3)

    customers = []
    for rec in result.customers:
        p = rec.profile
        customers.append(
            {
                "id": p.id,
                "cat": p.category,
                "items": p.items,
                "a": r3(p.arrival_time),
                # Full planned route; times are null for sections not reached by the end of the run
                "legs": [
                    [
                        v.section,
                        r3(rec.section_times[i][0]) if i < len(rec.section_times) else None,
                        r3(rec.section_times[i][1]) if i < len(rec.section_times) else None,
                    ]
                    for i, v in enumerate(p.visits)
                ],
                "co": r3(rec.checkout_arrival),
                "c": rec.counter,
                "ss": r3(rec.service_start),
                "d": r3(rec.departure),
            }
        )
    return {
        "duration": result.config.duration,
        "layout": layout.layout_dict(result.config.num_counters),
        "counters": [
            {"index": c.index, "type": "express" if c.express else "normal"}
            for c in result.counters
        ],
        "customers": customers,
    }
