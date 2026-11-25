"""Matplotlib charts rendered to PNG from stored results.

The web app draws its own interactive charts; these PNGs are the report-ready
versions (download them from the chart menus in the app). They use the same
colours as the web app so figures and screenshots match.
"""

from __future__ import annotations

import io
import logging

import matplotlib

matplotlib.use("Agg")  # no GUI backend on a server
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib import font_manager, ticker  # noqa: E402

logging.getLogger("matplotlib.font_manager").setLevel(logging.ERROR)  # quiet "font weight" notices

INK = "#172331"
INK_2 = "#556270"
GRID = "#e7eaee"
AXIS = "#c2c8cf"
SERIES = "#257de0"
STRATEGY_COLOURS = {"shortest_queue": "#257de0", "shortest_wait": "#f47230", "express": "#00b894"}
SHORT_LABELS = {"shortest_queue": "Shortest Queue", "shortest_wait": "Shortest Est. Wait",
                "express": "Express / Normal"}


def _font() -> str:
    available = {f.name for f in font_manager.fontManager.ttflist}
    for name in ("IBM Plex Sans", "Segoe UI", "Helvetica Neue", "Arial", "DejaVu Sans"):
        if name in available:
            return name
    return "sans-serif"


plt.rcParams.update({
    "font.family": _font(),
    "font.size": 9.5,
    "text.color": INK,
    "axes.labelcolor": INK_2,
    "axes.edgecolor": AXIS,
    "axes.linewidth": 0.8,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.grid": True,
    "axes.grid.axis": "y",
    "grid.color": GRID,
    "grid.linewidth": 0.8,
    "axes.axisbelow": True,
    "axes.titlesize": 10.5,
    "axes.titleweight": "semibold",
    "axes.titlelocation": "left",
    "axes.titlepad": 10,
    "xtick.color": INK_2,
    "ytick.color": INK_2,
    "xtick.major.size": 0,
    "ytick.major.size": 0,
    "legend.frameon": False,
    "figure.dpi": 100,
})


def _png(fig) -> bytes:
    buf = io.BytesIO()
    fig.tight_layout()
    fig.savefig(buf, format="png", dpi=150, facecolor="white")
    plt.close(fig)
    return buf.getvalue()


def _step(ax, points, end, colour=SERIES, fill=True, lw=1.4):
    if not points:
        return
    t = [p[0] for p in points] + [end]
    v = [p[1] for p in points] + [points[-1][1]]
    ax.step(t, v, where="post", color=colour, lw=lw)
    if fill:
        ax.fill_between(t, v, step="post", color=colour, alpha=0.10, lw=0)


def _subtitle(fig, text: str) -> None:
    fig.text(0.01, 0.005, text, fontsize=8, color=INK_2, ha="left", va="bottom")


# --------------------------------------------------------------------- runs
def run_queue_lengths(run) -> bytes:
    ts = run.timeseries
    T = ts["duration"]
    counters = run.metrics["counters"]
    n = len(counters)
    cols = 2 if n > 1 else 1
    rows = int(np.ceil(n / cols))
    top = max(1, max((max(v for _, v in q) for q in ts["queues"]), default=1))
    fig, axes = plt.subplots(rows, cols, figsize=(9, 1.55 * rows + 0.6), sharex=True, sharey=True,
                             squeeze=False)
    for i, ax in enumerate(axes.flat):
        if i >= n:
            ax.axis("off")
            continue
        c = counters[i]
        _step(ax, ts["queues"][i], T)
        ax.set_ylim(0, top * 1.1 + 0.2)
        ax.set_xlim(0, T)
        kind = " (express)" if c["type"] == "express" else ""
        ax.set_title(f"Counter {c['counter']}{kind}: average {c['avg_queue_length']:.2f}, "
                     f"max {c['max_queue_length']}", fontsize=9, fontweight="medium")
        ax.yaxis.set_major_locator(ticker.MaxNLocator(integer=True, nbins=4))
    for ax in axes[-1]:
        ax.set_xlabel("Time (min)")
    fig.suptitle("Customers waiting at each counter", x=0.01, ha="left", fontsize=11, fontweight="semibold")
    return _png(fig)


def run_in_store(run) -> bytes:
    ts = run.timeseries
    fig, ax = plt.subplots(figsize=(9, 3.0))
    _step(ax, ts["in_store"], ts["duration"])
    ax.set_xlim(0, ts["duration"])
    ax.set_ylim(bottom=0)
    ax.set(title=f"Customers in the supermarket (time-weighted average {run.metrics['avg_in_store']:.1f})",
           xlabel="Time (min)", ylabel="Customers")
    return _png(fig)


