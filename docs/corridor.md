# Corridor decision (step 1.1)

**Chosen:** Lawrence Avenue East, **westbound**, local service on routes **54 and 154**, from **Markham Rd to Midland Ave** (12 consecutive stops, about 3.4 km).
**Window:** weekday **AM peak, 07:00–09:00**, measured by scheduled arrival at the first modelled stop (Markham Rd).
**Service date:** Wednesday **2026-10-21** (GTFS `service_id` 1, valid Mon–Fri 2026-09-30 → 2026-10-31; removed only on 2026-10-12).

Decided 2026-10-17 by Owner A from the real files listed in [Sources](#sources).

## Why this corridor

- **Housing:** at least three documented residential projects sit within walking distance of these stops (see [feasibility.md](feasibility.md)). Two of them (661 and 855 units) are at the first two stops, so new riders board upstream and their load passes every stop downstream. That is the effect the brief asks us to show.
- **Readiness question:** a 2025 City report lists RapidTO for Lawrence East among unfunded work, so "is the lane ready before occupancy?" is a real question.
- **Direction:** westbound in the AM carries riders toward rapid transit: route 54 continues to Don Valley Station, and route 154 to Kennedy Station (Line 2).

## What the corridor contains

| seq | stop_id | gtfs_stop_id | name | lat | lon | link to next (m) | scheduled to next (s) |
|---|---|---|---|---|---|---|---|
| 1 | LE01 | 9504 | Lawrence Ave East at Markham Rd | 43.759995 | -79.225042 | 485 | 106 |
| 2 | LE02 | 5308 | Lawrence Ave East at Opposite Cedarbrae Mall | 43.758785 | -79.230855 | 168 | 35 |
| 3 | LE03 | 5271 | Lawrence Ave East at Greenbrae Circt | 43.758343 | -79.232850 | 242 | 51 |
| 4 | LE04 | 5232 | Lawrence Ave East at Bellamy Rd North West Side | 43.757749 | -79.235742 | 196 | 41 |
| 5 | LE05 | 5234 | Lawrence Ave East at Ben Stanton Blvd | 43.757245 | -79.238096 | 274 | 58 |
| 6 | LE06 | 5241 | Lawrence Ave East at Burnview Cres West Side | 43.756528 | -79.241423 | 441 | 93 |
| 7 | LE07 | 5289 | Lawrence Ave East at Valparaiso Ave Scarborough General Hospital | 43.755437 | -79.246651 | 392 | 67 |
| 8 | LE08 | 5230 | Lawrence Ave East at Barrymore Rd | 43.754448 | -79.251333 | 373 | 64 |
| 9 | LE09 | 5238 | Lawrence Ave East at Brimley Rd West Side | 43.753545 | -79.255814 | 328 | 56 |
| 10 | LE10 | 16737 | Lawrence Ave East at Danielle Moore Cir West Side | 43.752733 | -79.259749 | 218 | 37 |
| 11 | LE11 | 5240 | Lawrence Ave East at Brockley Dr | 43.752209 | -79.262362 | 279 | 48 |
| 12 | LE12 | 5293 | Lawrence Ave East at Midland Ave West Side | 43.751534 | -79.265714 | — | — |

- **Total:** 3,396 m and 656 s (about 10.9 min) of scheduled running time from LE01 to LE12.
- **Link lengths** come from GTFS `shape_dist_traveled` on shape 1123044. Step A5 recomputes them in metres (EPSG:26917) from the shape.
- **Scheduled times** are the median over the local trips in the window. Route 54 times are fixed per link; route 154 trips are scheduled slower from LE06 onward (up to +19 s on a link; 732 s in total vs 656 s for route 54).

### Service in the window (westbound, arriving at LE01 07:00–09:00)

| route | GTFS shape(s) | trips | headway | serves |
|---|---|---|---|---|
| 54 (two branches) | 1123044, 1123045 | 24 | 5 min combined (each branch every 10 min) | all 12 stops |
| 154 | 1122095 | 5 | about 22 min | all 12 stops |

In total, 29 local trips. The 54's two westbound patterns start at Morningside Ave and at Starspray Loop, and merge before Markham Rd, so they're the same service inside the segment.

## What is left out

- **954 Lawrence East Express:** 15 trips in the window. It stops at only 4 of the 12 stops (LE01, LE07, LE11, LE12), and is excluded as express service. Riders boarding at those 4 stops can use it in reality, so the model overstates the local load slightly there. Record this as a limitation.
- **354 Lawrence East:** night service, outside the window.
- **Eastbound** (the other direction), and **everything west of Midland Ave**, including the rest of the 54 to Don Valley Station.
- **Weekends and holidays.**

## Known caveats

- **No observed lane effect on Lawrence East.** Any priority-lane effect borrowed from the Eglinton East RapidTO results must be labelled a *transferred assumption*.
- **Schedules are not observed headways.** GTFS gives planned times only.
- **Incoming load at LE01 is unknown.** Lane A sets it in A9 as a labelled assumption.
- **Berths per stop:** assumed 1 at every stop until checked on street imagery.

## Sources

| source_id | title | publisher | retrieved_at | version |
|---|---|---|---|---|
| ttc-gtfs | TTC Routes and Schedules (GTFS) | City of Toronto Open Data / TTC | 2026-10-17 | feed last modified 2026-09-25; calendar 2026-09-30 → 2026-10-31 |
| tor-dev-pipeline | Development Pipeline | City of Toronto Open Data | 2026-10-17 | refreshed 2026-10-08 |
| tor-dev-apps | Development Applications (coordinates, related files) | City of Toronto Open Data | 2026-10-17 | refreshed 2026-10-16 |
| tor-rapidto-2025 | 2025 RapidTO report (unfunded corridors) | City of Toronto | — | https://www.toronto.ca/legdocs/mmis/2025/ex/bgrd/backgroundfile-256133.pdf |

- GTFS: https://open.toronto.ca/dataset/ttc-routes-and-schedules/
- Development Pipeline: https://open.toronto.ca/dataset/development-pipeline/
- Development Applications: https://open.toronto.ca/dataset/development-applications/

Raw downloads live in `data/raw/`, which git ignores.
