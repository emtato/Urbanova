# Lane C: Express API, storage and grounded AI

The requested Express service is implemented in `server/`. It consumes the frozen Comparison 2.0.0 JSON Schema and the same frontend TypeScript interfaces. Stop/Development and the Python simulator remain owned by Lane B. The root Railway configuration now targets Express.

## Run

Use Node 24 and the existing repository-root `.env` with `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and optional `CORS_ORIGINS` (JSON array). No database credentials belong in frontend variables.

```sh
python -m pip install -r backend/integration/requirements.txt
npm ci --prefix server
npm run db:init --prefix server
npm start --prefix server
```

`db:init` builds the server and creates additive `c_` tables in Tiger Data. Startup also applies this idempotent schema. API and worker-thread scheduler start together on port 8010, or `PORT`. Run one API on that port at a time. The existing Vite proxy already points there. `npm run dev --prefix server` watches API source; run a build after worker-source changes because worker threads execute compiled JavaScript.

```sh
npm test --prefix server
npm run smoke:db --prefix server
npm run smoke:b11 --prefix server
npm run test:parser:live --prefix server
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
| GET /api/results/:comparison_id | Frozen Comparison; fixture and stale response headers |
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

No reviewed cycle, lane effect or intervention cost quotes exist yet. Supply explicit assumptions through the package-preview/job endpoints or a configured policy file. With no policy supplied, upgrades are explicitly unavailable; the API does not invent prices. `server/config/package-policy.example.json` is an inactive synthetic example. Populate a reviewed/user-selected policy, retain its assumption label and source IDs, and set backend-only `PACKAGE_POLICY_PATH` to its path. Claimed source IDs must resolve to the reviewed manifest. Policy contents participate in the cache key. Costs and budgets use CAD at a common price year. Capital is one-time and operation annual; the decision ranks high-bound capital then annual operation lexicographically, stating that rule rather than adding unlike annual/one-time amounts.

## B11 computation and explicit fixture mode

B11 is the default evaluator. Express queues work in a Node worker thread, which starts an isolated Python process using `backend.integration.b11`. It uses Lane B's runner and summary metrics; it does not implement another simulator or change Lane B's files. Python must be installed locally (the root `.venv` is detected), or set `PYTHON_EXECUTABLE`. The Railway image includes a minimal Python environment.

For each phase, low/central/high demand case and requested seed, sample the corridor cohort once and reuse it across packages. Incoming riders still consume capacity: injecting a cohort must preserve B11's incoming-generation path. Effective engine seeds derive from SHA256 of draws ID, phase, demand and requested seed ID. The run retains the requested seed ID. Random streams are shared, but event-dependent draw consumption can differ across packages. Identical effective inputs reuse computed outputs.

Without a policy, existing service runs against the reviewed housing; upgrades remain unavailable. With an explicit policy and sufficient budgets/fleet, the adapter constructs existing, lane, extra-service and both. The combined package accounts for fleet savings from the lane. Capital and annual costs, effects, availability and reasons are preserved. The frozen extra-service contract requires at least one added vehicle; an otherwise feasible zero-added-vehicle service assumption returns 422 instead of invented fleet. Packages unavailable in every phase are screened out and their reasons retained.

All runs use actual B11 output. The latest B11 metrics distinguish neutral cutoff riders (onboard or awaiting a first car) from denied riders still stranded, and use riders who encountered a car as the denied-share denominator. The frozen Comparison 2.0.0 requires all arrivals in its denominator and all waiting/onboard riders in unresolved counts. The adapter explicitly projects physical passenger state into those existing definitions, retaining completed-rider waits from B11. Its comparison/criterion decisions therefore retain the conservative frozen cutoff definition. The unmodified native B11 contract and overview are stored for every run in `c_b11_run_metrics` and exposed at `GET /api/results/:comparison_id/b11-metrics` with `format_version:"b11-metrics-v1"`. Clients needing the neutral-cutoff presentation should use those native counts, not relabel the frozen fields. Moving neutral-cutoff decisions into the frozen comparison needs an agreed contract version change. Stop p95 across multiple seeds is computed from pooled completed-passenger waits, never averaged stop percentiles. Remaining queues and unresolved passengers accompany completed-rider metrics. The one-year upgrade delay is a separate Comparison with independently materialized availability and stored aggregates; identical inputs may reuse actual computed results. Summary and brief link the delayed comparison and report whether the preferred tested package changes.

Submit `{scenario_id, version, random:{seed_ids:[42],draws_id:"demo"}, retain_replay:true}` to `POST /api/jobs`. Optional `policy` pins user-selected costs/effects. Optional `demand_factors` defaults to `{low:0.8,central:1,high:1.2}` and multiplies the all-mode trip rate; these are sensitivity assumptions, not measured confidence intervals. Every run carries model and data digests. The boundary checks the materialized scenario, feasible package coverage, phases/demand cases, paired seed IDs, stop/cohort counts, versions, conservation, references and numeric criterion flags.

