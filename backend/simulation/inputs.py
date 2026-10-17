"""All necessary inputs/personalization for one simulation run, independent of frontend controls."""

from dataclasses import dataclass

from .objects import Development, ExistingResidences, Stop


@dataclass(frozen=True)
class SimulationInput:
    # Pass stops in travel order. Housing objects already contain occupancy
    # and transit share, so those settings aren't duplicated here.
    stops: tuple[Stop, ...]
    existing_residences: tuple[ExistingResidences, ...]
    developments: tuple[Development, ...]

    # One travel time per adjacent pair of stops: A->B, B->C, etc.
    link_travel_times_s: tuple[float, ...]
    streetcar_capacity: int
    headway_s: float  # Average seconds between entries at the first stop.

    # Rush hour starts at simulation time zero.
    rush_hour_duration_s: float
    trips_per_resident_in_window: float  # Before applying each housing object's transit share.

    # Maximum deviation from headway_s: 30 means gaps can vary by +/-30 seconds.
    # Zero means regular service; keep this smaller than headway_s.
    headway_randomness_s: float = 0.0
    # Relative arrival weights for equal parts of rush hour.
    # (1.0,) is uniform; (1.0, 2.0, 1.0) puts half the arrivals in the middle third.
    commuter_distribution: tuple[float, ...] = (1.0,)
    seed: int = 0  # Reproduce random choices when comparing scenarios.
