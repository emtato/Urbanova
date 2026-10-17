"""Tests for B10: Simulation invariants, conservation laws, and hand-worked validation."""

import pytest
from backend.simulation.inputs import SimulationInput
from backend.simulation.objects import Passenger, Stop
from backend.simulation.runner import run_simulation
from data.simulation_input import load_simulation_input

LAT = 43.65
LON = -79.36


def test_b10_passenger_status_and_conservation_invariant():
    """B10: Every passenger is waiting, on board, arrived or beyond the segment.
    Total created = arrived + waiting + onboard + beyond_segment.
    """
    inputs = load_simulation_input()
    res = run_simulation(inputs)
    passengers = res["passengers"]
    overview = res["summary"]["overview"]

    valid_statuses = {"waiting", "onboard", "arrived", "beyond_segment"}
    statuses = [p["status"] for p in passengers]
    assert all(s in valid_statuses for s in statuses)

    total_created = len(passengers)
    arrived = sum(1 for s in statuses if s == "arrived")
    beyond = sum(1 for s in statuses if s == "beyond_segment")
    waiting = sum(1 for s in statuses if s == "waiting")
    onboard = sum(1 for s in statuses if s == "onboard")

    assert total_created == arrived + beyond + waiting + onboard
    assert overview["conservation_valid"] is True


def test_b10_load_stays_between_zero_and_capacity():
    """B10: Vehicle load stays between zero and vehicle capacity at all times."""
    inputs = load_simulation_input()
    res = run_simulation(inputs)

    # Check final state of all streetcars
    for car in res["streetcars"]:
        load = len(car["onboard_passenger_ids"])
        assert 0 <= load <= car["capacity"]

    # Check every sim_log entry with a streetcar
    for entry in res["sim_log"]:
        car = entry.get("streetcar")
        if car:
            load = len(car["onboard_passenger_ids"])
            assert 0 <= load <= car["capacity"]
            if entry.get("onboard_count_after") is not None:
                assert 0 <= entry["onboard_count_after"] <= car["capacity"]


def test_b10_denied_riders_persist_board_later_and_counted_once():
    """B10: Denied riders persist in the queue, can board a later vehicle, and are counted once."""
    stops = (
        Stop(id="s0", name="Start", sequence=0, latitude=LAT, longitude=LON),
        Stop(id="s1", name="Terminus", sequence=1, latitude=LAT, longitude=LON - 0.01),
    )
    # Capacity 1. Two passengers arrive at t=0.
    # Car 1 arrives at t=0, boards p1. p2 is denied boarding.
    # Car 1 dwells until t=20, then departs.
    # Car 2 arrives/enters berth at t=20, boards p2.
    inputs = SimulationInput(
        stops=stops,
        existing_residences=(),
        developments=(),
        link_travel_times_s=(10.0,),
        streetcar_capacity=1,
        headway_s=10.0,
        rush_hour_duration_s=15.0,
        trips_per_resident_in_window=0.3,
        start_time_s=0,
        end_time_s=100,
        stop_dwell_range_s=(20, 20),
        seed=1,
    )
    passengers = {
        "p1": Passenger(id="p1", origin_stop_id="s0", destination_stop_id="s1", get_to_stop_time=0, rider_group="existing"),
        "p2": Passenger(id="p2", origin_stop_id="s0", destination_stop_id="s1", get_to_stop_time=0, rider_group="existing"),
    }

    res = run_simulation(inputs, passengers)
    p2 = res["passengers"][1]

    # p2 was denied once by Car 1, then boarded Car 2 at t=20, and completed trip at s1
    assert p2["denied_boarding_once"] is True
    assert p2["boarding_time_s"] == 20
    assert p2["status"] == "arrived"

    # In overview, exactly 1 passenger out of 2 was denied at least once:
    overview = res["summary"]["overview"]
    assert overview["denied_boarding_share"] == pytest.approx(0.5)


def test_b10_event_times_ordered_and_travel_times_non_negative():
    """B10: Event times in sim_log are non-decreasing; passenger travel/wait times non-negative."""
    inputs = load_simulation_input()
    res = run_simulation(inputs)

    # 1. Monotonic event times
    event_times = [entry["time_s"] for entry in res["sim_log"]]
    for i in range(1, len(event_times)):
        assert event_times[i] >= event_times[i - 1], f"Event {i} time decreased"

    # 2. Non-negative passenger durations
    for p in res["passengers"]:
        arr_time = p["get_to_stop_time"]
        board_time = p.get("boarding_time_s")
        exit_time = p.get("exit_time_s")

        if board_time is not None:
            assert board_time >= arr_time, "Wait time must be non-negative"
        if exit_time is not None and board_time is not None:
            assert exit_time >= board_time, "Ride time must be non-negative"
        if exit_time is not None:
            assert exit_time >= arr_time, "Journey time must be non-negative"


