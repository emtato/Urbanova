"""Discrete-event transit simulation."""

from .metrics import analyze_simulation
from .paired_runs import run_paired_comparisons, run_repeated_simulations
from .runner import run_simulation

__all__ = ["analyze_simulation", "run_simulation", "run_repeated_simulations", "run_paired_comparisons"]
