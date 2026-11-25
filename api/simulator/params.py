"""Parameter descriptions sent to the web UI so forms are generated from one source."""

from simulation import layout
from simulation.config import ARRIVAL_PROFILES, SECTION_LABELS, SimulationConfig
from simulation.strategies import STRATEGIES

# key, label, unit, min, max, step, group, help
PARAMETERS = [
    ("duration", "Run length", "min", 30, 1440, 10, "Run",
     "Length of the trading period T. The store opens empty at t = 0 and the run stops at T."),
    ("seed", "Random seed", "", 1, 999999, 1, "Run",
     "Drives every random number. The same seed and parameters always give the same run."),
    ("arrival_rate", "Arrival rate", "/min", 0.1, 6, 0.1, "Arrivals",
     "Average customers arriving per minute (lambda). Inter-arrival times are exponential."),
    ("peak_amplitude", "Peak strength", "", 0, 1.9, 0.1, "Arrivals",
     "A in lambda(t) = lambda((1 - A/2) + A sin^2(pi t / T)). 1.0 means half the average rate at "
     "opening and closing and 1.5 times it at the peak. The average stays lambda."),
    ("num_counters", "Checkout counters", "", 1, 10, 1, "Checkout",
     "Number of open counters, one cashier each, each with its own FIFO queue."),
    ("num_express", "Express counters", "", 0, 10, 1, "Checkout",
     "Counters reserved for baskets of 5 items or fewer. Used only by the Express and Normal strategy."),
    ("scan_time_per_item", "Scan time per item", "min", 0.01, 0.5, 0.01, "Checkout",
     "Mean of the exponential scan time for one item. 0.05 min is 3 seconds."),
    ("payment_min", "Payment minimum", "min", 0, 5, 0.1, "Checkout",
     "Shortest payment time (triangular a)."),
    ("payment_mode", "Payment most likely", "min", 0, 5, 0.1, "Checkout",
     "Most likely payment time (triangular c)."),
    ("payment_max", "Payment maximum", "min", 0.1, 10, 0.1, "Checkout",
     "Longest payment time (triangular b)."),
    ("p_small", "Small baskets", "share", 0, 1, 0.05, "Baskets",
     "Probability that a customer buys 1 to 5 items."),
    ("p_medium", "Medium baskets", "share", 0, 1, 0.05, "Baskets",
     "Probability that a customer buys 6 to 15 items."),
    ("p_large", "Large baskets", "share", 0, 1, 0.05, "Baskets",
     "Probability that a customer buys 16 items or more."),
    ("large_max_items", "Largest basket", "items", 16, 100, 1, "Baskets",
     "Upper bound for large baskets, which are uniform from 16 to this value."),
    ("mean_pick_time", "Pick time per item", "min", 0.05, 3, 0.05, "Shopping",
     "Mean of the exponential time to find and pick one item."),
    ("walk_speed_min", "Slowest walking speed", "m/s", 0.3, 2, 0.1, "Shopping",
     "Lower bound of the uniform walking speed."),
    ("walk_speed_max", "Fastest walking speed", "m/s", 0.3, 2.5, 0.1, "Shopping",
     "Upper bound of the uniform walking speed."),
]


def meta() -> dict:
    defaults = SimulationConfig().to_dict()
    return {
        "defaults": defaults,
        "parameters": [
            {"key": k, "label": label, "unit": unit, "min": lo, "max": hi, "step": step,
             "group": group, "help": help_}
            for k, label, unit, lo, hi, step, group, help_ in PARAMETERS
        ],
        "arrival_profiles": list(ARRIVAL_PROFILES),
        "sections": SECTION_LABELS,
        "strategies": [{"key": k, "label": cls.label} for k, cls in STRATEGIES.items()],
        "layout": layout.layout_dict(defaults["num_counters"]),
        "counter_span": {"x_min": layout.COUNTER_X_MIN, "x_max": layout.COUNTER_X_MAX,
                         "y": layout.COUNTER_Y},
    }
