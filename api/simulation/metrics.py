"""Performance measures (formulas in docs/03-mathematical-model.md, section 3.6)."""

from __future__ import annotations

import math

import numpy as np
import pandas as pd

from . import layout
from .engine import SimulationResult

RESULT_SCHEMA = 2  # bump when the shape of metrics/time series changes (stored runs are upgraded)
EPS = 1e-9  # waits shorter than this count as "did not wait"
MAX_SERIES_POINTS = 4000  # above this a step series is reduced to a peak-preserving envelope

CUSTOMER_COLUMNS = [
    "id", "category", "items", "route", "arrival", "checkout_arrival", "counter_index",
    "service_start", "departure", "service_time_required", "state_at_end",
]


def customers_dataframe(result: SimulationResult) -> pd.DataFrame:
    """One row per customer. Times are minutes from opening; missing = not reached by T."""
    rows = []
    for r in result.customers:
        p = r.profile
        rows.append([
            p.id, p.category, p.items, ">".join(v.section for v in p.visits), p.arrival_time,
            r.checkout_arrival, r.counter, r.service_start, r.departure, p.service_time,
            r.state_at_end,
        ])
    df = pd.DataFrame(rows, columns=CUSTOMER_COLUMNS)
    for col in ("checkout_arrival", "counter_index", "service_start", "departure"):
        df[col] = pd.to_numeric(df[col], errors="coerce").astype(float)
    df["counter"] = df["counter_index"] + 1                      # 1-based, as shown in the UI
    df["wait"] = df["service_start"] - df["checkout_arrival"]     # W_q,i
    df["service"] = df["departure"] - df["service_start"]
    df["time_in_store"] = df["departure"] - df["arrival"]          # W_i
    return df


def _mean(series: pd.Series) -> float:
    s = series.dropna()
    return float(s.mean()) if len(s) else 0.0


def _max(series: pd.Series) -> float:
    s = series.dropna()
    return float(s.max()) if len(s) else 0.0


def _percentile(series: pd.Series, q: float) -> float:
    s = series.dropna()
    return float(np.percentile(s, q)) if len(s) else 0.0


def time_average(series: list[tuple[float, int]], end: float) -> float:
    """(1/T) * integral of a step function over [0, T]; exact because values change only at events."""
    if end <= 0:
        return 0.0
    area = 0.0
    for (t0, v), (t1, _) in zip(series, series[1:]):
        area += v * (t1 - t0)
    last_t, last_v = series[-1]
    area += last_v * (end - last_t)
    return area / end


def nice_step(raw: float) -> float:
    """Smallest 'round' number (1, 2, 2.5, 5 x 10^k) that is >= raw."""
    if raw <= 0:
        return 1.0
    power = 10 ** math.floor(math.log10(raw))
    for m in (1, 2, 2.5, 5, 10):
        if m * power >= raw - 1e-12:
            return m * power
    return 10 * power


def wait_distribution(waits: pd.Series) -> dict:
    """Customers served without waiting, plus a histogram of the positive waits."""
    w = waits.dropna().to_numpy()
    zero = int((w <= EPS).sum())
    positive = w[w > EPS]
    if len(positive) == 0:
        return {"zero": zero, "positive": 0, "mean_positive": 0.0, "bin_width": 0.0, "edges": [],
                "counts": []}
    width = nice_step(float(positive.max()) / 20)
    n_bins = max(1, math.ceil(float(positive.max()) / width - 1e-9))
    edges = np.arange(n_bins + 1) * width
    counts, _ = np.histogram(positive, bins=edges)
    return {
        "zero": zero,
        "positive": int(len(positive)),
        "mean_positive": float(positive.mean()),
        "bin_width": width,
        "edges": [round(float(e), 6) for e in edges],
        "counts": [int(c) for c in counts],
    }


