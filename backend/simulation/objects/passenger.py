"""One passenger's planned journey and changing simulation state."""

from dataclasses import dataclass
from typing import Literal


@dataclass
class Passenger:
    id: str
    origin_stop_id: str
    # None means the destination is beyond the modelled corridor.
    destination_stop_id: str | None
    arrival_time_s: float  # Seconds from simulation start, not a wall-clock time.
    rider_group: Literal["existing", "new"]
    development_id: str | None = None
    # Scheduled passengers have not yet joined a stop queue.
    status: Literal["scheduled", "waiting", "onboard", "arrived", "beyond_segment"] = "scheduled"
    streetcar_id: str | None = None  # Current vehicle only; cleared on exit.
    boarding_time_s: float | None = None
    exit_time_s: float | None = None  # Alighting or crossing the corridor boundary.
    # Remains true even if the passenger boards a later vehicle.
    denied_boarding_once: bool = False
