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
    residents_per_occupied_unit: float  # Average people per occupied home.
    transit_share: float  # Fraction of trips in the modelled window using transit, 0 to 1.
    # stops that this new building's residents would feasibly use (likely 1 closest and 2nd closest)
    accessible_stop_ids: tuple[str, ...] = ()
