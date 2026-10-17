"""Tests for B13: Baseline schedule consistency, headway residuals, and demand calibration."""

import pytest
from backend.simulation.consistency import (
    calculate_demand_consistency,
    calculate_headway_residuals,
    calculate_schedule_residuals,
    generate_consistency_report,
)
from backend.simulation.inputs import SimulationInput
from backend.simulation.runner import run_simulation
from data.simulation_input import load_simulation_input


@pytest.fixture
def baseline_run():
    base_inputs = load_simulation_input()
    # Baseline has 0 new development riders
    inputs = SimulationInput(
        stops=base_inputs.stops,
        existing_residences=base_inputs.existing_residences,
        developments=(),
        link_travel_times_s=base_inputs.link_travel_times_s,
        streetcar_capacity=base_inputs.streetcar_capacity,
        headway_s=base_inputs.headway_s,
        rush_hour_duration_s=base_inputs.rush_hour_duration_s,
        trips_per_resident_in_window=base_inputs.trips_per_resident_in_window,
        start_time_s=base_inputs.start_time_s,
        end_time_s=base_inputs.end_time_s,
        headway_randomness_s=base_inputs.headway_randomness_s,
        commuter_distribution=base_inputs.commuter_distribution,
        seed=base_inputs.seed,
        link_travel_time_variation_share=base_inputs.link_travel_time_variation_share,
        westward_share=base_inputs.westward_share,
        walk_limit_m=base_inputs.walk_limit_m,
        parallel_route_bands=base_inputs.parallel_route_bands,
        incoming_load_range=base_inputs.incoming_load_range,
        stop_dwell_range_s=base_inputs.stop_dwell_range_s,
    )
    return run_simulation(inputs)


def test_b13_schedule_link_residuals(baseline_run):
    """B13: Verify link travel times against the GTFS schedule and check residuals."""
    res = calculate_schedule_residuals(baseline_run)

    assert "links" in res
    assert len(res["links"]) == 8  # 9 stops -> 8 links
    assert res["corridor_scheduled_total_s"] > 0
    assert res["corridor_simulated_total_s"] > 0

    # With link_travel_time_variation_share=0.0 in the default reviewed inputs,
    # link travel time matches scheduled time exactly (residual close to 0):
    for link_id, data in res["links"].items():
        assert data["scheduled_time_s"] > 0
        assert data["simulated_mean_time_s"] > 0
        assert abs(data["residual_s"]) <= 1.0  # whole-second discrete clock tolerance


def test_b13_headway_residuals(baseline_run):
    """B13: Compare simulated entry headways against scheduled GTFS departures at Broadview."""
    res = calculate_headway_residuals(baseline_run)

    assert res["scheduled_trips_in_window"] == 17
    assert res["simulated_trips_in_window"] >= 15
    assert res["scheduled_median_gap_s"] == 360.0
    assert res["scheduled_mean_gap_s"] == pytest.approx(419.81, rel=0.01)

    # Simulated headway uses headway_s=360s (or configured mean)
    assert res["simulated_median_gap_s"] > 0
    assert "mean_headway_residual_s" in res
    assert "median_headway_residual_s" in res


def test_b13_demand_consistency(baseline_run):
    """B13: Check demand totals against 2022 TTS AM peak survey estimates."""
    res = calculate_demand_consistency(baseline_run)

    # Baseline must NOT include new development riders
    assert res["baseline_has_no_new_development"] is True
    assert res["total_simulated_passengers"] > 0
    assert res["corridor_passengers"] > 0
    assert res["incoming_broadview_passengers"] > 0
    assert res["tts_ward13_transit_share"] == pytest.approx(0.298, rel=0.01)
    assert res["demand_non_negative"] is True


def test_b13_full_consistency_report_and_growth_policy():
    """B13: Full consistency report generates cleanly and enforces 'never tune growth' policy."""
    report = generate_consistency_report()

    assert report["status"] == "consistent"
    assert "schedule_residuals" in report
    assert "headway_residuals" in report
    assert "demand_consistency" in report
    assert "Never tune growth case" in report["calibration_policy"]
