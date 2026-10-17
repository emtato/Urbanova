"""Run one simulation using the supplied scenario inputs."""

from copy import deepcopy
from dataclasses import asdict
from math import isfinite
from random import Random

# commute.py helper:
#   sample_streetcar_trip(home_lat, home_lon, rng, *, accessible_stop_ids=None)
#   -> returns StreetcarTrip(board_stop_id, alight_stop_id, exit, ...) if the
#      commuter uses the westbound 505, or None if they walk, take Line 1, or
#      travel outside this corridor model.
from .commute import sample_streetcar_trip
from .inputs import SimulationInput
from .objects import Passenger, SimLog, Streetcar
from .objects.sim_log import SimAction

# streetcars.py helpers:
#   streetcar_entry_times(inputs) -> Iterator[float] of entry times at Broadview (stop 0).
#   generate_streetcar(inputs, streetcar_id) -> new empty Streetcar at inputs.stops[0].
#   handle_stop_passengers(inputs, streetcar, passengers, time_s) -> alights riders
#       at their destination_stop_id, boards waiting_passenger_ids FIFO up to capacity,
#       marks denied_boarding_once=True when full, and moves destination_stop_id=None
#       riders to status="beyond_segment" at the terminus (inputs.stops[-1]).
#   depart_streetcar(inputs, streetcar, time_s) -> starts link to next stop.
#   arrive_streetcar(streetcar, time_s) -> places streetcar at next_stop_id.
#   terminate_streetcar(inputs, streetcar) -> marks streetcar "finished" at terminus.
from .streetcars import (
    arrive_streetcar,
    depart_streetcar,
    generate_streetcar,
    handle_stop_passengers,
    streetcar_entry_times,
    terminate_streetcar,
)


def generate_passengers(inputs: SimulationInput) -> dict[str, Passenger]:
    """Generate westbound 505 passengers from existing_residences and developments.

    Uses `sample_streetcar_trip` (from backend/simulation/commute.py) for each
    commuter trip generated in the rush-hour window:
    - Takes building (latitude, longitude), a reproducible Random stream, and
      the building's `accessible_stop_ids`.
    - Samples a workplace from the City of Toronto 2021 Census heatmap (60% west
      of home, 40% elsewhere) and checks the 750 m walking/subway/505 rules.
    - Returns None if the commuter walks, takes the subway directly, or cannot
      use the 505 (so we do NOT also multiply by `transit_share`).
    - Returns a `StreetcarTrip` when they ride the westbound 505:
        * `trip.board_stop_id` -> `Passenger.origin_stop_id`
        * `trip.alight_stop_id` -> `Passenger.destination_stop_id`
          (`None` means they stay on past TMU / `beyond_segment`).
    """
    if not isfinite(inputs.trips_per_resident_in_window) or inputs.trips_per_resident_in_window < 0:
        raise ValueError("trips_per_resident_in_window must be finite and nonnegative")
    weights = inputs.commuter_distribution
    if not weights or any(not isfinite(w) or w < 0 for w in weights) or sum(weights) <= 0:
        raise ValueError("commuter_distribution must be non-empty with nonnegative finite weights and positive sum")

    # Separate RNG stream so passenger sampling never alters streetcar entry or link timing.
    passenger_rng = Random(f"{inputs.seed}:passengers")
    valid_stop_ids = {stop.id for stop in inputs.stops}
    bin_indices = range(len(weights))
    bin_width_s = inputs.rush_hour_duration_s / len(weights)
    passengers: dict[str, Passenger] = {}

    # Combine existing housing clusters (rider_group="existing") and new proposals (rider_group="new").
    housing_sources = [
        ("existing", None, cluster.latitude, cluster.longitude,
         cluster.total_units * cluster.occupied_share * cluster.residents_per_occupied_unit,
         cluster.accessible_stop_ids)
        for cluster in inputs.existing_residences
    ] + [
        ("new", dev.id, dev.latitude, dev.longitude,
         dev.net_added_units * dev.occupied_share * dev.residents_per_occupied_unit,
         dev.accessible_stop_ids)
        for dev in inputs.developments
    ]

    for rider_group, dev_id, lat, lon, estimated_residents, accessible_stop_ids in housing_sources:
        # Total commuter trips leaving this building during the rush-hour window.
        num_commuters = round(estimated_residents * inputs.trips_per_resident_in_window)
        for _ in range(num_commuters):
            # Call commute.py helper: returns StreetcarTrip(board_stop_id, alight_stop_id, ...) or None.
            trip = sample_streetcar_trip(
                lat,
                lon,
                passenger_rng,
                accessible_stop_ids=accessible_stop_ids or None,
            )
            if trip is None:
                continue  # Commuter walked, used Line 1 directly, or wasn't served by the 505.
            if trip.board_stop_id not in valid_stop_ids:
                continue
            if trip.alight_stop_id is not None and trip.alight_stop_id not in valid_stop_ids:
                continue

            # Sample when this passenger reaches their boarding stop within [0, rush_hour_duration_s)
            # using the relative time-bin weights in inputs.commuter_distribution.
            chosen_bin = passenger_rng.choices(bin_indices, weights=weights, k=1)[0]
            get_to_stop_time = (chosen_bin + passenger_rng.random()) * bin_width_s

            passenger_id = f"passenger-{len(passengers) + 1}"
            passengers[passenger_id] = Passenger(
                id=passenger_id,
                origin_stop_id=trip.board_stop_id,
                destination_stop_id=trip.alight_stop_id,  # None = rides west past TMU (beyond_segment)
                get_to_stop_time=get_to_stop_time,
                rider_group=rider_group,
                development_id=dev_id,
            )

    return passengers


