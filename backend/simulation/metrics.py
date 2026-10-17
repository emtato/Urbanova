"""Post-simulation analyzer and complete frontend reference for `run_simulation()` output.

================================================================================
FRONTEND & API REFERENCE: `result = run_simulation(inputs)` RETURN VALUE
================================================================================

`run_simulation(inputs)` returns a JSON-ready Python `dict` with 5 top-level keys:

```python
{
    "inputs": {...},       # 1. Exact scenario inputs used for this simulation run
    "streetcars": [...],   # 2. Final state of every generated streetcar
    "passengers": [...],   # 3. Final state & trip timestamps of every passenger
    "sim_log": [...],      # 4. Chronological event stream for visual map/street replay
    "summary": {...},      # 5. Pre-computed analytics, stop tables & headline metrics
}
```

All time durations have an `_s` suffix and are in **seconds**.
All `time_s`, `get_to_stop_time`, `boarding_time_s`, `exit_time_s`, `departure_time_s`,
and `expected_arrival_time_s` values in the output are **elapsed seconds from the start
of the simulation (`0` = `inputs["start_time_s"]`, e.g. 07:00 AM)**.
All shares (`_share`) are fractions in `[0.0, 1.0]` (multiply by `100` for `%`).

--------------------------------------------------------------------------------
1. `result["inputs"]` (dict) — Scenario Configuration
--------------------------------------------------------------------------------
 Mirrors `SimulationInput` (`backend/simulation/inputs.py`):
  - `stops`: `list[dict]` — Ordered westbound 505 stops (0 = Broadview -> 8 = TMU):
      `{ "id", "name", "sequence", "latitude", "longitude", "waiting_passenger_ids", "serving_streetcar_id" }`
  - `existing_residences`: `list[dict]` — Baseline neighbourhood housing clusters
  - `developments`: `list[dict]` — Proposed towers (239, 500, 761 Dundas St E)
  - `link_travel_times_s`: `list[float]` — Scheduled link travel times between adjacent stops
  - `streetcar_capacity`: `int` — Max passengers per streetcar (e.g., 130 planned or 251 crush)
  - `headway_s`: `float` — Mean streetcar dispatch interval at Broadview (seconds)
  - `rush_hour_duration_s`: `float` — Passenger arrival window length (e.g., 7200.0 = 2 hours)
  - `trips_per_resident_in_window`: `float` — Commuter trip rate per resident
  - `start_time_s`, `end_time_s`: `int` — Service-day clock bounds in seconds past midnight
  - `headway_randomness_s`: `float` — Entry headway variation bound (seconds)
  - `commuter_distribution`: `list[float]` — Relative arrival weights across rush-hour bins
  - `seed`: `int` — Random seed used for reproducible comparisons
  - `link_travel_time_variation_share`: `float` — Fractional link travel-time variability

--------------------------------------------------------------------------------
2. `result["streetcars"]` (list[dict]) — Final Vehicle State
--------------------------------------------------------------------------------
One dict per dispatched streetcar (`streetcar-1`, `streetcar-2`, ...):
  - `id`: `str` — e.g. `"streetcar-1"`
  - `capacity`: `int` — Vehicle capacity
  - `onboard_passenger_ids`: `list[str]` — Passenger IDs still onboard at run end (`[]` if finished)
  - `status`: `"at_stop" | "in_transit" | "finished"`
  - `current_stop_id`: `str | None` — Set when `status == "at_stop"` or `"finished"` (at TMU)
  - `previous_stop_id`: `str | None` — Origin stop of current link when `status == "in_transit"`
  - `next_stop_id`: `str | None` — Target stop of current link when `status == "in_transit"`
  - `departure_time_s`: `float | None` — When the car started its current link
  - `expected_arrival_time_s`: `float | None` — When the car will reach `next_stop_id`

--------------------------------------------------------------------------------
3. `result["passengers"]` (list[dict]) — Every Simulated Passenger
--------------------------------------------------------------------------------
Includes both corridor-boarding riders (from `existing_residences` and `developments`)
and incoming Broadview riders (12–24 riders seeded onto each streetcar at Broadview):
  - `id`: `str` — e.g. `"passenger-1"`
  - `origin_stop_id`: `str` — Boarding stop ID along the 505 corridor
  - `destination_stop_id`: `str | None` — Alighting stop ID, or `None` if riding west past TMU
  - `get_to_stop_time`: `float` — Elapsed seconds when the passenger arrived at `origin_stop_id`
  - `rider_group`: `"existing" | "new"` — `"new"` = from a proposed development
  - `development_id`: `str | None` — Development ID if `rider_group == "new"`, else `None`
  - `status`: `"scheduled" | "waiting" | "onboard" | "arrived" | "beyond_segment"`
      * `"arrived"`: Alighted at `destination_stop_id` on the corridor
      * `"beyond_segment"`: Reached TMU terminus and continued west past Yonge
      * `"waiting"`: Still waiting in the queue at `origin_stop_id` at run end
      * `"onboard"`: Still riding a streetcar at run end
  - `streetcar_id`: `str | None` — Current vehicle ID if `"onboard"`, else `None`
  - `boarding_time_s`: `float | None` — Elapsed seconds when they boarded (`wait = boarding_time_s - get_to_stop_time`)
  - `exit_time_s`: `float | None` — Elapsed seconds when they alighted or passed TMU (`ride = exit_time_s - boarding_time_s`)
  - `denied_boarding_once`: `bool` — `True` if at least one full streetcar passed them while waiting

--------------------------------------------------------------------------------
4. `result["sim_log"]` (list[dict]) — Complete Visual Replay Event Stream
--------------------------------------------------------------------------------
Chronological list of all passenger, stop-queue, and streetcar actions:
  - `time_s`: `int` — Elapsed whole seconds from simulation start
  - `action`: `"passenger_arrive" | "generate" | "arrive" | "alight" | "board" | "deny" | "beyond_segment" | "depart" | "terminate"`
      * `"passenger_arrive"`: A passenger reaches `stop_id` and joins its waiting queue (`streetcar` is `None`)
      * `"generate"`: Streetcar enters at Broadview (`stops[0]`) with 12–24 incoming riders (`count`)
      * `"arrive"`: Streetcar reaches a downstream stop (`stop_id`), before serving passengers
      * `"alight"`: `count` passengers exit `streetcar` at `stop_id`
      * `"board"`: `count` waiting passengers board `streetcar` at `stop_id`
      * `"deny"`: `count` waiting passengers at `stop_id` are left behind by a full `streetcar`
      * `"beyond_segment"`: `count` onboard passengers continue west past the TMU terminus (`stops[-1]`)
      * `"depart"`: Streetcar finishes 15–30s stop dwell at `stop_id` (`previous_stop_id`) and starts link
                    to `next_stop_id` (`departure_time_s` -> `expected_arrival_time_s`)
      * `"terminate"`: Streetcar finishes service at the TMU terminus (`stops[-1]`)
  - `streetcar`: `dict | None` — Deep-copied snapshot of the `Streetcar` at that exact step (`None` for `"passenger_arrive"`)
  - `stop_id`: `str | None` — Stop ID where this event occurred (or departed from on `"depart"`)
  - `count`: `int` — Total passengers involved in this event (`0` for pure movement events)
  - `existing_count`: `int` — Existing-residence riders involved in this event
  - `new_count`: `int` — New-development riders involved in this event
  - `passenger_ids`: `list[str]` — IDs of the passengers involved in this event
  - `onboard_count_after`: `int | None` — Streetcar load immediately after this event (`None` for `"passenger_arrive"`)
  - `waiting_count_after`: `int | None` — Waiting queue length at `stop_id` immediately after this event
  - `stop_queues`: `dict[str, int]` — Snapshot of `{stop_id: waiting_count}` across all 9 stops at this moment

--------------------------------------------------------------------------------
5. `result["summary"]` (dict) — Pre-Computed Tables & Headline Analytics
--------------------------------------------------------------------------------
Produced by `analyze_simulation(result)`:

  A. `result["summary"]["overview"]` (dict — Headline KPI Cards / Overall Table)
     - `corridor_passengers`: `int` — Total riders who walked to a 505 stop (`existing` + `new`)
     - `existing_corridor_passengers`: `int` — Existing neighbourhood residents at 505 stops
     - `new_development_passengers`: `int` — New development residents at 505 stops
     - `incoming_broadview_passengers`: `int` — Pre-boarded riders entering at Broadview
     - `total_passengers_in_sim`: `int` — `corridor_passengers + incoming_broadview_passengers`
     - `boarded_corridor_passengers`: `int` — Corridor riders who successfully boarded by 9:00 AM
     - `completed_corridor_passengers`: `int` — Corridor riders who reached their destination / TMU by 9:00 AM
     - `in_progress_at_cutoff_passengers`: `int` — Neutral riders caught at the 9:00 AM cutoff
       (`onboard_at_end_passengers` + `awaiting_first_car_at_end_passengers`); they contribute to
       streetcar fullness and boarding wait stats up to 9:00 AM, but are excluded from both
       finished and unresolved/failed completion counts
     - `onboard_at_end_passengers`: `int` — Riders mid-ride on a moving streetcar at the 9:00 AM cutoff
     - `awaiting_first_car_at_end_passengers`: `int` — Riders who walked to a stop right before 9:00 AM
       and had not yet had any streetcar arrive (`denied_boarding_once == False`)
     - `unresolved_passengers`: `int` — Riders who were denied boarding by a full streetcar and are
       still stranded in a stop queue at 9:00 AM (`status == "waiting" and denied_boarding_once`)
     - `remaining_queue_passengers`: `int` — Same as `unresolved_passengers` (stranded denied riders at 9:00 AM)
     - `raw_waiting_at_cutoff_passengers`: `int` — Physical queue at 9:00 AM (`remaining_queue_passengers + awaiting_first_car_at_end_passengers`)
     - `denied_boarding_count`: `int` — Corridor riders denied boarding at least once
     - `denied_boarding_share`: `float | None` — Share of streetcar-encountering corridor riders denied boarding (0–1)
     - `existing_denied_boarding_share`: `float | None` — Denied share among existing residents
     - `new_denied_boarding_share`: `float | None` — Denied share among new-development residents
     - `mean_wait_s`, `median_wait_s`, `p95_wait_s`, `max_wait_s`: `float | None` — Stop wait times
     - `mean_ride_time_s`: `float | None` — Mean in-vehicle time on the corridor
     - `mean_commute_time_s`, `p95_commute_time_s`: `float | None` — Total wait + ride time
     - `streetcar_capacity`: `int` — Vehicle capacity
     - `streetcars_dispatched`, `streetcars_completed`: `int`
     - `mean_departure_load`: `float | None` — Mean onboard load leaving stops
     - `peak_streetcar_load`: `int` — Max onboard load observed on any streetcar
     - `full_departures_count`: `int` — Number of link departures at 100% capacity
     - `full_departures_share`: `float | None` — Share of link departures at 100% capacity
     - `conservation_valid`: `bool` — `True` when all passenger & capacity invariants hold

  B. `result["summary"]["by_stop"]` (list[dict] — 9 Stop Rows, Broadview -> TMU)
     Each item represents one stop along the corridor:
     - `stop_id`: `str`, `stop_name`: `str`, `sequence`: `int` (0 to 8)
     - `streetcar_arrivals`: `int` — Number of streetcars that served this stop
     - `mean_headway_s`, `min_headway_s`, `max_headway_s`, `headway_cv`: `float | None`
     - `bunched_arrivals_count`, `gapped_arrivals_count`: `int`
     - `mean_arrival_load`, `peak_arrival_load`: `float | int | None`
     - `mean_departure_load`, `peak_departure_load`: `float | int | None` (`None` at TMU terminus)
     - `full_departures_count`: `int` — Streetcars leaving this stop completely full
     - `alighted_passengers`: `int` — Riders who got off at this stop
     - `beyond_segment_passengers`: `int` — Riders continuing west past TMU (non-zero at TMU)
     - `passengers`: `int` — Total corridor riders arriving at this stop
     - `encountered_streetcar_passengers`: `int` — Riders at this stop who saw at least one car before 9:00 AM
     - `boarded_passengers`, `completed_passengers`, `in_progress_at_cutoff_passengers`, `remaining_queue`: `int`
     - `denied_boarding_count`: `int`, `denied_at_least_once_share`: `float | None`
     - `mean_wait_s`, `p95_wait_s`: `float | None` — Wait times for riders boarding at this stop
     - `completed_mean_wait_s`, `completed_p95_wait_s`: `float | None`
     - `by_rider_group`: `{"existing": {...}, "new": {...}}` — Same passenger metrics split by cohort

  C. `result["summary"]["by_development"]` (list[dict] — 3 Proposed Developments)
     Each item summarizes one development (`239`, `500`, `761 Dundas St E`):
     - `development_id`, `name`, `net_added_units`, `occupied_share`, `accessible_stop_ids`
     - `passengers`: `int` — Number of westbound 505 riders generated by this building
     - `boarded_passengers`, `completed_passengers`, `in_progress_at_cutoff_passengers`, `remaining_queue`: `int`
     - `denied_boarding_count`: `int`, `denied_at_least_once_share`: `float | None`
     - `mean_wait_s`, `p95_wait_s`, `mean_ride_time_s`, `mean_commute_time_s`: `float | None`

  D. `result["summary"]["overcrowding"]` (dict — Bottleneck Callouts)
     - `overall`, `existing`, `new`: cohort overcrowding summaries
     - `worst_stop_by_denied_share`: `{ "stop_id", "stop_name", "denied_at_least_once_share", "denied_boarding_count", "passengers" } | None`
     - `worst_stop_by_p95_wait`: `{ "stop_id", "stop_name", "p95_wait_s", "mean_wait_s", "passengers" } | None`
     - `worst_stop_by_remaining_queue`: `{ "stop_id", "stop_name", "remaining_queue", "passengers" } | None`

  E. `result["summary"]["wait_times_s"]`, `result["summary"]["journey_times_s"]`, `result["summary"]["fleet"]`
     Full distribution breakdowns (`count`, `mean_s`, `median_s`, `p95_s`, `min_s`, `max_s`)
     for charts and detailed inspection.

  F. `result["summary"]["contract"]` (dict — Frozen Schema Match)
     - `diagnostics`: Matches `backend/schemas/run.py` (`Diagnostics`)
     - `stop_results`: Matches `backend/schemas/results.py` (`list[StopResult]`)
"""

