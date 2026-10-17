# Judge Q&A

**Do passengers disappear?** Every run checks conservation across waiting, onboard, arrived and beyond-segment states. Queued riders persist after a full vehicle; denial is counted once per rider. Warm-up and incoming riders remain in physical accounting but are excluded from the measured housing cohort.

**What enters at Broadview?** GTFS entry times and a sampled onboard load from the reviewed bounds. Occupancy is an assumption, not a TTC observation. Extra service uses an alternative timetable; a faster lane does not add departures by itself.

**Where did the lane benefit come from?** A central 12% link-time reduction is explicitly assumed, applied only to the selected links. King Street material supports transferred cost/effect context, not an established AM Dundas benefit. See [interventions.md](interventions.md).

**Why does service cost vehicles?** Vehicles are `ceil(round-trip cycle / headway)`. Added vehicle hours, service days and the cost-per-hour range determine annual operating cost. Lane cycle savings may reduce extra fleet needs; capital, annual operating and fleet limits are screened separately.

**Why not divide passengers by hourly capacity?** Arrival times, destinations, incoming loads, finite berths, no overtaking and bounded dwell change the queues. Averages hide full vehicles and long waits. Packages share sampled journeys and keyed random streams. Passenger-dependent dwell feedback is intentionally omitted by the simulation owner.

**What exactly is “unresolved”?** Native B11 counts denied riders still waiting at the cap. Onboard riders and riders awaiting their first car are separately in progress. Show raw waiting-at-cutoff too. Do not interpret a zero unresolved count as proof that everybody completed.

**Tiny case, worked by hand:** Three stops, two cars, ten riders, capacity five, entries at 0/30, ten seconds per link and zero dwell. The owner's tick engine departs a newly dispatched or arrived car on its next tick. Eight riders start at A, two at B; all go to C. Car 1 boards five at 0, departs A at 1, reaches B at 11, departs at 12 and reaches C at 22. Car 2 boards three at 30, departs at 31, boards two at B at 41, departs at 42 and reaches C at 52. Wait sum `5×0 + 3×30 + 2×41 = 172`; mean 17.2 seconds; p95 41 seconds; five denied once; all ten complete. The executable check is `backend/tests/test_service_window.py`.

**Is this calibrated?** Baseline schedule residuals are reported in `baseline_consistency.json`. Whole-route daily boardings cannot validate this segment's AM demand. Held-out headway observations and reviewed walking entrances/crossings are still missing.

**What does AI do?** Gemini proposes validated edits using existing IDs and explains stored numeric results. Invented numbers or source IDs trigger a template. Forms work when Gemini is unavailable. Transport outputs are computed by B11, not Gemini.
