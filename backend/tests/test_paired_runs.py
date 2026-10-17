"""Batch isolation, reproducibility, aggregation and paired arithmetic."""

import json
from copy import deepcopy
from dataclasses import replace

import pytest

from backend.simulation import paired_runs
from backend.simulation.inputs import SimulationInput
from backend.simulation.objects import Passenger, Stop


@pytest.fixture
def inputs():
    return SimulationInput(
        stops=(
            Stop(id="s0", name="Start", sequence=0, latitude=43.65, longitude=-79.36),
            Stop(id="s1", name="End", sequence=1, latitude=43.65, longitude=-79.37),
        ),
        existing_residences=(), developments=(), link_travel_times_s=(5.0,),
        streetcar_capacity=1, headway_s=30, rush_hour_duration_s=61,
        trips_per_resident_in_window=0, start_time_s=0, end_time_s=100,
        stop_dwell_range_s=(0, 0), seed=7,
    )


@pytest.fixture
def three_passengers(monkeypatch):
    def generate(_inputs):
        return {
            f"p{i}": Passenger(
                id=f"p{i}", origin_stop_id="s0", destination_stop_id="s1",
                get_to_stop_time=0, rider_group="existing",
            ) for i in range(3)
        }
    monkeypatch.setattr("backend.simulation.runner.generate_passengers", generate)


def without_runtime(batch):
    result = deepcopy(batch)
    result.pop("id", None)
    result["overall_results"].pop("runtime")
    for run in result["individual_results"]:
        run["summary"]["contract"]["diagnostics"].pop("runtime_s")
    return result


def test_twenty_real_runs_are_independent_and_keep_original_results(inputs, three_passengers):
    inputs.stops[0].waiting_passenger_ids.append("old-state")
    original = deepcopy(inputs)
    batch = paired_runs.run_repeated_simulations(inputs)
    assert inputs == original
    assert set(batch) == {"id", "overall_results", "individual_results"}
    assert isinstance(batch["id"], str) and batch["id"]
    assert len(batch["individual_results"]) == 20
    assert batch["overall_results"]["seeds"] == list(range(7, 27))
    assert batch["overall_results"]["all_runs_conservation_valid"] is True
    assert batch["overall_results"]["invalid_run_indices"] == []
    assert all(run["summary"]["overview"]["corridor_passengers"] == 3 for run in batch["individual_results"])
    assert all(set(run) == {"inputs", "streetcars", "passengers", "sim_log", "summary"} for run in batch["individual_results"])
    assert batch["overall_results"]["metrics"]["mean_wait_s"]["mean"] == 30
    assert batch["overall_results"]["metrics"]["mean_wait_s"]["stddev"] == 0
    runtime = batch["overall_results"]["runtime"]
    assert len(runtime["per_run_s"]) == 20
    assert runtime["total_s"] >= sum(runtime["per_run_s"]) > 0
    # JSON serialization includes all full results, with no NaN placeholders.
    json.dumps(batch, allow_nan=False)
    batch["individual_results"][0]["passengers"][0]["status"] = "changed"
    assert batch["individual_results"][1]["passengers"][0]["status"] == "arrived"


def test_seeded_batches_reproduce_outcomes_but_vary_between_seeds(inputs, three_passengers):
    varied = replace(inputs, headway_randomness_s=5)
    first = paired_runs.run_repeated_simulations(varied, run_count=3, seeds=[13, 2, 19])
    second = paired_runs.run_repeated_simulations(varied, run_count=3, seeds=[13, 2, 19])
    assert first["id"] != second["id"]
    assert without_runtime(first) == without_runtime(second)
    assert [run["inputs"]["seed"] for run in first["individual_results"]] == [13, 2, 19]
    assert first["overall_results"]["metrics"]["mean_wait_s"]["stddev"] > 0


