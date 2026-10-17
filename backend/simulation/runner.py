"""Run one simulation using the supplied scenario inputs."""

from copy import deepcopy
from dataclasses import asdict
from math import isfinite

from .inputs import SimulationInput
from .objects import SimLog, Streetcar
from .objects.sim_log import SimAction
from .streetcars import (
    arrive_streetcar,
    depart_streetcar,
    generate_streetcar,
    streetcar_entry_times,
    terminate_streetcar,
)


def run_simulation(inputs: SimulationInput) -> dict:
    """Run empty streetcars and return their activity and final state as JSON-ready data.

    start/end are service-day seconds; activity and vehicle times are elapsed
    from the start. Actions happen on whole-second ticks once their time is due.
    Entry stops at the earlier of the rush-window end or run end.
    Cars still travelling at run end stay in transit in the saved state.
    """
    # TODO: Add passenger generation, queues, boarding/alighting, dwell and metrics.

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

    # Keep active cars for updates, all cars for results, and every action for replay.
    duration_s = end_time - start_time
    entry_end_s = min(inputs.rush_hour_duration_s, duration_s)
    streetcars: list[Streetcar] = []
    active_streetcars: dict[str, Streetcar] = {}
    sim_log: list[SimLog] = []

    # Prepare the entry schedule so the clock knows when to introduce each car.
    entry_times = streetcar_entry_times(inputs) #from streetcars.py helper, returns list
    next_entry_s = next(entry_times, None)

    # Preserve each action's state in the shared history for saving and replaying the run.
    def record(time_s: int, action: SimAction, streetcar: Streetcar) -> None:
        sim_log.append(SimLog(time_s, action, deepcopy(streetcar)))

    # Route a car onward after a stop, or retire it when it reaches the corridor exit.
    def continue_or_terminate(streetcar: Streetcar, time_s: int) -> None:
        if streetcar.current_stop_id == inputs.stops[-1].id:
            terminate_streetcar(inputs, streetcar)
            record(time_s, "terminate", streetcar)
            active_streetcars.pop(streetcar.id)
        else:
            # TODO: Add passenger handling and dwell before starting the next link.
            depart_streetcar(inputs, streetcar, time_s)
            record(time_s, "depart", streetcar)

    # Advance one second at a time, including final arrivals at the reporting cutoff.
    for time_s in range(start_time, end_time + 1):
        elapsed_s = time_s - start_time

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
        "sim_log": [asdict(entry) for entry in sim_log],
    }
