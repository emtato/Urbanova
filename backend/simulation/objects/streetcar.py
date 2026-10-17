"""One streetcar's capacity, passengers and position along the corridor."""

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class Streetcar:
    id: str
    capacity: int
    # Passenger records hold each's destinations; occupancy is len(onboard_passenger_ids).
    onboard_passenger_ids: list[str] = field(default_factory=list)
    status: Literal["at_stop", "in_transit", "finished"] = "at_stop" #streetcar enters simulatoin at first station "pops in". no need to have it scheduled to enter in advane
    current_stop_id: str | None = None  # Set while at a stop; None during travel.
    # During travel, these endpoints identify the link without moving coordinates.
    previous_stop_id: str | None = None
    next_stop_id: str | None = None
    departure_time_s: float | None = None #departure from latest stop
    expected_arrival_time_s: float | None = None #expected arrival at next stop
