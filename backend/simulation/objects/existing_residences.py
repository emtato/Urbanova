"""An existing housing cluster used to generate baseline residential demand."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ExistingResidences:
    id: str
    name: str
    # Representative location of the cluster, rather than an individual building.
    latitude: float
    longitude: float
    total_units: int  # Total homes in the existing housing cluster.
    occupied_share: float  # Fraction of homes occupied, from 0 to 1.
    residents_per_occupied_unit: float  # Average people per occupied home.
    transit_share: float  # Fraction of trips in the modelled window using transit, 0 to 1.
    # stops that this building's residents would feasibly use (likely 1 closest and 2nd closest)
    accessible_stop_ids: tuple[str, ...] = ()
