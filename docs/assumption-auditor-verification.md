# Assumption-auditor verification

Backend implementation checked on 2026-10-17 (Toronto). This record separates
computed results, test fixtures, and integration work that still needs access.

- Full Express/backend suite: **58 tests passed**, including 11 auditor tests.
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

Still required for the completed sponsor story: the sponsor's real Papiers
connection/guide, a verified read and write, and an actual human redirect. Manual
notes remain labelled manual and external writeback remains pending. The real
investigation is deliberately waiting rather than manufacturing these steps.

See [the implementation and API guide](assumption-auditor.md).
