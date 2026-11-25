"""Supermarket checkout discrete-event simulation engine.

Pure Python (NumPy + Pandas). No Django imports, so the engine can be run,
tested and reused on its own.
"""

from .comparison import compare_strategies
from .config import SimulationConfig
from .customers import generate_customers
from .engine import Simulation, SimulationResult, run_simulation
from .metrics import build_trace, compute_metrics, customers_dataframe, time_series
from .strategies import STRATEGIES, get_strategy

__all__ = [
    "SimulationConfig",
    "Simulation",
    "SimulationResult",
    "run_simulation",
    "generate_customers",
    "compute_metrics",
    "customers_dataframe",
    "time_series",
    "build_trace",
    "compare_strategies",
    "STRATEGIES",
    "get_strategy",
]