def test_b10_light_regular_case_matches_hand_worked_result():
    """B10: A light regular deterministic scenario matches exact hand calculations.

    Setup:
    - 2 stops (s0 -> s1), 1 link of 20 seconds (variation=0).
    - Headway = 50s. Dwell = exactly 10s.
    - Capacity = 2.
    - p1 arrives at t=0, p2 arrives at t=5. Both board Car 1.
    - Car 1 enters s0 at t=0, boards p1 (wait=0s).
    - At t=5, p2 arrives and boards Car 1 (wait=0s).
    - At t=10, Car 1 departs s0.
    - At t=30, Car 1 arrives at s1 (terminus), both alight (exit_time=30s).
    - Hand result:
      p1: wait = 0s, ride = 30 - 0 = 30s, commute = 30s
      p2: wait = 0s, ride = 30 - 5 = 25s, commute = 25s
      mean wait = 0.0s, p95 wait = 0.0s, completed = 2, unresolved = 0, denied_share = 0.0
    """
    stops = (
        Stop(id="s0", name="Start", sequence=0, latitude=LAT, longitude=LON),
        Stop(id="s1", name="Terminus", sequence=1, latitude=LAT, longitude=LON - 0.01),
    )
    inputs = SimulationInput(
        stops=stops,
        existing_residences=(),
        developments=(),
        link_travel_times_s=(20.0,),
        streetcar_capacity=2,
        headway_s=50.0,
        rush_hour_duration_s=10.0,
        trips_per_resident_in_window=0.3,
        start_time_s=0,
        end_time_s=60,
        stop_dwell_range_s=(10, 10),
        link_travel_time_variation_share=0.0,
        seed=1,
    )
    passengers = {
        "p1": Passenger(id="p1", origin_stop_id="s0", destination_stop_id="s1", get_to_stop_time=0, rider_group="existing"),
        "p2": Passenger(id="p2", origin_stop_id="s0", destination_stop_id="s1", get_to_stop_time=5, rider_group="existing"),
    }
    res = run_simulation(inputs, passengers)
    p_map = {p["id"]: p for p in res["passengers"]}

    assert p_map["p1"]["boarding_time_s"] == 0
    assert p_map["p1"]["exit_time_s"] == 30
    assert p_map["p2"]["boarding_time_s"] == 5
    assert p_map["p2"]["exit_time_s"] == 30

    ov = res["summary"]["overview"]
    assert ov["completed_corridor_passengers"] == 2
    assert ov["unresolved_passengers"] == 0
    assert ov["remaining_queue_passengers"] == 0
    assert ov["denied_boarding_share"] == 0.0
    assert ov["mean_wait_s"] == 0.0
    assert ov["p95_wait_s"] == 0.0
    assert ov["mean_ride_time_s"] == 27.5
    assert ov["mean_commute_time_s"] == 27.5


def test_b10_overloaded_case_grows_queue():
    """B10: An overloaded scenario grows a persistent queue with denied boarding."""
    stops = (
        Stop(id="s0", name="Start", sequence=0, latitude=LAT, longitude=LON),
        Stop(id="s1", name="Terminus", sequence=1, latitude=LAT, longitude=LON - 0.01),
    )
    # 10 passengers arrive at t=0. Car capacity = 2.
    # 2 cars enter (t=0, t=30). Each car can carry at most 2 passengers (total 4 served).
    # 6 passengers must remain in the queue unresolved at end of run.
    inputs = SimulationInput(
        stops=stops,
        existing_residences=(),
        developments=(),
        link_travel_times_s=(10.0,),
        streetcar_capacity=2,
        headway_s=30.0,
        rush_hour_duration_s=35.0,
        trips_per_resident_in_window=0.3,
        start_time_s=0,
        end_time_s=70,
        stop_dwell_range_s=(5, 5),
        seed=1,
    )
    passengers = {
        f"p{i}": Passenger(id=f"p{i}", origin_stop_id="s0", destination_stop_id="s1", get_to_stop_time=0, rider_group="existing")
        for i in range(10)
    }

    res = run_simulation(inputs, passengers)
    ov = res["summary"]["overview"]

    assert ov["completed_corridor_passengers"] == 4
    assert ov["unresolved_passengers"] == 6
    assert ov["remaining_queue_passengers"] == 6
    # 8 riders were left behind by full cars:
    assert ov["denied_boarding_share"] == 0.8
    peak_queue = max(entry["stop_queues"].get("s0", 0) for entry in res["sim_log"])
    assert peak_queue == 10


def test_b10_identical_inputs_and_seed_reproduce_exact_results():
    """B10: Running the simulator with identical inputs and seeds produces bitwise identical results."""
    inputs = load_simulation_input()
    run1 = run_simulation(inputs)
    run2 = run_simulation(inputs)

    assert run1["summary"]["overview"] == run2["summary"]["overview"]
    assert run1["passengers"] == run2["passengers"]
    assert run1["sim_log"] == run2["sim_log"]
    assert run1["streetcars"] == run2["streetcars"]
