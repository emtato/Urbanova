# Assumptions and limits

The machine-readable inputs, per-field provenance and SourceRefs live in `data/reviewed/simulation_input.json` and `simulation_sources.json`. Reviewed intervention evidence is in `interventions.json`, the three `package_policy_*.json` files and [interventions.md](interventions.md). Every returned comparison includes the numerical assumptions and source versions used for that run.

| Input | Status | Meaning / limit |
| --- | --- | --- |
| Stop sequence, entry timetable, link schedule | Sourced | TTC GTFS for the selected service date; scheduled service, not observed headways. |
| Development units and stages | Sourced where documented | Proposed homes; occupancy and delivery dates are not confirmed. |
| Existing residential capacity | Mixed sourced / estimated | Per-building evidence and estimates are retained in the housing bundle; estimates are not published unit counts. |
| Occupancy, household size, trip rate and departure profile | Sourced proxies / assumptions | See each field's status, denominator and source IDs; commute choice already determines 505 use, so transit share is not multiplied a second time. |
| Incoming load and door dwell | Assumed | Uniform reviewed bounds; no measured AM incoming occupancy. |
| Boarding / alighting dwell feedback | Omitted by owner decision | The pulled Lane B implementation explicitly keeps bounded door dwell and omits passenger-dependent dwell. Schedule link times may already include dwell. |
| Shared delay | Assumed | Default `max_corridor_delay_s=0`; keyed once per run and divided across links. Link noise uses a separate stream. |
| Priority lane | Assumed effect; transferred cost evidence | Central link-time multiplier 0.88 on listed links only; evidence does not establish that AM saving on Dundas. Cost ranges are not quotes. |
| Extra service | User-selected alternative | Headways 240/300/360 seconds; round-trip cycle, extra vehicle hours and price-year cost ranges remain explicit. |
| Phase years, budgets, fleet and criterion | User-selected | Demo template is illustrative, not a forecast or TTC standard. |
| Warm-up / clearance | User-selected operational assumptions | Demo uses 600 / 1800 seconds. The owner's pre-window vehicle operation is retained; later service is an extrapolation. Pre-window incoming riders are excluded from the measured housing cohort. |
| Walking access | Pending human review | Nine candidate routes (three per development), cached OSM geometry; review entrances, crossings, barriers and closures before activating alternatives. |

`python -m backend.scripts.check_consistency` writes `baseline_consistency.json`: baseline travel-time residuals against the schedule, a demand-comparability warning and missing held-out observations. It does not tune growth or manufacture a stop-level residual from whole-route daily boardings.

Wait percentiles describe riders; run-to-run statistics describe paired simulation variation. Neither is an observational confidence interval. Native unresolved riders are denied riders still waiting at the cap; onboard riders and riders awaiting their first vehicle are separately reported as in progress. Raw waiting-at-cutoff counts remain available. A replay is one illustrative run, not the multi-run comparison.

There is no confirmed stop/direction/window demand calibration, no validated prediction of real crowding and no emissions model. Recommendations mean **best among the tested packages under these assumptions**. A package that fails the criterion stays visible; housing is never silently reduced to make it pass.

Warm-up pre-populates vehicles and incoming loads, not an observed pre-peak waiting queue. The simulator owner's bounded dwell and tick ordering remain explicit model choices; the original event-heap/passenger-dependent-dwell specification was not silently claimed as implemented.
