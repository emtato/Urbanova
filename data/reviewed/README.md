# Reviewed Phase 01 evidence
This directory contains compact, derived feasibility artifacts for TTC 505 westbound from Dundas/Broadview to TMU Station.
It is not the frozen Comparison API contract or a calibrated simulation output.

- corridor.json / corridor.geojson / stops.csv: dated GTFS corridor, schedule and geometry.
- project_selection.json: explicit service-window, threshold and application-selection decisions.
- development_shortlist.csv / developments.csv: five reviewed candidates and three selected proposals.
- sources.json: source IDs, official URLs, versions, retrieval times, SHA-256 checksums and licences.
- walking_access.json / walking_routes.geojson: estimated nearest-stop pedestrian paths and explicit connector lengths.
- walking_routes.svg: reproducible desktop review map; walking_routes.png is the exported preview inspected during review.
- feasibility_report.json: machine-readable findings and missing observations.
- route_505.json: the whole 505 route in both directions (stops, patterns, trips per hour) for reference; rebuild with python -m backend.scripts.export_route.
- access_check.json: the latest local live Tiger Data/Gemini check; no credentials are included.

Rebuild with python -m backend.scripts.prove_feasibility. Raw GTFS, pipeline downloads and OSM source tiles remain in ignored data/raw and data/cache.
The SVG map rebuilds with the command. The PNG is a static review preview; use the regenerated SVG after refreshing sources.
CSV source_ids use semicolon-delimited IDs for developments and JSON arrays for stop records.
Proposed unit counts are not occupied or net-new households. Walking connectors and building entrances are estimates requiring owner review.

Contains information licensed under the [Open Government Licence – Toronto](https://open.toronto.ca/open-data-licence/).
Map data © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright), available under the Open Database Licence.
See ../../docs/feasibility.md for the full interpretation and limitations.
