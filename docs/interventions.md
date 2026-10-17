# A10 design: intervention options (extra service, streetcar priority)
**Status: A10 data built and validated.** Owner: Lane A. Lane C still needs to load the catalogue into its scenario bundle before interventions are selectable there.

**Scope.** The simulation is mainly about adjusting existing service (headway and frequency), so **extra service is the focus**. Streetcar priority is an optional extra: its costs and shorter round trip are filled in because Lane C's policy format requires them, but **its effect is not simulated** until there is time.

The 505 is a streetcar route, so "lane" here means streetcar priority in the style of King Street (traffic restrictions and signal changes that let streetcars go first), not a bus lane.

## Why
Lane C's package screen compares four packages: existing, streetcar priority (called "lane" in Lane C's code), extra service, and both. It needs one policy file (`PACKAGE_POLICY_PATH`, schema in `server/src/shared/policy.ts`) with run times, headways and costs. None exists, so every upgrade is reported as "cost policy unavailable" and no affordability answer can be given. A10 supplies that data, with every number sourced or labelled.

## Decisions taken
| Decision | Choice | Why |
| --- | --- | --- |
| Focus | **Extra service first; streetcar priority optional** (agreed with the team) | The simulation adjusts existing parameters (headway, frequency). Priority's effect is the least certain input, so its simulation is deferred. |
| Extra-service target headways | **360 s, 300 s (default), 240 s** | Today's 505 AM peak is about 6–7 min. TTC's AM-peak streetcar headways in the current GTFS range from about 3 min (504 King) to 6 min (most routes); 300 s matches 506 Carlton and 510 Spadina, and 240 s matches 504 King eastbound. |
| Hours of extra service | **AM peak only**, costed as **2.5 h/day** (agreed) | **Because the simulation only models 07:00–09:00.** The benefit of extra cars (shorter waits, fewer riders left behind) is only measured in that window, so the cost must cover the same window. Costing AM+PM or all-day service against AM-only benefits would make extra service look worse than it is. The extra 0.5 h is an assumption for cars travelling to and from the carhouse. If the simulation later adds the PM peak, cost AM+PM instead. |
| Where extra service runs | **The whole 505 route** (Broadview Station ↔ Dundas West Station) | Added cars enter from the route's ends, so extra service has no partial coverage; its cost uses the full-route cycle. |
| Where streetcar priority applies | **The whole modelled segment**, Broadview & Dundas → TMU, all 8 links (agreed) | Three reasons. (1) **Simpler to implement:** one saving share applied to every link, and the effect shows fully in the simulation. (2) **No data on which links are most congested:** we only have scheduled times, not observed delay by link, so any choice of partial links would be unsupported. (3) **A partial-coverage option can be added later if time allows**, for example as a cheaper alternative, ideally once observed delay data exists. |
| Service days | Weekdays in a year, minus statutory holidays | Counted from the GTFS calendar pattern; derived, not observed. |
| Price year | **CAD 2026** | Lane C fixes `budget_price_year` at 2026. Older costs are inflated with Statistics Canada's annual CPI; 2026 uses the January–August monthly CPI mean because the year is incomplete, and is labelled accordingly. |

## Outputs
1. **`data/reviewed/interventions.json`**: the reviewed A10 data. Every value has `unit`, `status` (`sourced`, `derived`, `transferred`, `assumed` or `user_selected`), `source_ids`, a low/central/high range where uncertain, and a one-line `meaning`.
2. **`data/reviewed/package_policy_<headway>.json`** (three files: `_360`, `_300`, `_240`): generated from item 1, each matching Lane C's `PolicySchema` exactly. Lane C's schema holds one `service_headway_s`, so each target headway is one policy. The default (`_300`) is the one to point `PACKAGE_POLICY_PATH` at. The API also accepts a policy per job, so the frontend can offer all three.
3. **`backend/scripts/build_interventions.py`**: computes the derived values from cached GTFS, assembles items 1 and 2, and registers new sources in `simulation_sources.json`. Lane C rejects any `source_id` missing from that manifest.
4. A **contract-shaped catalogue** inside `interventions.json`: one `Intervention` per option (extra service at 360, 300 and 240 s; streetcar priority), validated against `backend/schemas/intervention.py`. Lane C's default scenario currently requires an empty catalogue (`server/src/services/bundle.ts`, checked in `validate.ts`); loading this one is a small Lane C change.
5. Tests and a short section in this doc describing the final values.

