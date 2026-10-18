# Verification record - 2026-10-17

Pulled `origin/main` through `d3cb110`, including the teammate frontend/3D changes explicitly approved by the user. Resolved the initial six overlaps and the later naming/provenance schema conflict, retaining both features. The simulation owner's tick engine and configured-simulation API are preserved. The pre-pull work is also preserved in a local Git stash. Teammate frontend/3D files match upstream without additional implementation edits.

- Express: all 47 tests passed after the final merge, including real B11 computations, configured batch save/fetch/rename/delete, native storage and the pipeline. `/health` stays responsive during configured computation.
- Python: 166 tests passed with the shadow suite excluded. The independent three-stop/two-car/ten-rider case passes; mean wait 17.2 seconds, p95 41 seconds, five denied once, all ten completed. The streamed-retention regression preserves native statistics and the full-result default.
- Pulled 3D test issue: `backend/tests/data/test_shadows.py::test_committed_shadows_have_three_layers_for_every_sunlit_time` expects 12 timestamps, while the pulled shadow artifact contains 16. The shadow artifact and test were left unchanged under the requested 3D exclusion.
- Frontend production build and contract check passed after the final pull: generated interfaces, TypeScript compilation and fixture warning/replay/assumption rendering.
- Tiger Data bundle: 60 source records, 9 stops, 8 links, 3 developments, 9 candidate walking routes and 4 intervention records. Repeated seeding is idempotent. Walking routes remain pending human approval.
- Database compatibility probe: an incompatible worker claim was skipped and the matching worker accepted; the test job was rolled back.
- Railway deployment `77e54033-e4ea-4a4c-a550-0c8e3501b60a` is healthy at `https://urbanova-production-ec5f.up.railway.app`. Model `b11-f25bcfaf3073abf6c471`, data `reviewed-ca928b8645bb48a7dd4b`, orchestrator `lane-c-b11-v2` match Windows.
- Public real-job probe passed: conservation, assumption statuses, over-budget rejection, immutable scenario reload, repeat-request cache hit, stale results after an edit, HTTP 409 for the stale request, fresh replacement results, two history records and a downloadable brief. Probe comparison: `202fab45-3d11-4f37-9e6b-70b3d2984cbe`.

- The final configured-simulation API passed real Tiger Data save/fetch/delete checks, including model/data/source provenance. Only its own short probe record was deleted. Fifteen API/native-storage/pipeline tests passed after the additive provenance change.

The completed grid is comparison `bf004a78-1bf5-46b2-927e-ceda484fdfca`; delay comparison `f522ceb4-a2ca-4825-ad9f-93394c71618a`. It covers two phases, low/central/high demand, four packages, 20 paired seeds and the availability delay: 30 base cases and 30 delayed cases, 1,200 persisted run aggregates, 1,200 native summaries, 1,080 stop/cohort aggregates and exactly one full selected run/replay archive. Every retained run passes conservation.

The initial successful `runPipeline` took 755.641 seconds locally. Repeating the same request returned the same comparison as a cache hit in 3.508 seconds inside `runPipeline`, or 8.523 seconds for the whole CLI command including build/initialization. These are observed timings for this workload, not a general database speed-up claim. Railway independently served the same grid as a cache hit. The tested preference is extra service; the delayed-upgrade comparison has no package meeting the criterion across all selected cases. These are model outcomes under the recorded assumptions.

The Windows launcher `-CheckOnly` passed against the current cached grid/database. PowerShell and Bash launcher syntax checks passed. The local ignored `data/cache/demo/manifest.json` and `brief.txt` can be recreated on another laptop by repeating the same pipeline command; use `--remote-worker` when Railway's matching worker is available. Other policies or edited inputs are not automatically cache hits.

Earlier large runs exceeded memory; package comparisons now project each run to its native summary immediately rather than retaining every full archive until the batch ends. Full dictionaries remain the default for the owner's standalone batch API. This preserves the authoritative native summaries and statistics.

Human checks not represented by these automated results: walking entrances/crossings, four physical laptops, cold boot, outside-team usability, three rehearsals, backup recording, screenshots and Devpost submission. No physical offline database test is claimed; the team explicitly chose hosted Tiger Data only.
