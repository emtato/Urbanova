"""The shared activity record for every action in the simulation.

SimLog covers all simulated activity:
  - "passenger_arrive": a passenger reaches their origin stop and joins its waiting queue
  - "generate": a streetcar enters the corridor at Broadview (with any incoming load)
  - "arrive": a streetcar reaches a downstream stop
  - "alight": passengers exit a streetcar at their destination stop
  - "board": waiting passengers board a streetcar at a stop
  - "deny": waiting passengers are left behind by a full streetcar
  - "beyond_segment": onboard passengers continue west past the TMU terminus
  - "depart": a streetcar finishes stop dwell and starts the next link
  - "terminate": a streetcar finishes service at the TMU terminus
"""

from dataclasses import dataclass, field
from typing import Literal

from .streetcar import Streetcar

SimAction = Literal[
    "passenger_arrive",
    "generate",
    "arrive",
    "alight",
    "board",
    "deny",
    "beyond_segment",
    "depart",
    "terminate",
]


@dataclass(frozen=True)
class SimLog:
    """One action at a point in time, with the relevant vehicle, stop, and queue state."""

    time_s: int  # Elapsed whole seconds from inputs.start_time_s.
    action: SimAction
    streetcar: Streetcar | None = None  # Deep copy of the streetcar (None for passenger_arrive).
    stop_id: str | None = None  # Stop where this action occurred (or departed from on "depart").
    count: int = 0  # Number of passengers involved in this action (0 for pure movement events).
    existing_count: int = 0  # Existing-residence riders involved in this action.
    new_count: int = 0  # New-development riders involved in this action.
    passenger_ids: list[str] = field(default_factory=list)  # IDs of the passengers involved in this action.
    onboard_count_after: int | None = None  # Streetcar load immediately after this action.
    waiting_count_after: int | None = None  # Waiting queue length at `stop_id` after this action.
    stop_queues: dict[str, int] = field(default_factory=dict)  # Snapshot of {stop_id: queue_len} across all stops.

