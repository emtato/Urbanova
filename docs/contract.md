# Phase 01 contract, version 1.0.0

Simulation variables and the simulator are owned by the simulation teammate. The sourced data now covers **505 westbound, Dundas East/Broadview to Jarvis**; see [data-handoff.md](data-handoff.md). The synthetic contract fixture, frontend and source bundle now consistently use that westbound segment. Contract validation passes; simulator variables and hand-case validation remain owned by the simulation teammate.

The active backend is FastAPI. Its authoritative runtime models are **Pydantic modules in backend/schemas/**, replacing the archived Express/Zod instructions in the version 3 planning document. The generated JSON Schema is data/contracts/comparison.schema.json. Matching, hand-maintained TypeScript interfaces are frontend/src/lib/types.ts. No second backend or validation library is needed.

## Checklist and evidence

| Step | Deliverable | Evidence |
| --- | --- | --- |
| 1.1 | Corridor and service window | [corridor.md](corridor.md), dated GTFS evidence in data/reviewed |
| 1.2 | Three proposals and missing observations | [feasibility.md](feasibility.md); estimated walking access explicitly requires owner review |
| 1.3 | Live database and structured Gemini response | data/reviewed/access_check.json; both passed locally |
| 1.4 | Simulator and hand-case validation | Owned by simulation teammate; duplicate root sim/ scaffolding removed |
| 1.5 | SourceRef | backend/schemas/source.py |
| 1.6 | Assumption | backend/schemas/assumption.py |
| 1.7 | Stop, Link, Corridor | backend/schemas/corridor.py |
| 1.8 | Development and walking access | backend/schemas/development.py |
| 1.9 | Intervention and cost ranges | backend/schemas/intervention.py |
| 1.10 | Scenario, phase, budgets and criterion | backend/schemas/scenario.py |
| 1.11 | Run and diagnostics | backend/schemas/run.py |
| 1.12 | ReplayEvent | backend/schemas/replay_event.py |
| 1.13 | StopResult and CaseResult | backend/schemas/results.py |
| 1.14 | Comparison, packages, sensitivity and replay | backend/schemas/comparison.py |
| 1.15 | Matching TypeScript | frontend/src/lib/types.ts; check:contract checks field parity and compiles the sample |
| 1.16 | Fully populated sample and replay | data/fixtures/sample_comparison.json; visible FIXTURE banner in the frontend |

This records executed engineering checks. It does not assert that all four laptop owners have signed off: their confirmation table remains in [foundation.md](foundation.md). It also does not mark entrance/crossing field review as completed.

## IDs, units and ordering

- Preserve GTFS IDs as strings. Canonical stop IDs are `ttc-stop-<gtfs_stop_id>`. Stop seq is contiguous, **zero-based**, in travel order. Links connect consecutive stops. Development IDs and pipeline_ref identify one proposal once.
- WGS84 coordinates use **[longitude, latitude]**, EPSG:4326. Metric calculations use EPSG:26917; lengths and walking distances are metres. Footprints are GeoJSON Polygons with closed rings. Missing footprints are null with footprint_status=unavailable; address-point boxes are not building footprints.
- Time quantities have an explicit _s suffix and use seconds. peak_window start_s/end_s are local GTFS service-day seconds, allowing values beyond 86400. The timezone is America/Toronto; service_date anchors the schedule. Replay t_s starts at zero at the beginning of the modelled window.
- Incoming load and capacity use passengers/vehicle. Shares are fractions from 0 to 1, never percentages. Count fields are nonnegative integers. Money uses CAD; operating budgets/costs are annual, capital costs are one-time. Costs and budgets must share a price year.
- retrieved_at includes a timezone. Development record_date in this snapshot is the **application received date**, not an approval or completion date. Dataset revision/retrieval details remain in the source manifest.
- Every source_ids reference must resolve to one unique SourceRef. Assumptions carry meaning, units, ordered low/central/high, allowed_range and status. Sourced assumptions require provenance; no source ID converts a fixture choice into an observation.

## Scenario and comparison semantics

A Scenario owns one housing list shared by every package; packages cannot replace the housing input. Each development is assigned to exactly one phase. That phase's occupied_share is a scenario input, not a claim that its proposed homes are built. Phase year supplies the availability date at this contract's annual resolution; intervention_availability and earliest_phase reference these phase IDs.

A Comparison contains current, growth and supported_growth cases for **each phase and each low/central/high demand case**. scenario.demand_case selects the UI's initial view. Package evaluations cover every phase/demand pair and point to a matching CaseResult. Current has no new-development riders. Growth and supported growth compare the same passenger cohorts with paired seed IDs. Packages may have multiple interventions; their high-bound costs and extra vehicle counts are added.

Feasibility uses high-bound capital and annual operating costs, fleet allowance and both availability constraints. A feasible package may still fail the planning criterion. The criterion is applied to every run's p95 wait, denied-at-least-once share and unresolved passengers, not just an average across seeds. Reasons accompany failed decisions. The sample's numeric criterion and costs are invented test values, not TTC standards or quotes.

Each Run is one result with its own model/data versions, scenario version, package and seed IDs. Conservation means created = arrived + waiting + onboard. Unresolved = waiting + onboard at the reporting cap; a completed run can still have unresolved riders. Its completion status does not imply criterion success.

StopResult covers both existing and new riders at every stop, including empty cohorts. Mean/p95 waits describe **completed riders** only and are null when none complete. Denied share uses all arrivals in that cohort and counts a rider once, regardless of repeated deny events; it is null for an empty cohort. Headway CV is standard deviation divided by mean, with null when insufficient arrivals are available. The deterministic sample has at least two arrivals at each stop, giving CV zero.

CaseResult's per-run arrays align with its runs list; run_count is their common length. unresolved_passengers is the sum across runs, not a mean. Stop counts likewise aggregate across runs; wait means weight completed riders. P95 uses the nearest-rank definition over completed waits and must not be reconstructed by averaging stop p95s. Stop accounting and weighted means/denied shares are cross-checked for single-run cases. Multi-run individual passenger histories remain the simulation owner's responsibility.

## Replay semantics

The sample stream includes two streetcars visiting **every one of the seven stops**, using the six sourced schedule-link medians and zero fixture dwell. Events are chronological, with stable authored ordering at equal timestamps. Each car dispatches once, arrives at a stop, alights before boarding, records any capacity denial, then departs. Movement events have count=0 and rider_group=null. Passenger events identify existing or new riders; load_after is the vehicle's total after that event. A denial never removes riders from a queue.

ReplayStream includes run_id, vehicle capacities, a reporting horizon and queues present at t=0. This first stream contract supports empty incoming vehicles and those initial queues; a future stream with new arrivals during replay or incoming passengers must add explicit initialization/arrival semantics in a versioned contract change. It must not silently reuse dispatch as a passenger-arrival event. The validator checks capacity, group loads, stop order, initial/final accounting and consistency with run diagnostics. The supplied short stream finishes both vehicles at Jarvis, leaving two new riders waiting at River.

## Fixture hand calculation

The three central-demand cases are authored in backend/scripts/build_fixture.py, with the arithmetic in its docstring. Five existing riders start at Broadview, five new riders at River, and everyone alights at Jarvis. Vehicles have **four places for testing**, not an asserted streetcar capacity. Two baseline dispatches occur at 0 and 60 s; the supported package dispatches three cars at 0, 30 and 60 s. Every passenger waits from t=0. River is 175 scheduled seconds after Broadview.

| Central case | Created | Arrived | Queued | Completed mean wait | P95 | Denied once |
| --- | --- | --- | --- | --- | --- | --- |
| Current | 5 | 5 | 0 | 12 s | 60 s | 1/5 |
| Growth | 10 | 8 | 2 | 95.625 s | 235 s | 6/10 |
| Supported growth | 10 | 10 | 0 | 111.5 s | 235 s | 6/10 |

Low demand uses three new riders; high uses seven, keeping the five existing riders. All nine case results and both packages' three demand evaluations are populated. The high-demand supported package fails the illustrative denied-share criterion even though it clears its queues. A capacity sensitivity entry is labelled fixture and holds the central passenger inputs fixed.

The central supported completed-rider mean is higher because it includes the two long-wait riders left unresolved by baseline growth. Read it alongside unresolved riders. None of these fixture demand counts is derived from the actual proposed unit counts. A real development-to-demand conversion belongs to Lane A and needs explicit occupancy/trip assumptions.

## Validate and hand off

From the repository root, using the activated Python environment:

```sh
python -m backend.scripts.check_contract
python -m pytest backend/tests -q
cd frontend
npm run check:contract
npm run build
npm run lint
```

No credentials, database access or paid Gemini call are needed for these contract checks. The previous live access check is recorded separately. The frontend's contract check compares Python/TypeScript field names, compiles an exact generated copy of the JSON using satisfies Comparison, and renders the React tree to check the warning banner and replay control. Python tests reject broken source links, units, ranges, budgets, run arrays, passenger accounting and replay loads.

Run python -m backend.scripts.build_fixture only to intentionally re-author the hand-worked example. For other intentional contract/JSON edits, run python -m backend.scripts.check_contract --write, review the JSON Schema and TypeScript copy, then rerun both language checks. Without --write, any generated artifact drift fails. TypeScript does not replace runtime validation of future network responses.

The fixture endpoint is GET /api/fixtures/sample-comparison, validates its response with Comparison and returns X-FutureProof-Fixture: true. It does not save or simulate anything. The frontend currently loads the same checked-in fixture without a network dependency and displays a sticky FIXTURE banner, assumptions and a replay scrubber. The full production map, scenario runner, persistence and Gemini explanation are later lane work.

Owners can now build against contract 1.0.0. Change units, field meanings or required fields only with a contract version change, corresponding Python/TypeScript updates and a reviewed replacement sample. Keep fixture labels on every fixture-derived presentation.
