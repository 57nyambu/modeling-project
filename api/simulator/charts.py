"""Matplotlib charts rendered to PNG from stored results.

The same images are used in the web dashboard and can be downloaded for the
final report.
"""

from __future__ import annotations

import io

import matplotlib

matplotlib.use("Agg")  # no GUI backend on a server
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402

STRATEGY_COLOURS = {"shortest_queue": "#2563eb", "shortest_wait": "#0d9488", "express": "#d97706"}
SHORT_LABELS = {"shortest_queue": "Shortest Queue", "shortest_wait": "Shortest Est. Wait",
                "express": "Express / Normal"}
COUNTER_COLOURS = ["#2563eb", "#0d9488", "#d97706", "#7c3aed", "#dc2626",
                   "#0891b2", "#65a30d", "#db2777", "#4b5563", "#ea580c"]

plt.rcParams.update({
    "font.size": 10, "axes.spines.top": False, "axes.spines.right": False,
    "axes.grid": True, "grid.alpha": 0.25, "axes.titleweight": "bold", "axes.titlesize": 11,
})


def _png(fig) -> bytes:
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=130)
    plt.close(fig)
    return buf.getvalue()


# --------------------------------------------------------------------- runs
def run_queue_lengths(run) -> bytes:
    ts = run.timeseries
    fig, ax = plt.subplots(figsize=(8, 3.6))
    counters = run.metrics["counters"]
    for i, q in enumerate(ts["queues"]):
        kind = counters[i]["type"]
        ax.step(ts["t"], q, where="post", lw=1.3, color=COUNTER_COLOURS[i % 10],
                label=f"Counter {i + 1}" + (" (express)" if kind == "express" else ""))
    ax.set(title="Queue length over time", xlabel="Time (min)", ylabel="Customers waiting")
    ax.legend(ncol=min(len(ts["queues"]), 5), fontsize=8, frameon=False, loc="upper left")
    return _png(fig)


def run_in_store(run) -> bytes:
    ts = run.timeseries
    fig, ax = plt.subplots(figsize=(8, 3.2))
    ax.step(ts["t"], ts["in_store"], where="post", color="#1e293b", lw=1.4)
    ax.fill_between(ts["t"], ts["in_store"], step="post", alpha=0.12, color="#1e293b")
    ax.set(title="Customers in the supermarket", xlabel="Time (min)", ylabel="Customers")
    return _png(fig)


def run_wait_histogram(run) -> bytes:
    waits = [c["ss"] - c["co"] for c in (run.trace or {}).get("customers", [])
             if c["ss"] is not None and c["co"] is not None]
    fig, ax = plt.subplots(figsize=(6, 3.4))
    if waits:
        ax.hist(waits, bins=30, color="#2563eb", alpha=0.85, edgecolor="white")
        ax.axvline(np.mean(waits), color="#dc2626", ls="--", lw=1.2, label=f"Mean {np.mean(waits):.2f} min")
        ax.legend(frameon=False)
    else:
        ax.text(0.5, 0.5, "No waiting-time data", ha="center", va="center", transform=ax.transAxes)
    ax.set(title="Distribution of waiting times", xlabel="Waiting time (min)", ylabel="Customers")
    return _png(fig)


def run_utilisation(run) -> bytes:
    counters = run.metrics["counters"]
    fig, ax = plt.subplots(figsize=(6, 3.4))
    labels = [f"C{c['counter']}" + ("\nexpress" if c["type"] == "express" else "") for c in counters]
    vals = [c["utilisation"] * 100 for c in counters]
    bars = ax.bar(labels, vals, color=[COUNTER_COLOURS[i % 10] for i in range(len(vals))])
    ax.bar_label(bars, fmt="%.1f%%", fontsize=8, padding=2)
    ax.set(title="Cashier utilisation", ylabel="Busy time (%)", ylim=(0, 112))
    return _png(fig)


RUN_CHARTS = {
    "queue-length": run_queue_lengths,
    "in-store": run_in_store,
    "wait-histogram": run_wait_histogram,
    "utilisation": run_utilisation,
}


# -------------------------------------------------------------- comparisons
def _bar_with_ci(comparison, measure: str, title: str, ylabel: str, scale: float = 1.0) -> bytes:
    summary = comparison.results["summary"]
    keys = list(summary)
    means = [summary[k]["measures"][measure]["mean"] * scale for k in keys]
    errs = [summary[k]["measures"][measure]["ci_half"] * scale for k in keys]
    fig, ax = plt.subplots(figsize=(6, 3.6))
    bars = ax.bar([SHORT_LABELS[k] for k in keys], means, yerr=errs, capsize=6,
                  color=[STRATEGY_COLOURS[k] for k in keys])
    ax.bar_label(bars, labels=[f"{m:.2f}" for m in means], fontsize=8, label_type="center", color="white",
                 fontweight="bold")
    top = max((m + e) for m, e in zip(means, errs)) if means else 1
    ax.set_ylim(0, top * 1.12 if top > 0 else 1)
    ax.set(title=f"{title}\n(mean, 95% CI, {comparison.replications} replications)", ylabel=ylabel)
    return _png(fig)


def cmp_avg_wait(c):
    return _bar_with_ci(c, "avg_wait", "Average waiting time", "Minutes")


def cmp_max_wait(c):
    return _bar_with_ci(c, "max_wait", "Maximum waiting time", "Minutes")


def cmp_queue_length(c):
    return _bar_with_ci(c, "avg_queue_length", "Average queue length", "Customers per counter")


def cmp_time_in_store(c):
    return _bar_with_ci(c, "avg_time_in_store", "Average time in store", "Minutes")


def cmp_utilisation(c):
    return _bar_with_ci(c, "utilisation", "Cashier utilisation", "Percent", scale=100)


def cmp_by_category(c):
    summary = c.results["summary"]
    cats = ["small", "medium", "large"]
    x = np.arange(len(cats))
    width = 0.26
    fig, ax = plt.subplots(figsize=(7, 3.6))
    for i, key in enumerate(summary):
        means = [summary[key]["by_category_wait"][cat]["mean"] for cat in cats]
        errs = [summary[key]["by_category_wait"][cat]["ci_half"] for cat in cats]
        ax.bar(x + (i - 1) * width, means, width, yerr=errs, capsize=4,
               color=STRATEGY_COLOURS[key], label=SHORT_LABELS[key])
    ax.set_xticks(x, ["Small (1-5)", "Medium (6-15)", "Large (16+)"])
    ax.set(title="Average waiting time by basket size", ylabel="Minutes")
    ax.legend(frameon=False, fontsize=8)
    return _png(fig)


def cmp_queue_over_time(c):
    ts = c.results.get("timeseries", {})
    fig, ax = plt.subplots(figsize=(8, 3.6))
    for key, series in ts.items():
        total = np.sum(np.array(series["queues"]), axis=0)
        ax.step(series["t"], total, where="post", lw=1.2, color=STRATEGY_COLOURS[key], label=SHORT_LABELS[key])
    ax.set(title="Total customers waiting over time (replication 1, same customers)",
           xlabel="Time (min)", ylabel="Customers waiting")
    ax.legend(frameon=False, fontsize=8)
    return _png(fig)


COMPARISON_CHARTS = {
    "avg-wait": cmp_avg_wait,
    "max-wait": cmp_max_wait,
    "queue-length": cmp_queue_length,
    "time-in-store": cmp_time_in_store,
    "utilisation": cmp_utilisation,
    "by-category": cmp_by_category,
    "queue-over-time": cmp_queue_over_time,
}