def run_busy(run) -> bytes:
    ts = run.timeseries
    n = len(run.metrics["counters"])
    fig, ax = plt.subplots(figsize=(9, 2.6))
    _step(ax, ts["busy"], ts["duration"])
    ax.set_xlim(0, ts["duration"])
    ax.set_ylim(0, n + 0.3)
    ax.yaxis.set_major_locator(ticker.MaxNLocator(integer=True))
    ax.set(title=f"Busy cashiers (average {run.metrics['avg_busy_cashiers']:.2f} of {n})",
           xlabel="Time (min)", ylabel="Cashiers")
    return _png(fig)


def run_wait_histogram(run) -> bytes:
    dist = run.metrics["wait_distribution"]
    fig, ax = plt.subplots(figsize=(7, 3.2))
    if dist["counts"]:
        edges = dist["edges"]
        ax.bar(edges[:-1], dist["counts"], width=dist["bin_width"] * 0.92, align="edge", color=SERIES)
        mean_pos = dist["mean_positive"]
        ax.axvline(mean_pos, color=INK, lw=1)
        ax.text(mean_pos, ax.get_ylim()[1] * 0.95, f"  mean of those who waited {mean_pos:.2f} min",
                va="top", fontsize=8, color=INK)
    else:
        ax.text(0.5, 0.5, "Nobody had to wait", ha="center", va="center", transform=ax.transAxes)
    started = dist["zero"] + dist["positive"]
    share = dist["zero"] / started * 100 if started else 0
    ax.set(title=f"Waiting times of customers who waited ({share:.0f}% were served without waiting)",
           xlabel="Waiting time (min)", ylabel="Customers")
    return _png(fig)


def run_utilisation(run) -> bytes:
    counters = run.metrics["counters"]
    fig, ax = plt.subplots(figsize=(7, 0.42 * len(counters) + 1.1))
    labels = [f"Counter {c['counter']}" + (" (express)" if c["type"] == "express" else "") for c in counters]
    vals = [c["utilisation"] * 100 for c in counters]
    y = np.arange(len(vals))[::-1]
    ax.barh(y, vals, height=0.5, color=SERIES)
    for yi, v in zip(y, vals):
        ax.text(v + 1, yi, f"{v:.1f}%", va="center", fontsize=8.5, color=INK)
    ax.set_yticks(y, labels)
    ax.set_xlim(0, 110)
    ax.grid(axis="x")
    ax.grid(axis="y", visible=False)
    ax.set(title="Cashier utilisation (share of the run spent serving)", xlabel="Busy time (%)")
    return _png(fig)


RUN_CHARTS = {
    "queue-length": run_queue_lengths,
    "in-store": run_in_store,
    "busy-cashiers": run_busy,
    "wait-histogram": run_wait_histogram,
    "utilisation": run_utilisation,
}


# -------------------------------------------------------------- comparisons
def _bars_with_ci(comparison, measure: str, title: str, xlabel: str, scale: float = 1.0) -> bytes:
    summary = comparison.results["summary"]
    keys = list(summary)
    means = [summary[k]["measures"][measure]["mean"] * scale for k in keys]
    errs = [summary[k]["measures"][measure]["ci_half"] * scale for k in keys]
    fig, ax = plt.subplots(figsize=(7, 2.5))
    y = np.arange(len(keys))[::-1]
    ax.barh(y, means, height=0.5, color=[STRATEGY_COLOURS[k] for k in keys])
    ax.errorbar(means, y, xerr=errs, fmt="none", ecolor=INK, elinewidth=1, capsize=4)
    top = max(m + e for m, e in zip(means, errs)) if means else 1
    for yi, m, e in zip(y, means, errs):
        ax.text(m + e + top * 0.02, yi, f"{m:.2f} ± {e:.2f}", va="center", fontsize=8.5, color=INK)
    ax.set_yticks(y, [SHORT_LABELS[k] for k in keys])
    ax.set_xlim(0, top * 1.3 if top > 0 else 1)
    ax.grid(axis="x")
    ax.grid(axis="y", visible=False)
    ax.set(title=f"{title}: mean and 95% CI over {comparison.replications} replications", xlabel=xlabel)
    return _png(fig)