from __future__ import annotations

from math import ceil, sqrt
from statistics import median
from typing import Any


def nearest_rank_percentile(values: list[float], percentile: float) -> float | None:
    """Compute the nearest-rank percentile (e.g., 0.95 for P95) matching contract semantics."""
    if not values:
        return None
    if not 0 < percentile <= 1:
        raise ValueError("percentile must be in (0, 1]")
    ordered = sorted(values)
    index = max(0, ceil(percentile * len(ordered)) - 1)
    return float(ordered[index])


def summarize_distribution(values: list[float]) -> dict[str, float | int | None]:
    """Return count, mean, median, P95, min, and max for a numeric sample."""
    if not values:
        return {
            "count": 0,
            "mean_s": None,
            "median_s": None,
            "p95_s": None,
            "min_s": None,
            "max_s": None,
        }
    return {
        "count": len(values),
        "mean_s": float(sum(values) / len(values)),
        "median_s": float(median(values)),
        "p95_s": nearest_rank_percentile(values, 0.95),
        "min_s": float(min(values)),
        "max_s": float(max(values)),
    }


def _wait_time_s(passenger: dict[str, Any]) -> float | None:
    """Return a boarded passenger's stop wait time in seconds, or None if never boarded."""
    boarding_time_s = passenger.get("boarding_time_s")
    if boarding_time_s is None:
        return None
    return max(0.0, float(boarding_time_s - passenger["get_to_stop_time"]))