`evaluator:"fixture"` explicitly requests the unchanged hand-worked contract sample. It retains fixture labels and synthetic housing/seeds; it is never presented as the requested scenario's calculation. Omit this option for real B11 runs.

Frozen Comparison 2.0.0 remains unchanged, with `replay:null` for B11. `GET /api/replay/:comparison_id` returns a separate strict `format_version:"b11-events-v1"` envelope for a retained B11 run: arrival/boarding/denial/dwell-related movement events, incoming passengers, final passenger records, stops and source/model/data/run IDs. Clients must branch on this version before rendering; the original fixture replay renderer cannot consume it directly. Only one selected base run retains its full log; all runs retain aggregates. A B11 replay is never disguised as an initial-queues-only fixture replay.

The decision wording remains **best among the tested packages under these assumptions**. Results are scenario experiments, not calibrated forecasts. Housing estimates, unreviewed entrances/crossings, assumed incoming loads/dwell/demand factors and possible scheduled-time/dwell double counting remain visible limitations. Long source-query URLs and date-only retrieval metadata are normalized for the frozen SourceRef limits, with exact originals/checksums preserved in reviewed manifests.

## Storage, jobs and cache

The API enqueues only; computation runs in `worker_threads`. One active thread per process is bounded by a ten-minute timeout (override with JOB_TIMEOUT_MS). A 30-second heartbeat renews its 150-second lease. Timeout, shutdown and worker failure terminate the Python child. PostgreSQL leases, SKIP LOCKED claims and lease tokens prevent multiple instances completing the same job. Expired leases can be reclaimed after a restart. Scenarios are versioned and edits serialized; old jobs/results become stale. Cache keys include the complete validated scenario, policy, replay selection, reviewed data digest, model version, seed IDs and draws ID. Failed cached jobs can be retried. Simulation/adapter/package source changes automatically change the B11 model digest; MODEL_VERSION separately versions the orchestrator.

All runs retain aggregates and actual run/source/assumption versions. Replay events are separated from comparison payloads and stored only when requested. `server/db/queries.sql` contains the three judge queries: reviewed development access joined to stops, worst stops for a phase, and package results across runs/assumption versions. It includes no unmeasured speed-up claim. Run EXPLAIN ANALYZE with real parameters before claiming one.

## AI and failures

One configured Gemini model uses `@google/genai`, a JSON schema generated from the Zod patch schema, and bounded request timeouts. Every actual call is logged in `c_ai_calls` with model, purpose, prompt hash, status and duration. Keys and raw prompts are not logged. If auditing cannot begin, the paid call is skipped. Gemini cannot run jobs or write scenarios; the caller must apply a validated patch.

The configured model accepted the SDK `responseSchema` vocabulary. The adapter generates it from Zod, encodes optional fields as nullable, removes nulls only for originally optional keys, then revalidates the complete original Zod schema. Provider-side schema constraints are a subset; server-side bounds and strict keys remain authoritative. Calls have a 25-second SDK timeout and 30-second abort deadline. Keep the default model generation settings used by the live check.

The explainer receives only a stored Comparison. Its numeric tokens must appear in that payload and cited IDs must resolve; otherwise it uses a deterministic template. A missing comparison returns a plain invitation to submit a scenario job. Observed stop-level demand and incoming occupancy remain unavailable and are never manufactured from whole-route daily counts.

## Railway

Keep Root Directory at the repository root. Both railway.json and server/railway.json target Express. It builds the server Dockerfile with Node 24 and Python; Railway performs the image build, so teammates do not need Docker installed. Use the same backend-only Tiger Data and Gemini variables and allow the real frontend origin in CORS_ORIGINS. The root configuration builds and starts Express on the next Railway deployment. Confirm the public health endpoint after deployment. The Docker build context excludes `.env`, caches, raw downloads and local dependencies. The Docker image itself has not been locally built unless explicitly recorded in validation.

Implementation references: [Node worker threads](https://nodejs.org/api/worker_threads.html), [node-postgres transactions](https://node-postgres.com/features/transactions), [Zod JSON Schema conversion](https://zod.dev/json-schema), [Google SDK content configuration](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html).

## Executed verification

The real Tiger Data smoke passed HTTP enqueue, worker thread/Python computation, all four packages, 15 persisted base run aggregates, a separately stored delay comparison, 2,566 selected native replay events and a cache hit. Costs in this probe were explicitly synthetic test assumptions; service metrics came from B11. The regular suite includes a real B11 regression checking incoming loads and p95 against actual passenger waits. Run `npm run smoke:b11 --prefix server` to repeat the full database check; it creates a labelled smoke scenario/result.

The existing ten live Gemini questions and grounded explanation passed before this integration; the prompt was unchanged, so no additional paid calls were made. Forms and templated explanations remain available when Gemini fails. Docker image construction and the public Railway health endpoint have not been verified locally.

Final local checks: 31 Node tests, 129 Python tests, frozen-contract validation, and frontend contract/build checks passed. Frontend lint completed with existing warnings, including the vendored map worker.
