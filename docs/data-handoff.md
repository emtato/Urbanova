# Data for the simulation owner

Use **data/reviewed/** as the sourced input bundle for 505 **westbound, Dundas East/Broadview → Jarvis**. Simulation variables, demand conversion and the engine belong to the simulation teammate.

| File | Contents |
| --- | --- |
| corridor.json | Ordered stops, six links, route/shape IDs, service date/window and scheduled trips |
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
| headway_s | Use scheduled_trips to inspect entry gaps. The published 360 s summary is a median, not the mean requested by this input. The owner decides how to represent the schedule. |
| rush_hour_duration_s | The selected 07:00–09:00 window spans 7,200 seconds. |
| developments | developments.csv provides proposed units and access; occupancy, residents per unit and transit share still require explicit assumptions. |
| existing_residences | Existing housing/population and its transit share have not been sourced in this bundle. |
| streetcar_capacity | Not supplied by GTFS; source the vehicle specification or label the owner's assumption. |
| trips_per_resident_in_window, headway_randomness_s, commuter_distribution, seed | Simulation-owner choices; no measured values are invented here. |

Do not use **data/fixtures/** or frontend/src/lib/sampleComparison.ts as real simulation inputs: those contain synthetic integration examples, including invented capacity, service and costs. The existing fixture still reflects the earlier eastbound snapshot and needs a separate contract/UI reconciliation.

Rebuild source-derived evidence with python -m backend.scripts.prove_feasibility. Check the data independently with python -m pytest backend/tests/data -q. Raw source downloads stay ignored under data/raw and data/cache.
