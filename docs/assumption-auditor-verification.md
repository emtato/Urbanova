# Assumption-auditor verification

Backend implementation checked on 2026-10-17 (Toronto). This record separates
computed results, test fixtures, and integration work that still needs access.

- Full Express/backend suite: **58 tests passed**, including 11 auditor tests.
- After adding the Papiers reader and private-excerpt protections, the full suite
  passed **64 tests**. Additional focused coverage checks broader-search service
  notes are not mislabelled as incoming-load evidence.
- Final full backend suite with the CLI reader, broader searches and scoped
  low-thinking Gemini configuration: **65 tests passed**.
- TypeScript build and `git diff --check` passed.
- Real Tiger Data queue creation, claiming, lease renewal, persistence and reload
  were exercised with the actual B11 Python adapter.
- Final real investigation: **6384e993-413a-4081-9cc7-1e9225aaaa5d**.
  Seven configurations × seeds 101, 102, 103 = **21 actual B11 runs**. Fixed
  existing housing cohort signatures and conservation checks passed. The saved
  status is **awaiting_human**, with an agent-selected incoming-load follow-up.
  The current central assumptions did not reproduce existing-rider denied
  boarding at the selected stop. The incoming-load prediction was contradicted
  within these cases. No crowding, observed baseline or threshold was fabricated.
- This real check used the bounded local policy, with Gemini disabled. Automatic
  approval review rejected sending the new audit context to Gemini without
  specific approval. The model-choice path has unit coverage and is wired behind
  `RESEARCH_GEMINI_ENABLED=true`, which is off by default. No live Gemini auditor
  call is claimed.
- Unit tests complete a clearly labelled **TEST** human-redirect loop, verify that
  an unavailable fleet removes service frequency from consideration, check
  revision conflicts, and reject mismatched cohorts, unknown stops, contradictory
  settings, invented AI citations, and a live-library claim without a receipt.
  These tests are not an actual teammate redirect or a live Papiers read.
- Existing 20-run demo cache **bf004a78-1bf5-46b2-927e-ceda484fdfca** remains current;
  its two phases and stored upgrade-delay comparison passed `check-demo`.
- Backend commit **3f92ccc** was pushed and deployed to Railway as
  **469d2683-7b35-4840-9f7b-5aafbfdf8760**. Public API/database health passed;
  the real local checkpoint reloaded with `stale:false` on Linux.
