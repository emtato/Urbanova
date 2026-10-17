# Completion and handoff

Scope: complete non-3D data, simulator, API and demo-support work. Lane D, 3D massing/street scenes and frontend polish are owned separately. The existing Python B11 engine is retained. Railway and Tiger Data are the chosen hosting services; local/offline database fallback and Vultr were explicitly dropped.

Implemented here: strict Express startup config; setup of both Node projects; reviewed intervention policies; immutable spatial bundle loading; three candidate walk routes per development; integration with the pulled owner's berth/FIFO, keyed-stream, shared-delay and warm-up implementation; sourced GTFS entries and explicit clearance controls; independent tiny case; baseline consistency report; shared HTTP/headless submission; two-phase demo precomputation; version-aware job claiming; batched persistence; history and scenario reload; brief attachment; demo launchers and prerequisite checks; architecture, assumptions, script and Q&A. The new configured-simulation API is preserved and computes in a worker thread.

Plan deviations retained from Lane B: its engine advances in whole-second ticks rather than an event heap, and its source explicitly omits passenger-dependent dwell (B6). These are documented implementation choices, not completed claims for the original heap/dwell specification. No second simulator was retained after the pull.

Verification evidence is recorded separately in `docs/verification.md` when checks finish. Generated replay/grid caches are ignored by Git and stored in Tiger Data; another laptop can recreate its local manifest using the same pipeline command and retrieve the database cache hit.

Human or teammate work still required:

- Review the nine routes in `data/reviewed/walking_review.csv`; record usable entrances, actual crossings, barriers, closures, name and date. Pending alternatives are not automatically activated.
- Each teammate confirms their own environment. Run a physical cold boot on the chosen demo laptop.
- Lane D integration/accessibility, screenshots and any 3D work remain outside this change. The headless two-phase grid does not mean the interface exposes every control.
- Lane D should regenerate its bundled Today reference with `backend/scripts/build_today_baseline.py` after pulling the updated model/data, and consume the new configured-batch provenance for version compatibility. Older history must stay visibly unverified.
- Assign presenter names, rehearse three times, run an outside-team usability check and record the backup video.
- Confirm organizer deadlines/eligibility and submit initial/final Devpost entries. No external submission has been made by these scripts.
- Optional signals, holding, hypothetical siting and research investigator remain conditional stretch. They are not required for the core comparison and must not be claimed as implemented.

Do not treat scheduled headways, estimated building capacities, assumed demand or lane savings as observations. Missing stop-level/incoming-load data and held-out validation remain documented limitations, not silently completed checklist items.
