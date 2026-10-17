# Lane C: Express API, storage and grounded AI

The requested Express service is implemented in `server/`. It consumes the frozen Comparison 2.0.0 JSON Schema and the same frontend TypeScript interfaces. Stop/Development and the Python simulator remain owned by Lane B. The existing FastAPI Railway configuration is preserved; the Express deployment is a separate, ready-to-select config.

## Run

Use Node 24 and the existing repository-root `.env` with `DATABASE_URL`, `GEMINI_API_KEY`, `GEMINI_MODEL`, and optional `CORS_ORIGINS` (JSON array). No database credentials belong in frontend variables.

```sh
npm ci --prefix server
npm run db:init --prefix server
npm start --prefix server
```

`db:init` builds the server and creates additive `c_` tables in Tiger Data. Startup also applies this idempotent schema. API and worker-thread scheduler start together on port 8010, or `PORT`. Run one API on that port at a time. The existing Vite proxy already points there. `npm run dev --prefix server` watches API source; run a build after worker-source changes because worker threads execute compiled JavaScript.

```sh
npm test --prefix server
npm run smoke:db --prefix server
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
| POST /api/scenarios/:id/parse | `{question}`; AI patch preview, never an automatic write |
| POST /api/jobs | `{scenario_id, version, random:{seed_ids,draws_id}, retain_replay}`; 202 and polling ID, or cached completion |
| GET /api/jobs/:id | Job status, explicit fixture notice, package screen and stale flag |
| GET /api/results/:comparison_id | Frozen Comparison; fixture and stale response headers |
| GET /api/results/:comparison_id/summary | Tested-package decision and sensitivity report |
| POST /api/results/:comparison_id/explain | Grounded explanation or template fallback |
| GET /api/results/:comparison_id/brief | Text brief including costs, outcomes, uncertainty and versions |
| GET /api/replay/:comparison_id | Retained frozen ReplayStream; 404 if not selected |
| GET /api/fixtures/sample-comparison | Explicitly labelled original contract example |

Example patch: `{"version":1,"patch":{"phase_years":[{"phase_id":"phase-1","year":2028}],"capital_budget_cad":2500000}}`. Patch fields are strict: unknown keys/IDs and out-of-range values fail with 422 and field constraints. Housing locations, access/demographic inputs, phases, intervention options and availability must remain in the reviewed catalogue. A stale version fails with 409. A parse preview goes through the same validation as a form edit. Natural-language requests without a required year get a plain clarification response rather than a fabricated date.

The form patch also accepts `planning_criterion` with optional `max_p95_wait_s`, `max_denied_share` and `max_unresolved_passengers`. This remains a user-selected criterion, not a sourced TTC standard. Natural-language parsing uses the smaller, live-tested phase/housing/demand/budget/fleet subset; edit criterion values through the form boundary.

Job/patch/AI envelopes are explicit Zod schemas extending the transport around the frozen models, not changes to Comparison 2.0.0. JSON syntax errors, oversized requests, unknown routes and service errors return JSON. Raw SQL/SDK errors and keys are never returned.

## Packages and costs

The screen always lists existing, lane, extra service and both, retaining every infeasibility reason. Required vehicles are `ceil(cycle_s / headway_s)`. Incremental vehicles are nonnegative differences from baseline; annual operation is incremental vehicles × peak hours/day × service days/year × cost/hour, plus stated lane operation. High capital/annual operation bounds, extra fleet, price year and earliest phase are checked.

No reviewed cycle, lane effect or intervention cost quotes exist yet. With no policy configured, upgrades are explicitly unavailable; the API does not invent prices. `server/config/package-policy.example.json` is an inactive synthetic example. Populate a reviewed/user-selected policy, retain its assumption label and source IDs, and set backend-only `PACKAGE_POLICY_PATH` to its path. Claimed source IDs must resolve to the reviewed manifest. Policy contents participate in the cache key. Costs and budgets use CAD at a common price year. Capital is one-time and operation annual; the decision ranks high-bound capital then annual operation lexicographically, stating that rule rather than adding unlike annual/one-time amounts.

## B11 boundary and fixture mode

The latest Lane B commits add passenger generation, commute selection and boarding/alighting, but the runner still marks summary metrics and dwell as TODO and does not yet supply a B11 Comparison adapter. **C5 therefore uses the authorized fixture stub.** It returns the unchanged, labelled hand-worked example: its housing, seed IDs, capacities and two tested packages remain synthetic. It is not relabelled as a computation of the requested scenario or as evaluation of the four screened packages. The job stores the actual requested scenario separately; the notice makes the mismatch explicit. Fixture figures must never be displayed as real analysis.

`packages/plan.ts` defines the paired B11 plan: the same scenario housing, seed IDs, draws ID and low/central/high cases for each feasible package, plus an upgrade-availability delay of one year. `B11Adapter` is the attachment point in the worker evaluator. Production mode is not enabled until Lane B supplies that adapter with full, frozen Comparison outputs for base and delayed availability. The boundary rejects fixture outputs, changed housing, missing evaluations, unpaired seeds and different stop/cohort counts. It does not implement a second simulator.

The comparison code identifies dominance and selects a least-cost tested option passing every selected case/run, with the wording **best among the tested packages under these assumptions**. If none passes, it reports alternatives. Low/central/high choices and repeated worst stops can be computed from the fixture today. Upgrade-delay outcomes remain `pending_b11` until independently evaluated; moving phase labels is not treated as a new run.

## Storage, jobs and cache

The API enqueues only; computation runs in `worker_threads`. One active thread per process is bounded by a 120-second timeout. PostgreSQL leases, SKIP LOCKED claims and lease tokens prevent multiple instances completing the same job. Expired leases can be reclaimed after a restart. Scenarios are versioned and edits serialized; old jobs/results become stale. Cache keys include the complete validated scenario, policy, replay selection, reviewed data digest, model version, seed IDs and draws ID. Failed cached jobs can be retried. Bump MODEL_VERSION when installing/changing the evaluator.

All runs retain aggregates and actual run/source/assumption versions. Replay events are separated from comparison payloads and stored only when requested. `server/db/queries.sql` contains the three judge queries: reviewed development access joined to stops, worst stops for a phase, and package results across runs/assumption versions. It includes no unmeasured speed-up claim. Run EXPLAIN ANALYZE with real parameters before claiming one.

## AI and failures

One configured Gemini model uses `@google/genai`, a JSON schema generated from the Zod patch schema, and bounded request timeouts. Every actual call is logged in `c_ai_calls` with model, purpose, prompt hash, status and duration. Keys and raw prompts are not logged. If auditing cannot begin, the paid call is skipped. Gemini cannot run jobs or write scenarios; the caller must apply a validated patch.

The configured model accepted the SDK `responseSchema` vocabulary. The adapter generates it from Zod, encodes optional fields as nullable, removes nulls only for originally optional keys, then revalidates the complete original Zod schema. Provider-side schema constraints are a subset; server-side bounds and strict keys remain authoritative. Calls have a 25-second SDK timeout and 30-second abort deadline. Keep the default model generation settings used by the live check.

The explainer receives only a stored Comparison. Its numeric tokens must appear in that payload and cited IDs must resolve; otherwise it uses a deterministic template. A missing comparison returns a plain invitation to submit a scenario job. Observed stop-level demand and incoming occupancy remain unavailable and are never manufactured from whole-route daily counts.

## Railway

Keep Root Directory at the repository root and select `server/railway.json` as the service's config file to deploy Express. It builds the server Dockerfile with Node 24; Railway performs the image build, so teammates do not need Docker installed. Use the same backend-only Tiger Data and Gemini variables and allow the real frontend origin in CORS_ORIGINS. The root `railway.json` continues to start FastAPI until the service configuration is switched intentionally. The Docker build context excludes `.env`, caches, raw downloads and local dependencies. The Docker image itself has not been locally built unless explicitly recorded in validation.

Implementation references: [Node worker threads](https://nodejs.org/api/worker_threads.html), [node-postgres transactions](https://node-postgres.com/features/transactions), [Zod JSON Schema conversion](https://zod.dev/json-schema), [Google SDK content configuration](https://googleapis.github.io/js-genai/release_docs/interfaces/types.GenerateContentConfig.html).

## Executed verification

The Tiger Data smoke passed through HTTP, a real worker thread, nine persisted fixture-run aggregates, retained replay, a development/stop join and stale-version marking. The parser prompt `scenario-patch-v2` passed all ten live fixed questions, and its live explanation passed the grounding check without fallback. Further live checks hit HTTP 429 quota/rate limiting; the code keeps forms and templates available in that state. Form-only criterion edits do not expand the live-tested model-facing patch schema. After incorporating the latest teammate commits, 20 Node tests and 112 Python tests passed, along with the frozen-contract check and frontend contract/build/lint checks. Docker image construction has not been tested locally.
