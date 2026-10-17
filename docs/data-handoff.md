# Data for the simulation owner

Use **data/reviewed/** as the sourced input bundle for 505 **westbound, Dundas East/Broadview → TMU Station**. Simulation variables, demand conversion and the engine belong to the simulation teammate.

The complete dataclass-compatible handoff is now [simulation-data.md](simulation-data.md). Load it with `from data.simulation_input import load_simulation_input`, then `inputs = load_simulation_input()`. The bundle supplies every current field using sourced evidence and explicitly labelled assumptions. It is a partial residential scenario, not calibrated 505 ridership.

| File | Contents |
| --- | --- |
| corridor.json | Ordered stops, eight links, route/shape IDs, service date/window and scheduled trips |
| stops.csv | Stop IDs, zero-based sequence, coordinates and source IDs |
| corridor.geojson | Corridor geometry for display |
| developments.csv | Three selected proposals, proposed units, stages, dates, nearest stops and estimated walking metres |
| walking_access.json / walking_routes.geojson | Estimated pedestrian access and explicit connectors requiring manual review |
| sources.json | Source URLs, versions, retrieval timestamps, licences and checksums |
| route_505.json | Both directions of the full route for reference; corridor.json defines the modelled segment |

Coordinates are longitude/latitude in EPSG:4326; metric lengths use EPSG:26917. Times use seconds or GTFS service-day HH:MM:SS, which may exceed 24:00:00. Scheduled times are not observed travel/dwell times. Proposed units are not occupied residents or passenger demand. Incoming occupancy and demand observations remain unknown.

## Mapping to the teammate's SimulationInput

Her definitions in backend/simulation/inputs.py remain authoritative. This handoff supplies evidence without assigning simulation settings:

| Input | Evidence or remaining choice |
| --- | --- |
| stops | corridor.json stops, in the published westbound order |
| link_travel_times_s | corridor.json links[].scheduled_time_s, one per adjacent stop pair; scheduled medians rather than observed running times |
| headway_s | 419.8125 s mean of adjacent scheduled entry gaps. The separate 360 s summary is a median. Neither is observed reliability. |
| rush_hour_duration_s | The selected 07:00–09:00 window spans 7,200 seconds. |
| developments | Adopted net-added units 624 / 413 / 1,197, with report/pipeline conflicts and the assumed 761 replacement count recorded. Household size, future occupancy and transit share are labelled transfers/assumptions. |
| existing_residences | Expanded mapped residential records using published counts and explicit unit estimates; the original 58 rentals / 6,269 units are preserved. See building-units.md for per-building ranges, unknowns and source links. Occupancy/travel behaviour remain proxies. |
| streetcar_capacity | TTC physical maximum 251; historical planning capacity 130 is a separate quantity. |
| trips_per_resident_in_window | 0.2310568468 all-mode trips/resident/2h: assumed 2/3 transfer of TTS Ward 13 AM rate, before applying transit share. |
| headway_randomness_s, commuter_distribution, seed | Explicit defaults 0, [1.0], 0. Arrival/service regularity is assumed; seed is internal. |
| start_time_s, end_time_s | Explicit reporting bounds 25,200 and 32,400 service-day seconds (07:00-09:00); clearance remains an owner decision. |
| link_travel_time_variation_share | User-selected default 0, matching the newly added input field; no calibrated variability claim. |

Do not use **data/fixtures/** or frontend/src/lib/sampleComparison.ts as real simulation inputs: those contain synthetic integration examples, including invented capacity, service and costs. The fixture now follows the same westbound segment, but its invented demand, capacity, service and costs remain integration examples rather than simulation inputs.

Rebuild source-derived evidence with python -m backend.scripts.prove_feasibility. Check the data independently with python -m pytest backend/tests/data -q. Raw source downloads stay ignored under data/raw and data/cache.
