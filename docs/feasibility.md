# Phase 01: corridor and feasibility checks
Scope agreed with the user: Phase 01's corridor/feasibility checks (1.1–1.4), not the full Lane A pipeline or the later schema/fixture contract.
Product label: **scenario experiment**. Schedules and proposed unit counts are sourced; demand and future occupancy are not observed.

## Evidence and status
| Step | Status | Evidence |
| --- | --- | --- |
| 1.1 Corridor | Verified with an explicit window assumption | 505 westbound Dundas/Broadview → TMU Station, nine consecutive stops; see corridor.md |
| 1.2 GTFS and developments | Verified as feasibility evidence | Dated weekday service plus three distinct pipeline proposals and estimated pedestrian access |
| 1.3 Tiger Data and Gemini | Passed live | data/reviewed/access_check.json records PostGIS and a schema-validated Gemini response |
| 1.4 Tiny case | Simulation teammate owns this | Duplicate simulation scaffolding removed; use the sourced data handoff, not synthetic fixture values |

The analysis window is Friday 2026-10-16, 07:00–09:00 America/Toronto, chosen for reproducibility.
The feed covers that day, and calendar exceptions are applied. There are 17 scheduled westbound entries, a median 6-minute headway and a roughly 2.51 km segment.
The user extended the westbound endpoint to TMU Station at Yonge/Dundas, yielding nine stops and a Line 1 connection.

## Residential development shortlist
Source: the City's Development Pipeline CSV, resource updated 2026-10-08. Unit counts below are the dataset's **proposed residential units**, not occupied homes, net-new units or an approved completion forecast.
Application received dates are separate from dataset update/retrieval dates.

| Selected application | Address | Proposed units | Pipeline stage | Nearest modelled stop | Estimated walk |
| --- | --- | --- | --- | --- | --- |
| 22 124214 STE 13 OZ | 239 Dundas St E | 630 | Active | Jarvis, 2119 | 272 m |
| 26 122451 STE 13 OZ | 500 Dundas St E | 413 | Under Review | Parliament, 2125 | 229 m |
| 25 236949 STE 13 OZ | 761 Dundas St E | 1,197 | Under Review | River, 2127 | 270 m |

Three spatially distinct sites are selected once each using their OZ application numbers; related site-plan applications are not counted again.
The review keeps five candidates in development_shortlist.csv. 401 Dundas East (137 units) is a reserve candidate.
218 Dundas East is held for reconciliation: its numeric unit field is 542, while its description says 522, and the address has multiple municipal address points.
The selected 239 and 761 unit counts agree with their source descriptions; 500 uses the explicit numeric unit field.
Pipeline stage "Active" is preserved as published and is not relabelled "Approved".

**Third development retained after the TMU extension.** Westbound, 239 Dundas St E's nearest stop remains Jarvis. It is now upstream of Church and TMU Station, so its riders can contribute load on those two links. Its occupancy and demand still need explicit assumptions.
A previously discussed, unselected alternative is Regent Park Phases 4–5 (22 136063 STE 13 OZ), next to Regent Park Blvd. Its pipeline record lists 3,432 proposed units; the application description says about 3,246, of which 1,270 are TCHC-owned rental, partly replacing existing homes. Its status is OMB Appeal, and the net-new count is not sourced.

## Walking access and its limits
Official Toronto municipal address points locate the projects. Small OpenStreetMap tiles provide the pedestrian network.
Distances use shortest mapped paths in EPSG:26917 plus explicit straight-line connectors between address points/stops and nearby graph nodes.
They are estimates from representative address points, not measured walks from confirmed building entrances.
All three estimates are below the chosen 500 m screening threshold, itself a modelling assumption.

The generated [SVG review map](../data/reviewed/walking_routes.svg) and [PNG preview](../data/reviewed/walking_routes.png) show the routes and red dashed connectors.
Desktop inspection found routes on the Dundas/Regent/River-side network; none of these three access paths needs to cross the Don River.
Entrance locations, temporary construction closures, legal pedestrian crossings and connector accessibility still need owner/field review.
The 500 and 761 paths use service/footway connections; do not silently treat parcel-centre connectors as verified public entrances.
Each route retains manual_review=pending. Full Lane A walking access to 2–3 alternative stops per development is outside this feasibility check.

## Missing observations
- Stop-level weekday arrivals, destinations and rider-group demand.
- Incoming streetcar occupancy at Broadview Ave at Dundas St East.
- Observed dwell rates, capacity assumptions, boarding behaviour and travel-time variability.
- Development occupancy dates, occupied shares and replacement/net-new housing counts.
- Streetcar-specific intervention effects, costs, fleet constraints and operating-cycle assumptions.

Do not invent observed ridership or treat the schedules as calibration data for passenger demand.
The production model needs warm-up, a clearance horizon and explicit reporting of unresolved riders.

## Simulation ownership
The simulation teammate defines the variables and hand-case validation. Duplicate simulation scaffolding has been removed. Use [data-handoff.md](data-handoff.md) for her sourced inputs.

## Reproduce from the repository root
After installing requirements and setting local .env credentials:
```sh
python -m backend.scripts.prove_feasibility
python -m backend.scripts.check_access
python -m pytest -q
```
The data build reuses checksum-verified caches; on a new laptop it downloads source files into ignored data/raw and data/cache.
--refresh explicitly replaces snapshots and may make the fixed service date unavailable in a newer feed.
Only the initial research run used --adopt-existing to register the already-downloaded source files.
The default build includes walking access. --skip-walk deliberately leaves that part pending.
Runtime source files are cached, while compact reviewed evidence is committed for the team.
The source manifest includes official URLs, retrieval timestamps, licences, versions and SHA-256 checksums.

## Local versus Railway configuration
Local scripts load the root .env. Railway Variables configure the deployed backend and do not update local files.
The successful Gemini access check uses GEMINI_MODEL=gemini-3.8-flash.
Set that same value in Railway Variables and apply/redeploy; Google rejected gemini-2.5-flash for the new account.
Keys and database URLs remain backend-only and are excluded from the committed evidence.

## Phase 01 handoff
Steps 1.5–1.16 are documented in [contract.md](contract.md). The synthetic fixture, replay and frontend now match the westbound data and pass the contract checks. Simulation variables and validation belong to the simulation teammate. Her sourced inputs are listed in [data-handoff.md](data-handoff.md); laptop confirmations and walking-review caveats remain explicit.
The frozen API boundary is backend/schemas/Comparison, version 1.0.0. The reviewed corridor.json remains the data evidence rather than the API response shape.
