# Lane C: Express API, storage and grounded AI

The requested Express service is implemented in `backend/server/`. Live results use C's **3.0.0** metadata envelope containing Lane B's native batches; legacy Comparison 2.0.0 remains readable for fixtures/history. **The owner's 2026-10-17 decision makes Lane B's dictionaries and metric definitions authoritative.** Stop/Development and the Python simulator remain owned by Lane B. The root Railway configuration targets Express.

## Run

Use Node 24 and the existing repository-root `.env` with `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and optional `CORS_ORIGINS` (JSON array). No database credentials belong in frontend variables.

```sh
python -m pip install -r backend/integration/requirements.txt
npm ci --prefix backend/server
npm run db:init --prefix backend/server
npm start --prefix backend/server
```

`db:init` builds the server and creates additive `c_` tables in Tiger Data. Startup also applies this idempotent schema. API and worker-thread scheduler start together on port 8010, or `PORT`. Run one API on that port at a time. The existing Vite proxy already points there. `npm run dev --prefix backend/server` watches API source; run a build after worker-source changes because worker threads execute compiled JavaScript.

```sh
npm test --prefix backend/server
npm run smoke:db --prefix backend/server
npm run smoke:b11 --prefix backend/server
npm run test:parser:live --prefix backend/server
```

The regular tests need no credentials/network/paid calls. The explicit database smoke uses Tiger Data and leaves a labelled smoke scenario/result for inspection. It verifies HTTP → job → worker thread → stored aggregates/replay and stale edits. The ten fixed parser questions are boundary regressions using injected structured answers; they test IDs, ranges and preservation of housing. They are not a measured live-model accuracy score. `test:parser:live` explicitly reruns the same questions against the configured model and one explanation, logging every actual call. Rerun it after prompt changes; it fails if the provider or prompt regression is unavailable rather than reporting mocked responses as live success.

## Endpoints

| Endpoint | Behaviour |
| --- | --- |
| GET /health, /api/health, /api/health/db | PostgreSQL ping; 503 JSON when unavailable |
| GET /api/corridor | Reviewed westbound corridor in frozen Corridor format |
| GET /api/scenarios/default | Reviewed housing with explicit editable planning defaults |
| POST /api/scenarios | Create a scenario with `{scenario_id}` |
| GET /api/scenarios/:id | Latest Scenario |
| POST /api/scenarios/:id/patch | `{version, patch}`; validate and create next version |
| POST /api/scenarios/:id/packages | Immediate cost/fleet/availability screen for `{version, policy?}`, including a one-year availability delay; no simulator required |
| POST /api/scenarios/:id/parse | `{question}`; AI patch preview, never an automatic write |
| POST /api/jobs | `{scenario_id, version, random:{seed_ids,draws_id}, retain_replay}`; 202 and polling ID, or cached completion |
| GET /api/jobs/:id | Job status, evaluator notice, package screen and stale flag |
| GET /api/results/:comparison_id | Native 3.0.0 comparison or legacy 2.0.0 result; fixture and stale response headers |
| GET /api/results/:comparison_id/summary | Tested-package decision and sensitivity report |
| POST /api/results/:comparison_id/explain | Grounded explanation or template fallback |
| GET /api/results/:comparison_id/brief | Text brief including costs, outcomes, uncertainty and versions |
| GET /api/replay/:comparison_id | Selected B11 b11-events-v1 replay, or frozen fixture ReplayStream; 404 if not selected |
| GET /api/fixtures/sample-comparison | Explicitly labelled original contract example |

Example patch: `{"version":1,"patch":{"phase_years":[{"phase_id":"phase-1","year":2028}],"capital_budget_cad":2500000}}`. Patch fields are strict: unknown keys/IDs and out-of-range values fail with 422 and field constraints. Housing locations, access/demographic inputs, phases, intervention options and availability must remain in the reviewed catalogue. A stale version fails with 409. A parse preview goes through the same validation as a form edit. Natural-language requests without a required year get a plain clarification response rather than a fabricated date.

The form patch also accepts `planning_criterion` with optional `max_p95_wait_s`, `max_denied_share` and `max_unresolved_passengers`. This remains a user-selected criterion, not a sourced TTC standard. Natural-language parsing uses the smaller, live-tested phase/housing/demand/budget/fleet subset; edit criterion values through the form boundary.

Job/patch/AI envelopes are explicit Zod schemas extending the transport around the frozen models, not changes to Comparison 2.0.0. JSON syntax errors, oversized requests, unknown routes and service errors return JSON. Raw SQL/SDK errors and keys are never returned.

## Packages and costs

The screen always lists existing, lane, extra service and both, retaining every infeasibility reason. Required vehicles are `ceil(cycle_s / headway_s)`. Incremental vehicles are nonnegative differences from baseline; annual operation is incremental vehicles × peak hours/day × service days/year × cost/hour, plus stated lane operation. High capital/annual operation bounds, extra fleet, price year and earliest phase are checked.

No reviewed cycle, lane effect or intervention cost quotes exist yet. Supply explicit assumptions through the package-preview/job endpoints or a configured policy file. With no policy supplied, upgrades are explicitly unavailable; the API does not invent prices. `backend/server/config/package-policy.example.json` is an inactive synthetic example. Populate a reviewed/user-selected policy, retain its assumption label and source IDs, and set backend-only `PACKAGE_POLICY_PATH` to its path. Claimed source IDs must resolve to the reviewed manifest. Policy contents participate in the cache key. Costs and budgets use CAD at a common price year. Capital is one-time and operation annual; the decision ranks high-bound capital then annual operation lexicographically, stating that rule rather than adding unlike annual/one-time amounts.

## B11 native handoff: owner decision, 2026-10-17

This decision supersedes earlier template requirements for live B → C results.
B supplies `run_repeated_simulations(inputs, run_count=20, seeds=...)` and
`run_paired_comparisons(cases, baseline_case=..., run_count=20, seeds=...)` in
`backend/simulation/paired_runs.py`. See [simulation-runs.md](simulation-runs.md).
C must accept the single-input batch shape directly:

```text
{
  overall_results: {
    run_count, seeds, metrics,
    all_runs_conservation_valid, invalid_run_indices, runtime
  },
  individual_results: [
    {inputs, streetcars, passengers, sim_log, summary},
    ...one unchanged full dictionary per seed...
  ]
}
```

Named comparisons contain those batches under `cases`, with `baseline_case`,
`seeds`, `total_run_count`, `improvements` and `runtime_s`. C owns scenario,
package, source and version metadata outside B's dictionaries. C must validate
the native result shape and migrate its API, storage, frontend consumers,
criterion checks, briefs and AI explanations together.

The simulator owner's definitions are authoritative:

- Onboard riders and riders awaiting their first car at cutoff are **in progress**, excluded from unresolved counts.
- Unresolved means riders still waiting after a capacity denial. `raw_waiting_at_cutoff_passengers` separately records the physical queue.
- Denied share counts each denied corridor rider once and uses corridor riders who encountered a streetcar as its denominator.
- Preserve the cohort named by each metric; the overview's boarding-wait metrics and completed-trip wait metrics are separate.
- Aggregate means and sample standard deviations describe variation between runs. A mean of per-run p95s is not a pooled passenger percentile or a confidence interval.

Remove the bridge projection that substitutes all-waiting-plus-onboard
unresolved counts or an all-arrivals denied-share denominator. Package decisions
must use B's meanings, rather than hiding them in a side endpoint while making
decisions with the older formulas. Keep the original Comparison 2.0.0 fixture
labelled and separate; B does not owe a template-shaped output adapter.

Replay uses the selected run's `sim_log`, supporting passenger arrivals during
the run, incoming vehicle loads, existing/new counts, passenger IDs, post-event
vehicle/queue counts and vehicle snapshots. A C-owned transport envelope may
carry these records and metadata without discarding events or requiring all
riders to start in queues at time zero. Native actions and fields are documented
in `backend/simulation/metrics.py`.

The bridge now calls `run_repeated_simulations` and retains each original batch
inside its case metadata. The old metric projection has been removed. Native
validation checks seed order, aggregates and per-run views against full results;
package matching compares initial journeys instead of completion-dependent
counts. Matching seed IDs alone still does not complete B2's fixed vehicle/link draws.

## Current B11 computation and explicit fixture mode

B11 is the default evaluator. Express queues work in a Node worker thread, which starts an isolated Python process using `backend.integration.b11`. It uses Lane B's runner and summary metrics; it does not implement another simulator or change Lane B's files. Python must be installed locally (the root `.venv` is detected), or set `PYTHON_EXECUTABLE`. The Railway image includes a minimal Python environment.

For each phase, low/central/high demand case and requested seed, sample the corridor cohort once and reuse it across packages. Incoming riders still consume capacity: injecting a cohort must preserve B11's incoming-generation path. Effective engine seeds derive from SHA256 of draws ID, phase, demand and requested seed ID. The run retains the requested seed ID. Random streams are shared, but event-dependent draw consumption can differ across packages. Identical effective inputs reuse computed outputs.

Without a policy, existing service runs against the reviewed housing; upgrades remain unavailable. With an explicit policy and sufficient budgets/fleet, the adapter constructs existing, lane, extra-service and both. The combined package accounts for fleet savings from the lane. Capital and annual costs, effects, availability and reasons are preserved. The frozen extra-service contract requires at least one added vehicle; an otherwise feasible zero-added-vehicle service assumption returns 422 instead of invented fleet. Packages unavailable in every phase are screened out and their reasons retained.

All runs use actual simulator output. Each live 3.0.0 case contains unchanged `overall_results` and `individual_results` plus C-owned metadata. Decisions read the native overview directly; per-run view arrays are checked for equality. Stop summaries pool completed-passenger waits and weight denied share by encountered riders. Full original summaries remain in `c_b11_run_metrics` and at `GET /api/results/:comparison_id/b11-metrics` with `format_version:"b11-metrics-v1"`. The one-year availability delay is materialized separately. Explanations receive checked metrics and variation without the large individual passenger/replay archives; grounding checks that same payload.

Submit `{scenario_id, version, random:{seed_ids:[42],draws_id:"demo"}, retain_replay:true}` to `POST /api/jobs`. Optional `policy` pins user-selected costs/effects. Optional `demand_factors` defaults to `{low:0.8,central:1,high:1.2}` and multiplies the all-mode trip rate; these are sensitivity assumptions, not measured confidence intervals. Every run carries model and data digests. The boundary checks the materialized scenario, feasible package coverage, phases/demand cases, paired seed IDs, stop/cohort counts, versions, conservation, references and numeric criterion flags.

`evaluator:"fixture"` explicitly requests the unchanged hand-worked contract sample. It retains fixture labels and synthetic housing/seeds; it is never presented as the requested scenario's calculation. Omit this option for real B11 runs.

Fixture Comparison 2.0.0 remains unchanged. Live 3.0.0 has `replay:null` in its metadata envelope; full native run dictionaries and logs are archived inside each case. `GET /api/replay/:comparison_id` additionally returns the selected replay as the existing strict `format_version:"b11-events-v1"` envelope. Only the selected replay is separately indexed; the exact event records remain native. Native batches travel between Python and Node as gzip-compressed JSON, with a 64 MiB compressed limit and configurable decoded `B11_MAX_OUTPUT_BYTES` (default 512 MiB). Large matrices require corresponding memory/runtime sizing. API paths and handlers were not changed; frontend response validation now accepts 3.0.0.

The decision wording remains **best among the tested packages under these assumptions**. Results are scenario experiments, not calibrated forecasts. Housing estimates, unreviewed entrances/crossings, assumed incoming loads/dwell/demand factors and possible scheduled-time/dwell double counting remain visible limitations. Long source-query URLs and date-only retrieval metadata are normalized for the frozen SourceRef limits, with exact originals/checksums preserved in reviewed manifests.

## Storage, jobs and cache

The API enqueues only; computation runs in `worker_threads`. One active thread per process is bounded by a ten-minute timeout (override with JOB_TIMEOUT_MS). A 30-second heartbeat renews its 150-second lease. Timeout, shutdown and worker failure terminate the Python child. PostgreSQL leases, SKIP LOCKED claims and lease tokens prevent multiple instances completing the same job. Expired leases can be reclaimed after a restart. Scenarios are versioned and edits serialized; old jobs/results become stale. Cache keys include the complete validated scenario, policy, replay selection, reviewed data digest, model version, seed IDs and draws ID. Failed cached jobs can be retried. Simulation/adapter/package source changes automatically change the B11 model digest; MODEL_VERSION separately versions the orchestrator.

All runs retain aggregates and actual run/source/assumption versions. Native 3.0.0 archives the full batches, including original run logs; only the selected replay is additionally indexed for replay retrieval. `PgStore.pastRuns({scenario_id,limit,offset})` returns paginated experiment metadata without loading those large dictionaries; wiring a history endpoint is deferred with the API routes. `backend/server/db/queries.sql` contains the three judge queries: reviewed development access joined to stops, worst stops for a phase, and package results across runs/assumption versions. It includes no unmeasured speed-up claim. Run EXPLAIN ANALYZE with real parameters before claiming one.

## AI and failures

One configured Gemini model uses `@google/genai`, a JSON schema generated from the Zod patch schema, and bounded request timeouts. Every actual call is logged in `c_ai_calls` with model, purpose, prompt hash, status and duration. Keys and raw prompts are not logged. If auditing cannot begin, the paid call is skipped. Gemini cannot run jobs or write scenarios; the caller must apply a validated patch.

The configured model accepted the SDK `responseSchema` vocabulary. The adapter generates it from Zod, encodes optional fields as nullable, removes nulls only for originally optional keys, then revalidates the complete original Zod schema. Provider-side schema constraints are a subset; server-side bounds and strict keys remain authoritative. Calls have a 25-second SDK timeout and 30-second abort deadline. Keep the default model generation settings used by the live check.

The explainer receives the stored comparison's checked metrics, variation and metadata; native individual histories are omitted from its prompt. Numeric tokens must appear in that same prompt payload and cited IDs must resolve; otherwise it uses a deterministic template. A missing comparison returns a plain invitation to submit a scenario job. Observed stop-level demand and incoming occupancy remain unavailable and are never manufactured from whole-route daily counts.

## Railway

Keep Root Directory at the repository root. Both railway.json and backend/server/railway.json target Express. It builds the server Dockerfile with Node 24 and Python; Railway performs the image build, so teammates do not need Docker installed. Use the same backend-only Tiger Data and Gemini variables and allow the real frontend origin in CORS_ORIGINS. The root configuration builds and starts Express on the next Railway deployment. Confirm the public health endpoint after deployment. The Docker build context excludes `.env`, caches, raw downloads and local dependencies. Railway built and deployed this image successfully on 2026-10-17; public API/database health and a real four-package job passed. See [the deployment record](live-analysis.md).

Implementation references: [Node worker threads](https://nodejs.org/api/worker_threads.html), [node-postgres transactions](https://node-postgres.com/features/transactions), [Zod JSON Schema conversion](https://zod.dev/json-schema), [Google SDK content configuration](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html).

## Executed verification

The real Tiger Data smoke passed HTTP enqueue, worker thread/Python computation, all four packages, 15 persisted base run aggregates, a separately stored delay comparison, 2,566 selected native replay events and a cache hit. Costs in this probe were explicitly synthetic test assumptions; service metrics came from B11. The regular suite includes a real B11 regression checking incoming loads and p95 against actual passenger waits. Run `npm run smoke:b11 --prefix backend/server` to repeat the full database check; it creates a labelled smoke scenario/result.

The existing ten live Gemini questions and grounded explanation passed before this integration; the prompt was unchanged, so no additional paid calls were made. Forms and templated explanations remain available when Gemini fails. Railway image construction, public API/database health and a real public B11 job were verified on 2026-10-17; see [the deployment record](live-analysis.md).

Final local checks: 31 Node tests, 129 Python tests, frozen-contract validation, and frontend contract/build checks passed. Frontend lint completed with existing warnings, including the vendored map worker.
