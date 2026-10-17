"""Tests for B5: Berth rule and no-overtaking rule in the simulation engine."""

import pytest
from backend.simulation.inputs import SimulationInput
from backend.simulation.objects import Passenger, Stop
from backend.simulation.runner import run_simulation


def test_b5_berth_rule_prevents_simultaneous_service():
    """Verify that only one streetcar occupies and serves a stop berth at a time."""
    stops = (
        Stop(id="s0", name="Start", sequence=0, latitude=43.65, longitude=-79.36),
        Stop(id="s1", name="Mid", sequence=1, latitude=43.65, longitude=-79.37),
        Stop(id="s2", name="TMU", sequence=2, latitude=43.65, longitude=-79.38),
    )
    # Headway 10s: car-1 enters at t=0, car-2 enters at t=10.
    # Dwell at s0 is fixed 20s: car-1 dwells until t=20.
    # Car-2 enters at t=10 while car-1 is still in the berth at s0!
    inputs = SimulationInput(
        stops=stops,
        existing_residences=(),
        developments=(),
        link_travel_times_s=(15.0, 15.0),
        streetcar_capacity=1,
        headway_s=10.0,
        rush_hour_duration_s=15.0,
        trips_per_resident_in_window=0,
        start_time_s=0,
        end_time_s=100,
        stop_dwell_range_s=(20, 20),
        seed=42,
    )

    # p1 at t=0, p2 at t=5
    passengers = {
        "p1": Passenger(id="p1", origin_stop_id="s0", destination_stop_id="s2", get_to_stop_time=0, rider_group="existing"),
        "p2": Passenger(id="p2", origin_stop_id="s0", destination_stop_id="s2", get_to_stop_time=5, rider_group="existing"),
    }

    result = run_simulation(inputs, passengers)
    sim_log = result["sim_log"]

    # car-1 boards p1 at t=0
    board_events = [e for e in sim_log if e["action"] == "board"]
    assert len(board_events) >= 2

    first_board = board_events[0]
    assert first_board["streetcar"]["id"] == "streetcar-1"
    assert first_board["passenger_ids"] == ["p1"]
    assert first_board["time_s"] == 0

    # car-2 is generated at t=10 while car-1 is still dwelling at s0 (planned depart t=20).
    # car-2 must NOT board p2 at t=10 because car-1 occupies the berth!
    boards_at_10 = [e for e in board_events if e["time_s"] == 10]
    assert len(boards_at_10) == 0

    # car-1 departs s0 at t=20. At t=20, car-2 is admitted to the berth and boards p2.
    boards_at_20 = [e for e in board_events if e["time_s"] == 20]
    assert len(boards_at_20) == 1
    assert boards_at_20[0]["streetcar"]["id"] == "streetcar-2"
    assert boards_at_20[0]["passenger_ids"] == ["p2"]


def test_b5_no_overtaking_on_links():
    """Verify that a trailing streetcar cannot arrive at the next stop before a preceding car."""
    stops = (
        Stop(id="s0", name="Start", sequence=0, latitude=43.65, longitude=-79.36),
        Stop(id="s1", name="Mid", sequence=1, latitude=43.65, longitude=-79.37),
        Stop(id="s2", name="TMU", sequence=2, latitude=43.65, longitude=-79.38),
    )
    # Headway 10s: car-1 at t=0, car-2 at t=10.
    # Dwell 0s. Car-1 departs s0 at t=1, car-2 departs s0 at t=11.
    # Base link time 50s with high variation (0.5).
    # Without no-overtaking, car-2 might arrive earlier than car-1.
    inputs = SimulationInput(
        stops=stops,
        existing_residences=(),
        developments=(),
        link_travel_times_s=(50.0, 50.0),
        streetcar_capacity=10,
        headway_s=10.0,
        rush_hour_duration_s=15.0,
        trips_per_resident_in_window=0,
        start_time_s=0,
        end_time_s=200,
        stop_dwell_range_s=(0, 0),
        link_travel_time_variation_share=0.8,
        seed=1,
    )

    result = run_simulation(inputs)
    sim_log = result["sim_log"]

    # Check arrival times at s1
    s1_arrivals = [e for e in sim_log if e["action"] == "arrive" and e["stop_id"] == "s1"]
    assert len(s1_arrivals) >= 2
    car1_arr = next(e for e in s1_arrivals if e["streetcar"]["id"] == "streetcar-1")
    car2_arr = next(e for e in s1_arrivals if e["streetcar"]["id"] == "streetcar-2")

    # Car-2 must NOT arrive earlier than Car-1
    assert car2_arr["time_s"] >= car1_arr["time_s"]

    # Check departure times from s1
    s1_departs = [e for e in sim_log if e["action"] == "depart" and e["stop_id"] == "s1"]
    car1_dep = next(e for e in s1_departs if e["streetcar"]["id"] == "streetcar-1")
    car2_dep = next(e for e in s1_departs if e["streetcar"]["id"] == "streetcar-2")
    assert car2_dep["time_s"] >= car1_dep["time_s"]


def test_b5_terminus_berth_queue_clears_in_order():
    """Verify that multiple streetcars arriving at the terminus clear the berth queue in order."""
    stops = (
        Stop(id="s0", name="Start", sequence=0, latitude=43.65, longitude=-79.36),
        Stop(id="s1", name="TMU", sequence=1, latitude=43.65, longitude=-79.37),
    )
    inputs = SimulationInput(
        stops=stops,
        existing_residences=(),
        developments=(),
        link_travel_times_s=(10.0,),
        streetcar_capacity=5,
        headway_s=5.0,
        rush_hour_duration_s=15.0,
        trips_per_resident_in_window=0,
        start_time_s=0,
        end_time_s=100,
        stop_dwell_range_s=(0, 0),
        seed=10,
    )

    result = run_simulation(inputs)
    terminates = [e for e in result["sim_log"] if e["action"] == "terminate"]
    assert len(terminates) >= 2

    # Verify they terminate in sequential vehicle order
    car_ids = [e["streetcar"]["id"] for e in terminates]
    assert car_ids == sorted(car_ids, key=lambda cid: int(cid.split("-")[1]))

    # Verify conservation
    assert result["summary"]["overview"]["conservation_valid"] is True
