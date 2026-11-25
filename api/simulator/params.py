"""Parameter descriptions sent to the web UI so forms are generated from one source."""

from simulation.config import SECTION_LABELS, SimulationConfig
from simulation.strategies import STRATEGIES

PARAMETERS = [
    # key, label, unit, min, max, step, group, help
    ("duration", "Run length", "min", 30, 1440, 10, "Run", "Length of the trading period T"),
    ("seed", "Random seed", "", 1, 999999, 1, "Run", "Same seed and parameters give the same result"),
    ("arrival_rate", "Arrival rate", "per min", 0.1, 6, 0.1, "Arrivals", "Poisson rate lambda"),
    ("num_counters", "Checkout counters", "", 1, 10, 1, "Checkout", "Number of cashiers"),
    ("num_express", "Express counters", "", 0, 10, 1, "Checkout", "Used only by Express and Normal"),
    ("scan_time_per_item", "Scan time per item", "min", 0.01, 0.5, 0.01, "Checkout", "Mean of exponential scan time"),
    ("payment_min", "Payment time minimum", "min", 0, 5, 0.1, "Checkout", "Triangular a"),
    ("payment_mode", "Payment time most likely", "min", 0, 5, 0.1, "Checkout", "Triangular c"),
    ("payment_max", "Payment time maximum", "min", 0.1, 10, 0.1, "Checkout", "Triangular b"),
    ("p_small", "Small baskets (1-5)", "share", 0, 1, 0.05, "Baskets", "Probability"),
    ("p_medium", "Medium baskets (6-15)", "share", 0, 1, 0.05, "Baskets", "Probability"),
    ("p_large", "Large baskets (16+)", "share", 0, 1, 0.05, "Baskets", "Probability"),
    ("large_max_items", "Large basket maximum", "items", 16, 100, 1, "Baskets", "Upper bound for large baskets"),
    ("mean_pick_time", "Pick time per item", "min", 0.05, 3, 0.05, "Shopping", "Mean of exponential pick time"),
    ("walk_speed_min", "Walking speed minimum", "m/s", 0.3, 2, 0.1, "Shopping", "Uniform lower bound"),
    ("walk_speed_max", "Walking speed maximum", "m/s", 0.3, 2.5, 0.1, "Shopping", "Uniform upper bound"),
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
        "sections": SECTION_LABELS,
        "strategies": [{"key": k, "label": cls.label} for k, cls in STRATEGIES.items()],
    }
