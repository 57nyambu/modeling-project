"""Validation against analytic queueing results (M/M/1 and M/M/c)."""

from __future__ import annotations

import math

from .config import SimulationConfig
from .engine import run_simulation
from .metrics import compute_metrics


def mm1_theory(lam: float, mu: float) -> dict:
    if lam >= mu:
        raise ValueError("M/M/1 requires lambda < mu")
    rho = lam / mu
    return {"rho": rho, "wq": rho / (mu - lam), "lq": rho**2 / (1 - rho)}


def mmc_theory(lam: float, mu: float, c: int) -> dict:
    """Erlang C formulas for a single shared queue with c servers."""
    a = lam / mu
    rho = a / c
    if rho >= 1:
        raise ValueError("M/M/c requires lambda < c * mu")
    s = sum(a**k / math.factorial(k) for k in range(c))
    top = a**c / (math.factorial(c) * (1 - rho))
    p_wait = top / (s + top)
    wq = p_wait / (c * mu - lam)
    return {"rho": rho, "p_wait": p_wait, "wq": wq, "lq": lam * wq}


def run_mm1_validation(
    lam: float = 0.7,
    mu: float = 1.0,
    duration: float = 20_000,
    replications: int = 10,
    seed: int = 7,
) -> dict:
    """Run R long replications of a 1-counter store with exponential service.

    The engine passes if the analytic value lies inside the 95% confidence
    interval of the replication means.
    """
    from .comparison import summarise  # local import avoids a cycle

    theory = mm1_theory(lam, mu)
    samples = {"rho": [], "wq": [], "lq": []}
    for r in range(replications):
        cfg = SimulationConfig(
            duration=duration,
            seed=seed + r,
            arrival_rate=lam,
            num_counters=1,
            num_express=0,
            service_model="exponential",
            exp_service_mean=1.0 / mu,
        )
        m = compute_metrics(run_simulation(cfg, "shortest_queue"))
        samples["rho"].append(m["utilisation"])
        samples["wq"].append(m["avg_wait"])
        samples["lq"].append(m["avg_queue_length"])

    out = {
        "lambda": lam,
        "mu": mu,
        "duration": duration,
        "replications": replications,
        "measures": {},
    }
    for key, values in samples.items():
        s = summarise(values)
        lo, hi = s["mean"] - s["ci_half"], s["mean"] + s["ci_half"]
        out["measures"][key] = {
            "theory": theory[key],
            "simulated_mean": s["mean"],
            "ci_low": lo,
            "ci_high": hi,
            "theory_inside_ci": lo <= theory[key] <= hi,
            "relative_error": abs(s["mean"] - theory[key]) / theory[key],
        }
    return out