def _ride_time_s(passenger: dict[str, Any]) -> float | None:
    """Return a completed passenger's in-vehicle ride time in seconds, or None if incomplete."""
    if passenger.get("status") not in ("arrived", "beyond_segment"):
        return None
    boarding_time_s = passenger.get("boarding_time_s")
    exit_time_s = passenger.get("exit_time_s")
    if boarding_time_s is None or exit_time_s is None:
        return None
    return max(0.0, float(exit_time_s - boarding_time_s))


def _commute_time_s(passenger: dict[str, Any]) -> float | None:
    """Return a completed passenger's total corridor time (wait + in-vehicle ride), or None."""
    if passenger.get("status") not in ("arrived", "beyond_segment"):
        return None
    exit_time_s = passenger.get("exit_time_s")
    if exit_time_s is None:
        return None
    return max(0.0, float(exit_time_s - passenger["get_to_stop_time"]))


def _is_cutoff_in_progress(passenger: dict[str, Any]) -> bool:
    """Return True if a passenger is mid-ride at 9 AM or just arrived at a stop near 9 AM before any car reached them.

    These riders contribute to streetcar fullness and stop activity up to the 9 AM
    cutoff, but have a neutral (`None`) completion outcome (neither finished nor
    failed/unresolved).
    """
    status = passenger.get("status")
    if status == "onboard":
        return True
    if status == "waiting" and not passenger.get("denied_boarding_once"):
        return True
    return False


