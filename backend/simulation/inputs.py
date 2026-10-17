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
#   The runner samples this duration once per link departure; arrivals occur on
#   the first whole-second tick that reaches the sampled expected arrival time.
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

    # User-provided scenario inputs for service variability and arrival shape.
    headway_randomness_s: float = 0.0  # User input (seconds): 30 with a 300 s headway gives 270–330 s gaps; 0 = regular service.
    commuter_distribution: tuple[float, ...] = (1.0,)  # User input: arrival weights over equal time bins; e.g. (1, 4, 6, 4, 1).
    seed: int = 0  # Reproduce random choices when comparing scenarios.
    link_travel_time_variation_share: float = 0.0  # User input: 0.25 means 90–150 s for a 120 s link; 0 keeps fixed times.
    # Model assumptions: values, ranges and status live in data/reviewed/simulation_input.json
    # (field_metadata). Defaults match that file so hand-built test inputs behave the same.
    westward_share: float = 0.6  # Share of commuters assigned a workplace west of home.
    walk_limit_m: float = 750.0  # Longest walk to work, a Line 1 station or a 505 stop.
    parallel_route_bands: tuple[float, float] = (0.40, 0.60)  # Fraction of the way to College/Queen: below the first -> all consider the 505; up to the second -> half.
    incoming_load_range: tuple[int, int] = (12, 24)  # Riders already aboard each car entering at Broadview & Dundas (uniform, inclusive).
    stop_dwell_range_s: tuple[int, int] = (15, 30)  # Dwell seconds at each non-terminus stop (uniform, inclusive).
    max_corridor_delay_s: float = 0.0  # B7: Maximum common corridor delay across all links (seconds, e.g. 60.0); 0 = disabled.
    # NOTE (B6): B6 passenger-dependent dwell calculation (door time + boardings/alightings feedback)
    # is intentionally ignored/omitted per project plan; stop dwell remains bounded by stop_dwell_range_s.


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
#   journey observations could guide it later. Sampling is connected in runner.py.
# - commuter_distribution: user-selected arrival shape until observations exist.
# - start_time_s, end_time_s and rush_hour_duration_s: chosen analysis boundaries;
#   the collected schedule covers the selected 07:00–09:00 window (7,200 seconds).
# - seed: an internal reproducibility control, not a real-world measurement.
# - Missing occupancy, household-size and transit/trip-rate values can initially
#   be explicit user assumptions; they must not be labelled as collected facts.
#
# data/fixtures/ contains synthetic examples; its numbers do not fill these data gaps.


# DATA & SIMULATION PROGRESS UPDATE — checked on 2026-10-17 (11:45 AM).
# Sources: data/reviewed/simulation_input.json, data/simulation_input.py,
# backend/simulation/commute.py, backend/simulation/runner.py, and docs/simulation-data.md.
#
# ALL SimulationInput DTO FIELDS ARE NOW POPULATED AND VALIDATED:
# - Loader: `from data.simulation_input import load_simulation_input` loads
#   `data/reviewed/simulation_input.json` directly into `SimulationInput` with fresh
#   empty `Stop` queues and validates all field types and invariants.
# - existing_residences (RESOLVED): 591 residential building records (30,663 total units:
#   58 RentSafeTO apartment registrations with 6,269 units + 533 expanded mapped residential
#   buildings from `building_unit_inventory.json`). Populated with `occupied_share=0.97`
#   (CMHC 2025 rental vacancy), `residents_per_occupied_unit` (1.6–2.2 from 2021 Census
#   neighbourhood profiles), `transit_share=0.2981` (2022 TTS Ward 13 AM share), and up
#   to 2 OSM network-walk `accessible_stop_ids` (<= 500 m).
# - developments (RESOLVED): All 3 proposed developments are populated with `net_added_units`
#   (`624` at 239 Dundas St E, `413` at 500 Dundas St E, `1,197` at 761 Dundas St E;
#   replacement units are already handled / ignored where zero), `occupied_share=1.0`,
#   2021 Census neighbourhood household size, 2022 TTS `transit_share`, and up to 2 OSM
#   network-walk `accessible_stop_ids`.
# - streetcar_capacity (RESOLVED): Sourced at `251` (TTC Flexity Outlook LFLRV physical
#   crush limit: 70 seated + 181 standing; historical 2019 planned load of `130` is also
#   recorded in `simulation_sources.json` and can be passed via `overrides`).
# - trips_per_resident_in_window (RESOLVED): Sourced/derived at `0.231057` trips/resident
#   for the 2-hour 07:00–09:00 window (2022 TTS Ward 13 AM peak resident trips scaled by 2/3).
#
# 505-SPECIFIC COMMUTE DEMAND, ROUTING, INCOMING LOADS & DWELL:
# The five model assumptions below are SimulationInput fields (westward_share, walk_limit_m,
# parallel_route_bands, incoming_load_range, stop_dwell_range_s). Their values, units,
# status and meaning live in data/reviewed/simulation_input.json
# (field_metadata), set from data/sources/simulation_selection.json -> model_assumptions.
# Change them there or with load_simulation_input(overrides=...), not in the code.
# - Workplace destinations & Line 1 stations: `data/reviewed/workplaces_2021.json` (585
#   City of Toronto census tracts weighted by 2021 employment), `line1_stations.json`,
#   and full-route `route_505.json` are loaded by `backend/simulation/commute.py`.
# - Parallel streetcar catchment split (`corridor_505_share` in `commute.py`): Accounts
#   for 506 College (~580 m north) and 501 Queen (~450 m south): <40% of distance to
#   College/Queen -> 100% evaluated for 505; 40%–60% -> 50%; >60% -> 0% (use Queen/College).
#   Bands come from `parallel_route_bands`.
# - 750 m routing rule (`sample_streetcar_trip` in `commute.py`): Samples a workplace
#   (60% west of home, 40% elsewhere) and filters out walk-to-work (<= 750 m), direct
#   Line 1 subway trips, and unserved trips; returns westbound 505 boarding and alighting
#   stops (or `None` / `beyond_segment` when riding past TMU). The 60% and 750 m come from
#   `westward_share` and `walk_limit_m`.
# - Incoming Broadview streetcar load (`seed_incoming_passengers` in `runner.py`):
#   Streetcars entering at Broadview & Dundas (`ttc-stop-1756`) are seeded with a uniform
#   random number of already-onboard passengers from `incoming_load_range` (currently 12–24).
# - Stop dwell time (`run_simulation` in `runner.py`): uniform random seconds per non-terminus
#   stop from `stop_dwell_range_s` (currently 15–30), sampled via `dwell_rng` from `inputs.seed`,
#   while boarding/alighting passengers before departing to the next link.
#
# USER-PROVIDED SCENARIO INPUTS:
# - `headway_randomness_s`, `link_travel_time_variation_share`, and `commuter_distribution`
#   (along with `start_time_s`, `end_time_s`, and `rush_hour_duration_s`) are treated as
#   direct user/scenario inputs, requiring no further external data collection.