def test_missing_metrics_and_failed_conservation_are_not_hidden(inputs, monkeypatch):
    values = {7: None, 8: 10, 9: 20}

    def fake_run(run_inputs):
        return {"summary": {"overview": {
            "mean_wait_s": values[run_inputs.seed],
            "p95_wait_s": None,
            "conservation_valid": run_inputs.seed != 8,
        }}}

    monkeypatch.setattr(paired_runs, "run_simulation", fake_run)
    overall = paired_runs.run_repeated_simulations(inputs, run_count=3)["overall_results"]
    assert overall["metrics"]["mean_wait_s"] == {
        "valid_run_count": 2, "missing_run_count": 1,
        "mean": 15, "median": 15, "min": 10, "max": 20,
        "stddev": pytest.approx(7.0710678119),
    }
    assert overall["metrics"]["p95_wait_s"]["mean"] is None
    assert overall["metrics"]["p95_wait_s"]["valid_run_count"] == 0
    assert overall["all_runs_conservation_valid"] is False
    assert overall["invalid_run_indices"] == [1]
    assert "conservation_valid" not in overall["metrics"]


def test_paired_capacity_improvement_matches_hand_calculation(inputs, three_passengers):
    comparison = paired_runs.run_paired_comparisons(
        {"baseline": inputs, "more_capacity": replace(inputs, streetcar_capacity=3, seed=999)},
        baseline_case="baseline", run_count=2, seeds=[5, 11],
    )
    assert comparison["total_run_count"] == 4
    for batch in comparison["cases"].values():
        assert batch["overall_results"]["seeds"] == [5, 11]
        assert [run["inputs"]["seed"] for run in batch["individual_results"]] == [5, 11]
    improvement = comparison["improvements"]["more_capacity"]
    assert improvement["mean_wait_s"]["per_run_reduction"] == [30, 30]
    assert improvement["mean_wait_s"]["reduction_percent"]["mean"] == 100
    assert improvement["denied_boarding_share"]["reduction"]["mean"] == pytest.approx(2 / 3)
    assert improvement["unresolved_passengers"]["per_run_reduction_percent"] == [None, None]
    assert improvement["new_denied_boarding_share"]["reduction"]["mean"] is None
    assert comparison["runtime_s"] >= sum(batch["overall_results"]["runtime"]["total_s"] for batch in comparison["cases"].values())


def test_identical_cases_have_zero_reduction_and_single_run_has_no_stddev(inputs, three_passengers):
    comparison = paired_runs.run_paired_comparisons(
        {"baseline": inputs, "same": inputs}, baseline_case="baseline", run_count=1,
    )
    wait = comparison["improvements"]["same"]["mean_wait_s"]
    assert wait["per_run_reduction"] == [0]
    assert wait["reduction_percent"]["mean"] == 0
    assert wait["reduction"]["stddev"] is None


def test_worse_service_records_negative_improvement(inputs, three_passengers):
    comparison = paired_runs.run_paired_comparisons(
        {"baseline": replace(inputs, streetcar_capacity=3), "less_capacity": inputs},
        baseline_case="baseline", run_count=1,
    )
    wait = comparison["improvements"]["less_capacity"]["mean_wait_s"]
    assert wait["per_run_reduction"] == [-30]
    # The absolute deterioration is valid even though the baseline wait is zero.
    assert wait["per_run_reduction_percent"] == [None]


@pytest.mark.parametrize("kwargs", [
    {"run_count": 0}, {"run_count": True}, {"run_count": 1.5},
    {"run_count": 2, "seeds": [1]}, {"run_count": 2, "seeds": [1, 1]},
    {"run_count": 1, "seeds": [False]}, {"run_count": 1, "seeds": [1.5]},
])
def test_invalid_seed_configuration_is_rejected_before_running(inputs, monkeypatch, kwargs):
    def unexpected_run(_inputs):
        pytest.fail("Invalid configuration must not start a simulation")
    monkeypatch.setattr(paired_runs, "run_simulation", unexpected_run)
    with pytest.raises(ValueError):
        paired_runs.run_repeated_simulations(inputs, **kwargs)


def test_missing_baseline_is_rejected(inputs):
    with pytest.raises(ValueError, match="baseline_case"):
        paired_runs.run_paired_comparisons({"candidate": inputs}, baseline_case="missing")
