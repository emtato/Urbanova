"""A corridor stop and its current waiting queue."""

from collections import deque
from dataclasses import dataclass, field


@dataclass
class Stop:
    id: str
    name: str
    sequence: int  # Zero-based position in the corridor's direction of travel.
    latitude: float
    longitude: float
    # FIFO: append arrivals on the right, board from the left.
    waiting_passenger_ids: deque[str] = field(default_factory=deque)
    # None means the berth is free; initially assume one serving vehicle per stop.
    serving_streetcar_id: str | None = None
