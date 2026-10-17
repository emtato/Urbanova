"""JSON stdin/stdout bridge: compose frozen Comparisons from B11 summaries.

The simulator and its metrics remain authoritative. Cohorts are generated once
per phase/demand/seed and injected into its existing generation seam, in this
isolated process, so extra service cannot change the sampled demand.
"""
import copy
import hashlib
import json
import statistics
import sys
from dataclasses import replace

from backend.simulation import runner
from backend.simulation.metrics import nearest_rank_percentile
from backend.schemas import Comparison
from data.simulation_input import load_simulation_input


def percentile(values):
    return nearest_rank_percentile(values, .95)


def assumption(key, value, unit, meaning, status="assumed", source_ids=None, low=None, high=None):
    lo = value if low is None else low
    hi = value if high is None else high
    return dict(key=key, low=lo, central=value, high=hi, unit=unit, meaning=meaning,
                status=status, source_ids=source_ids or [], allowed_range=dict(low=min(0, lo), high=max(hi, value)))


def build(plan):
    baseline = load_simulation_input()
    sources = [{k: s[k] for k in ("source_id", "title", "url", "publisher", "retrieved_at", "version", "licence")}
               for s in plan["source_manifest"]]
    # Extra commute source files are part of the data digest even when their
    # legacy manifest is separate from the original corridor source manifest.
    from backend.config import ROOT_DIR
    workplace_manifest = ROOT_DIR / "data/reviewed/workplaces_sources.json"
    if workplace_manifest.exists():
        entries = json.loads(workplace_manifest.read_text(encoding="utf-8"))
        if isinstance(entries, dict):
            entries = entries.get("sources", [])
        for s in entries:
            if not any(x["source_id"] == s["source_id"] for x in sources):
                sources.append({k:s[k] for k in ("source_id", "title", "url", "publisher", "retrieved_at", "version", "licence")})
    for source in sources:
        if len(source["retrieved_at"]) == 10:
            source["retrieved_at"] += "T00:00:00+00:00"
            source["version"] += "; review date only, UTC-midnight normalization (not a precise retrieval time)"
        if len(source["url"]) > 2083:
            from urllib.parse import urlsplit, parse_qs, urlencode, urlunsplit
            parts = urlsplit(source["url"])
            resource = parse_qs(parts.query).get("resource_id", [])
            query = urlencode({"resource_id":resource[0],"limit":1}) if resource else ""
            source["url"] = urlunsplit((parts.scheme,parts.netloc,parts.path,query,""))
            source["version"] += "; exact long query URL/checksum preserved in reviewed source manifest"
    cohort_cache, simulation_cache = {}, {}
    native_replay = None
    native_metrics = []
    factors = plan["demand_factors"]
    warnings = [
        "Scenario experiment, not a calibrated ridership forecast. Housing includes explicit estimates; entrances and crossings require review.",
        "Incoming loads, dwell, workplace choice and demand multipliers are assumptions, not observed westbound demand.",
        "Scheduled link times may already include dwell; applying the model's dwell range can double-count part of journey time.",
        "The reporting cap can leave passengers waiting/onboard. Completed-rider waits must be read alongside unresolved counts.",
        "Packages share generated corridor passenger cohorts and seeded model random streams. Identical effective inputs reuse B11 outputs.",
        "Effective engine seeds are SHA256(draws_id, phase_id, demand_case, requested seed ID); recorded seed IDs retain the requested identifiers. Event-dependent streams can consume draws in different orders across packages.",
        "Frozen Comparison replay is initial-queues-only; live B11 events use the separate b11-events-v1 replay envelope.",
        "Comparison 2.0.0 defines unresolved as all waiting plus onboard riders, and denied share over all arrived corridor passengers. Native B11 now treats cutoff-in-progress riders as neutral and uses an encountered-car denominator. Native metrics are stored separately without changing those meanings; this frozen comparison retains its original definitions and is more conservative about cutoff riders.",
    ]

    def inputs_for(phase_id, demand, seed_id, current=False):
        scenario = plan["scenario"]
        phase_index = next(i for i,p in enumerate(scenario["phases"]) if p["phase_id"] == phase_id)
        active = {dev for p in scenario["phases"][:phase_index+1] for dev in p["development_ids"]}
        devs = [d for d in scenario["developments"] if d["id"] in active]
        values = {"developments":devs, "trips_per_resident_in_window":baseline.trips_per_resident_in_window*factors[demand]}
        stream = json.dumps([plan["random"]["draws_id"], phase_id, demand, seed_id], separators=(",", ":"))
        values["seed"] = int.from_bytes(hashlib.sha256(stream.encode()).digest()[:4], "big") % 2147483647
        from pydantic import TypeAdapter
        from backend.simulation.objects import Development
        values["developments"] = TypeAdapter(tuple[Development, ...]).validate_python(devs)
        inputs = replace(baseline, **values)
        cohort_key = (phase_id, demand, seed_id)
        if cohort_key not in cohort_cache:
            cohort_cache[cohort_key] = runner.generate_passengers(inputs)
        cohort = cohort_cache[cohort_key]
        if current:
            cohort = {pid:p for pid,p in cohort.items() if p.rider_group == "existing"}
            inputs = replace(inputs, developments=())
        return inputs, cohort

    def execute(inputs, cohort, capture=False):
        # Avoid changing B11's incoming-load behaviour: passing passengers=...
        # disables it. Inject only its generation function, then restore it.
        key = (inputs.seed, inputs.headway_s, inputs.link_travel_times_s,
               tuple(cohort), tuple((d.id,d.net_added_units) for d in inputs.developments))
        if key in simulation_cache and not (capture and native_replay is None and "replay_data" not in simulation_cache[key]):
            return simulation_cache[key]
        original = runner.generate_passengers
        runner.generate_passengers = lambda _: copy.deepcopy(cohort)
        try:
            result = runner.run_simulation(copy.deepcopy(inputs))
        finally:
            runner.generate_passengers = original
        incoming = {pid for event in result["sim_log"] if event["action"] == "generate"
                    for pid in event["streetcar"]["onboard_passenger_ids"]}
        samples = {}
        for p in result["passengers"]:
            if p["id"] not in incoming and p["status"] in ("arrived", "beyond_segment") and p["boarding_time_s"] is not None:
                samples.setdefault((p["origin_stop_id"],p["rider_group"]), []).append(max(0.,p["boarding_time_s"]-p["get_to_stop_time"]))
        gaps = {}
        for stop in inputs.stops:
            times = [e["time_s"] for e in result["sim_log"] if e["stop_id"] == stop.id and e["action"] == ("generate" if stop.sequence == 0 else "arrive")]
            gaps[stop.id] = [b-a for a,b in zip(times,times[1:])]
        # Project physical state into frozen 2.0.0 meanings. Preserve B11's newer
        # neutral-cutoff metrics separately; never silently reinterpret a field.
        native = dict(contract=copy.deepcopy(result["summary"]["contract"]),overview=result["summary"]["overview"])
        contract = copy.deepcopy(native["contract"])
        active = [p for p in result["passengers"] if p["id"] not in incoming and p["status"] != "scheduled"]
        waiting = sum(p["status"] == "waiting" for p in active)
        onboard = sum(p["status"] == "onboard" for p in active)
        contract["diagnostics"] = dict(passengers_created=len(active),passengers_arrived=sum(p["status"] in ("arrived","beyond_segment") for p in active),passengers_waiting=waiting,passengers_onboard=onboard,unresolved_passengers=waiting+onboard,conservation=contract["diagnostics"]["conservation"],runtime_s=contract["diagnostics"]["runtime_s"])
        contract["case_metrics"].update(unresolved_passengers=waiting+onboard,denied_share=sum(p["denied_boarding_once"] for p in active)/len(active) if active else None)
        for row in contract["stop_results"]:
            group = [p for p in active if p["origin_stop_id"] == row["stop_id"] and p["rider_group"] == row["rider_group"]]
            row.update(passengers=len(group),remaining_queue=sum(p["status"] == "waiting" for p in group),denied_at_least_once_share=sum(p["denied_boarding_once"] for p in group)/len(group) if group else None)
        compact = dict(contract=contract, native=native, samples=samples,gaps=gaps,
                       incoming=result["summary"]["overview"]["incoming_broadview_passengers"])
        # Retain at most one complete log, only if explicitly requested.
        if capture and native_replay is None:
            compact["replay_data"] = dict(events=result["sim_log"],passengers=result["passengers"])
        simulation_cache[key] = compact
        return compact

    def comparison(variant):
        nonlocal native_replay
        spec = plan[variant]
        scenario = spec["scenario"]
        cases, packages = [], copy.deepcopy(spec["packages"])
        for package in packages:
            package["evaluations"] = []
        for phase in scenario["phases"]:
            phase_id = phase["phase_id"]
            for demand in ("low", "central", "high"):
                definitions = [("current", "existing"), ("growth", "existing")]
                supported = [p["package_id"] for p in packages if p["package_id"] != "existing"] or ["existing"]
                definitions.extend(("supported_growth", p) for p in supported)
                for kind, package_id in definitions:
                    package = next(p for p in packages if p["package_id"] == package_id)
                    selected = [i for i in scenario["interventions"] if i["id"] in package["intervention_ids"]]
                    phase_position = next(i for i,p in enumerate(scenario["phases"]) if p["phase_id"] == phase_id)
                    available = all(next(i for i,p in enumerate(scenario["phases"]) if p["phase_id"] == item["earliest_phase"]) <= phase_position for item in selected)
                    outputs, runs = [], []
                    case_id = f"{variant}:{phase_id}:{demand}:{kind}:{package_id}"
                    for seed_id in plan["random"]["seed_ids"]:
                        inputs, cohort = inputs_for(phase_id, demand, seed_id, current=kind == "current")
                        if plan.get("policy"):
                            inputs = replace(inputs,headway_s=plan["policy"]["baseline_headway_s"])
                        if available:
                            lane = next((i for i in selected if i["type"] == "priority_lane"), None)
                            extra = next((i for i in selected if i["type"] == "extra_service"), None)
                            multiplier = lane["effect"]["central"] if lane else 1
                            inputs = replace(inputs, link_travel_times_s=tuple(t*multiplier for t in inputs.link_travel_times_s), headway_s=extra["headway_s"] if extra else (plan["policy"]["baseline_headway_s"] if plan.get("policy") else inputs.headway_s))
                        capture = variant == "base" and kind != "current" and demand == scenario["demand_case"] and phase_id == scenario["phases"][0]["phase_id"] and package_id == packages[-1]["package_id"] and plan.get("retain_replay",False)
                        output = execute(inputs, cohort,capture=capture)
                        outputs.append(output)
                        run_id = f"{case_id}:seed-{seed_id}"
                        runs.append(dict(run_id=run_id,scenario_version=scenario["version"],package=package_id,
                                         model_version=plan["model_version"],data_version=plan["data_version"],seed_ids=[seed_id],
                                         status="completed",diagnostics=output["contract"]["diagnostics"]))
                        native_metrics.append(dict(run_id=run_id,summary=output["native"]))
                        if capture and native_replay is None and "replay_data" in output:
                            native_replay = dict(format_version="b11-events-v1",comparison_id="pending",run_id=run_id,
                                                 scenario_id=scenario["scenario_id"],model_version=plan["model_version"],data_version=plan["data_version"],
                                                 source_ids=[s["source_id"] for s in sources],horizon_s=inputs.end_time_s-inputs.start_time_s,
                                                 stops=plan["corridor"]["stops"],**output.pop("replay_data"))
                    stop_results = []
                    for index, stop in enumerate(outputs[0]["contract"]["stop_results"]):
                        rows = [o["contract"]["stop_results"][index] for o in outputs]
                        waits = [w for o in outputs for w in o["samples"].get((stop["stop_id"],stop["rider_group"]), [])]
                        headways = [g for o in outputs for g in o["gaps"][stop["stop_id"]]]
                        passengers = sum(r["passengers"] for r in rows)
                        stop_results.append(dict(stop_id=stop["stop_id"],rider_group=stop["rider_group"],passengers=passengers,
                                                 completed_passengers=sum(r["completed_passengers"] for r in rows),mean_wait_s=statistics.mean(waits) if waits else None,
                                                 p95_wait_s=percentile(waits),denied_at_least_once_share=sum((r["denied_at_least_once_share"] or 0)*r["passengers"] for r in rows)/passengers if passengers else None,
                                                 remaining_queue=sum(r["remaining_queue"] for r in rows),headway_cv=statistics.pstdev(headways)/statistics.mean(headways) if headways and statistics.mean(headways)>0 else None))
                    metrics = [o["contract"]["case_metrics"] for o in outputs]
                    case = dict(case_id=case_id,kind=kind,package_id=package_id,phase_id=phase_id,demand_case=demand,stops=stop_results,runs=runs,
                                per_run_mean_wait_s=[m["mean_wait_s"] for m in metrics],per_run_p95_wait_s=[m["p95_wait_s"] for m in metrics],
                                per_run_denied_share=[m["denied_share"] for m in metrics],per_run_unresolved_passengers=[m["unresolved_passengers"] for m in metrics],
                                run_count=len(runs),unresolved_passengers=sum(m["unresolved_passengers"] for m in metrics))
                    cases.append(case)
                    if kind == "growth" or (kind == "supported_growth" and package_id != "existing"):
                        c = scenario["planning_criterion"]
                        meets = all(m["p95_wait_s"] is not None and m["p95_wait_s"]<=c["max_p95_wait_s"] and m["denied_share"] is not None and m["denied_share"]<=c["max_denied_share"] and m["unresolved_passengers"]<=c["max_unresolved_passengers"] for m in metrics)
                        screen = next(s for s in spec["screen"] if s["package_id"] == package_id and s["phase_id"] == phase_id)
                        package["evaluations"].append(dict(phase_id=phase_id,demand_case=demand,case_id=case_id,feasible=screen["feasible"],feasibility_reasons=screen["reasons"],criterion_met=meets,criterion_reasons=[] if meets else ["At least one run fails the selected wait, denied-share or unresolved criterion (including unknown metrics). "]))
        assumptions = [assumption("demand_multiplier",1,"factor","Explicit low/central/high sensitivity choices; not a measured confidence interval.",low=factors["low"],high=factors["high"])]
        for key,value in (("trips_per_resident_in_window",baseline.trips_per_resident_in_window),("streetcar_capacity",baseline.streetcar_capacity),("westward_share",baseline.westward_share),("walk_limit_m",baseline.walk_limit_m)):
            meta = plan["field_metadata"].get(key,{})
            assumptions.append(assumption(key,value,meta.get("unit","model input"),meta.get("meaning",key),status="sourced" if meta.get("status")=="sourced" else "assumed",source_ids=meta.get("source_ids",[])))
        assumptions.extend([assumption("incoming_load",sum(baseline.incoming_load_range)/2,"passengers/vehicle","B11 uniform incoming-load assumption; not measured.",low=baseline.incoming_load_range[0],high=baseline.incoming_load_range[1]),assumption("dwell",sum(baseline.stop_dwell_range_s)/2,"seconds/stop","B11 dwell assumption; scheduled link times may already include dwell.",low=baseline.stop_dwell_range_s[0],high=baseline.stop_dwell_range_s[1])])
        corr = copy.deepcopy(plan["corridor"])
        corr["incoming_load"] = assumptions[-2]
        for key,value,unit in (("headway_randomness_s",baseline.headway_randomness_s,"seconds"),("link_travel_time_variation_share",baseline.link_travel_time_variation_share,"fraction"),("baseline_headway_s",plan["policy"]["baseline_headway_s"] if plan.get("policy") else baseline.headway_s,"seconds"),("parallel_route_inner_band",baseline.parallel_route_bands[0],"fraction"),("parallel_route_outer_band",baseline.parallel_route_bands[1],"fraction")):
            assumptions.append(assumption(key,value,unit,"Explicit model setting; not an observed service measurement."))
        excluded = [f"{s['package_id']} / {s['phase_id']}: {'; '.join(s['reasons'])}" for s in spec["screen"] if not s["feasible"]]
        result = dict(contract_version="2.0.0",comparison_id=f"b11:{variant}",fixture=False,product_label="scenario experiment",scenario=scenario,corridor=corr,cases=cases,packages=packages,sensitivity=[],assumptions=assumptions,sources=sources,warnings=warnings+excluded,replay=None)
        return Comparison.model_validate(result).model_dump(mode="json")

    base = comparison("base")
    delayed = comparison("delayed")
    return dict(comparison=base,delayedComparison=delayed,native_replay=native_replay,native_metrics=native_metrics,
                package_screen=plan["base"]["screen"],notice="Computed from B11 using shared sampled corridor cohorts and requested seeds. Incoming loads and other model assumptions remain explicit.")


if __name__ == "__main__":
    try:
        result = build(json.load(sys.stdin))
        json.dump(result,sys.stdout,allow_nan=False,separators=(",", ":"))
    except Exception as error:
        # Never echo the input/environment (which can contain credentials).
        print(f"B11 bridge failed: {type(error).__name__}",file=sys.stderr)
        from pydantic import ValidationError
        if isinstance(error,ValidationError):
            print(json.dumps([{"loc":e["loc"],"msg":e["msg"]} for e in error.errors(include_input=False)[:5]]),file=sys.stderr)
        sys.exit(1)
