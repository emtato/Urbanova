"""Run one simulation using the supplied scenario inputs."""

from collections import deque
from copy import deepcopy
from dataclasses import asdict
from math import isfinite
from random import Random
from time import perf_counter

# commute.py helpers:
#   corridor_505_share(home_lat, home_lon, corridor_stops)
#   -> returns 1.0 if <40% of the way from Dundas to College/Queen, 0.5 if 40-60%,
#      or 0.0 if >60% (where riders take 501 Queen or 506 College instead).
#   sample_streetcar_trip(home_lat, home_lon, rng, *, accessible_stop_ids=None)
#   -> returns StreetcarTrip(board_stop_id, alight_stop_id, exit, ...) if the
#      commuter uses the westbound 505, or None if they walk, take Line 1, or
#      travel outside this corridor model.
from .commute import corridor_505_share, sample_streetcar_trip
from .inputs import SimulationInput
from .metrics import analyze_simulation
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

    1. Calls `corridor_505_share(lat, lon, inputs.stops)` (from commute.py) to
       account for parallel streetcars (506 College to the north, 501 Queen to the south):
       - < 40% of the way from Dundas to College/Queen -> 100% of commuters stay on 505
       - 40% to 60% of the way -> 50% stay on 505, 50% take Queen/College (ignored)
       - > 60% of the way -> 0% stay on 505 (all take Queen/College, ignored)
    2. Calls `sample_streetcar_trip` (from commute.py) for each remaining commuter:
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
        # Scale by how close the building is to Dundas vs. College/Queen (1.0, 0.5, or 0.0).
        route_share = corridor_505_share(lat, lon, inputs.stops, bands=inputs.parallel_route_bands)
        if route_share <= 0:
            continue
        # Total commuter trips from this building that consider the 505 corridor.
        num_commuters = round(estimated_residents * inputs.trips_per_resident_in_window * route_share)
        for _ in range(num_commuters):
            # Call commute.py helper: returns StreetcarTrip(board_stop_id, alight_stop_id, ...) or None.
            trip = sample_streetcar_trip(
                lat,
                lon,
                passenger_rng,
                accessible_stop_ids=accessible_stop_ids or None,
                walk_limit_m=inputs.walk_limit_m,
                westward_share=inputs.westward_share,
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


def seed_incoming_passengers(
    inputs: SimulationInput,
    streetcar: Streetcar,
    passengers: dict[str, Passenger],
    incoming_rng: Random | None = None,
    time_s: float = 0.0,
) -> None:
    """Place `inputs.incoming_load_range` already-onboard riders onto a car entering at Broadview.

    Uses `sample_streetcar_trip` (from commute.py) at the entry stop (`inputs.stops[0]`)
    so each incoming rider gets a realistic downstream alighting stop (or `None` if
    riding past TMU).
    """
    if incoming_rng is None:
        incoming_rng = Random(f"{inputs.seed}:incoming:{streetcar.id}")
    entry_stop = inputs.stops[0]
    valid_stop_ids = {stop.id for stop in inputs.stops}
    low, high = inputs.incoming_load_range
    incoming_count = min(incoming_rng.randint(low, high), streetcar.capacity)

    for _ in range(incoming_count):
        # Sample downstream 505 destinations from the entry stop (Broadview & Dundas).
        destination_stop_id: str | None = None
        for _attempt in range(25):
            trip = sample_streetcar_trip(
                entry_stop.latitude,
                entry_stop.longitude,
                incoming_rng,
                accessible_stop_ids=(entry_stop.id,),
                walk_limit_m=inputs.walk_limit_m,
                westward_share=inputs.westward_share,
            )
            if trip is not None and (trip.alight_stop_id is None or trip.alight_stop_id in valid_stop_ids):
                destination_stop_id = trip.alight_stop_id
                break

        passenger_id = f"passenger-{len(passengers) + 1}"
        passengers[passenger_id] = Passenger(
            id=passenger_id,
            origin_stop_id=entry_stop.id,
            destination_stop_id=destination_stop_id,
            get_to_stop_time=time_s,
            rider_group="existing",
            status="onboard",
            streetcar_id=streetcar.id,
            boarding_time_s=time_s,
        )
        streetcar.onboard_passenger_ids.append(passenger_id)


def run_simulation(
    inputs: SimulationInput,
    passengers: dict[str, Passenger] | None = None,
    warmup_duration_s: float | None = None,
) -> dict:
    """Run streetcars and passengers and return their activity, final state, and summary metrics.

    start/end are service-day seconds; activity and vehicle times are elapsed
    from the start. Actions happen on whole-second ticks once their time is due.
    Entry stops at the earlier of the rush-window end or run end.
    Cars still travelling at run end stay in transit in the saved state.
    B9 warm-up: warmup_duration_s runs streetcars before start_time_s so the
    corridor is pre-populated with operating vehicles at t=0. Activity before
    t=0 is not recorded into sim_log to preserve the non-negative event schema.
    """
    run_start_s = perf_counter()

    # Read the clock boundaries that control how long this simulation runs.
    start_time = inputs.start_time_s
    end_time = inputs.end_time_s
    warmup_s = int(warmup_duration_s if warmup_duration_s is not None else getattr(inputs, "warmup_duration_s", 0.0))

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
    if any(not isfinite(value) or value<0 for value in (inputs.clearance_s,inputs.warmup_duration_s,inputs.max_corridor_delay_s)):
        raise ValueError('Warm-up, clearance and corridor delay must be finite and nonnegative')
    end_time += inputs.clearance_s

    # Keep active cars for updates, all cars for results, and every action for replay.
    duration_s = end_time - start_time
    entry_end_s = min(inputs.rush_hour_duration_s+inputs.clearance_s, duration_s)
    streetcars: list[Streetcar] = []
    active_streetcars: dict[str, Streetcar] = {}
    planned_departure_s: dict[str, float] = {}
    stops_by_id = {stop.id: stop for stop in inputs.stops}
    sim_log: list[SimLog] = []

    # Generate passengers from housing inputs via commute.py's sample_streetcar_trip
    # unless the caller explicitly passed a custom passengers dict (e.g. in unit tests).
    use_incoming_broadview_load = passengers is None and bool(inputs.existing_residences or inputs.developments)
    for stop in inputs.stops:
        stop.waiting_passenger_ids.clear()
        stop.serving_streetcar_id = None
    stop_berth_queues: dict[str, deque[str]] = {stop.id: deque() for stop in inputs.stops}
    if passengers is None:
        passengers = generate_passengers(inputs)
    else:
        for passenger in passengers.values():
            if passenger.status == "waiting":
                stops_by_id[passenger.origin_stop_id].waiting_passenger_ids.append(passenger.id)

    # Sort scheduled passengers by arrival time at stop so we can enqueue them in order.
    scheduled_passengers = sorted(
        (p for p in passengers.values() if p.status == "scheduled"),
        key=lambda p: p.get_to_stop_time,
    )
    next_passenger_idx = 0

    # Prepare the entry schedule so the clock knows when to introduce each car.
    # For B9 warm-up, entry_times begin at -warmup_s.
    entry_times = streetcar_entry_times(inputs, start_offset_s=-float(warmup_s))
    next_entry_s = next(entry_times, None)

    # Give link travel times, stop dwell times, and incoming Broadview loads repeatable random streams.
    travel_rng = Random(f"{inputs.seed}:link_travel_times")
    dwell_rng = Random(f"{inputs.seed}:dwell_times")
    incoming_rng = Random(f"{inputs.seed}:incoming_loads")

    def current_stop_queues() -> dict[str, int]:
        return {stop.id: len(stop.waiting_passenger_ids) for stop in inputs.stops}

    # Preserve each action's state in the shared history for saving and replaying the run.
    def record(
        time_s: int,
        action: SimAction,
        streetcar: Streetcar | None,
        *,
        stop_id: str | None = None,
        passenger_ids: list[str] | tuple[str, ...] = (),
        onboard_override: list[str] | None = None,
        waiting_override: int | None = None,
    ) -> None:
        if time_s < 0:
            return  # B9: Activity during warm-up (before start_time_s) is not recorded into sim_log
        car_copy = deepcopy(streetcar) if streetcar is not None else None
        if car_copy is not None and onboard_override is not None:
            car_copy.onboard_passenger_ids = list(onboard_override)
        resolved_stop_id = stop_id
        if resolved_stop_id is None and car_copy is not None:
            resolved_stop_id = car_copy.current_stop_id or car_copy.previous_stop_id
        pids = list(passenger_ids)
        existing_cnt = sum(1 for pid in pids if passengers[pid].rider_group == "existing")
        new_cnt = sum(1 for pid in pids if passengers[pid].rider_group == "new")
        queues = current_stop_queues()
        if resolved_stop_id is not None and waiting_override is not None:
            queues[resolved_stop_id] = waiting_override
        sim_log.append(
            SimLog(
                time_s=time_s,
                action=action,
                streetcar=car_copy,
                stop_id=resolved_stop_id,
                count=len(pids),
                existing_count=existing_cnt,
                new_count=new_cnt,
                passenger_ids=pids,
                onboard_count_after=len(car_copy.onboard_passenger_ids) if car_copy is not None else None,
                waiting_count_after=queues.get(resolved_stop_id) if resolved_stop_id is not None else None,
                stop_queues=queues,
            )
        )

    def serve_and_log_stop_passengers(
        streetcar: Streetcar,
        time_s: int,
        *,
        check_denials: bool,
    ) -> None:
        stop_id = streetcar.current_stop_id
        pre_onboard_ids = list(streetcar.onboard_passenger_ids)
        pre_waiting_count = len(stops_by_id[stop_id].waiting_passenger_ids) if stop_id is not None else 0
        events = handle_stop_passengers(
            inputs,
            streetcar,
            passengers,
            time_s,
            check_denials=check_denials,
        )
        alighted_set = set(events["alighted"])
        after_alight_ids = [pid for pid in pre_onboard_ids if pid not in alighted_set]
        after_board_ids = after_alight_ids + list(events["boarded"])

        if events["alighted"]:
            record(
                time_s,
                "alight",
                streetcar,
                stop_id=stop_id,
                passenger_ids=events["alighted"],
                onboard_override=after_alight_ids,
                waiting_override=pre_waiting_count,
            )
        if events["boarded"]:
            record(
                time_s,
                "board",
                streetcar,
                stop_id=stop_id,
                passenger_ids=events["boarded"],
                onboard_override=after_board_ids,
            )
        if events["denied"]:
            record(
                time_s,
                "deny",
                streetcar,
                stop_id=stop_id,
                passenger_ids=events["denied"],
                onboard_override=after_board_ids,
            )
        if events["beyond_segment"]:
            record(
                time_s,
                "beyond_segment",
                streetcar,
                stop_id=stop_id,
                passenger_ids=events["beyond_segment"],
            )

    # Serve passengers upon reaching a stop; terminate at TMU or schedule the stop dwell (inputs.stop_dwell_range_s).
    # B5 berth rule: only one streetcar occupies and serves a stop berth at a time.
    def begin_stop_service(streetcar: Streetcar, time_s: int) -> None:
        stop = stops_by_id[streetcar.current_stop_id]
        stop.serving_streetcar_id = streetcar.id
        is_terminus = streetcar.current_stop_id == inputs.stops[-1].id
        serve_and_log_stop_passengers(
            streetcar,
            time_s,
            check_denials=is_terminus or time_s >= duration_s,
        )
        if is_terminus:
            if stop.serving_streetcar_id == streetcar.id:
                stop.serving_streetcar_id = None
            terminate_streetcar(inputs, streetcar)
            record(time_s, "terminate", streetcar, stop_id=stop.id)
            active_streetcars.pop(streetcar.id)
            # Berth rule: admit the next queued streetcar waiting for the terminus berth.
            if stop_berth_queues[stop.id]:
                next_car_id = stop_berth_queues[stop.id].popleft()
                begin_stop_service(active_streetcars[next_car_id], time_s)
        else:
            # NOTE (B6): Passenger-dependent dwell calculation (door time + boardings/alightings)
            # is intentionally ignored per project plan; stop dwell is sampled from stop_dwell_range_s.
            dwell_low_s, dwell_high_s = inputs.stop_dwell_range_s
            # B2: Entity-keyed dwell stream so event order changes cannot shift dwell times
            car_dwell_rng = Random(f"{inputs.seed}:dwell:{streetcar.id}:{streetcar.current_stop_id}")
            planned_departure_s[streetcar.id] = time_s + car_dwell_rng.randint(dwell_low_s, dwell_high_s)

    # Depart a non-terminus stop once its sampled dwell time has elapsed.
    def finish_dwell_and_depart(streetcar: Streetcar, time_s: int) -> None:
        stop = stops_by_id[streetcar.current_stop_id]
        serve_and_log_stop_passengers(streetcar, time_s, check_denials=True)
        if stop.serving_streetcar_id == streetcar.id:
            stop.serving_streetcar_id = None
        planned_departure_s.pop(streetcar.id, None)
        depart_streetcar(inputs, streetcar, time_s)

        # Base link duration from stop definition
        base_duration_s = streetcar.expected_arrival_time_s - time_s

        # B7: Shared corridor delay applied across all links (up to max_corridor_delay_s, e.g. 60s)
        max_corridor_delay = getattr(inputs, "max_corridor_delay_s", 0.0)
        if max_corridor_delay > 0:
            shared_delay_rng = Random(f"{inputs.seed}:shared_corridor_delay")
            corridor_delay_s = shared_delay_rng.uniform(0, max_corridor_delay)
            link_delay_s = corridor_delay_s / len(inputs.link_travel_times_s)
        else:
            link_delay_s = 0.0

        base_with_delay = base_duration_s + link_delay_s

        # B2: Entity-keyed link noise draw so event order cannot shift draws across packages
        if travel_variation_share > 0:
            link_noise_rng = Random(f"{inputs.seed}:link_noise:{streetcar.id}:{streetcar.previous_stop_id}:{streetcar.next_stop_id}")
            travel_duration_s = link_noise_rng.uniform(
                base_with_delay * (1 - travel_variation_share),
                base_with_delay * (1 + travel_variation_share),
            )
        else:
            travel_duration_s = base_with_delay

        streetcar.expected_arrival_time_s = time_s + travel_duration_s

        # B5 no-overtaking rule: a streetcar cannot arrive at the next stop earlier
        # than any preceding car travelling to that stop.
        for other in active_streetcars.values():
            if (
                other.id != streetcar.id
                and other.status == "in_transit"
                and other.next_stop_id == streetcar.next_stop_id
                and other.expected_arrival_time_s is not None
                and streetcar.expected_arrival_time_s < other.expected_arrival_time_s
            ):
                streetcar.expected_arrival_time_s = other.expected_arrival_time_s

        record(time_s, "depart", streetcar, stop_id=stop.id)

        # B5 berth rule: if another streetcar was waiting for this stop's berth, admit it now.
        if stop_berth_queues[stop.id]:
            next_car_id = stop_berth_queues[stop.id].popleft()
            begin_stop_service(active_streetcars[next_car_id], time_s)

    # Advance one second at a time, including warm-up before start_time and final arrivals at the reporting cutoff.
    for time_s in range(start_time - warmup_s, end_time + 1):
        elapsed_s = time_s - start_time

        # Enqueue scheduled passengers whose stop-arrival time (get_to_stop_time) has arrived.
        while (
            next_passenger_idx < len(scheduled_passengers)
            and elapsed_s >= scheduled_passengers[next_passenger_idx].get_to_stop_time
        ):
            passenger = scheduled_passengers[next_passenger_idx]
            if passenger.status == "scheduled":
                passenger.status = "waiting"
                stop = stops_by_id[passenger.origin_stop_id]
                stop.waiting_passenger_ids.append(passenger.id)
                record(
                    elapsed_s,
                    "passenger_arrive",
                    None,
                    stop_id=stop.id,
                    passenger_ids=[passenger.id],
                )
            next_passenger_idx += 1

        # Update travelling cars that have reached their next stop and dwelling cars ready to depart.
        for streetcar in list(active_streetcars.values()):
            if streetcar.status == "in_transit" and elapsed_s >= streetcar.expected_arrival_time_s:
                arrive_streetcar(streetcar, elapsed_s)
                record(elapsed_s, "arrive", streetcar, stop_id=streetcar.current_stop_id)
                stop = stops_by_id[streetcar.current_stop_id]
                # B5 berth rule: only one streetcar serves the stop at a time.
                if stop.serving_streetcar_id is None:
                    begin_stop_service(streetcar, elapsed_s)
                else:
                    stop_berth_queues[stop.id].append(streetcar.id)
            elif streetcar.status == "at_stop" and streetcar.id in planned_departure_s:
                if elapsed_s >= planned_departure_s[streetcar.id]:
                    finish_dwell_and_depart(streetcar, elapsed_s)
                elif streetcar.id == stops_by_id[streetcar.current_stop_id].serving_streetcar_id:
                    serve_and_log_stop_passengers(
                        streetcar,
                        elapsed_s,
                        check_denials=elapsed_s >= duration_s,
                    )

        # Introduce cars whose entry time has been reached while the entry window is open.
        while elapsed_s < entry_end_s and next_entry_s is not None and elapsed_s >= next_entry_s:
            streetcar = generate_streetcar(inputs, f"streetcar-{len(streetcars) + 1}")
            if use_incoming_broadview_load:
                # Seed 12-24 riders already onboard from north of Broadview & Dundas (B2 entity-keyed stream).
                seed_incoming_passengers(
                    inputs,
                    streetcar,
                    passengers,
                    Random(f"{inputs.seed}:incoming:{streetcar.id}"),
                    elapsed_s,
                )
            streetcars.append(streetcar)
            active_streetcars[streetcar.id] = streetcar
            record(
                elapsed_s,
                "generate",
                streetcar,
                stop_id=streetcar.current_stop_id,
                passenger_ids=list(streetcar.onboard_passenger_ids),
            )
            stop = stops_by_id[streetcar.current_stop_id]
            # B5 berth rule: enter berth and begin service if free; otherwise queue for berth.
            if stop.serving_streetcar_id is None:
                begin_stop_service(streetcar, elapsed_s)
            else:
                stop_berth_queues[stop.id].append(streetcar.id)
            next_entry_s = next(entry_times, None)

    # Package the inputs, final state, activity history, and summary metrics as JSON-ready saved-run data.
    saved_inputs = asdict(inputs)
    saved_inputs['end_time_s']=end_time
    saved_inputs['analysis_window_elapsed_s']=[0,inputs.rush_hour_duration_s]
    saved_inputs['warmup_passenger_ids']=[p.id for p in passengers.values() if p.get_to_stop_time<0]
    for stop in saved_inputs["stops"]:
        stop["waiting_passenger_ids"] = list(stop["waiting_passenger_ids"])
    run_data = {
        "inputs": saved_inputs,
        "streetcars": [asdict(streetcar) for streetcar in streetcars],
        "passengers": [asdict(passenger) for passenger in passengers.values()],
        "sim_log": [asdict(entry) for entry in sim_log],
    }
    run_data["summary"] = analyze_simulation(run_data, runtime_s=perf_counter() - run_start_s)
    return run_data