def run_simulation(inputs: SimulationInput, passengers: dict[str, Passenger] | None = None) -> dict:
    """Run streetcars and passengers and return their activity and final state as JSON-ready data.

    start/end are service-day seconds; activity and vehicle times are elapsed
    from the start. Actions happen on whole-second ticks once their time is due.
    Entry stops at the earlier of the rush-window end or run end.
    Cars still travelling at run end stay in transit in the saved state.
    """
    # TODO: Add boarding/alighting dwell time and summary metrics.

    # Read the clock boundaries that control how long this simulation runs.
    start_time = inputs.start_time_s
    end_time = inputs.end_time_s

    # Check that the supplied clock and route can support streetcar movement.
    if not isinstance(start_time, int) or not isinstance(end_time, int) or end_time <= start_time:
        raise ValueError("Start/end times must be integer service-day seconds with end after start")
    if not inputs.stops:
        raise ValueError("The simulation requires at least one stop")
    stop_ids = [stop.id for stop in inputs.stops]
    if len(stop_ids) != len(set(stop_ids)):
        raise ValueError("Stop IDs must be unique")
    if [stop.sequence for stop in inputs.stops] != list(range(len(inputs.stops))):
        raise ValueError("Stops must be supplied in zero-based travel order")
    if len(inputs.link_travel_times_s) != len(inputs.stops) - 1:
        raise ValueError("Supply one travel time per adjacent stop pair")
    if any(not isfinite(duration) or duration <= 0 for duration in inputs.link_travel_times_s):
        raise ValueError("Link travel times must be finite and positive")
    travel_variation_share = inputs.link_travel_time_variation_share
    if not isfinite(travel_variation_share) or not 0 <= travel_variation_share < 1:
        raise ValueError("Travel-time variation must be finite and between zero (inclusive) and one (exclusive)")

    # Keep active cars for updates, all cars for results, and every action for replay.
    duration_s = end_time - start_time
    entry_end_s = min(inputs.rush_hour_duration_s, duration_s)
    streetcars: list[Streetcar] = []
    active_streetcars: dict[str, Streetcar] = {}
    stops_by_id = {stop.id: stop for stop in inputs.stops}
    sim_log: list[SimLog] = []

    # Generate passengers from housing inputs via commute.py's sample_streetcar_trip
    # unless the caller explicitly passed a custom passengers dict (e.g. in unit tests).
    if passengers is None:
        for stop in inputs.stops:
            stop.waiting_passenger_ids.clear()
        passengers = generate_passengers(inputs)

    # Sort scheduled passengers by arrival time at stop so we can enqueue them in order.
    scheduled_passengers = sorted(
        (p for p in passengers.values() if p.status == "scheduled"),
        key=lambda p: p.get_to_stop_time,
    )
    next_passenger_idx = 0

    # Prepare the entry schedule so the clock knows when to introduce each car.
    # streetcar_entry_times (from streetcars.py) yields float entry timestamps in seconds.
    entry_times = streetcar_entry_times(inputs)
    next_entry_s = next(entry_times, None)

    # Give link travel times a repeatable random stream separate from entry timing.
    travel_rng = Random(f"{inputs.seed}:link_travel_times")

    # Preserve each action's state in the shared history for saving and replaying the run.
    def record(time_s: int, action: SimAction, streetcar: Streetcar) -> None:
        sim_log.append(SimLog(time_s, action, deepcopy(streetcar)))

    # Serve passengers at the current stop (including TMU terminus), then depart or terminate.
    def continue_or_terminate(streetcar: Streetcar, time_s: int) -> None:
        # handle_stop_passengers (from streetcars.py):
        # 1) Alights onboard passengers whose destination_stop_id == streetcar.current_stop_id
        # 2) Boards stop.waiting_passenger_ids FIFO up to streetcar.capacity (sets boarding_time_s)
        # 3) Sets denied_boarding_once=True on remaining waiting passengers if car is full
        # 4) If at inputs.stops[-1] (TMU), transitions destination_stop_id=None riders to
        #    status="beyond_segment" and clears onboard_passenger_ids before termination.
        handle_stop_passengers(inputs, streetcar, passengers, time_s)
        if streetcar.current_stop_id == inputs.stops[-1].id:
            terminate_streetcar(inputs, streetcar)
            record(time_s, "terminate", streetcar)
            active_streetcars.pop(streetcar.id)
        else:
            # TODO: Add dwell before starting the next link.
            depart_streetcar(inputs, streetcar, time_s)

            # Sample this car's link duration once, then save that plan in its departure record.
            if travel_variation_share > 0:
                base_duration_s = streetcar.expected_arrival_time_s - time_s
                travel_duration_s = travel_rng.uniform(
                    base_duration_s * (1 - travel_variation_share),
                    base_duration_s * (1 + travel_variation_share),
                )
                streetcar.expected_arrival_time_s = time_s + travel_duration_s
            record(time_s, "depart", streetcar)

    # Advance one second at a time, including final arrivals at the reporting cutoff.
    for time_s in range(start_time, end_time + 1):
        elapsed_s = time_s - start_time

        # Enqueue scheduled passengers whose stop-arrival time (get_to_stop_time) has arrived.
        while (
            next_passenger_idx < len(scheduled_passengers)
            and elapsed_s >= scheduled_passengers[next_passenger_idx].get_to_stop_time
        ):
            passenger = scheduled_passengers[next_passenger_idx]
            if passenger.status == "scheduled":
                passenger.status = "waiting"
                stops_by_id[passenger.origin_stop_id].waiting_passenger_ids.append(passenger.id)
            next_passenger_idx += 1

        # Introduce cars whose entry time has been reached while the entry window is open.
        while elapsed_s < entry_end_s and next_entry_s is not None and elapsed_s >= next_entry_s:
            streetcar = generate_streetcar(inputs, f"streetcar-{len(streetcars) + 1}")
            streetcars.append(streetcar)
            active_streetcars[streetcar.id] = streetcar
            record(elapsed_s, "generate", streetcar)
            continue_or_terminate(streetcar, elapsed_s)
            next_entry_s = next(entry_times, None)

        # Update travelling cars that have reached their next stop by this second.
        for streetcar in list(active_streetcars.values()):
            if elapsed_s >= streetcar.expected_arrival_time_s:
                arrive_streetcar(streetcar, elapsed_s)
                record(elapsed_s, "arrive", streetcar)
                continue_or_terminate(streetcar, elapsed_s)

    # Package the inputs, final state and activity history as JSON-ready saved-run data.
    saved_inputs = asdict(inputs)
    for stop in saved_inputs["stops"]:
        stop["waiting_passenger_ids"] = list(stop["waiting_passenger_ids"])
    return {
        "inputs": saved_inputs,
        "streetcars": [asdict(streetcar) for streetcar in streetcars],
        "passengers": [asdict(passenger) for passenger in passengers.values()],
        "sim_log": [asdict(entry) for entry in sim_log],
    }
