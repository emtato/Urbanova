"""One passenger's planned journey and changing simulation state."""

from dataclasses import dataclass
from typing import Literal


@dataclass
class Passenger:
    id: str
    origin_stop_id: str #depart from
    # None means the destination is beyond the modelled corridor.
    destination_stop_id: str | None
    get_to_stop_time: float  # time when passenger arrives at stop. calculate wait time by doing boarding_time - get_to_stop_time
    rider_group: Literal["existing", "new"]
    development_id: str | None = None #if rider group new, str
    status: Literal["scheduled", "waiting", "onboard", "arrived", "beyond_segment"] = "scheduled"     # Scheduled passengers have not yet joined a stop queue.
    streetcar_id: str | None = None  # Current vehicle only; cleared on exit.
    boarding_time_s: float | None = None #objective time (since simulation start) of boarding
    exit_time_s: float | None = None  # Alighting or crossing the corridor boundary.
    denied_boarding_once: bool = False     # Remains true even if the passenger boards a later vehicle: useful log to keep track of how many people couldnt board because of overcrowding

