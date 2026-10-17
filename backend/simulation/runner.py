"""Run one simulation using the supplied scenario inputs."""

from copy import deepcopy
from dataclasses import asdict
from math import inf, isfinite

from .inputs import SimulationInput
from .objects import SimLog, Streetcar
from .objects.sim_log import SimAction
from .streetcars import (arrive_streetcar, depart_streetcar, generate_streetcar, streetcar_entry_times, terminate_streetcar, )


def run_simulation(inputs: SimulationInput) -> dict:
    """Run empty streetcars and return their activity and final state as JSON-ready data.

    start/end are service-day seconds; activity and vehicle times are elapsed
    from the start. Entry stops at the earlier of the rush-window end or run end.
    Cars still travelling at run end stay in transit in the saved state.
    """
    # 1. Create fresh run state and generate passengers from the housing inputs.
    # 2. Schedule passenger arrivals and streetcar entries using the input settings.
    # 3. Process events and collect results for metrics and replay.
    # TODO: Add passenger generation, queues, boarding/alighting, dwell and metrics.
    start_time = inputs.start_time_s
    end_time = inputs.end_time_sx

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

    duration_s = end_time - start_time
    streetcars: list[Streetcar] = []  # Retain finished cars for the saved result.
    active_streetcars: dict[str, Streetcar] = {}
    sim_log: list[SimLog] = []  # Shared history for all actions; currently recording streetcars.
    entry_times = streetcar_entry_times(inputs)
    next_entry_s = next(entry_times, None)

    def record(time_s: float, action: SimAction, streetcar: Streetcar) -> None:
        # Never append the live object: its later mutations would alter old entries.
        sim_log.append(SimLog(time_s, action, deepcopy(streetcar)))

    def continue_or_terminate(streetcar: Streetcar, time_s: float) -> None:
        if streetcar.current_stop_id == inputs.stops[-1].id:
            terminate_streetcar(inputs, streetcar)
            record(time_s, "terminate", streetcar)
            active_streetcars.pop(streetcar.id)
        else:
            # Zero dwell for this portion; passenger handling will go here later.
            depart_streetcar(inputs, streetcar, time_s)
            record(time_s, "depart", streetcar)

    for time_s in range(start_time, end_time):
        tick_end_s = time_s + 1 - start_time

        # Process exact event times inside this second, so fractions aren't lost.
        while True:
            entry_s = next_entry_s if next_entry_s is not None and next_entry_s < duration_s else inf
            arriving_car = min(active_streetcars.values(), key=lambda car: car.expected_arrival_time_s, default=None)
            arrival_s = arriving_car.expected_arrival_time_s if arriving_car is not None else inf
            event_time_s = min(entry_s, arrival_s)
            if event_time_s > tick_end_s:
                break

            # At equal timestamps, generation is processed before arrival.
            if entry_s <= arrival_s:
                streetcar = generate_streetcar(inputs, f"streetcar-{len(streetcars) + 1}")
                streetcars.append(streetcar)
                active_streetcars[streetcar.id] = streetcar
                record(event_time_s, "generate", streetcar)
                continue_or_terminate(streetcar, event_time_s)
                next_entry_s = next(entry_times, None)
            else:
                arrive_streetcar(arriving_car, event_time_s)
                record(event_time_s, "arrive", arriving_car)
                continue_or_terminate(arriving_car, event_time_s)

    # Dataclasses make convenient runtime records; dictionaries/lists can be saved
    # directly as JSON. Include inputs so a replay also has route coordinates.
    saved_inputs = asdict(inputs)
    for stop in saved_inputs["stops"]:
        stop["waiting_passenger_ids"] = list(stop["waiting_passenger_ids"])
    return {"inputs": saved_inputs, "streetcars": [asdict(streetcar) for streetcar in streetcars], "sim_log": [asdict(entry) for entry in
                                                                                                               sim_log], }