## Fields and where each comes from
| Lane C field | Meaning | Method / source | Expected status |
| --- | --- | --- | --- |
| `cycle_s` | Time for one car to run Broadview Station → Dundas West → Broadview Station, including terminal layover | Westbound + eastbound scheduled run (GTFS, about 3,900 s + 3,780 s) plus median terminal layover from consecutive trips of the same `block_id` | derived |
| `baseline_headway_s` | Today's AM-peak entry gap | Same value the simulator uses (`headway_s` ≈ 420 s, the mean of scheduled gaps) so the two stay consistent | derived |
| `service_headway_s` | Gap with extra service | 360 / 300 / 240 s, one per policy file | user_selected |
| `lane_cycle_s` | `cycle_s` with streetcar priority | `cycle_s` minus the time saved on the modelled segment's 8 links, westbound and eastbound (12% selected; see below) | derived from an assumed effect |
| `peak_hours` | Hours/day the extra cars run | 2.5 (AM peak plus carhouse travel) | assumed |
| `service_days` | Days/year | Weekday count for one year minus holidays | derived |
| `cost_per_hour` | Operating cost of one streetcar for one hour (driver, energy, maintenance) | TTC published operating statistics or budget: cost per vehicle-hour, streetcar mode if available, else system-wide and labelled | sourced or transferred |
| `lane_capital` | One-time cost to build priority on the modelled segment (paint, signs, signal changes, curb work) | King Street Transit Priority Corridor and RapidTO costs scaled to the segment's length (about 2.5 km). A similar project's budget is not a quote | transferred |
| `lane_operating` | Annual enforcement and upkeep | Same sources; if no figure exists, a wide labelled range | transferred or assumed |
| `price_year` | Year of the CAD figures | 2026, after CPI adjustment | derived |
| `earliest_phase` | First phase an upgrade can be in place | `phase-1`, the only phase Lane C defines today | user_selected |
| `availability` | Optional per-option phase | Omitted unless the team sets different dates for lane and extra service | user_selected |
| `source_ids`, `assumption_label` | Provenance and one-sentence caveat | Collected from the rows above | — |

## How the values were chosen
All figures below are quoted, with page numbers, in `data/sources/intervention_evidence.json`. Costs are in 2026 CAD, converted with Statistics Canada's CPI: 2015 = 126.6, 2017 = 130.4, 2019 = 136.0, 2024 = 160.9, 2025 = 164.2, and 2026 = 168.1. The 2026 index is the January–August 2026 monthly CPI mean (Table 18-10-0004-01, vector v41690973), because the year is incomplete; it matches Lane C's fixed budget price year. King Street's priority section (Bathurst → Jarvis) is about 2.5 km (2,473–2,578 m by direction in the GTFS), almost the same as our 2,513 m segment, so no length scaling is applied (ratio 0.995).

### Service parameters (step 1, from the TTC GTFS feed, Friday 2026-10-16, trips starting 07:00–09:00)
| Value | Result | How |
| --- | --- | --- |
| Westbound / eastbound full-route run | 3,660 s / 3,600 s | Median of 18 trips each way |
| Terminal layover | 120 s at Broadview Station, 480 s at Dundas West Station | Median gap between a block's consecutive trips at the same terminal |
| `cycle_s` | **7,920 s** | Median time between a block's consecutive Broadview Station departures (18 samples). Adding the parts above gives 7,860 s, within 1%. |
| `baseline_headway_s` | **420 s** (419.8) | Same value the simulator uses |
| `service_days` | **251** | 261 weekdays in 2026 minus 10 Ontario holidays falling on weekdays |

Only westbound is simulated. Eastbound is used because a car must return eastbound before its next westbound trip, so vehicle counts need the full round trip.

### Streetcar-priority effect: **12% of link time saved (selected)**
No 505 priority exists, so there is no measured effect on Dundas. The reasoning, in order:

