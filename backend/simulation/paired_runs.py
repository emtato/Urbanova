"""Repeat single-run simulations and compare named cases using matching seeds.

This layer retains the simulator's existing metric definitions. Equal seeds do
not yet guarantee vehicle/link-matched draws when packages change event order
(B2). It does not convert results into Lane C's Comparison/replay contract.
"""

from collections.abc import Callable, Mapping, Sequence
from copy import deepcopy
from dataclasses import replace
from statistics import mean, median, stdev
from time import perf_counter
from uuid import uuid4

from .inputs import SimulationInput
from .runner import run_simulation


# These quantities have a clear direction: a reduction is an improvement.
# Counts such as total riders and vehicles are summarized, but not scored.
LOWER_IS_BETTER = (
    "mean_wait_s", "median_wait_s", "p95_wait_s", "max_wait_s",
    "mean_ride_time_s", "mean_commute_time_s", "p95_commute_time_s",
    "denied_boarding_share", "existing_denied_boarding_share",
    "new_denied_boarding_share", "unresolved_passengers",
    "raw_waiting_at_cutoff_passengers", "full_departures_share",
)


def _statistics(values: Sequence[float | int | None]) -> dict:
    """Summarize run-level values, preserving missing metrics rather than zeroing them."""
    present = [value for value in values if value is not None]
    return {
        "valid_run_count": len(present),
        "missing_run_count": len(values) - len(present),
        "mean": float(mean(present)) if present else None,
        "median": float(median(present)) if present else None,
        "min": min(present) if present else None,
        "max": max(present) if present else None,
        "stddev": float(stdev(present)) if len(present) > 1 else None,
    }


def _resolve_seeds(inputs: SimulationInput, run_count: int, seeds: Sequence[int] | None) -> list[int]:
    if type(run_count) is not int or run_count < 1:
        raise ValueError("run_count must be a positive integer")
    if seeds is None:
        if type(inputs.seed) is not int:
            raise ValueError("The input seed must be an integer")
        return list(range(inputs.seed, inputs.seed + run_count))
    resolved = list(seeds)
    if len(resolved) != run_count:
        raise ValueError("Supply exactly run_count seeds")
    if any(type(seed) is not int for seed in resolved):
        raise ValueError("Seeds must be integers")
    if len(set(resolved)) != run_count:
        raise ValueError("Seeds must be distinct within a batch")
    return resolved


def run_repeated_simulations(
    inputs: SimulationInput,
    *,
    run_count: int = 20,
    seeds: Sequence[int] | None = None,
    batch_id: str | None = None,
    result_transform: Callable[[dict], dict] | None = None,
) -> dict:
    """Return id, overall_results and an ordered array of untouched single-run dictionaries.

    Default seeds are inputs.seed through inputs.seed + run_count - 1. Each run
    receives a deep copy, so neither the caller's state nor earlier results can
    be mutated by a later run. Passenger demand is sampled anew for each seed.

    Metrics summarize summary.overview across runs with equal run weights. For
    example, p95_wait_s.mean is the mean of the individual runs' p95s, not a
    pooled passenger percentile or a confidence interval. stddev is the sample
    standard deviation; it is null with fewer than two valid observations.
    Runtime uses an outer wall clock, including input copying and analysis.
    """
    if batch_id is not None and (not isinstance(batch_id, str) or not batch_id.strip()):
        raise ValueError("batch_id must be a non-empty string")
    resolved_id = str(uuid4()) if batch_id is None else batch_id
    seed_ids = _resolve_seeds(inputs, run_count, seeds)
    batch_start = perf_counter()
    results = []
    runtimes = []
    for seed in seed_ids:
        run_start = perf_counter()
        result = run_simulation(replace(deepcopy(inputs), seed=seed))
        runtimes.append(perf_counter() - run_start)
        # API callers keep full dictionaries by default. Package comparisons
        # can retain summaries immediately, bounding memory across many seeds.
        results.append(result_transform(result) if result_transform else result)

    overviews = [result["summary"]["overview"] for result in results]
    metric_names = [
        name for name, value in overviews[0].items()
        if value is None or type(value) in (int, float)
    ]
    invalid_runs = [index for index, overview in enumerate(overviews) if not overview["conservation_valid"]]
    overall = {
        "run_count": run_count,
        "seeds": seed_ids,
        "metrics": {
            name: _statistics([overview[name] for overview in overviews])
            for name in metric_names
        },
        "all_runs_conservation_valid": not invalid_runs,
        "invalid_run_indices": invalid_runs,
        "runtime": {
            "per_run_s": runtimes,
            "statistics_s": _statistics(runtimes),
            "total_s": perf_counter() - batch_start,
        },
    }
    return {"id": resolved_id, "overall_results": overall, "individual_results": results}


def run_paired_comparisons(
    cases: Mapping[str, SimulationInput],
    *,
    baseline_case: str,
    run_count: int = 20,
    seeds: Sequence[int] | None = None,
) -> dict:
    """Run named cases (packages/demand/phases) and compare each with one baseline.

    Every case gets the baseline's seed list, even if its input seed differs.
    Call separately for each demand/phase when only packages should be compared.
    Positive reductions mean improvement; negative values mean deterioration.
    Percentage reduction is 100 * (baseline - candidate) / baseline per seed,
    and is null for a missing value or a zero baseline. Reduction statistics
    describe paired differences, rather than subtracting independent averages.
    """
    if not cases or baseline_case not in cases:
        raise ValueError("baseline_case must identify a supplied case")
    if any(not isinstance(name, str) or not name.strip() for name in cases):
        raise ValueError("Case names must be non-empty strings")
    seed_ids = _resolve_seeds(cases[baseline_case], run_count, seeds)
    started = perf_counter()
    batches = {
        name: run_repeated_simulations(inputs, run_count=run_count, seeds=seed_ids)
        for name, inputs in cases.items()
    }
    baseline = batches[baseline_case]["individual_results"]
    improvements = {}
    for name, batch in batches.items():
        if name == baseline_case:
            continue
        metrics = {}
        for metric in LOWER_IS_BETTER:
            reductions, percentages = [], []
            for before, after in zip(baseline, batch["individual_results"]):
                base = before["summary"]["overview"][metric]
                candidate = after["summary"]["overview"][metric]
                reduction = None if base is None or candidate is None else base - candidate
                reductions.append(reduction)
                percentages.append(100 * reduction / base if reduction is not None and base != 0 else None)
            metrics[metric] = {
                "per_run_reduction": reductions,
                "reduction": _statistics(reductions),
                "per_run_reduction_percent": percentages,
                "reduction_percent": _statistics(percentages),
            }
        improvements[name] = metrics
    return {
        "baseline_case": baseline_case,
        "seeds": seed_ids,
        "total_run_count": len(cases) * run_count,
        "cases": batches,
        "improvements": improvements,
        "runtime_s": perf_counter() - started,
    }