- The deployed Railway worker independently computed another seven configurations
  × seeds 201, 202, 203 (**21 real B11 runs**) for investigation
  **e690d21b-acc4-4321-95ac-4d2a8d9f76a8**. It reached `awaiting_human` with
  `stale:false`, no error, nine ordered events, and `chosen_by:bounded_policy`.
  [Open its live research replay](https://urbanova-production-ec5f.up.railway.app/api/investigations/e690d21b-acc4-4321-95ac-4d2a8d9f76a8/replay).
  The public integration endpoint correctly reports `transport:unconnected`.
- Teammate UI commits through **928e2f0** were fast-forwarded; this feature adds
  backend research endpoints and a UI handoff, not the resident research drawer.

## Follow-up after the user supplied the challenge brief

The user confirmed the actual constraint: **No extra vehicles at move-in; keep
current service frequency** and explicitly authorized the new Gemini decision
payload. That redirect was saved under `User (research team)` on investigation
**e690d21b-acc4-4321-95ac-4d2a8d9f76a8**. Nine additional B11 runs completed its
three follow-up cases at current headway, for **30 real runs total**. Its status
is now **completed**. The live Gemini call returned HTTP 504; the recorded bounded
fallback chose the next knob, with service excluded. This is an actual human
constraint, not a test fixture; no successful Gemini decision is claimed from
that timed-out call.

The supplied brief makes Papiers optional, but the user explicitly requested the
integration. The official CLI **papiers 0.1.5** is now pinned and wired for bounded
search/read using `PAPIERS_TOKEN`. Its published guide says it is read-only;
write-back is not implemented through an invented command. A real library token
and matching content are needed for a real content read. The saved token has now
authenticated successfully against the official CLI: listing notes returned an
actual response with zero notes, and relevant searches found no readable item.
The user was asked to add the real service constraint as a Papiers note. Until
the content check returns an actual item/request receipt, this record does not
claim a verified content read. The token was transferred to Railway through
stdin without printing it. Private library excerpt bodies are excluded from the public
API and export. The CLI adapter has tests for real command shapes, returned ID
matching, empty/failed reads and judgment-versus-curation labels. The user also
explicitly approved enabling research Gemini for future Railway investigations;
the persistent flag was set successfully. A retry of the previously approved
measured-options call still returned no decision, so bounded fallback remains
necessary when the provider fails.

The configured model was then checked against Google's actual model catalog:
**gemini-3.8-flash is available**. The bounded research calls now request the
documented **LOW** thinking setting rather than default medium reasoning; the
parser and explainer settings are unchanged. A live logged call subsequently
succeeded and returned `incoming_load` with an empty valid citation list, using
only the approved measured-options payload. The actual earlier completed
investigation retains its original fallback record rather than being rewritten
to pretend Gemini made that historical decision.

The prepared real team note is [505 Dundas service constraint](research/505-dundas-service-constraint.md).
The user requested creation on their behalf, but the available Papiers CLI/token
cannot write, and no browser-control session is available. It must be pasted into
the account through Papiers's own interface before its actual content can be read.

The user then added the note in Papiers. A **real authenticated content read
succeeded** at 2026-10-18 02:43 UTC using the official CLI, returning:

- Item: `nte_300916d959c5ec978c24499c4cb0df06`.
- Read request: `req_d7919cdbee13491b83604a690cd0deed`.
- Search request: `req_2d8c63ab27274d73b551fbdc2845c250`.
- Signal: `human_judgment`; mode: `papiers_live`.

The full proof is saved locally in ignored `data/cache/papiers-read-proof.json`;
the private note body and token are not committed. This is verified integration,
not a copied development fixture. External write-back remains unsupported by the
official read-only CLI; findings can be exported for manual saving.

## Completed real Papiers investigation

Investigation **09050823-a2de-4642-883f-1df89e95c2bc** completed all **30 real B11
runs** (ten configurations × seeds 301, 302, 303). It read the actual Papiers note
through search/read request `req_139b203ebddd435fb6d840788e2868d1`, and recorded a
valid **Gemini-generated next step** before the human redirect. The second
decision used the explicitly recorded bounded fallback; it is not presented as
a successful AI choice.

The user's real no-extra-vehicles constraint excluded `service_frequency` from
the next-step candidates. All three follow-up configurations used the current
headway **419.8125 seconds**. Housing was held fixed. The original incoming-load
prediction was contradicted within the tested bounds; the model did not
reproduce central-case denied boarding at the selected stop. No observational
baseline, crowding story, threshold, or improved outcome was invented.

The finding and evidence trail are persisted in Tiger Data. Its Papiers writeback
state is **unsupported_read_only**, with a brief export for manual saving. The
private library body is not exposed by public fetch/export routes.

[Open the completed investigation replay](https://urbanova-production-ec5f.up.railway.app/api/investigations/09050823-a2de-4642-883f-1df89e95c2bc/replay).

## Railway end-to-end verification

Backend **bdea2cf** was deployed as **ac8b4c13-a653-46ee-8eb9-7a862cab8a14**.
The merged shared branch **f4875ae** also preserves the teammate's new model assets;
that merge did not change the backend, reviewed data or shared frontend types.

The public backend reports `transport:papiers_live`, `read_only:true`, and reloads
the completed investigation above with `stale:false`. A second full workflow was
then executed entirely through the public API and Railway worker:

- Investigation: **073dfbef-3719-484c-b1cd-1bc47d4d7992**.
- Actual production Papiers read request: `req_2661656ed8984292bbf9ba3102c24787`.
- Same actual team note: `nte_300916d959c5ec978c24499c4cb0df06`.
- Ten configurations × seeds 401, 402, 403 = **30 real B11 runs**.
- Completed, `stale:false`, private excerpt redaction verified.
- All follow-up headways: **419.8125 seconds**, enforcing the user's real constraint.
- Gemini returned HTTP 503 on these production decisions. Both fallback decisions
  are recorded; they are not labelled successful Gemini choices. A separate local
  follow-up also hit HTTP 429, so provider availability/quota remains variable.
  The earlier completed investigation retains its valid Gemini-generated next
  step and can be used to demonstrate that path honestly.
- External writeback: `unsupported_read_only`; saved finding and export available.
- The original 20-run/two-phase demo cache still validates as current.

[Open the production-worker replay](https://urbanova-production-ec5f.up.railway.app/api/investigations/073dfbef-3719-484c-b1cd-1bc47d4d7992/replay).

See [the implementation and API guide](assumption-auditor.md).