def _summarize_overcrowding_group(passengers: list[dict[str, Any]]) -> dict[str, float | int | None]:
    """Summarize arrivals, boarded, completed, cutoff-neutral, and denied/stranded counts for a cohort."""
    total = len(passengers)
    boarded_count = sum(1 for p in passengers if p.get("boarding_time_s") is not None)
    completed_count = sum(1 for p in passengers if p.get("status") in ("arrived", "beyond_segment"))
    in_progress_count = sum(1 for p in passengers if _is_cutoff_in_progress(p))
    # Riders who actually encountered a streetcar before cutoff (either boarded or were denied by a full car).
    encountered_car_count = sum(
        1 for p in passengers
        if p.get("boarding_time_s") is not None or p.get("denied_boarding_once")
    )
    denied_count = sum(1 for p in passengers if p.get("denied_boarding_once"))
    # Only riders who were actually denied by a full streetcar and are still waiting at cutoff count as unresolved/stranded.
    stranded_queue = sum(
        1 for p in passengers
        if p.get("status") == "waiting" and p.get("denied_boarding_once")
    )
    raw_waiting_queue = sum(1 for p in passengers if p.get("status") == "waiting")
    return {
        "passengers": total,
        "encountered_streetcar_passengers": encountered_car_count,
        "boarded_passengers": boarded_count,
        "completed_passengers": completed_count,
        "in_progress_at_cutoff_passengers": in_progress_count,
        "denied_boarding_count": denied_count,
        "denied_at_least_once_share": (
            (denied_count / encountered_car_count) if encountered_car_count > 0 else None
        ),
        "remaining_queue": stranded_queue,
        "raw_waiting_at_cutoff": raw_waiting_queue,
    }


def _summarize_unresolved_queue_waits(
    waiting_passengers: list[dict[str, Any]],
    horizon_s: float,
) -> dict[str, float | int | None]:
    """Summarize lower-bound wait times for riders denied boarding and still stranded at run end."""
    waits_so_far = [
        max(0.0, float(horizon_s - p["get_to_stop_time"]))
        for p in waiting_passengers
        if p.get("denied_boarding_once")
    ]
    if not waits_so_far:
        return {
            "count": 0,
            "mean_wait_so_far_s": None,
            "p95_wait_so_far_s": None,
            "max_wait_so_far_s": None,
        }
    return {
        "count": len(waits_so_far),
        "mean_wait_so_far_s": float(sum(waits_so_far) / len(waits_so_far)),
        "p95_wait_so_far_s": nearest_rank_percentile(waits_so_far, 0.95),
        "max_wait_so_far_s": float(max(waits_so_far)),
    }


