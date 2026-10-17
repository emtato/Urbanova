"""Streetcar entry timing, creation at Broadview and termination at TMU.

The runner calls these helpers for entry, movement and termination.
Times here are elapsed seconds from the start of the rush-hour window, following
SimulationInput; start_time_s/end_time_s are not interpreted as elapsed times.
"""

from collections.abc import Iterator
from math import isfinite
from random import Random

from .inputs import SimulationInput
from .objects import Passenger, Streetcar

#3 following helpers supply entry times, generate (and return) streetcar or terminate it
def streetcar_entry_times(inputs: SimulationInput) -> Iterator[float]:
    """Yield entries in [0, rush_hour_duration_s), including the first at zero.

    Each following gap is headway_s plus a uniformly sampled variation bounded
    by headway_randomness_s. The same seed reproduces the same entry schedule.
    Closing the entry window does not terminate cars still travelling to TMU.
    """
    if not isfinite(inputs.rush_hour_duration_s) or inputs.rush_hour_duration_s <= 0:
        raise ValueError("Rush-hour duration must be finite and positive")
    if not isfinite(inputs.headway_s) or inputs.headway_s <= 0:
        raise ValueError("Headway must be finite and positive")
    if not isfinite(inputs.headway_randomness_s) or not 0 <= inputs.headway_randomness_s < inputs.headway_s:
        raise ValueError("Headway randomness must be finite, nonnegative and smaller than headway")

    # Keep scheduling randomness independent of later passenger random choices.
    rng = Random(inputs.seed)
    time_s = 0.0
    while time_s < inputs.rush_hour_duration_s:
        yield time_s
        variation_s = rng.uniform(-inputs.headway_randomness_s, inputs.headway_randomness_s)
        next_time_s = time_s + inputs.headway_s + variation_s
        if next_time_s <= time_s:
            raise ValueError("The entry gap must advance simulation time")
        time_s = next_time_s


def generate_streetcar(inputs: SimulationInput, streetcar_id: str) -> Streetcar:
    """Create one empty car when its entry event occurs at the first stop.

    The caller supplies a unique ID, for example streetcar-1. The runner calls
    this at each entry time; no waiting/scheduled car is needed.
    """
    if not inputs.stops:
        raise ValueError("Streetcar generation requires an entry stop")
    if not streetcar_id:
        raise ValueError("Streetcars require a nonempty ID")
    if isinstance(inputs.streetcar_capacity, bool) or not isinstance(inputs.streetcar_capacity, int) or inputs.streetcar_capacity <= 0:
        raise ValueError("Streetcar capacity must be a positive integer")

    return Streetcar(
        id=streetcar_id,
        capacity=inputs.streetcar_capacity,
        current_stop_id=inputs.stops[0].id,
    )


def depart_streetcar(inputs: SimulationInput, streetcar: Streetcar, time_s: float) -> None:
    """Start the next link once stop dwell and passenger boarding/alighting complete."""
    if streetcar.status != "at_stop":
        raise ValueError("A streetcar must be at a stop before departing")
    stop_index = next(index for index, stop in enumerate(inputs.stops)
                      if stop.id == streetcar.current_stop_id)
    if stop_index == len(inputs.stops) - 1:
        raise ValueError("A streetcar at TMU must terminate instead of departing")

    streetcar.previous_stop_id = streetcar.current_stop_id
    streetcar.next_stop_id = inputs.stops[stop_index + 1].id
    streetcar.current_stop_id = None
    streetcar.status = "in_transit"
    streetcar.departure_time_s = time_s
    streetcar.expected_arrival_time_s = time_s + inputs.link_travel_times_s[stop_index]


def arrive_streetcar(streetcar: Streetcar, time_s: float) -> None:
    """Finish the current link once the runner's clock reaches its arrival time."""
    if (streetcar.status != "in_transit" or streetcar.next_stop_id is None
            or streetcar.expected_arrival_time_s is None):
        raise ValueError("A streetcar must be travelling toward a stop before arriving")
    if time_s < streetcar.expected_arrival_time_s:
        raise ValueError("A streetcar cannot arrive before its expected arrival time")

    streetcar.current_stop_id = streetcar.next_stop_id
    streetcar.previous_stop_id = None
    streetcar.next_stop_id = None
    streetcar.status = "at_stop"
    streetcar.departure_time_s = None
    streetcar.expected_arrival_time_s = None


def handle_stop_passengers(
    inputs: SimulationInput,
    streetcar: Streetcar,
    passengers: dict[str, Passenger],
    time_s: float,
) -> None:
    """Alight arriving riders, board waiting riders up to capacity, and mark overcrowding.

    Also handles the terminus (inputs.stops[-1]): riders boarding at or riding
    past TMU with destination_stop_id=None still board and record wait/denied-boarding
    state before crossing the corridor boundary as status='beyond_segment'.
    """
    if streetcar.status != "at_stop" or streetcar.current_stop_id is None:
        raise ValueError("A streetcar must be at a stop to serve passengers")
    stop = next(s for s in inputs.stops if s.id == streetcar.current_stop_id)

    # 1. Alight passengers whose destination is this stop.
    remaining_onboard: list[str] = []
    for pid in streetcar.onboard_passenger_ids:
        passenger = passengers[pid]
        if passenger.destination_stop_id == stop.id:
            passenger.status = "arrived"
            passenger.exit_time_s = time_s
            passenger.streetcar_id = None
        else:
            remaining_onboard.append(pid)
    streetcar.onboard_passenger_ids = remaining_onboard

    # 2. Board waiting passengers FIFO up to vehicle capacity.
    while stop.waiting_passenger_ids and len(streetcar.onboard_passenger_ids) < streetcar.capacity:
        pid = stop.waiting_passenger_ids.popleft()
        passenger = passengers[pid]
        passenger.status = "onboard"
        passenger.streetcar_id = streetcar.id
        passenger.boarding_time_s = time_s
        streetcar.onboard_passenger_ids.append(pid)

    # 3. Overcrowding: anyone still waiting in the queue could not board this car.
    if len(streetcar.onboard_passenger_ids) >= streetcar.capacity:
        for pid in stop.waiting_passenger_ids:
            passengers[pid].denied_boarding_once = True

    # 4. At the terminus, riders heading beyond the modelled segment cross the boundary.
    if stop.id == inputs.stops[-1].id:
        still_onboard: list[str] = []
        for pid in streetcar.onboard_passenger_ids:
            passenger = passengers[pid]
            if passenger.destination_stop_id is None:
                passenger.status = "beyond_segment"
                passenger.exit_time_s = time_s
                passenger.streetcar_id = None
            else:
                still_onboard.append(pid)
        streetcar.onboard_passenger_ids = still_onboard


def terminate_streetcar(inputs: SimulationInput, streetcar: Streetcar) -> None:
    """Mark a car finished after it arrives at the last supplied stop (TMU).

    Keep the object and terminus ID available for later results. Passenger
    alighting must happen before this call once passenger handling is added.
    """
    if not inputs.stops:
        raise ValueError("Streetcar termination requires a terminus stop")
    if streetcar.status != "at_stop" or streetcar.current_stop_id != inputs.stops[-1].id:
        raise ValueError("A streetcar must be at the terminus before it can finish")
    if streetcar.onboard_passenger_ids:
        raise ValueError("All passengers must alight before a streetcar terminates")

    streetcar.status = "finished"
    streetcar.previous_stop_id = None
    streetcar.next_stop_id = None
    streetcar.departure_time_s = None
    streetcar.expected_arrival_time_s = None
