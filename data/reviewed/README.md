# Reviewed Phase 01 evidence
This directory contains compact, derived feasibility artifacts for TTC 505 westbound from Dundas/Broadview to TMU Station.
It is not the frozen Comparison API contract or a calibrated simulation output.

Simulation owner: start with simulation_input.json and [the loading guide](../../docs/simulation-data.md). The adapter in data/simulation_input.py constructs the existing SimulationInput dataclasses. It uses an expanded mapped-building residential inventory plus three proposals and labelled assumptions. The original 58 rentals are preserved. See [building-units.md](../../docs/building-units.md) for public counts, estimates and unknown-use buildings; this is not complete observed housing or stop-level demand.

- corridor.json / corridor.geojson / stops.csv: dated GTFS corridor, schedule and geometry.
- project_selection.json: explicit service-window, threshold and application-selection decisions.
- development_shortlist.csv / developments.csv: five reviewed candidates and three selected proposals.
- sources.json: source IDs, official URLs, versions, retrieval times, SHA-256 checksums and licences.
- walking_access.json / walking_routes.geojson: estimated nearest-stop pedestrian paths and explicit connector lengths.
- walking_routes.svg: reproducible desktop review map; walking_routes.png is the exported preview inspected during review.
- buildings_3d.geojson / sun_positions.json: footprints and heights for the 2,444 inventoried buildings, simplified proposal masses and sun positions for the 3D map and shadows; see ../../docs/massing.md.
- feasibility_report.json: machine-readable findings and missing observations.
- route_505.json: the whole 505 route in both directions (stops, patterns, trips per hour) for reference; rebuild with python -m backend.scripts.export_route.
- access_check.json: the latest local live Tiger Data/Gemini check; no credentials are included.
- simulation_input.json / existing_residences.csv: current simulation inputs, field metadata and an expanded residential scenario with per-building count status.
- simulation_sources.json: additional housing, census, travel-survey, planning, TTC and OSM evidence with checksums.
- existing_housing_audit.json / housing_context_2021.json / travel_context_2022.json: inclusion decisions and demographic/travel context.
- simulation_walking_routes.geojson: mapped access to up to two stops per included entity; every route still requires entrance/crossing/closure review.

Rebuild with python -m backend.scripts.prove_feasibility. Raw GTFS, pipeline downloads and OSM source tiles remain in ignored data/raw and data/cache.
The SVG map rebuilds with the command. The PNG is a static review preview; use the regenerated SVG after refreshing sources.
CSV source_ids use semicolon-delimited IDs for developments and JSON arrays for stop records.
Proposed unit counts are not occupied or net-new households. Walking connectors and building entrances are estimates requiring owner review.

Contains information licensed under the [Open Government Licence – Toronto](https://open.toronto.ca/open-data-licence/).
Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the Open Database Licence.
See ../../docs/feasibility.md for the full interpretation and limitations.

- building_unit_inventory.json / .csv: mapped buildings, public unit counts or labelled estimates, direct source links, uncertainty and inclusion.
- building_unit_summary.json / building_unit_calibration.json: snapshot coverage and local estimation anchors.
- registered_rental_input.json: original narrow baseline preserved for audit and repeatable expansion.

Rebuild simulation data and the inventory with python -m backend.scripts.build_simulation_data.
