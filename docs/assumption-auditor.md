# Assumption auditor: research-team knowledge, resident replay

The research team is the human user. Its members review a paper or note, supply
explicit parameter bounds, and constrain what can happen at move-in. Residents
see the saved investigation, its conditions and its limitations. Findings concern
the model; they do not establish the cause of observed TTC crowding.

## What runs

The auditor uses B11 unchanged, in a Node worker thread driving an isolated Python
process. It pins housing journeys for each seed across incoming-load and service
cases. The no-new-homes case filters that same population to existing riders.
Existing-rider cohort signatures, seed order and conservation must match.

There are only three experiment knobs: incoming load, demand case, and service
frequency. The initial screen has seven configurations: central, low/high incoming
load, no new homes, low/high demand and extra service. Demand factors are the
existing Lane C defaults (0.8, 1, 1.2), applied to the trip rate once. Transit share
is not multiplied in again. Extra service tests a headway at 75% of the current
headway, using B11's regular-entry schedule. This is an assumed service treatment,
not a funded or fleet-feasible recommendation. Link times, vehicle capacity,
walking rules, dwell assumptions and the reporting window stay fixed.

The prediction is registered before computation: at the chosen stop, the incoming
high-minus-low effect exceeds the central-homes-minus-no-new-homes effect on
**existing-rider denied-at-least-once share** by at least 0.02 (two percentage
points) by default. The denominator is existing riders encountering a car, per
B11. Missing shares stay missing. At least three valid pairs are required.
The auditor reports per-seed contrasts, sample standard deviation and a two-sided
Student-t 95% interval of the mean contrast. An interval wholly above the minimum
supports the prediction; wholly at/below contradicts it; otherwise it is
inconclusive. These are exploratory comparisons, with no multiplicity correction.

If a stop is not supplied, the auditor selects the highest mean central-run
existing-rider denied share. This selection is exploratory. If every stop has zero
denials, the investigation still reports that result; it cannot invent crowding.
The contrast is conditional on its two different incoming regimes and the central
housing case, not a full factorial attribution or a statement about real causes.

The next knob maximizes absolute paired mean change × evidence weakness. Weakness
is an explicit heuristic: 1 without a relevant team note, 0.75 with one. A note is
not an observation or proof. Ties prioritize incoming load, then demand, then
service. Gemini receives measured scores and the permitted maximizers, and can
choose a knob and cite existing relevant note IDs. Invalid/failed AI choices fall
back to that policy, with the decision mode recorded. AI never computes metrics,
extracts paper numbers into live parameters, or changes simulator output.
The decision request contains sensitivity scores, permitted knobs, the fleet
availability flag and note IDs/knobs/modes. It does not send note bodies or human
names to Gemini. This new decision call is opt-in with
`RESEARCH_GEMINI_ENABLED=true`; the default is the local policy. Setting
`GEMINI_ENABLED=false` also disables it. The existing scenario parser is unchanged.

The next step reads the knowledge-library port. Missing knowledge or a failed
read leads to **awaiting_human**, not invented evidence. Even with notes, the human
reviews the context and supplies a named operational redirect. A no-extra-vehicles
constraint removes service frequency from the candidate list and keeps current
headway in every follow-up. Explicit human settings override note bounds. A note's
bounds require a human redirect before use. Follow-up low/high cases test the
selected remaining knob, with housing unchanged. Findings retain exact recipes;
they claim no untested incoming-load threshold or real-world baseline.

## Papiers connection status — not live yet

No Papiers connector was found in the available plugin search, and no authorized
sponsor API guide/connection was supplied. `KnowledgeLibrary` is the transport
port, not a working Papiers API implementation. The production default is
`unconnected`; the API never guesses a Papiers endpoint. A sponsor adapter must
prove an actual read and return its document ID and retrieval time. A write must
return a receipt. Mock receipts are used in tests only and are not a live demo.

Manual notes are supported for development and recorded as **manual_copy**.
Findings are saved in Tiger Data and exported as JSON; their external writeback
stays **pending_connection** until a real adapter confirms it. Do not present this
as a completed Papiers challenge integration. Ask the sponsor for the guide,
authentication method, library/document IDs, permitted read/write tools and a
test document. Keep credentials on the backend and out of chat/git.

## API handoff for the resident/research UI

All paths use `/api/investigations` on the Express backend. Existing D/3D UI files
are untouched. The frontend can open a research drawer from “Why does my stop get
worse?” and render the ordered events from the replay endpoint.

| Method and path | Purpose |
| --- | --- |
| `GET /integration` | Honest connection status |
| `POST /` | Start `{stop_id?, seeds?, incoming_load_range?, minimum_effect?}`; returns 202 |
| `GET /:id` | Poll queued/running/awaiting_human/completed/failed; compact experiment results |
| `GET /:id/replay` | Ordered research events, finding, versions, writeback status |
| `POST /:id/notes` | Add a manually copied team note while awaiting human review |
| `POST /:id/redirect` | Submit a real human constraint and queue the follow-up |
| `GET /:id/brief` | Download the complete JSON finding and research trail |

Start with `{}` for eight fixed seeds, or supply 3–20 distinct seeds. Incoming
bounds must be ordered integers from zero to reviewed vehicle capacity. Stop IDs
must come from `/api/corridor`. Do not let residents submit false observations
as verified evidence: author fields are self-reported, not authentication.

Example **input shape only**, not a real teammate statement:

```json
{"author":"YOUR ACTUAL NAME","note":"Your actual operational constraint here","no_extra_vehicles":true}
```

A manual note requires `id`, `title`, `author`, `text`, and `knob` (one of
`incoming_load`, `demand_case`, `service_frequency`). Optional fields are
`source_url`, `locator` (e.g. paper page/annotation), `incoming_load_range`,
`demand_case` (`low`, `central`, `high`), and `headway_s`. A redirect requires
`author`, `note`, `no_extra_vehicles`; optional numerical fields use the same
names. Headway must be between 50% and 100% of the reviewed value; a shorter
headway conflicts with `no_extra_vehicles:true` and is rejected.

Existing CORS configuration applies. The queue uses Tiger Data, revision checks,
lease renewal and expired-lease recovery. Trails and hypotheses are saved before
the next computation. No long simulation runs in an Express handler. Multiple
replicas can claim different jobs safely, one research job per replica at a time.
Results record simulator/data versions and a separate auditor source digest;
changing auditor code does not invalidate the existing Lane C simulation cache.
Requests involving old auditor versions can still be read, but cannot continue.
This is the same trusted hackathon environment as the existing analysis API;
research author names are not verified accounts. Notes should contain no secrets.

## Command line

From the repository root, with the existing backend `.env` setup:

```powershell
npm run investigate --prefix backend/server -- start
npm run investigate --prefix backend/server -- show INVESTIGATION_UUID
npm run investigate --prefix backend/server -- note INVESTIGATION_UUID note.json
npm run investigate --prefix backend/server -- redirect INVESTIGATION_UUID redirect.json
```

Start and redirect compute locally using the shared Tiger Data queue. The running
API worker may claim the same queued work first; the CLI then polls it. Save
actual human text in `redirect.json`. Do not manufacture a completed human loop
using the example above. A completed sponsor demo still needs a genuine human
redirect and a verified real Papiers read/write.
