"""Command-line runner, useful for testing the engine without Django.

python -m simulation.cli --strategy shortest_queue --seed 42
python -m simulation.cli --compare --replications 10
python -m simulation.cli --validate
python -m simulation.cli --strategy express --csv customers.csv
"""

from __future__ import annotations

import argparse
import json

from .comparison import compare_strategies
from .config import SimulationConfig
from .engine import run_simulation
from .metrics import compute_metrics, customers_dataframe
from .strategies import STRATEGIES
from .validation import mmc_theory, run_mm1_validation


def main() -> None:
    ap = argparse.ArgumentParser(description="Supermarket checkout simulation")
    ap.add_argument("--strategy", choices=list(STRATEGIES), default="shortest_queue")
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--duration", type=float, default=240)
    ap.add_argument("--rate", type=float, default=1.4, help="arrivals per minute")
    ap.add_argument("--counters", type=int, default=4)
    ap.add_argument("--express", type=int, default=1)
    ap.add_argument("--compare", action="store_true")
    ap.add_argument("--replications", type=int, default=10)
    ap.add_argument("--validate", action="store_true")
    ap.add_argument("--csv", help="write per-customer results to this CSV file")
    args = ap.parse_args()

    if args.validate:
        print(json.dumps(run_mm1_validation(), indent=2))
        print(
            "M/M/2 reference (lambda=1.6, mu=1):", json.dumps(mmc_theory(1.6, 1.0, 2))
        )
        return

    cfg = SimulationConfig(
        duration=args.duration,
        seed=args.seed,
        arrival_rate=args.rate,
        num_counters=args.counters,
        num_express=args.express,
    )
    if args.compare:
        res = compare_strategies(cfg, args.replications)
        print(f"{'Strategy':38} {'Avg wait':>16} {'Max queue':>14} {'Utilisation':>16}")
        for key, s in res["summary"].items():
            m = s["measures"]
            print(
                f"{s['label']:38} "
                f"{m['avg_wait']['mean']:8.3f} ± {m['avg_wait']['ci_half']:5.3f} "
                f"{m['max_queue_length']['mean']:8.2f} ± {m['max_queue_length']['ci_half']:4.2f} "
                f"{m['utilisation']['mean']:8.3f} ± {m['utilisation']['ci_half']:5.3f}"
            )
        return

    result = run_simulation(cfg, args.strategy)
    metrics = compute_metrics(result)
    print(json.dumps({k: v for k, v in metrics.items() if k != "counters"}, indent=2))
    for c in metrics["counters"]:
        print(c)
    if args.csv:
        customers_dataframe(result).to_csv(args.csv, index=False)
        print(f"Wrote {args.csv}")


if __name__ == "__main__":
    main()
