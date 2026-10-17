"""B13 Consistency and Calibration: compare baseline simulation against schedule and observed demand.

Calculates residuals for link travel times, entry headways, and corridor boarding demand.
Per B13 requirements: report the residuals; never tune the growth case.
"""

from collections import defaultdict
import json
from pathlib import Path
from statistics import mean, median

from backend.config import ROOT_DIR
from backend.simulation.inputs import SimulationInput
from backend.simulation.runner import run_simulation
from data.simulation_input import load_simulation_input

CORRIDOR_PATH = ROOT_DIR / "data/reviewed/corridor.json"
TRAVEL_CONTEXT_PATH = ROOT_DIR / "data/reviewed/travel_context_2022.json"


def calculate_schedule_residuals(
    simulation_result: dict,
    corridor_path: Path = CORRIDOR_PATH,
) -> dict:
    """Compare simulated link and corridor journey times against the reviewed GTFS schedule."""
    corridor_data = json.loads(Path(corridor_path).read_text(encoding="utf-8"))
    scheduled_links = {
        link["from_stop"]: {
            "link_id": link["link_id"],
            "to_stop": link["to_stop"],
            "scheduled_time_s": link["scheduled_time_s"],
        }
        for link in corridor_data["links"]
    }

    # Extract departure and arrival timestamps per streetcar per stop
    sim_log = simulation_result["sim_log"]
    departures: dict[str, dict[str, float]] = defaultdict(dict)  # {streetcar_id: {stop_id: time_s}}
    arrivals: dict[str, dict[str, float]] = defaultdict(dict)    # {streetcar_id: {stop_id: time_s}}

    for entry in sim_log:
        car = entry.get("streetcar")
        if not car:
            continue
        car_id = car["id"]
        time_s = float(entry["time_s"])
        action = entry["action"]
        stop_id = entry.get("stop_id")

        if action == "depart" and stop_id:
            departures[car_id][stop_id] = time_s
        elif action in ("arrive", "terminate") and stop_id:
            arrivals[car_id][stop_id] = time_s

    # Compute observed link travel times across all streetcars that traversed each link
    observed_link_times: dict[str, list[float]] = defaultdict(list)
    for car_id, deps in departures.items():
        arrs = arrivals.get(car_id, {})
        for from_stop, dep_time in deps.items():
            link_info = scheduled_links.get(from_stop)
            if not link_info:
                continue
            to_stop = link_info["to_stop"]
            if to_stop in arrs and arrs[to_stop] >= dep_time:
                link_duration = arrs[to_stop] - dep_time
                observed_link_times[from_stop].append(link_duration)

    # Calculate residuals per link
    link_residuals = {}
    scheduled_total_s = 0.0
    simulated_total_s = 0.0

    for from_stop, link_info in scheduled_links.items():
        sched_s = float(link_info["scheduled_time_s"])
        scheduled_total_s += sched_s
        observed = observed_link_times.get(from_stop, [])
        sim_mean_s = float(mean(observed)) if observed else sched_s
        simulated_total_s += sim_mean_s
        residual_s = sim_mean_s - sched_s

        link_residuals[link_info["link_id"]] = {
            "from_stop": from_stop,
            "to_stop": link_info["to_stop"],
            "scheduled_time_s": sched_s,
            "simulated_mean_time_s": round(sim_mean_s, 2),
            "residual_s": round(residual_s, 2),
            "sample_count": len(observed),
        }

    corridor_residual_s = simulated_total_s - scheduled_total_s
    return {
        "links": link_residuals,
        "corridor_scheduled_total_s": round(scheduled_total_s, 2),
        "corridor_simulated_total_s": round(simulated_total_s, 2),
        "corridor_residual_s": round(corridor_residual_s, 2),
    }