def analyze_simulation(
    run_data: dict[str, Any],
    *,
    runtime_s: float = 0.0,
) -> dict[str, Any]:
    """Analyze a `run_simulation()` result dictionary and return a comprehensive summary.

    Separates:
      - Corridor-boarding passengers (existing neighbourhood residents & new-development
        residents who walk to and wait at a 505 stop)
      - Incoming Broadview passengers (riders already onboard streetcars entering at
        Broadview & Dundas from north of Dundas, who occupy vehicle capacity but did
        not wait in a corridor stop queue)
    And treats end-of-window riders (still `onboard` at cutoff, or `waiting` near cutoff
    without having seen a streetcar yet) as neutral (`in_progress_at_cutoff`) rather than
    counting them as failed/unresolved.
    """
    inputs = run_data["inputs"]
    streetcars = run_data["streetcars"]
    passengers = run_data["passengers"]
    sim_log = run_data["sim_log"]

    stops = inputs["stops"]
    stop_ids = [stop["id"] for stop in stops]
    first_stop_id = stop_ids[0] if stop_ids else None
    last_stop_id = stop_ids[-1] if stop_ids else None
    horizon_s = float(inputs["end_time_s"] - inputs["start_time_s"])
    capacity = int(inputs["streetcar_capacity"])
    target_headway_s = float(inputs["headway_s"])
    scheduled_corridor_travel_time_s = float(sum(inputs["link_travel_times_s"]))

    # Identify incoming Broadview passengers from the initial `generate` snapshots in sim_log
    # (recorded after `seed_incoming_passengers` and before serving the Broadview stop queue).
    incoming_passenger_ids: set[str] = set()
    for entry in sim_log:
        if entry["action"] == "generate":
            incoming_passenger_ids.update(entry["streetcar"]["onboard_passenger_ids"])

    incoming_passengers = [p for p in passengers if p["id"] in incoming_passenger_ids]
    warmup_ids=set(inputs.get('warmup_passenger_ids',[]))
    corridor_passengers_all = [p for p in passengers if p["id"] not in incoming_passenger_ids and p['id'] not in warmup_ids]
    # Active corridor passengers have reached their origin stop by the reporting horizon.
    corridor_passengers = [p for p in corridor_passengers_all if p["status"] != "scheduled"]
    scheduled_not_yet_arrived = [p for p in corridor_passengers_all if p["status"] == "scheduled"]

    existing_corridor = [p for p in corridor_passengers if p["rider_group"] == "existing"]
    new_corridor = [p for p in corridor_passengers if p["rider_group"] == "new"]

    # Check conservation invariants across passengers, stop queues, and streetcars.
    valid_statuses = {"scheduled", "waiting", "onboard", "arrived", "beyond_segment"}
    all_statuses_valid = all(p.get("status") in valid_statuses for p in passengers)
    waiting_in_stops = sum(len(stop.get("waiting_passenger_ids", ())) for stop in stops)
    waiting_passengers_total = sum(1 for p in passengers if p.get("status") == "waiting")
    onboard_in_streetcars = sum(len(car.get("onboard_passenger_ids", ())) for car in streetcars)
    onboard_passengers_total = sum(1 for p in passengers if p.get("status") == "onboard")
    loads_within_capacity = all(
        0 <= len(entry["streetcar"].get("onboard_passenger_ids", ())) <= entry["streetcar"].get("capacity", capacity)
        for entry in sim_log
        if entry.get("streetcar") is not None
    ) and all(
        0 <= len(car.get("onboard_passenger_ids", ())) <= car.get("capacity", capacity)
        for car in streetcars
    )

    # Wait time distributions (corridor-boarding riders only; includes anyone who boarded before 9 AM).
    boarded_waits_all = [w for p in corridor_passengers if (w := _wait_time_s(p)) is not None]
    boarded_waits_existing = [w for p in existing_corridor if (w := _wait_time_s(p)) is not None]
    boarded_waits_new = [w for p in new_corridor if (w := _wait_time_s(p)) is not None]

    completed_corridor = [p for p in corridor_passengers if p["status"] in ("arrived", "beyond_segment")]
    completed_existing = [p for p in existing_corridor if p["status"] in ("arrived", "beyond_segment")]
    completed_new = [p for p in new_corridor if p["status"] in ("arrived", "beyond_segment")]

    completed_waits_all = [w for p in completed_corridor if (w := _wait_time_s(p)) is not None]
    completed_waits_existing = [w for p in completed_existing if (w := _wait_time_s(p)) is not None]
    completed_waits_new = [w for p in completed_new if (w := _wait_time_s(p)) is not None]

    waiting_corridor = [p for p in corridor_passengers if p["status"] == "waiting"]
    waiting_existing = [p for p in existing_corridor if p["status"] == "waiting"]
    waiting_new = [p for p in new_corridor if p["status"] == "waiting"]

    corridor_created = len(corridor_passengers)
    corridor_arrived = len(completed_corridor)
    corridor_waiting_raw = len(waiting_corridor)
    corridor_onboard = sum(1 for p in corridor_passengers if p["status"] == "onboard")
    corridor_awaiting_first_car = sum(
        1 for p in waiting_corridor if not p.get("denied_boarding_once")
    )
    corridor_in_progress_at_cutoff = corridor_onboard + corridor_awaiting_first_car
    # Only riders who were actually denied boarding by a full car and are still waiting at cutoff are unresolved.
    corridor_unresolved = sum(
        1 for p in waiting_corridor if p.get("denied_boarding_once")
    )

    conservation_valid = (
        all_statuses_valid
        and waiting_in_stops == waiting_passengers_total
        and onboard_in_streetcars == onboard_passengers_total
        and loads_within_capacity
        and corridor_created == corridor_arrived + corridor_waiting_raw + corridor_onboard
    )

    # Ride time & total commute time distributions.
    ride_times_corridor = [r for p in completed_corridor if (r := _ride_time_s(p)) is not None]
    ride_times_existing = [r for p in completed_existing if (r := _ride_time_s(p)) is not None]
    ride_times_new = [r for p in completed_new if (r := _ride_time_s(p)) is not None]
    ride_times_incoming = [r for p in incoming_passengers if (r := _ride_time_s(p)) is not None]

    commute_times_corridor = [c for p in completed_corridor if (c := _commute_time_s(p)) is not None]
    commute_times_existing = [c for p in completed_existing if (c := _commute_time_s(p)) is not None]
    commute_times_new = [c for p in completed_new if (c := _commute_time_s(p)) is not None]

    # Streetcar fleet & link departure load analysis from sim_log.
    depart_events = [entry for entry in sim_log if entry["action"] == "depart"]
    departure_loads = [len(entry["streetcar"]["onboard_passenger_ids"]) for entry in depart_events]

    peak_load_by_car: dict[str, int] = {car["id"]: len(car.get("onboard_passenger_ids", ())) for car in streetcars}
    for entry in sim_log:
        if entry.get("streetcar") is None:
            continue
        car_id = entry["streetcar"]["id"]
        load = len(entry["streetcar"]["onboard_passenger_ids"])
        if load > peak_load_by_car.get(car_id, 0):
            peak_load_by_car[car_id] = load

    peak_load = max(peak_load_by_car.values(), default=0)
    mean_peak_load_per_car = (
        float(sum(peak_load_by_car.values()) / len(peak_load_by_car))
        if peak_load_by_car
        else None
    )
    full_departures_count = sum(1 for load in departure_loads if load >= capacity)
    crowded_80pct_threshold = 0.8 * capacity
    crowded_80pct_count = sum(1 for load in departure_loads if load >= crowded_80pct_threshold)

    generate_time_by_car = {
        entry["streetcar"]["id"]: float(entry["time_s"])
        for entry in sim_log
        if entry["action"] == "generate"
    }
    terminate_time_by_car = {
        entry["streetcar"]["id"]: float(entry["time_s"])
        for entry in sim_log
        if entry["action"] == "terminate"
    }
    completed_car_run_times = [
        terminate_time_by_car[car_id] - generate_time_by_car[car_id]
        for car_id in terminate_time_by_car
        if car_id in generate_time_by_car
    ]

    # Stop-by-stop analysis and contract StopResult generation.
    by_stop: list[dict[str, Any]] = []
    contract_stop_results: list[dict[str, Any]] = []

    for stop in stops:
        stop_id = stop["id"]
        seq = stop["sequence"]

        # Streetcar arrival timestamps and arrival loads at this stop.
        if seq == 0:
            arrival_entries = [
                entry for entry in sim_log
                if entry["action"] == "generate" and entry["streetcar"]["current_stop_id"] == stop_id
            ]
        else:
            arrival_entries = [
                entry for entry in sim_log
                if entry["action"] == "arrive" and entry["streetcar"]["current_stop_id"] == stop_id
            ]

        arrival_times = [float(entry["time_s"]) for entry in arrival_entries]
        arrival_loads = [len(entry["streetcar"]["onboard_passenger_ids"]) for entry in arrival_entries]

        # Inter-arrival headway gaps at this stop.
        headway_gaps = [
            arrival_times[i] - arrival_times[i - 1]
            for i in range(1, len(arrival_times))
        ]
        if headway_gaps:
            mean_headway = float(sum(headway_gaps) / len(headway_gaps))
            min_headway = float(min(headway_gaps))
            max_headway = float(max(headway_gaps))
            variance = sum((gap - mean_headway) ** 2 for gap in headway_gaps) / len(headway_gaps)
            headway_cv = float(sqrt(variance) / mean_headway) if mean_headway > 0 else None
            bunched_count = sum(1 for gap in headway_gaps if gap < 0.5 * target_headway_s)
            gapped_count = sum(1 for gap in headway_gaps if gap > 1.5 * target_headway_s)
        else:
            mean_headway = None
            min_headway = None
            max_headway = None
            headway_cv = None
            bunched_count = 0
            gapped_count = 0

        # Streetcar departure loads leaving non-terminus stops onto the next corridor link.
        stop_depart_entries = [
            entry for entry in depart_events
            if entry["streetcar"]["previous_stop_id"] == stop_id
        ]
        stop_departure_loads = [
            len(entry["streetcar"]["onboard_passenger_ids"])
            for entry in stop_depart_entries
        ]

        # Alighting counts at this stop (plus beyond_segment riders at the terminus).
        alighted_at_stop = sum(
            1 for p in passengers
            if p.get("status") == "arrived" and p.get("destination_stop_id") == stop_id
        )
        beyond_segment_at_stop = (
            sum(1 for p in passengers if p.get("status") == "beyond_segment")
            if stop_id == last_stop_id
            else 0
        )

        stop_corridor_passengers = [p for p in corridor_passengers if p["origin_stop_id"] == stop_id]
        stop_boarded_waits = [w for p in stop_corridor_passengers if (w := _wait_time_s(p)) is not None]
        stop_completed_waits = [
            w for p in stop_corridor_passengers
            if p["status"] in ("arrived", "beyond_segment") and (w := _wait_time_s(p)) is not None
        ]
        stop_group_summary = _summarize_overcrowding_group(stop_corridor_passengers)

        rider_groups_breakdown: dict[str, dict[str, Any]] = {}
        for group in ("existing", "new"):
            group_ps = [p for p in stop_corridor_passengers if p["rider_group"] == group]
            group_stats = _summarize_overcrowding_group(group_ps)
            group_boarded_waits = [w for p in group_ps if (w := _wait_time_s(p)) is not None]
            group_completed_waits = [
                w for p in group_ps
                if p["status"] in ("arrived", "beyond_segment") and (w := _wait_time_s(p)) is not None
            ]
            completed_mean_wait = (
                float(sum(group_completed_waits) / len(group_completed_waits))
                if group_completed_waits
                else None
            )
            completed_p95_wait = nearest_rank_percentile(group_completed_waits, 0.95)

            rider_groups_breakdown[group] = {
                **group_stats,
                "mean_wait_s": (
                    float(sum(group_boarded_waits) / len(group_boarded_waits))
                    if group_boarded_waits
                    else None
                ),
                "p95_wait_s": nearest_rank_percentile(group_boarded_waits, 0.95),
                "completed_mean_wait_s": completed_mean_wait,
                "completed_p95_wait_s": completed_p95_wait,
            }

            contract_stop_results.append(
                {
                    "stop_id": stop_id,
                    "rider_group": group,
                    "passengers": group_stats["completed_passengers"] + group_stats["remaining_queue"],
                    "completed_passengers": group_stats["completed_passengers"],
                    "mean_wait_s": completed_mean_wait,
                    "p95_wait_s": completed_p95_wait,
                    "denied_at_least_once_share": group_stats["denied_at_least_once_share"],
                    "remaining_queue": group_stats["remaining_queue"],
                    "headway_cv": headway_cv,
                }
            )

        by_stop.append(
            {
                "stop_id": stop_id,
                "stop_name": stop["name"],
                "sequence": seq,
                "streetcar_arrivals": len(arrival_entries),
                "mean_headway_s": mean_headway,
                "min_headway_s": min_headway,
                "max_headway_s": max_headway,
                "headway_cv": headway_cv,
                "bunched_arrivals_count": bunched_count,
                "gapped_arrivals_count": gapped_count,
                "mean_arrival_load": (
                    float(sum(arrival_loads) / len(arrival_loads)) if arrival_loads else None
                ),
                "peak_arrival_load": max(arrival_loads) if arrival_loads else None,
                "mean_departure_load": (
                    float(sum(stop_departure_loads) / len(stop_departure_loads))
                    if stop_departure_loads
                    else None
                ),
                "peak_departure_load": max(stop_departure_loads) if stop_departure_loads else None,
                "full_departures_count": sum(1 for load in stop_departure_loads if load >= capacity),
                "alighted_passengers": alighted_at_stop,
                "beyond_segment_passengers": beyond_segment_at_stop,
                **stop_group_summary,
                "mean_wait_s": (
                    float(sum(stop_boarded_waits) / len(stop_boarded_waits))
                    if stop_boarded_waits
                    else None
                ),
                "p95_wait_s": nearest_rank_percentile(stop_boarded_waits, 0.95),
                "completed_mean_wait_s": (
                    float(sum(stop_completed_waits) / len(stop_completed_waits))
                    if stop_completed_waits
                    else None
                ),
                "completed_p95_wait_s": nearest_rank_percentile(stop_completed_waits, 0.95),
                "by_rider_group": rider_groups_breakdown,
            }
        )

    # Identify bottleneck / worst stops across the corridor.
    stops_with_arrivals = [s for s in by_stop if s["passengers"] > 0]
    stops_with_waits = [s for s in by_stop if s["p95_wait_s"] is not None]
    stops_with_queues = [s for s in by_stop if s["remaining_queue"] > 0]

    worst_by_denied = (
        max(stops_with_arrivals, key=lambda s: (s["denied_at_least_once_share"] or 0.0, s["denied_boarding_count"]))
        if stops_with_arrivals
        else None
    )
    worst_by_wait = (
        max(stops_with_waits, key=lambda s: (s["p95_wait_s"] or 0.0, s["mean_wait_s"] or 0.0))
        if stops_with_waits
        else None
    )
    worst_by_queue = (
        max(stops_with_queues, key=lambda s: s["remaining_queue"])
        if stops_with_queues
        else None
    )

    # Per-development breakdown for proposed housing projects.
    by_development: list[dict[str, Any]] = []
    for dev in inputs.get("developments", ()):
        dev_id = dev["id"]
        dev_ps = [p for p in corridor_passengers if p.get("development_id") == dev_id]
        dev_group = _summarize_overcrowding_group(dev_ps)
        dev_waits = [w for p in dev_ps if (w := _wait_time_s(p)) is not None]
        dev_rides = [r for p in dev_ps if (r := _ride_time_s(p)) is not None]
        dev_commutes = [c for p in dev_ps if (c := _commute_time_s(p)) is not None]
        by_development.append(
            {
                "development_id": dev_id,
                "name": dev["name"],
                "net_added_units": dev["net_added_units"],
                "occupied_share": dev["occupied_share"],
                "accessible_stop_ids": list(dev["accessible_stop_ids"]),
                **dev_group,
                "mean_wait_s": float(sum(dev_waits) / len(dev_waits)) if dev_waits else None,
                "p95_wait_s": nearest_rank_percentile(dev_waits, 0.95),
                "mean_ride_time_s": float(sum(dev_rides) / len(dev_rides)) if dev_rides else None,
                "mean_commute_time_s": float(sum(dev_commutes) / len(dev_commutes)) if dev_commutes else None,
            }
        )

    overall_overcrowding = _summarize_overcrowding_group(corridor_passengers)
    existing_overcrowding = _summarize_overcrowding_group(existing_corridor)
    new_overcrowding = _summarize_overcrowding_group(new_corridor)

    boarded_wait_summary = summarize_distribution(boarded_waits_all)
    completed_wait_summary = summarize_distribution(completed_waits_all)
    ride_time_summary = summarize_distribution(ride_times_corridor)
    commute_time_summary = summarize_distribution(commute_times_corridor)

    mean_departure_load = (
        float(sum(departure_loads) / len(departure_loads))
        if departure_loads
        else None
    )
    full_departures_share = (
        float(full_departures_count / len(departure_loads))
        if departure_loads
        else None
    )

    return {
        "overview": {
            "corridor_passengers": corridor_created,
            "existing_corridor_passengers": len(existing_corridor),
            "new_development_passengers": len(new_corridor),
            "incoming_broadview_passengers": len(incoming_passengers),
            "total_passengers_in_sim": len(passengers),
            "boarded_corridor_passengers": overall_overcrowding["boarded_passengers"],
            "completed_corridor_passengers": corridor_arrived,
            "in_progress_at_cutoff_passengers": corridor_in_progress_at_cutoff,
            "onboard_at_end_passengers": corridor_onboard,
            "awaiting_first_car_at_end_passengers": corridor_awaiting_first_car,
            "unresolved_passengers": corridor_unresolved,
            "remaining_queue_passengers": corridor_unresolved,
            "raw_waiting_at_cutoff_passengers": corridor_waiting_raw,
            "denied_boarding_count": overall_overcrowding["denied_boarding_count"],
            "denied_boarding_share": overall_overcrowding["denied_at_least_once_share"],
            "existing_denied_boarding_share": existing_overcrowding["denied_at_least_once_share"],
            "new_denied_boarding_share": new_overcrowding["denied_at_least_once_share"],
            "mean_wait_s": boarded_wait_summary["mean_s"],
            "median_wait_s": boarded_wait_summary["median_s"],
            "p95_wait_s": boarded_wait_summary["p95_s"],
            "max_wait_s": boarded_wait_summary["max_s"],
            "mean_ride_time_s": ride_time_summary["mean_s"],
            "mean_commute_time_s": commute_time_summary["mean_s"],
            "p95_commute_time_s": commute_time_summary["p95_s"],
            "streetcar_capacity": capacity,
            "streetcars_dispatched": len(streetcars),
            "streetcars_completed": sum(1 for car in streetcars if car["status"] == "finished"),
            "mean_departure_load": mean_departure_load,
            "peak_streetcar_load": peak_load,
            "full_departures_count": full_departures_count,
            "full_departures_share": full_departures_share,
            "conservation_valid": conservation_valid,
        },
        "passenger_counts": {
            "total": len(passengers),
            "corridor_boarding": {
                "total": corridor_created,
                "existing": len(existing_corridor),
                "new": len(new_corridor),
                "scheduled_after_horizon": len(scheduled_not_yet_arrived),
                "by_status": {
                    "waiting": corridor_waiting_raw,
                    "onboard": corridor_onboard,
                    "arrived": sum(1 for p in corridor_passengers if p["status"] == "arrived"),
                    "beyond_segment": sum(1 for p in corridor_passengers if p["status"] == "beyond_segment"),
                },
                "boarded": overall_overcrowding["boarded_passengers"],
                "completed_trip": corridor_arrived,
                "in_progress_at_cutoff": corridor_in_progress_at_cutoff,
                "awaiting_first_car_at_cutoff": corridor_awaiting_first_car,
                "unresolved": corridor_unresolved,
            },
            "incoming_broadview": {
                "total": len(incoming_passengers),
                "entry_stop_id": first_stop_id,
                "by_status": {
                    "onboard": sum(1 for p in incoming_passengers if p["status"] == "onboard"),
                    "arrived": sum(1 for p in incoming_passengers if p["status"] == "arrived"),
                    "beyond_segment": sum(1 for p in incoming_passengers if p["status"] == "beyond_segment"),
                },
                "completed_trip": sum(
                    1 for p in incoming_passengers if p["status"] in ("arrived", "beyond_segment")
                ),
            },
            "conservation_valid": conservation_valid,
        },
        "wait_times_s": {
            "boarded": {
                "overall": boarded_wait_summary,
                "existing": summarize_distribution(boarded_waits_existing),
                "new": summarize_distribution(boarded_waits_new),
            },
            "completed_trips": {
                "overall": completed_wait_summary,
                "existing": summarize_distribution(completed_waits_existing),
                "new": summarize_distribution(completed_waits_new),
            },
            "unresolved_queues_at_end": {
                "overall": _summarize_unresolved_queue_waits(waiting_corridor, horizon_s),
                "existing": _summarize_unresolved_queue_waits(waiting_existing, horizon_s),
                "new": _summarize_unresolved_queue_waits(waiting_new, horizon_s),
            },
        },
        "journey_times_s": {
            "ride_time_s": {
                "corridor_overall": ride_time_summary,
                "corridor_existing": summarize_distribution(ride_times_existing),
                "corridor_new": summarize_distribution(ride_times_new),
                "incoming_broadview": summarize_distribution(ride_times_incoming),
            },
            "total_commute_time_s": {
                "overall": commute_time_summary,
                "existing": summarize_distribution(commute_times_existing),
                "new": summarize_distribution(commute_times_new),
            },
        },
        "overcrowding": {
            "overall": overall_overcrowding,
            "existing": existing_overcrowding,
            "new": new_overcrowding,
            "worst_stop_by_denied_share": (
                {
                    "stop_id": worst_by_denied["stop_id"],
                    "stop_name": worst_by_denied["stop_name"],
                    "denied_at_least_once_share": worst_by_denied["denied_at_least_once_share"],
                    "denied_boarding_count": worst_by_denied["denied_boarding_count"],
                    "passengers": worst_by_denied["passengers"],
                }
                if worst_by_denied and (worst_by_denied["denied_boarding_count"] or 0) > 0
                else None
            ),
            "worst_stop_by_p95_wait": (
                {
                    "stop_id": worst_by_wait["stop_id"],
                    "stop_name": worst_by_wait["stop_name"],
                    "p95_wait_s": worst_by_wait["p95_wait_s"],
                    "mean_wait_s": worst_by_wait["mean_wait_s"],
                    "passengers": worst_by_wait["passengers"],
                }
                if worst_by_wait
                else None
            ),
            "worst_stop_by_remaining_queue": (
                {
                    "stop_id": worst_by_queue["stop_id"],
                    "stop_name": worst_by_queue["stop_name"],
                    "remaining_queue": worst_by_queue["remaining_queue"],
                    "passengers": worst_by_queue["passengers"],
                }
                if worst_by_queue
                else None
            ),
        },
        "fleet": {
            "streetcar_capacity": capacity,
            "target_headway_s": target_headway_s,
            "streetcars_dispatched": len(streetcars),
            "streetcars_completed": sum(1 for car in streetcars if car["status"] == "finished"),
            "streetcars_in_transit_at_end": sum(1 for car in streetcars if car["status"] != "finished"),
            "total_stop_departures": len(departure_loads),
            "mean_departure_load": mean_departure_load,
            "median_departure_load": float(median(departure_loads)) if departure_loads else None,
            "p95_departure_load": nearest_rank_percentile([float(x) for x in departure_loads], 0.95),
            "peak_load": peak_load,
            "mean_peak_load_per_streetcar": mean_peak_load_per_car,
            "full_departures_count": full_departures_count,
            "full_departures_share": full_departures_share,
            "crowded_departures_80pct_count": crowded_80pct_count,
            "crowded_departures_80pct_share": (
                float(crowded_80pct_count / len(departure_loads))
                if departure_loads
                else None
            ),
            "scheduled_corridor_travel_time_s": scheduled_corridor_travel_time_s,
            "completed_corridor_run_time_s": summarize_distribution(completed_car_run_times),
        },
        "by_stop": by_stop,
        "by_development": by_development,
        "contract": {
            "diagnostics": {
                "passengers_created": corridor_arrived + corridor_unresolved,
                "passengers_arrived": corridor_arrived,
                "passengers_waiting": corridor_unresolved,
                "passengers_onboard": 0,
                "in_progress_at_cutoff_excluded": corridor_in_progress_at_cutoff,
                "conservation": conservation_valid,
                "unresolved_passengers": corridor_unresolved,
                "runtime_s": max(0.0, float(runtime_s)),
            },
            "case_metrics": {
                "mean_wait_s": completed_wait_summary["mean_s"],
                "p95_wait_s": completed_wait_summary["p95_s"],
                "denied_share": overall_overcrowding["denied_at_least_once_share"],
                "unresolved_passengers": corridor_unresolved,
            },
            "stop_results": contract_stop_results,
        },
    }
