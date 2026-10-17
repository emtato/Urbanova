"""Fixed housing inputs used to generate passengers before a simulation run."""

from dataclasses import dataclass


@dataclass(frozen=True)
class Development:
    id: str
    name: str
    latitude: float
    longitude: float
    net_added_units: int  # Added homes after accounting for replaced homes.
    occupied_share: float  # Scenario assumption from 0 to 1 for the selected phase.
    # Candidate stops only; walking distances and allocation rules come later.
    accessible_stop_ids: tuple[str, ...] = ()
