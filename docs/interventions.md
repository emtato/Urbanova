# A10 design: intervention options (extra service, streetcar priority)
**Status: design agreed; not built yet.** Owner: Lane A.

The 505 is a streetcar route, so "lane" here means streetcar priority in the style of King Street (traffic restrictions and signal changes that let streetcars go first), not a bus lane.

## Why
Lane C's package screen compares four packages: existing, streetcar priority (called "lane" in Lane C's code), extra service, and both. It needs one policy file (`PACKAGE_POLICY_PATH`, schema in `server/src/shared/policy.ts`) with run times, headways and costs. None exists, so every upgrade is reported as "cost policy unavailable" and no affordability answer can be given. A10 supplies that data, with every number sourced or labelled.

## Decisions taken
| Decision | Choice | Why |
| --- | --- | --- |
| Extra-service target headways | **360 s, 300 s (default), 240 s** | Today's 505 AM peak is about 6–7 min. TTC's AM-peak streetcar headways in the current GTFS range from about 3 min (504 King) to 6 min (most routes); 300 s matches 506 Carlton and 510 Spadina, and 240 s matches 504 King eastbound. |
| Hours of extra service | **AM peak only**, costed as **2.5 h/day** (agreed) | **Because the simulation only models 07:00–09:00.** The benefit of extra cars (shorter waits, fewer riders left behind) is only measured in that window, so the cost must cover the same window. Costing AM+PM or all-day service against AM-only benefits would make extra service look worse than it is. The extra 0.5 h is an assumption for cars travelling to and from the carhouse. If the simulation later adds the PM peak, cost AM+PM instead. |
| Where extra service runs | **The whole 505 route** (Broadview Station ↔ Dundas West Station) | Added cars enter from the route's ends, so extra service has no partial coverage; its cost uses the full-route cycle. |
| Where streetcar priority applies | **The whole modelled segment**, Broadview & Dundas → TMU, all 8 links (agreed) | Three reasons. (1) **Simpler to implement:** one saving share applied to every link, and the effect shows fully in the simulation. (2) **No data on which links are most congested:** we only have scheduled times, not observed delay by link, so any choice of partial links would be unsupported. (3) **A partial-coverage option can be added later if time allows**, for example as a cheaper alternative, ideally once observed delay data exists. |
| Service days | Weekdays in a year, minus statutory holidays | Counted from the GTFS calendar pattern; derived, not observed. |
| Price year | CAD at one common year | Lane C requires one `price_year`; older costs are inflated to it with the Bank of Canada CPI and labelled. |

## Outputs
1. **`data/reviewed/interventions.json`**: the reviewed A10 data. Every value has `unit`, `status` (`sourced`, `derived`, `transferred`, `assumed` or `user_selected`), `source_ids`, a low/central/high range where uncertain, and a one-line `meaning`.
2. **`data/reviewed/package_policy_<headway>.json`** (three files: `_360`, `_300`, `_240`): generated from item 1, each matching Lane C's `PolicySchema` exactly. Lane C's schema holds one `service_headway_s`, so each target headway is one policy. The default (`_300`) is the one to point `PACKAGE_POLICY_PATH` at. The API also accepts a policy per job, so the frontend can offer all three.
3. **`backend/scripts/build_interventions.py`**: computes the derived values from cached GTFS, assembles items 1 and 2, and registers new sources in `simulation_sources.json`. Lane C rejects any `source_id` missing from that manifest.
4. Tests and a short section in this doc describing the final values.