def compute_metrics(result: SimulationResult) -> dict:
    T = result.config.duration
    df = customers_dataframe(result)
    started = df[df["service_start"].notna()]
    served = df[df["departure"].notna()]

    counters = []
    for c in result.counters:
        mine = started[started["counter_index"] == c.index]
        counters.append({
            "counter": c.index + 1,
            "type": "express" if c.express else "normal",
            "served": c.served,
            "utilisation": c.busy_time / T,          # rho_c = busy time / T
            "avg_queue_length": c.queue_area / T,    # (1/T) * integral Q_c(t) dt
            "max_queue_length": c.max_queue,
            "avg_wait": _mean(mine["wait"]),
            "avg_service_time": _mean(served.loc[served["counter_index"] == c.index, "service"]),
        })

    n_c = len(result.counters)
    avg_q_total = sum(c["avg_queue_length"] for c in counters)
    states = df["state_at_end"].value_counts().to_dict()

    by_category = {}
    for cat in ("small", "medium", "large"):
        sub = df[df["category"] == cat]
        sub_started = sub[sub["service_start"].notna()]
        by_category[cat] = {
            "generated": int(len(sub)),
            "served": int(sub["departure"].notna().sum()),
            "avg_wait": _mean(sub_started["wait"]),
            "prob_wait": float((sub_started["wait"] > EPS).mean()) if len(sub_started) else 0.0,
            "avg_time_in_store": _mean(sub["time_in_store"]),
        }

    # Little's Law consistency check for the queues: L_q ~= lambda_eff * W_q
    lambda_eff = len(started) / T if T else 0.0
    avg_wait = _mean(started["wait"])

    return {
        "schema": RESULT_SCHEMA,
        "strategy": result.strategy_key,
        "strategy_label": result.strategy_label,
        "duration": T,
        "customers_generated": int(len(df)),
        "customers_served": int(len(served)),
        "customers_started_service": int(len(started)),
        "throughput_per_hour": len(served) / T * 60 if T else 0.0,
        "avg_wait": avg_wait,
        "max_wait": _max(started["wait"]),
        "p90_wait": _percentile(started["wait"], 90),
        "prob_wait": float((started["wait"] > EPS).mean()) if len(started) else 0.0,
        "pct_waited_over_5_min": float((started["wait"] > 5).mean() * 100) if len(started) else 0.0,
        "avg_queue_length": avg_q_total / n_c,      # mean over counters
        "avg_total_waiting": avg_q_total,           # people waiting anywhere
        "max_queue_length": int(max(c["max_queue_length"] for c in counters)),
        "avg_in_store": time_average(result.system_series, T),   # L, time-weighted
        "max_in_store": int(max(v for _, v in result.system_series)),
        "avg_busy_cashiers": time_average(result.busy_series, T),
        "avg_service_time": _mean(served["service"]),
        "avg_time_in_store": _mean(served["time_in_store"]),
        "utilisation": float(np.mean([c["utilisation"] for c in counters])),
        "remaining": int(len(df) - len(served)),
        "remaining_breakdown": {
            "shopping": int(states.get("shopping", 0)),
            "waiting": int(states.get("waiting", 0)),
            "in_service": int(states.get("in_service", 0)),
        },
        "littles_law": {"lq_observed": avg_q_total, "lambda_wq": lambda_eff * avg_wait},
        "wait_distribution": wait_distribution(started["wait"]),
        "counters": counters,
        "by_category": by_category,
        "events_processed": result.events_processed,
    }


def step_points(series: list[tuple[float, int]], end: float,
                max_points: int = MAX_SERIES_POINTS) -> tuple[list[list[float]], bool]:
    """Exact change points of a step function, or a peak-preserving envelope for very long runs.

    The envelope splits [0, T] into equal buckets and keeps the largest value seen in each,
    so maximum queue lengths stay visible.
    """
    if len(series) <= max_points:
        return [[round(t, 4), v] for t, v in series], False
    buckets = max_points // 2
    width = end / buckets
    out: list[list[float]] = []
    i = 0
    current = series[0][1]
    for b in range(buckets):
        start, stop = b * width, (b + 1) * width
        peak = current
        while i < len(series) and series[i][0] < stop:
            current = series[i][1]
            peak = max(peak, current)
            i += 1
        out.append([round(start, 4), peak])
    return out, True


def time_series(result: SimulationResult) -> dict:
    """Step functions for charts: [[time, value], ...] at every change point."""
    T = result.config.duration
    in_store, d1 = step_points(result.system_series, T)
    waiting, d2 = step_points(result.waiting_series, T)
    busy, d3 = step_points(result.busy_series, T)
    queues, flags = [], []
    for c in result.counters:
        pts, d = step_points(c.queue_series, T)
        queues.append(pts)
        flags.append(d)
    return {
        "duration": T,
        "decimated": any([d1, d2, d3, *flags]),
        "in_store": in_store,
        "waiting": waiting,
        "busy": busy,
        "queues": queues,
    }


def build_trace(result: SimulationResult) -> dict:
    """Compact per-customer timeline for the 2D animation (replayed in the browser)."""

    def r3(x):
        return None if x is None else round(float(x), 3)

    customers = []
    for rec in result.customers:
        p = rec.profile
        customers.append({
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
        })
    return {
        "duration": result.config.duration,
        "layout": layout.layout_dict(result.config.num_counters),
        "counters": [{"index": c.index, "type": "express" if c.express else "normal"}
                     for c in result.counters],
        "customers": customers,
    }


def customers_csv(result: SimulationResult) -> str:
    """Per-customer export with readable column order."""
    df = customers_dataframe(result)
    cols = ["id", "category", "items", "route", "arrival", "checkout_arrival", "counter",
            "service_start", "departure", "wait", "service", "time_in_store", "state_at_end"]
    return df[cols].round(4).to_csv(index=False)
