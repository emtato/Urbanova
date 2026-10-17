# Feasibility check (step 1.2)

Corridor: Lawrence Ave East westbound, LE01 Markham Rd → LE12 Midland Ave, weekday 07:00–09:00 (see [corridor.md](corridor-lawrence-east.md)).
Checked 2026-10-17 by Owner A.

| Check | Result |
|---|---|
| Three developments in the Development Pipeline, with units and stages | **Pass.** Three kept, two in reserve (below). |
| GTFS has the chosen pattern on a weekday service date | **Pass.** Routes 54 and 154 serve all 12 stops on 2026-10-21 (`service_id` 1), with 29 local trips in the window. |
| Stop-level demand observations | **Missing.** See [Missing observations](#missing-demand-observations). |

**Label from here on:** stop-level demand is not available, so the product is a **scenario experiment**, not a forecast.

## Developments

The method:
- **Units, stage and record date** come from the Development Pipeline (`tor-dev-pipeline`).
- **Coordinates and related files** come from Development Applications (`tor-dev-apps`). X/Y in that file are converted from NAD27 MTM zone 10 (EPSG:2019) to EPSG:4326.
- **Distance** is straight-line to the nearest corridor stop. It is a stub until A7 computes walking distance.
- **Units are proposed.** Residents exist only after an occupancy assumption.

### Kept (three best documented)

| dev_id | address | units | pipeline status | application status | record date | nearest stop | distance (m) | application |
|---|---|---|---|---|---|---|---|---|
| D1 | 3585 Lawrence Ave E | 661 | Under Review | Council Approved | 2025-03-07 | LE01 Markham Rd | 41 | [25 126138 ESC 24 OZ](http://app.toronto.ca/AIC/index.do?folderRsn=z4AanJSZOwm310ZLdFTjew%3D%3D) |
| D2 | 3434 Lawrence Ave E | 855 | Active | Closed | 2021-12-20 | LE02 Opp. Cedarbrae Mall | 214 | [21 250150 ESC 24 OZ](http://app.toronto.ca/AIC/index.do?folderRsn=pPQ0pVOgGiKjHETwD%2B2yrQ%3D%3D) |
| D3 | 2683 Lawrence Ave E | 206 | Active | Closed (site plan: NOAC issued) | 2020-11-12 | LE11 Brockley Dr | 83 | [20 217595 ESC 21 OZ](http://app.toronto.ca/AIC/index.do?folderRsn=3O3R%2FvnWj0wPsiF9zqEKsQ%3D%3D) |

Total: **1,722 proposed units**.

Why these three:
- **D1:** two towers of 34 and 35 storeys. The description states 661 units, matching the pipeline. Its riders board at the first stop and ride through the whole segment.
- **D2:** two buildings of 10–23 storeys. The description states 855 units with a unit-mix breakdown, matching the pipeline. Riders board at the second stop.
- **D3:** an 11-storey mixed-use building. The description states 206 units, matching the pipeline. A site plan with a Notice of Approval Conditions (24 247363 ESC 21 SA) shows it is the furthest along. It is near the downstream end, so it mainly adds boardings close to Midland Ave.

### Reserve

| address | units | pipeline status | application status | nearest stop | distance (m) | why not kept |
|---|---|---|---|---|---|---|
| 2650 Lawrence Ave E | 1,001 | Under Review | OMB Approved | LE11 | 138 | The rezoning was appealed (Aug 2025) and has a concurrent OPA, so the stage is less settled. |
| 799 Brimley Rd | 370 | Active | Closed | LE09 | 151 | The description mixes an earlier 391-unit + 13-townhouse scheme with a revised tower. The unit count needs checking on the AIC page. |

Other nearby records with residential units are 3379-3385 Lawrence Ave E, 2740 Lawrence Ave E, 1555 Midland Ave and 525 Markham Rd. They were not shortlisted. One reason: 3379-3385 shows 155 units in the pipeline, but its description says 123.

### Double counting

- Each address above has **one** Development Pipeline record.
- Related applications on the same site appear only in Development Applications, not as extra pipeline rows, so they are not counted again:
  - D1: 26 120685 ESC 24 OZ
  - D2: 21 250159 SB, 21 250160 SA, 26 135283 OZ
  - D3: 24 247363 SA
  - 2650 Lawrence: 25 202217 OZ
- Unit counts come from the parent pipeline record only.

**To do before A3 is final:** open each AIC link and confirm the current unit count and stage.

## GTFS pattern

- **Feed:** `ttc-gtfs`, last modified 2026-09-25. The calendar runs 2026-09-30 → 2026-10-31.
- **Service:** `service_id` 1 runs Mon–Fri and is removed only on 2026-10-12 (Thanksgiving). Routes 54, 154 and 954 have no other weekday service ids.
- **Trips:** westbound arrivals at LE01 from 07:00 to 09:00 are 24 trips on route 54 (shapes 1123044 and 1123045), 5 on route 154 (shape 1122095), and 15 on the 954 express (excluded).
- **Times:** no times after 24:00 fall in the window. Some late-night trips have them, so A2 must still handle that format.

## Missing demand observations

| Needed for | Status |
|---|---|
| Boardings and alightings by stop and time (AM, westbound) | **Not available** in open data. |
| Load already on board at LE01 | **Not available.** It becomes an A9 assumption. |
| Route-level weekday boardings | Available from TTC operating statistics: about 35,800 on Lawrence East (Nov 2025). This bounds the total only and doesn't validate how it is spread across stops. |
| Observed headways and run times | **Not available** from GTFS. A11 (BusTime recording) is optional and covers weekend service only. |
| Priority-lane effect on this street | **None observed.** Use Eglinton East RapidTO results as a *transferred assumption*. |
| Occupancy dates and completion shares | **Not sourced.** They are scenario inputs. |
| Walking access from each development | **Not computed yet** (A7). Straight-line distances are used above. |
