"""Post-simulation analyzer computing corridor, stop, development, and fleet metrics.

Accepts the dictionary returned by `run_simulation()` (or raw simulation objects)
and produces a structured summary dictionary suitable for:
  1. Resident-facing commute summaries & scenario comparison cards
  2. Stop-by-stop bottleneck and crowding analysis
  3. Contract-validated `Diagnostics` and `StopResult` payloads
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


def _summarize_overcrowding_group(passengers: list[dict[str, Any]]) -> dict[str, float | int | None]:
    """Summarize total arrivals, denied-boarding count/share, and remaining queue for a cohort."""
    total = len(passengers)
    denied_count = sum(1 for p in passengers if p.get("denied_boarding_once"))
    remaining_queue = sum(1 for p in passengers if p.get("status") == "waiting")
    boarded_count = sum(1 for p in passengers if p.get("boarding_time_s") is not None)
    completed_count = sum(1 for p in passengers if p.get("status") in ("arrived", "beyond_segment"))
    return {
        "passengers": total,
        "boarded_passengers": boarded_count,
        "completed_passengers": completed_count,
        "denied_boarding_count": denied_count,
        "denied_at_least_once_share": (denied_count / total) if total > 0 else None,
        "remaining_queue": remaining_queue,
    }


def _summarize_unresolved_queue_waits(
    waiting_passengers: list[dict[str, Any]],
    horizon_s: float,
) -> dict[str, float | int | None]:
    """Summarize lower-bound wait times for riders still stuck in a stop queue at run end."""
    waits_so_far = [
        max(0.0, float(horizon_s - p["get_to_stop_time"]))
        for p in waiting_passengers
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
    corridor_passengers_all = [p for p in passengers if p["id"] not in incoming_passenger_ids]
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
    ) and all(
        0 <= len(car.get("onboard_passenger_ids", ())) <= car.get("capacity", capacity)
        for car in streetcars
    )
    conservation_valid = (
        all_statuses_valid
        and waiting_in_stops == waiting_passengers_total
        and onboard_in_streetcars == onboard_passengers_total
        and loads_within_capacity
    )

    # Wait time distributions (corridor-boarding riders only).
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

        # Streetcar departure loads leaving this stop (or arrival loads at the TMU terminus).
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
                    "passengers": group_stats["passengers"],
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

    # Contract-compatible Diagnostics (over active corridor-boarding passengers).
    corridor_created = len(corridor_passengers)
    corridor_arrived = len(completed_corridor)
    corridor_waiting = len(waiting_corridor)
    corridor_onboard = sum(1 for p in corridor_passengers if p["status"] == "onboard")
    corridor_unresolved = corridor_waiting + corridor_onboard

    overall_overcrowding = _summarize_overcrowding_group(corridor_passengers)
    existing_overcrowding = _summarize_overcrowding_group(existing_corridor)
    new_overcrowding = _summarize_overcrowding_group(new_corridor)

    boarded_wait_summary = summarize_distribution(boarded_waits_all)
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
            "unresolved_passengers": corridor_unresolved,
            "remaining_queue_passengers": corridor_waiting,
            "onboard_at_end_passengers": corridor_onboard,
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
                    "scheduled": len(scheduled_not_yet_arrived),
                    "waiting": corridor_waiting,
                    "onboard": corridor_onboard,
                    "arrived": sum(1 for p in corridor_passengers if p["status"] == "arrived"),
                    "beyond_segment": sum(1 for p in corridor_passengers if p["status"] == "beyond_segment"),
                },
                "boarded": overall_overcrowding["boarded_passengers"],
                "completed_trip": corridor_arrived,
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
                "overall": summarize_distribution(completed_waits_all),
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
                "passengers_created": corridor_created,
                "passengers_arrived": corridor_arrived,
                "passengers_waiting": corridor_waiting,
                "passengers_onboard": corridor_onboard,
                "conservation": (
                    conservation_valid
                    and corridor_created == corridor_arrived + corridor_waiting + corridor_onboard
                ),
                "unresolved_passengers": corridor_unresolved,
                "runtime_s": max(0.0, float(runtime_s)),
            },
            "stop_results": contract_stop_results,
        },
    }
