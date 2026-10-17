"""An existing housing cluster used to generate baseline residential demand."""

from dataclasses import dataclass


@dataclass(frozen=True)
class ExistingResidences:
    id: str
    name: str
    # Representative location of the cluster, rather than an individual building.
    latitude: float
    longitude: float
    resident_count: int  # Residents, not passengers; trip assumptions come later.
    # Candidate stops; walking distances and allocation rules come later.
    accessible_stop_ids: tuple[str, ...] = ()
