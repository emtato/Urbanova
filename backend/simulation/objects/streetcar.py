"""One streetcar's capacity, passengers and position along the corridor."""

from dataclasses import dataclass, field
from typing import Literal


@dataclass
class Streetcar:
    id: str
    capacity: int
    # Passenger records hold destinations; occupancy is len(onboard_passenger_ids).
    onboard_passenger_ids: list[str] = field(default_factory=list)
    status: Literal["scheduled", "at_stop", "in_transit", "finished"] = "scheduled"
    current_stop_id: str | None = None  # Set while at a stop; None during travel.
    # During travel, these endpoints identify the link without moving coordinates.
    previous_stop_id: str | None = None
    next_stop_id: str | None = None
    departure_time_s: float | None = None
    expected_arrival_time_s: float | None = None
