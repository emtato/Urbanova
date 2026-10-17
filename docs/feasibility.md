# Phase 01: corridor and feasibility checks
Scope agreed with the user: Phase 01's corridor/feasibility checks (1.1–1.4), not the full Lane A pipeline or the later schema/fixture contract.
Product label: **scenario experiment**. Schedules and proposed unit counts are sourced; demand and future occupancy are not observed.

## Evidence and status
| Step | Status | Evidence |
| --- | --- | --- |
| 1.1 Corridor | Verified with an explicit window assumption | 505 eastbound Jarvis → Dundas/Broadview, seven consecutive stops; see corridor.md |
| 1.2 GTFS and developments | Verified as feasibility evidence | Dated weekday service plus three distinct pipeline proposals and estimated pedestrian access |
| 1.3 Tiger Data and Gemini | Passed live | data/reviewed/access_check.json records PostGIS and a schema-validated Gemini response |
| 1.4 Tiny case | Passed | sim/tiny_case.py reproduces the hand calculation; tests check conservation, capacity and persistent denied riders |

The analysis window is Friday 2026-10-16, 07:00–09:00 America/Toronto, chosen for reproducibility.
The feed covers that day, and calendar exceptions are applied. There are 15 scheduled entries, a median 7-minute headway and a roughly 1.97 km segment.
The user-confirmed endpoints yield seven stops, replacing the original generic 8–12-stop target.

## Residential development shortlist
Source: the City's Development Pipeline CSV, resource updated 2026-10-08. Unit counts below are the dataset's **proposed residential units**, not occupied homes, net-new units or an approved completion forecast.
Application received dates are separate from dataset update/retrieval dates.

| Selected application | Address | Proposed units | Pipeline stage | Nearest modelled stop | Estimated walk |
| --- | --- | --- | --- | --- | --- |
| 22 124214 STE 13 OZ | 239 Dundas St E | 630 | Active | Sherbourne, 2130 | 157 m |
| 26 122451 STE 13 OZ | 500 Dundas St E | 413 | Under Review | Regent Park Blvd, 15872 | 335 m |
| 25 236949 STE 13 OZ | 761 Dundas St E | 1,197 | Under Review | River, 2126 | 268 m |

Three spatially distinct sites are selected once each using their OZ application numbers; related site-plan applications are not counted again.
The review keeps five candidates in development_shortlist.csv. 401 Dundas East (137 units) is a reserve candidate.
218 Dundas East is held for reconciliation: its numeric unit field is 542, while its description says 522, and the address has multiple municipal address points.
The selected 239 and 761 unit counts agree with their source descriptions; 500 uses the explicit numeric unit field.
Pipeline stage "Active" is preserved as published and is not relabelled "Approved".

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
- Incoming streetcar occupancy at Jarvis.
- Observed dwell rates, capacity assumptions, boarding behaviour and travel-time variability.
- Development occupancy dates, occupied shares and replacement/net-new housing counts.
- Streetcar-specific intervention effects, costs, fleet constraints and operating-cycle assumptions.

Do not invent observed ridership or treat the schedules as calibration data for passenger demand.
The production model needs warm-up, a clearance horizon and explicit reporting of unresolved riders.

## Hand-calculated tiny case
Three stops A → B → C; two cars of capacity 4 enter A at 0 s and 60 s.
Five riders wait at A and five at B at 0 s; all travel to C. Each link takes 30 s with zero dwell as a fixture assumption.

| Car | At A | At B | At C |
| --- | --- | --- | --- |
| 1 | t=0: boards 4, leaves 1 | t=30: full, leaves 5 | t=60: alights 4 |
| 2 | t=60: boards 1 | t=90: boards 3, leaves 2 | t=120: alights 4 |

At 120 s: 8 arrived, 2 waiting, 0 onboard; 6 riders denied at least once.
Mean completed-rider wait = (4×0 + 1×60 + 3×90)/8 = 41.25 s.
The two unresolved riders have wait lower bounds of 120 s; they are reported rather than dropped.
This is a separately labelled reference case, not a claim that the production simulation is complete.

## Reproduce from the repository root
After installing requirements and setting local .env credentials:
```sh
python -m backend.scripts.prove_feasibility
python -m backend.scripts.check_access
python -m sim.tiny_case
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

## Next gate
The corridor/feasibility work is ready for the team to review.
The overall Phase 01 gate remains open until 1.5–1.16 land: Pydantic schemas, matching TypeScript types and a validated full sample Comparison/replay fixture.
Do not treat corridor.json as that final API contract.

The separate [Lawrence East study](feasibility-lawrence-east.md) is preserved for reference; this handoff follows the confirmed 505 endpoints.
