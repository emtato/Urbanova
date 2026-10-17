"""The shared activity record for every action in the simulation.

SimLog is intended to cover all activity: passenger arrivals, queue changes,
boarding, alighting, streetcar movement and any other simulated action.
Its current action types and snapshot field support the streetcar portion;
extend them as each additional part of the simulation is implemented.
"""

from dataclasses import dataclass
from typing import Literal

from .streetcar import Streetcar

SimAction = Literal["generate", "arrive", "depart", "terminate"]


@dataclass(frozen=True)
class SimLog:
    """One action at a point in time, with the relevant state captured then."""

    time_s: float  # Elapsed seconds from inputs.start_time_s, including fractions.
    action: SimAction
    streetcar: Streetcar  # A copy, so later changes cannot rewrite this history.