1. **King Street's morning peak barely changed.** The City's 2019 evaluation says AM peak travel times "stayed about the same (+/- a minute)". The 504 takes about 16 minutes across the priority section in the AM (929–963 s), so ±1 minute is about ±6%. The big gains were in the PM peak (slowest trips 4–5 minutes faster) and mid-day (2–2.5 minutes faster). The City attributes the small AM change to the downtown being less congested in the morning.
2. **Our segment has fewer jobs than King Street.** 2021 Census place-of-work counts within 400 m of each stop: about 5,000 workers near the seven stops from Broadview to Jarvis, and about 36,000 near Church and Yonge–Dundas (87% of the segment's total). King's priority section has about 51,000 along its whole length. The eastern part of our segment is mainly residential, so its AM congestion is unlikely to be worse than King's.
3. **Ridership on the 505 is back to 2018 levels, not above them.** 32,400 (2018), 23,356 (fall 2022), 28,400 (Nov 2024), 32,100 (Nov 2025). Measures differ slightly by year.
4. **Road congestion has grown since 2019.** The City's 2024 update reports King streetcar trips of "45 to 65 minutes" in late 2023, against a 16-minute average in 2018, falling to 17–21 minutes once traffic agents enforced the corridor (time of day not stated). So an enforced priority lane plausibly saves more now than in 2018–19.
5. **No 2019 schedule was available** to measure how much the 505's AM run time has grown (the archived feeds tried were not accessible).

| Case | Value | Basis |
| --- | --- | --- |
| Low | 0% | No AM improvement (King AM evidence) |
| Evidence-based central | 0% | King AM "about the same"; Dundas east is less job-dense than King |
| **Selected (high)** | **12%** | King Street's 2018 mid-day saving, about 2.25 min out of about 18.25 min (the 2018 16-minute average plus the saving), used as a stand-in for AM congestion having grown since 2019 |

**The team selected 12%** so that priority has a visible effect in the AM simulation and reflects congestion growth since the King evaluation. It is an **assumption**, not a measurement, and is labelled `assumed` with this reasoning. The evidence on its own points to little AM benefit; the comparison should say so wherever priority's result is shown.

`interventions.json` lists the covered links (all 8 links of the modelled segment) with the 12% saving per link, so the simulator can shorten `link_travel_times_s` on those links. `lane_cycle_s` reduces the full-route cycle only by the saving on the modelled segment in both directions (12% of about 904 s each way, about 217 s). Priority elsewhere on the 505 is not assumed.

### Costs: central values selected
| Value | Low | **Selected (central)** | High | Basis |
| --- | --- | --- | --- | --- |
| `cost_per_hour` (2026 CAD per streetcar-hour) | 171 | **283** | 445 | Central: TTC 2025 budget, total operating cost per service hour, system-wide and fully allocated (budget notes p. 4), adjusted to 2026 CAD. Low and high: TTC 2015 streetcar cost factors quoted by Steve Munro ($95.40/vehicle-hour, $3.42/vehicle-km, $515/vehicle-day), adjusted to 2026 CAD, with 9.86 km per vehicle-hour from the cycle; low uses the hour and km factors only, high adds the daily vehicle cost spread over the 2.5 h a peak-only car runs. |
| `lane_capital` (2026 CAD, one-time) | 1.93 M | **3.79 M** | 7.03 M | Low: the 2017 pilot estimate ($1.5 M), CPI-adjusted. Central: pilot plus the 2019 permanent improvements ($1.5 M), CPI-adjusted. High: also the 2024 improvements ($3.1 M), CPI-adjusted. |
| `lane_operating` (2026 CAD per year) | 0.445 M | **0.918 M** | 1.39 M | Low: $210,000 for January–July 2019, annualised and CPI-adjusted. High: $750,000 for "the remainder of 2019", assumed May–December (8 months), annualised and CPI-adjusted. Central: midpoint. Traffic-agent costs in the 2024 update are not stated, so high may understate today's cost. |

Lane C's policy carries all three bounds for each cost; the selected (central) value is the default used in comparisons.

### Extra vehicles
Required vehicles = `ceil(cycle_s / headway_s)`; Lane C computes this, A10 only supplies the inputs. With `cycle_s` = 7,920 s: today's 420 s needs 19 cars; 360 s, 300 s and 240 s need 22, 27 and 33, so **3, 8 and 14 extra cars**. With priority (`lane_cycle_s` about 7,703 s) the same headways need 19, 22, 26 and 33.

## Steps
1. Compute `cycle_s`, layover, `baseline_headway_s` and `service_days` from cached GTFS (about 30 min).
2. Find and record `cost_per_hour`, King Street costs and the King Street travel-time effect; download each source once with checksum (about 1 h; the least predictable step).
3. Write `interventions.json`, the three policy files and the build script; register sources (about 30 min).
4. **Complete.** Validate each policy against Lane C's rules and run the package screen locally with `PACKAGE_POLICY_PATH` set. All three 2026-CAD policies load; all package rows report vehicles and costs without a price-year mismatch. The default zero budgets and fleet allowance make every upgrade unaffordable until those scenario inputs are set.
5. **Complete.** Regression tests check the reviewed catalogue, source references, cost ranges and all three generated policy files. Final 2026-CAD values are recorded above.

## Dependencies and risks
- **Budgets and fleet are zero in Lane C's default scenario** (`server/src/services/bundle.ts`: `capital_budget_cad: 0`, `fleet_allowance: 0`). With A10 in place, any upgrade still fails "over budget" until a user or Lane C supplies budgets and a fleet allowance. Not part of A10; Lane C needs to know.
- **Lane C bundle integration is still required.** `server/src/services/bundle.ts` currently sets `interventions: []`; it must load the A10 catalogue from `data/reviewed/interventions.json` (and provide matching `intervention_availability`) before those options can be selected in a scenario. This is intentionally not changed by A10.
- **The simulator has no streetcar-priority mechanism.** Extra service works through `headway_s`. For priority to change crowding, Lane B needs to apply A10's per-link savings to `link_travel_times_s`; deferred (see below).
- **Costs cover both directions; benefits are westbound only.** The simulation models westbound AM only. Eastbound is used only because a car must run back eastbound before its next westbound trip, so vehicle counts use the full round trip. Priority is assumed built in both directions, so its capital cost and the shorter round trip (`lane_cycle_s`) include eastbound, but eastbound time savings for riders are not simulated. This understates priority's benefit, which is the conservative direction.
- **Cost figures may be incomplete.** Anything not found is marked `assumed` with a wide range; no number is presented as a TTC quote.
- **Spare fleet.** Whether TTC has the 3–14 extra streetcars these headways need at the AM peak is not something A10 can establish. `fleet_allowance` stays a scenario input.

## Deferred: streetcar priority in the simulator
Simulating priority needs Lane B to apply the per-link saving in `interventions.json` to `link_travel_times_s`. This is deferred until there is time. Until then, Lane C's comparison shows priority's **costs only**; its simulated crowding equals "existing". The dashboard should label priority "cost reference only; effect not simulated", or hide it.
