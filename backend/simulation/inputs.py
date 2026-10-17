"""All necessary inputs/personalization for one simulation run, independent of frontend controls."""

# FIELD GUIDE FOR TEAM A AND SCENARIO CONTROLS
# Values can come from data or explicit assumptions; identify which when sharing them.
# All durations below are in seconds. Shares are fractions: 0.4 means 40%.
# This is a draft input contract; destination choices, incoming vehicle loads and
# boarding/alighting dwell rules still need to be agreed upon separately.
#
# stops:
#   All stops on the selected 505 Dundas segment between broadview and TMU,
#   including the endpoints. For WESTBOUND travel, supply them in the order
#   Broadview -> Jarvis, not Jarvis -> Broadview. Each Stop supplies its ID, name,
#   latitude, longitude and zero-based sequence along that direction.
#   Start waiting_passenger_ids empty and serving_streetcar_id as None; those
#   fields describe changing run state, not data Team A needs to collect.
#
# existing_residences:
#   Clusters of existing housing that contribute baseline residential demand.
#   Each cluster includes its ID, name, representative coordinates, total_units,
#   occupied_share, residents_per_occupied_unit, transit_share and accessible_stop_ids.
#   accessible_stop_ids are stops the cluster's residents could feasibly walk to.
#   Estimated residents = total_units * occupied_share * residents_per_occupied_unit.
#   Do not add this demand again if it is already included in another baseline source.
#
# developments:
#   The selected three proposed residential developments that add scenario demand.
#   Each includes its ID, name, coordinates, net_added_units, occupied_share,
#   residents_per_occupied_unit, transit_share and accessible_stop_ids.
#   net_added_units excludes homes being replaced. occupied_share controls how
#   much of the development is occupied in the selected scenario/phase.
#   Estimated added residents = net_added_units * occupied_share * residents_per_occupied_unit.
#   In BOTH housing types, transit_share is the fraction of trips using transit,
#   not the fraction of residents who ever use transit. It does not yet select
#   which transit trips use our particular corridor and direction.
#
# link_travel_times_s:
#   Time to travel from each stop to the next, excluding boarding/alighting time.
#   For stops (A, B, C), supply (A-to-B seconds, B-to-C seconds).
#   There must be exactly one fewer travel time than stops. If using schedule
#   differences as a proxy, label them: they may include dwell at stops.
#
# streetcar_capacity:
#   Maximum total passengers allowed onboard one streetcar, seated AND standing.
#   This initial model uses the same capacity for every generated streetcar.
#
# headway_s:
#   Target/mean gap between successive streetcars entering at Broadview.
#   For example, 300 means one streetcar every five minutes. This is an entry
#   interval, not travel time between stops; gaps downstream can change during a run.
#
# rush_hour_duration_s:
#   Length of the passenger-arrival window being studied. For example, 7200
#   represents two hours. Simulation time zero is the beginning of that window;
#   this field does not specify a calendar date or a wall-clock start time.
#   It is not the final simulation cutoff: passengers may need service afterward.
#
# trips_per_resident_in_window:
#   Average trips per resident during this entire rush-hour window, BEFORE
#   applying transit_share. For example, 0.3 means 300 trips per 1,000 residents.
#   This is not a daily trip rate or an additional percentage of transit users.
#   The initial model applies the same rate to existing and new residents.
#
# headway_randomness_s (OPTIONAL; defaults to 0):
#   Maximum amount an individual entry gap may vary above/below headway_s.
#   With headway_s=300 and randomness=30, gaps would be between 270 and 330 seconds.
#   Leave at zero for regular service if suitable variability data is unavailable.
#   Helpful if Team A can supply observed headways, but this parameter is a bounded
#   scenario assumption, not a standard deviation. Keep it below headway_s.
#
# commuter_distribution (OPTIONAL; defaults to uniform arrivals):
#   Shape of passenger arrivals over rush hour, often envisioned as a bell curve:
#   fewer arrivals early, more around the peak, then fewer toward the end.
#   Represent the shape with non-negative relative weights for equal time bins.
#   For a two-hour window, (1, 4, 6, 4, 1) means five 24-minute bins; each bin
#   receives its weight / 16 of total demand. This approximates a bell-shaped peak.
#   The weights control WHEN trips occur, not how many trips there are in total.
#   They need not sum to 1, but must be non-empty with a positive total.
#   Team A can provide an observed time profile if available; otherwise label the
#   bell curve as an assumption. (1.0,) means evenly spread across the window.
#
# seed (INTERNAL; defaults to 0):
#   Number controlling reproducible random choices. With the same complete inputs
#   and model version, the same seed should reproduce the same run.
#   Team A does not need to find this in real-world data.

from dataclasses import dataclass

from .objects import Development, ExistingResidences, Stop


@dataclass(frozen=True)
class SimulationInput:
    # Westbound study segment: Broadview -> Jarvis.
    stops: tuple[Stop, ...]
    existing_residences: tuple[ExistingResidences, ...]
    developments: tuple[Development, ...]

    # Movement time between adjacent stops, excluding dwell.
    link_travel_times_s: tuple[float, ...]
    streetcar_capacity: int
    headway_s: float  # Mean entry gap in seconds; 300 = every five minutes.

    # Rush hour starts at simulation time zero.
    rush_hour_duration_s: float
    trips_per_resident_in_window: float  # Before applying each housing object's transit share.

    # Optional bounded variation in entry gaps; 0 = regular service.
    headway_randomness_s: float = 0.0
    # Arrival weights over equal time bins; e.g. (1, 4, 6, 4, 1) for a bell-shaped peak.
    commuter_distribution: tuple[float, ...] = (1.0,)
    seed: int = 0  # Reproduce random choices when comparing scenarios.

    start_time_s: float = 0.0 # usser provided
    end_time_s: float = 0.0