## Fields and where each comes from
| Lane C field | Meaning | Method / source | Expected status |
| --- | --- | --- | --- |
| `cycle_s` | Time for one car to run Broadview Station → Dundas West → Broadview Station, including terminal layover | Westbound + eastbound scheduled run (GTFS, about 3,900 s + 3,780 s) plus median terminal layover from consecutive trips of the same `block_id` | derived |
| `baseline_headway_s` | Today's AM-peak entry gap | Same value the simulator uses (`headway_s` ≈ 420 s, the mean of scheduled gaps) so the two stay consistent | derived |
| `service_headway_s` | Gap with extra service | 360 / 300 / 240 s, one per policy file | user_selected |
| `lane_cycle_s` | `cycle_s` with streetcar priority | `cycle_s` minus the time saved on the modelled segment's 8 links, westbound and eastbound | derived from a transferred effect |
| `peak_hours` | Hours/day the extra cars run | 2.5 (AM peak plus carhouse travel) | assumed |
| `service_days` | Days/year | Weekday count for one year minus holidays | derived |
| `cost_per_hour` | Operating cost of one streetcar for one hour (driver, energy, maintenance) | TTC published operating statistics or budget: cost per vehicle-hour, streetcar mode if available, else system-wide and labelled | sourced or transferred |
| `lane_capital` | One-time cost to build priority on the modelled segment (paint, signs, signal changes, curb work) | King Street Transit Priority Corridor and RapidTO costs scaled to the segment's length (about 2.5 km). A similar project's budget is not a quote | transferred |
| `lane_operating` | Annual enforcement and upkeep | Same sources; if no figure exists, a wide labelled range | transferred or assumed |
| `price_year` | Year of the CAD figures | Common year after CPI adjustment | derived |
| `earliest_phase` | First phase an upgrade can be in place | `phase-1`, the only phase Lane C defines today | user_selected |
| `availability` | Optional per-option phase | Omitted unless the team sets different dates for lane and extra service | user_selected |
| `source_ids`, `assumption_label` | Provenance and one-sentence caveat | Collected from the rows above | — |

### Streetcar-priority effect (the hardest input)
No 505 priority exists, so there is no measured effect on Dundas. The plan is to transfer the King Street pilot's published travel-time changes for the 504 into a **share of link time saved**, as a low/central/high range, labelled `transferred`. `interventions.json` will list the covered links (all 8 links of the modelled segment) and the saving per link, so the simulator can shorten `link_travel_times_s` on those links.

`lane_cycle_s` only reduces the full-route cycle by the saving on the modelled segment (in both directions). Priority elsewhere on the 505 is not assumed.

### Extra vehicles, for checking
Required vehicles = `ceil(cycle_s / headway_s)`; Lane C computes this, A10 only supplies the inputs. With an illustrative cycle of about 8,000 s, today's 420 s needs about 20 cars; 360 s, 300 s and 240 s need about 23, 27 and 34. The real numbers will come from the computed cycle.

## Steps
1. Compute `cycle_s`, layover, `baseline_headway_s` and `service_days` from cached GTFS (about 30 min).
2. Find and record `cost_per_hour`, King Street costs and the King Street travel-time effect; download each source once with checksum (about 1 h; the least predictable step).
3. Write `interventions.json`, the three policy files and the build script; register sources (about 30 min).
4. Validate each policy against Lane C's rules, then run the package screen locally with `PACKAGE_POLICY_PATH` set and check every package reports vehicles and costs (about 20 min).
5. Tests and final values in this doc (about 20 min).

## Dependencies and risks
- **Budgets and fleet are zero in Lane C's default scenario** (`server/src/services/bundle.ts`: `capital_budget_cad: 0`, `fleet_allowance: 0`). With A10 in place, any upgrade still fails "over budget" until a user or Lane C supplies budgets and a fleet allowance. Not part of A10; Lane C needs to know.
- **The simulator has no streetcar-priority mechanism.** Extra service works through `headway_s`. For priority to change crowding, Lane B needs to apply A10's per-link savings to `link_travel_times_s`. Agree this with Lane B before building.
- **Cost figures may be incomplete.** Anything not found is marked `assumed` with a wide range; no number is presented as a TTC quote.
- **Spare fleet.** Whether TTC has the 3–14 extra streetcars these headways need at the AM peak is not something A10 can establish. `fleet_allowance` stays a scenario input.

## Still to agree before building
- **Lane B (simulator):** apply A10's per-link saving to `link_travel_times_s` when the priority package is run. Without this, the priority package appears in the cost screen but the simulated crowding stays the same as "existing".
