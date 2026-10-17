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
#   Broadview -> TMU, not TMU -> Broadview. Each Stop supplies its ID, name,
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
#   User-selected maximum variation in an entry gap, measured in SECONDS, not a share.
#   For each gap, draw an offset uniformly between -headway_randomness_s and
#   +headway_randomness_s, then add that offset to headway_s. The first car enters at 0.
#   With headway_s=300 and randomness=30, gaps would be between 270 and 330 seconds.
#   To express a percentage, convert it to seconds: 10% of a 300 s headway is 30 s.
#   Use 0 for regular entries; require 0 <= headway_randomness_s < headway_s.
#   This is a scenario setting, not required data collection or a standard deviation.
#   Observed entry gaps can help choose it later. It changes entry timing, not travel speed.
#
# link_travel_time_variation_share (OPTIONAL; defaults to 0):
#   User-selected scenario setting; Team A does NOT need to collect this value.
#   It is the maximum fractional variation in each link's travel TIME, not the
#   probability of stopping or a direct change to speed. Require 0 <= share < 1.
#   Intended behaviour: draw one duration uniformly between base_time * (1 - share)
#   and base_time * (1 + share) when each streetcar starts each link.
#   For a 120 s link, 0.25 means a duration between 90 and 150 s. Use 0 for fixed times.
#   This models combined road variability around the baseline; it is not extra
#   positive delay added on top. The runner acts when its whole-second clock is due.
#   TODO: Connect this input to travel-duration sampling in the movement helper.
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
    # Westbound study segment: Broadview -> TMU.
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
    start_time_s: int  # usser provided (seconds after midnight)
    end_time_s: int  # User-provided reporting cutoff in service-day seconds.

    # Optional bounded variation in entry gaps; 0 = regular service.
    headway_randomness_s: float = 0.0  # User-selected seconds: 30 with a 300 s headway gives 270–330 s gaps.
    # Arrival weights over equal time bins; e.g. (1, 4, 6, 4, 1) for a bell-shaped peak.
    commuter_distribution: tuple[float, ...] = (1.0,)
    seed: int = 0  # Reproduce random choices when comparing scenarios.
    link_travel_time_variation_share: float = 0.0  # User-selected: 0.25 means 90–150 s for a 120 s link; see TODO above.


# CURRENT DATA AUDIT — repository files checked on 2026-10-17 9AM.
# Sources: data/reviewed/, docs/data-handoff.md and docs/feasibility.md.
# These findings describe the collected evidence, not measurements of every DTO field.
#
# GOOD SOURCE QUALITY FOR THE STATED PURPOSE — already collected:
# - stops: official GTFS IDs, coordinates, travel order and route geometry for
#   9 stops / 8 links, 505 westbound Broadview -> TMU, roughly 2.51 km.
# - Schedule: 17 planned entries during 07:00–09:00 on 2026-10-16, with scheduled
#   arrival/departure times and one scheduled median duration per adjacent stop pair.
# - Proposed developments: municipal application IDs, addresses, coordinates,
#   pipeline stages and proposed units in data/reviewed/developments.csv:
#   239 Dundas St E: 630; 500 Dundas St E: 413; 761 Dundas St E: 1,197.
#   These are published PROPOSED counts, not verified net-added or occupied homes.
# - Provenance: source URLs, dataset versions, retrieval dates, checksums and licences.
#
# USABLE ESTIMATES / LIMITS — do not present these as observed operating conditions:
# - link_travel_times_s: supplied values are SCHEDULED medians, not measured journey
#   times or clear-road running times. They may already allow for normal road delays.
# - headway_s: the 16 gaps between scheduled entries range from 300 to 657 seconds.
#   Their mean is 419.8125 s; the published 360 s figure is the MEDIAN, not the mean.
#   These describe the timetable, not actual gaps caused by service disruptions.
# - accessible_stop_ids: nearest stops have been identified for all 3 proposals.
#   Estimated walks are approximately 272 / 229 / 270 m respectively. Entrances,
#   connectors and crossings still require review; alternative accessible stops
#   have not been reviewed. Address-point coordinates are not confirmed entrances.
#
# STILL MISSING — buildings are not the only incomplete part of the input bundle:
# - existing_residences: existing housing clusters, their total_units, occupancy,
#   residents per occupied unit, transit shares and accessible stop assignments.
# - developments: replacement-home counts / net_added_units, occupied_share,
#   residents_per_occupied_unit and transit_share for the chosen scenario/phase.
#   Proposed units alone cannot supply those values; collect evidence or label assumptions.
# - streetcar_capacity: no sourced vehicle capacity is included in the reviewed bundle.
# - trips_per_resident_in_window: no sourced trip rate for the selected window.
# - Observed entry gaps, link travel-time variation and passenger-arrival profiles
#   are not included, so the randomness/profile settings are not calibrated yet.
# - Passenger destinations, corridor/direction choice, incoming vehicle occupancy,
#   boarding/alighting rates and dwell rules still need evidence or model decisions.
#   Some of these are future model needs rather than fields in this DTO today.
#
# USER-SELECTED SETTINGS — Team A does not have to collect these to run an assumed scenario:
# - headway_randomness_s: keep as a user-selected bound in seconds for now.
#   Team A CAN help calibrate it by recording actual westbound passage times at
#   Broadview and calculating successive gaps, manually or using vehicle tracking.
#   Actual passages are needed; countdown predictions or timetable gaps are not
#   measurements of real service variability. Collecting this is an optional task.
# - link_travel_time_variation_share: user-selected relative variation; actual
#   journey observations could guide it later. Sampling is not connected yet.
# - commuter_distribution: user-selected arrival shape until observations exist.
# - start_time_s, end_time_s and rush_hour_duration_s: chosen analysis boundaries;
#   the collected schedule covers the selected 07:00–09:00 window (7,200 seconds).
# - seed: an internal reproducibility control, not a real-world measurement.
# - Missing occupancy, household-size and transit/trip-rate values can initially
#   be explicit user assumptions; they must not be labelled as collected facts.
#
# data/fixtures/ contains synthetic examples; its numbers do not fill these data gaps.
