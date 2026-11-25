"""Strategy comparison with replications and Common Random Numbers."""

from __future__ import annotations

import math
from dataclasses import replace

from .config import SimulationConfig
from .customers import generate_customers
from .engine import run_simulation
from .metrics import RESULT_SCHEMA, compute_metrics
from .strategies import STRATEGIES

# Two-sided 95% Student t critical values t_{df, 0.975}
_T_975 = {
    1: 12.706,
    2: 4.303,
    3: 3.182,
    4: 2.776,
    5: 2.571,
    6: 2.447,
    7: 2.365,
    8: 2.306,
    9: 2.262,
    10: 2.228,
    11: 2.201,
    12: 2.179,
    13: 2.160,
    14: 2.145,
    15: 2.131,
    16: 2.120,
    17: 2.110,
    18: 2.101,
    19: 2.093,
    20: 2.086,
    21: 2.080,
    22: 2.074,
    23: 2.069,
    24: 2.064,
    25: 2.060,
    26: 2.056,
    27: 2.052,
    28: 2.048,
    29: 2.045,
    30: 2.042,
    40: 2.021,
    60: 2.000,
    120: 1.980,
}

COMPARED_MEASURES = [
    ("avg_wait", "Average waiting time (min)"),
    ("p90_wait", "90th percentile waiting time (min)"),
    ("max_wait", "Maximum waiting time (min)"),
    ("prob_wait", "Share of customers who waited"),
    ("pct_waited_over_5_min", "Waited over 5 min (%)"),
    ("avg_queue_length", "Average queue length (per counter)"),
    ("max_queue_length", "Maximum queue length"),
    ("avg_service_time", "Average service time (min)"),
    ("avg_time_in_store", "Average time in store (min)"),
    ("avg_in_store", "Average customers in store"),
    ("utilisation", "Cashier utilisation"),
    ("customers_served", "Customers served"),
    ("throughput_per_hour", "Customers served per hour"),
    ("remaining", "Remaining at end"),
]

# Measures tested for paired differences against Shortest Queue
PAIRED_MEASURES = ("avg_wait", "p90_wait", "max_wait", "avg_time_in_store")


def t_critical(df: int) -> float:
    if df <= 0:
        return float("nan")
    if df in _T_975:
        return _T_975[df]
    for k in sorted(_T_975):
        if k > df:
            return _T_975[k]  # conservative: next tabulated df above
    return 1.96


def summarise(values: list[float]) -> dict:
    n = len(values)
    mean = sum(values) / n
    if n < 2:
        return {"mean": mean, "sd": 0.0, "ci_half": 0.0, "n": n}
    sd = math.sqrt(sum((v - mean) ** 2 for v in values) / (n - 1))
    return {
        "mean": mean,
        "sd": sd,
        "ci_half": t_critical(n - 1) * sd / math.sqrt(n),
        "n": n,
    }


def compare_strategies(config: SimulationConfig, replications: int = 10) -> dict:
    config.validate()
    if not 1 <= replications <= 100:
        raise ValueError("replications must be between 1 and 100")

    per_rep: dict[str, list[dict]] = {k: [] for k in STRATEGIES}
    for r in range(replications):
        rep_cfg = replace(config, seed=config.seed + r)
        customers = generate_customers(
            rep_cfg
        )  # same customers for every strategy (CRN)
        for key in STRATEGIES:
            per_rep[key].append(
                compute_metrics(run_simulation(rep_cfg, key, customers))
            )

    summary = {}
    for key, runs in per_rep.items():
        summary[key] = {
            "label": runs[0]["strategy_label"],
            "measures": {
                m: summarise([float(run[m]) for run in runs])
                for m, _ in COMPARED_MEASURES
            },
            "by_category_wait": {
                cat: summarise([run["by_category"][cat]["avg_wait"] for run in runs])
                for cat in ("small", "medium", "large")
            },
        }

    # Paired differences against Shortest Queue (CRN makes pairing valid)
    base = "shortest_queue"
    paired_all: dict[str, dict[str, dict]] = {m: {} for m in PAIRED_MEASURES}
    for key in STRATEGIES:
        if key == base:
            continue
        for m in PAIRED_MEASURES:
            diffs = [a[m] - b[m] for a, b in zip(per_rep[key], per_rep[base])]
            paired_all[m][key] = summarise(diffs)
    paired = paired_all["avg_wait"]

    ranking = sorted(summary, key=lambda k: summary[k]["measures"]["avg_wait"]["mean"])
    return {
        "schema": RESULT_SCHEMA,
        "replications": replications,
        "measures": [{"key": m, "label": label} for m, label in COMPARED_MEASURES],
        "summary": summary,
        "paired_avg_wait_vs_shortest_queue": paired,
        "paired_vs_shortest_queue": paired_all,
        "ranking_by_avg_wait": ranking,
        "seeds": [config.seed + r for r in range(replications)],
        "per_replication": {
            k: [{m: run[m] for m, _ in COMPARED_MEASURES} for run in v]
            for k, v in per_rep.items()
        },
    }