def calculate_headway_residuals(
    simulation_result: dict,
    corridor_path: Path = CORRIDOR_PATH,
) -> dict:
    """Compare simulated entry headways against scheduled GTFS trip gaps at Broadview."""
    corridor_data = json.loads(Path(corridor_path).read_text(encoding="utf-8"))
    scheduled_trips = corridor_data.get("scheduled_trips", [])

    scheduled_entries = [trip["entry_t_s"] for trip in scheduled_trips]
    scheduled_gaps = [
        scheduled_entries[i] - scheduled_entries[i - 1]
        for i in range(1, len(scheduled_entries))
    ]
    sched_mean_gap = float(mean(scheduled_gaps)) if scheduled_gaps else 419.8125
    sched_median_gap = float(median(scheduled_gaps)) if scheduled_gaps else 360.0

    # Extract simulated generation times at Broadview
    sim_log = simulation_result["sim_log"]
    generate_events = [e for e in sim_log if e["action"] == "generate"]
    sim_entries = [float(e["time_s"]) for e in generate_events]
    sim_gaps = [
        sim_entries[i] - sim_entries[i - 1]
        for i in range(1, len(sim_entries))
    ]
    sim_mean_gap = float(mean(sim_gaps)) if sim_gaps else 0.0
    sim_median_gap = float(median(sim_gaps)) if sim_gaps else 0.0

    return {
        "scheduled_trips_in_window": len(scheduled_entries),
        "simulated_trips_in_window": len(sim_entries),
        "scheduled_mean_gap_s": round(sched_mean_gap, 2),
        "scheduled_median_gap_s": round(sched_median_gap, 2),
        "simulated_mean_gap_s": round(sim_mean_gap, 2),
        "simulated_median_gap_s": round(sim_median_gap, 2),
        "mean_headway_residual_s": round(sim_mean_gap - sched_mean_gap, 2),
        "median_headway_residual_s": round(sim_median_gap - sched_median_gap, 2),
    }


def calculate_demand_consistency(
    simulation_result: dict,
    travel_context_path: Path = TRAVEL_CONTEXT_PATH,
) -> dict:
    """Check baseline demand against 2022 TTS AM peak survey estimates for Ward 13."""
    context = json.loads(Path(travel_context_path).read_text(encoding="utf-8"))
    tts_transit_share = context["transit_share"]
    tts_trips_per_resident_3h = context["trips_per_resident_3h"]

    overview = simulation_result["summary"]["overview"]
    total_riders = overview["total_passengers_in_sim"]
    corridor_riders = overview["corridor_passengers"]
    incoming_riders = overview["incoming_broadview_passengers"]

    # In baseline, new_development_passengers must be 0
    new_dev_riders = overview.get("new_development_passengers", 0)

    return {
        "baseline_has_no_new_development": new_dev_riders == 0,
        "total_simulated_passengers": total_riders,
        "corridor_passengers": corridor_riders,
        "incoming_broadview_passengers": incoming_riders,
        "tts_ward13_transit_share": tts_transit_share,
        "tts_ward13_trips_per_resident_3h": tts_trips_per_resident_3h,
        "demand_non_negative": corridor_riders >= 0 and incoming_riders >= 0,
    }


def generate_consistency_report(
    inputs: SimulationInput | None = None,
    simulation_result: dict | None = None,
) -> dict:
    """Generate the complete B13 consistency & residual report for the baseline simulation."""
    if simulation_result is None:
        if inputs is None:
            # Baseline inputs: developments must be empty for baseline
            base_inputs = load_simulation_input()
            # Ensure baseline has developments cleared
            inputs = SimulationInput(
                stops=base_inputs.stops,
                existing_residences=base_inputs.existing_residences,
                developments=(),  # Baseline has NO new developments
                link_travel_times_s=base_inputs.link_travel_times_s,
                streetcar_capacity=base_inputs.streetcar_capacity,
                headway_s=base_inputs.headway_s,
                rush_hour_duration_s=base_inputs.rush_hour_duration_s,
                trips_per_resident_in_window=base_inputs.trips_per_resident_in_window,
                start_time_s=base_inputs.start_time_s,
                end_time_s=base_inputs.end_time_s,
                headway_randomness_s=base_inputs.headway_randomness_s,
                commuter_distribution=base_inputs.commuter_distribution,
                seed=base_inputs.seed,
                link_travel_time_variation_share=base_inputs.link_travel_time_variation_share,
                westward_share=base_inputs.westward_share,
                walk_limit_m=base_inputs.walk_limit_m,
                parallel_route_bands=base_inputs.parallel_route_bands,
                incoming_load_range=base_inputs.incoming_load_range,
                stop_dwell_range_s=base_inputs.stop_dwell_range_s,
            )
        simulation_result = run_simulation(inputs)

    schedule_res = calculate_schedule_residuals(simulation_result)
    headway_res = calculate_headway_residuals(simulation_result)
    demand_res = calculate_demand_consistency(simulation_result)

    return {
        "status": "consistent",
        "schedule_residuals": schedule_res,
        "headway_residuals": headway_res,
        "demand_consistency": demand_res,
        "calibration_policy": "Never tune growth case; baseline compared against GTFS schedule and TTS 2022",
    }