def cmp_avg_wait(c):
    return _bars_with_ci(c, "avg_wait", "Average waiting time", "Minutes")


def cmp_p90_wait(c):
    return _bars_with_ci(c, "p90_wait", "90th percentile waiting time", "Minutes")


def cmp_max_wait(c):
    return _bars_with_ci(c, "max_wait", "Maximum waiting time", "Minutes")


def cmp_queue_length(c):
    return _bars_with_ci(c, "avg_queue_length", "Average queue length", "Customers waiting per counter")


def cmp_time_in_store(c):
    return _bars_with_ci(c, "avg_time_in_store", "Average time in store", "Minutes")


def cmp_utilisation(c):
    return _bars_with_ci(c, "utilisation", "Cashier utilisation", "Percent", scale=100)


def cmp_by_category(c):
    summary = c.results["summary"]
    cats = ["small", "medium", "large"]
    x = np.arange(len(cats))
    width = 0.24
    fig, ax = plt.subplots(figsize=(7.5, 3.3))
    for i, key in enumerate(summary):
        means = [summary[key]["by_category_wait"][cat]["mean"] for cat in cats]
        errs = [summary[key]["by_category_wait"][cat]["ci_half"] for cat in cats]
        ax.bar(x + (i - 1) * (width + 0.02), means, width, color=STRATEGY_COLOURS[key], label=SHORT_LABELS[key])
        ax.errorbar(x + (i - 1) * (width + 0.02), means, yerr=errs, fmt="none", ecolor=INK, elinewidth=1,
                    capsize=3)
    ax.set_xticks(x, ["Small (1 to 5 items)", "Medium (6 to 15)", "Large (16 or more)"])
    ax.set(title="Average waiting time by basket size (mean and 95% CI)", ylabel="Minutes")
    ax.legend(fontsize=8, loc="upper left", ncols=3)
    return _png(fig)


def cmp_queue_over_time(c):
    ts = c.results.get("timeseries", {})
    keys = list(ts)
    top = max((max(v for _, v in s["waiting"]) for s in ts.values()), default=1)
    fig, axes = plt.subplots(len(keys), 1, figsize=(9, 1.45 * len(keys) + 0.7), sharex=True, sharey=True,
                             squeeze=False)
    for ax, key in zip(axes[:, 0], keys):
        s = ts[key]
        _step(ax, s["waiting"], s["duration"], colour=STRATEGY_COLOURS[key])
        ax.set_xlim(0, s["duration"])
        ax.set_ylim(0, top * 1.1 + 0.2)
        ax.set_title(SHORT_LABELS[key], fontsize=9, fontweight="medium")
        ax.yaxis.set_major_locator(ticker.MaxNLocator(integer=True, nbins=4))
    axes[-1, 0].set_xlabel("Time (min)")
    fig.suptitle("Customers waiting in all queues (replication 1, identical customers)", x=0.01, ha="left",
                 fontsize=11, fontweight="semibold")
    return _png(fig)


def cmp_replications(c):
    res = c.results
    keys = list(res["summary"])
    per = res["per_replication"]
    fig, ax = plt.subplots(figsize=(7, 3.4))
    xs = np.arange(len(keys))
    for r in range(res["replications"]):
        ax.plot(xs, [per[k][r]["avg_wait"] for k in keys], color=AXIS, lw=0.9, zorder=1)
    for i, k in enumerate(keys):
        vals = [run["avg_wait"] for run in per[k]]
        ax.scatter([i] * len(vals), vals, s=26, color=STRATEGY_COLOURS[k], edgecolor="white", lw=1.2, zorder=3)
        mean = float(np.mean(vals))
        ax.plot([i - 0.18, i + 0.18], [mean, mean], color=INK, lw=2, zorder=4)
    ax.set_xticks(xs, [SHORT_LABELS[k] for k in keys])
    ax.set_xlim(-0.5, len(keys) - 0.5)
    ax.set_ylim(bottom=0)
    ax.set(title="Average waiting time in each replication (lines join the same customers)",
           ylabel="Minutes")
    return _png(fig)


COMPARISON_CHARTS = {
    "avg-wait": cmp_avg_wait,
    "p90-wait": cmp_p90_wait,
    "max-wait": cmp_max_wait,
    "queue-length": cmp_queue_length,
    "time-in-store": cmp_time_in_store,
    "utilisation": cmp_utilisation,
    "by-category": cmp_by_category,
    "queue-over-time": cmp_queue_over_time,
    "replications": cmp_replications,
}
