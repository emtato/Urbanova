"""JSON stdin/stdout bridge: retain native B11 batches with C-owned metadata.

The simulator and its metrics remain authoritative. Cohorts are generated once
per phase/demand/seed and injected into its existing generation seam, in this
isolated process, so extra service cannot change the sampled demand.
"""
import copy
import hashlib
import gzip
import json
import statistics
import sys
from dataclasses import asdict, replace

from backend.simulation import runner
from backend.simulation.paired_runs import run_repeated_simulations
from backend.simulation.metrics import nearest_rank_percentile
from data.simulation_input import load_simulation_input


def percentile(values):
    return nearest_rank_percentile(values, .95)


def assumption(key, value, unit, meaning, status="assumed", source_ids=None, low=None, high=None):
    lo = value if low is None else low
    hi = value if high is None else high
    return dict(key=key, low=lo, central=value, high=hi, unit=unit, meaning=meaning,
                status=status, source_ids=source_ids or [], allowed_range=dict(low=min(0, lo), high=max(hi, value)))


def build(plan):
    operations=plan.get('operations',{})
    baseline = replace(load_simulation_input(),warmup_duration_s=operations.get('warmup_s',0),clearance_s=operations.get('clearance_s',0))
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
        "Onboard riders and riders awaiting their first car at cutoff are in progress, excluded from unresolved counts. Physical queues are reported separately.",
        "Packages share generated corridor passenger cohorts and seeded model random streams. Identical effective inputs reuse B11 outputs.",
        "Effective engine seeds are SHA256(draws_id, phase_id, demand_case, requested seed ID); recorded seed IDs retain the requested identifiers. Vehicle/link/stop draws are keyed independently of event order; baseline entries use the dated GTFS timetable.",
        "Unselected runs retain native summaries/statistics and input/cohort references; passenger/event histories are retained for one selected base run only.",
        "Native result batches and summaries retain the simulator owner's definitions. Denied share uses riders who encountered a streetcar, counting each denied rider once.",
        "Per-run decision waits use the native overview's boarded-rider waits; stop summaries retain the native completed-trip waits. Do not mix those cohorts.",
        "Run-to-run standard deviation is variation between seeds, not a confidence interval. Replay uses the native sim_log events.",
    ]

    def inputs_for(phase_id, demand, seed_id, current=False):
        scenario = plan["scenario"]
        phase_index = next(i for i,p in enumerate(scenario["phases"]) if p["phase_id"] == phase_id)
        active = {dev for p in scenario["phases"][:phase_index+1] for dev in p["development_ids"]}
        occupancy = {dev:p["occupied_share"] for p in scenario["phases"][:phase_index+1] for dev in p["development_ids"]}
        devs = [{**d,"occupied_share":d["occupied_share"]*occupancy[d["id"]]} for d in scenario["developments"] if d["id"] in active]
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

    def compact_result(result):
        incoming = set(result['inputs'].get('warmup_passenger_ids',[])) | {pid for event in result['sim_log'] if event['action']=='generate' for pid in event['passenger_ids']}
        journeys = sorted((p['id'],p['origin_stop_id'],p['destination_stop_id'],int(p['get_to_stop_time']*1_000_000),p['rider_group'],p['development_id']) for p in result['passengers'] if p['id'] not in incoming)
        signature=hashlib.sha256(json.dumps(journeys,separators=(',',':')).encode()).hexdigest()
        result['inputs']['cohort_signature']=signature
        result['inputs']['retention']='full-selected-run'
        keys=('seed','headway_s','link_travel_times_s','streetcar_capacity','start_time_s','end_time_s','warmup_duration_s','clearance_s','max_corridor_delay_s','entry_schedule_s','analysis_window_elapsed_s','cohort_signature')
        compact_inputs={key:result['inputs'][key] for key in keys}
        compact_inputs.update(retention='summary-only',data_version=plan['data_version'],model_version=plan['model_version'])
        return dict(inputs=compact_inputs,streetcars=[],passengers=[],sim_log=[],summary=result['summary'])

    def execute(inputs, cohorts, seeds, capture=False):
        # Avoid changing B11's incoming-load behaviour: passing passengers=...
        # disables it. Inject only its generation function, then restore it.
        key = json.dumps([asdict(inputs), seeds], sort_keys=True, default=list)
        if key in simulation_cache and not capture:
            return key, *simulation_cache[key]
        original = runner.generate_passengers
        runner.generate_passengers = lambda run_inputs: copy.deepcopy(cohorts[run_inputs.seed])
        outputs=[]
        retained=False
        def retain(result):
            nonlocal retained
            outputs.append(analyze(result))
            compact=compact_result(result)
            if capture and not retained:
                retained=True
                return result
            return compact
        try:
            batch = run_repeated_simulations(inputs, run_count=len(seeds), seeds=seeds,result_transform=retain)
        finally:
            runner.generate_passengers = original
        return key,batch,outputs

    def analyze(result):
        incoming = set(result['inputs'].get('warmup_passenger_ids',[])) | {pid for event in result["sim_log"] if event["action"] == "generate"
                    for pid in event["streetcar"]["onboard_passenger_ids"]}
        samples = {}
        for p in result["passengers"]:
            if p["id"] not in incoming and p["status"] in ("arrived", "beyond_segment") and p["boarding_time_s"] is not None:
                samples.setdefault((p["origin_stop_id"],p["rider_group"]), []).append(max(0.,p["boarding_time_s"]-p["get_to_stop_time"]))
        gaps = {}
        for stop in result["inputs"]["stops"]:
            times = [e["time_s"] for e in result["sim_log"] if e["stop_id"] == stop["id"] and e["action"] == ("generate" if stop["sequence"] == 0 else "arrive")]
            gaps[stop["id"]] = [b-a for a,b in zip(times,times[1:])]
        return dict(contract=result["summary"]["contract"], native=result["summary"], samples=samples, gaps=gaps)

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
                    runs, cohorts, engine_seeds = [], {}, []
                    case_id = f"{variant}:{phase_id}:{demand}:{kind}:{package_id}"
                    for seed_id in plan["random"]["seed_ids"]:
                        inputs, cohort = inputs_for(phase_id, demand, seed_id, current=kind == "current")
                        cohorts[inputs.seed] = cohort
                        engine_seeds.append(inputs.seed)
                        if plan.get("policy"):
                            inputs = replace(inputs,headway_s=plan["policy"]["baseline_headway_s"])
                        if available:
                            lane = next((i for i in selected if i["type"] == "priority_lane"), None)
                            extra = next((i for i in selected if i["type"] == "extra_service"), None)
                            multiplier = lane["effect"]["central"] if lane else 1
                            inputs = replace(inputs, link_travel_times_s=tuple(t*multiplier if lane and plan["corridor"]["links"][i]["link_id"] in lane["link_ids"] else t for i,t in enumerate(inputs.link_travel_times_s)), headway_s=extra["headway_s"] if extra else (plan["policy"]["baseline_headway_s"] if plan.get("policy") else inputs.headway_s))
                        if abs(inputs.headway_s-baseline.headway_s)>1e-6:
                            inputs=replace(inputs,entry_schedule_s=())
                    capture = variant == 'base' and kind != 'current' and demand == scenario['demand_case'] and phase_id == scenario['phases'][0]['phase_id'] and package_id == packages[-1]['package_id'] and plan.get('retain_replay',False) and native_replay is None
                    cache_key,batch,outputs = execute(inputs, cohorts, engine_seeds, capture=capture)
                    compact_runs=[]
                    selected_run=None
                    for seed_id, result, output in zip(plan["random"]["seed_ids"], batch["individual_results"], outputs):
                        run_id = f"{case_id}:seed-{seed_id}"
                        runs.append(dict(run_id=run_id,scenario_version=scenario["version"],package=package_id,
                                         model_version=plan["model_version"],data_version=plan["data_version"],seed_ids=[seed_id],
                                         status="completed",diagnostics=output["contract"]["diagnostics"]))
                        native_metrics.append(dict(run_id=run_id,summary=output["native"]))
                        compact_runs.append(result if result['inputs'].get('retention')=='summary-only' else compact_result(result))
                        if capture and native_replay is None:
                            selected_run=result
                            native_replay = dict(format_version="b11-events-v1",comparison_id="pending",run_id=run_id,
                                                 scenario_id=scenario["scenario_id"],model_version=plan["model_version"],data_version=plan["data_version"],
                                                 source_ids=[s["source_id"] for s in sources],horizon_s=inputs.end_time_s-inputs.start_time_s+inputs.clearance_s,
                                                 stops=plan["corridor"]["stops"],events=result["sim_log"],passengers=result["passengers"])
                    compact_batch={**batch,'individual_results':compact_runs}
                    simulation_cache[cache_key]=(compact_batch,outputs)
                    if selected_run is not None:
                        retained=list(compact_runs);retained[0]=selected_run
                        batch={**batch,'individual_results':retained}
                    else:
                        batch=compact_batch
                    stop_results = []
                    for index, stop in enumerate(outputs[0]["contract"]["stop_results"]):
                        rows = [o["contract"]["stop_results"][index] for o in outputs]
                        waits = [w for o in outputs for w in o["samples"].get((stop["stop_id"],stop["rider_group"]), [])]
                        headways = [g for o in outputs for g in o["gaps"][stop["stop_id"]]]
                        groups = [next(s for s in o["native"]["by_stop"] if s["stop_id"] == stop["stop_id"])["by_rider_group"][stop["rider_group"]] for o in outputs]
                        passengers = sum(g["passengers"] for g in groups)
                        encountered = sum(g["encountered_streetcar_passengers"] for g in groups)
                        stop_results.append(dict(stop_id=stop["stop_id"],rider_group=stop["rider_group"],passengers=passengers,
                                                 completed_passengers=sum(r["completed_passengers"] for r in rows),mean_wait_s=statistics.mean(waits) if waits else None,
                                                 p95_wait_s=percentile(waits),denied_at_least_once_share=sum(g["denied_boarding_count"] for g in groups)/encountered if encountered else None,
                                                 encountered_streetcar_passengers=encountered,
                                                 remaining_queue=sum(r["remaining_queue"] for r in rows),headway_cv=statistics.pstdev(headways)/statistics.mean(headways) if headways and statistics.mean(headways)>0 else None))
                    metrics = [dict(mean_wait_s=o["native"]["overview"]["mean_wait_s"],p95_wait_s=o["native"]["overview"]["p95_wait_s"],denied_share=o["native"]["overview"]["denied_boarding_share"],unresolved_passengers=o["native"]["overview"]["unresolved_passengers"]) for o in outputs]
                    case = dict(case_id=case_id,kind=kind,package_id=package_id,phase_id=phase_id,demand_case=demand,stops=stop_results,runs=runs,
                                per_run_mean_wait_s=[m["mean_wait_s"] for m in metrics],per_run_p95_wait_s=[m["p95_wait_s"] for m in metrics],
                                per_run_denied_share=[m["denied_share"] for m in metrics],per_run_unresolved_passengers=[m["unresolved_passengers"] for m in metrics],
                                run_count=len(runs),unresolved_passengers=sum(m["unresolved_passengers"] for m in metrics),**batch)
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
        for key,unit in (("warmup_duration_s","seconds"),("clearance_s","seconds")):
            assumptions.append(assumption(key,getattr(baseline,key),unit,"Explicit operational assumption; warm-up and post-window service are not observed weekday demand."))
        assumptions.append(assumption("max_corridor_delay_s",baseline.max_corridor_delay_s,"seconds/corridor","Upper bound on one shared corridor delay divided across links; the simulation owner's B7 rule."))
        for key,value,unit in (("headway_randomness_s",baseline.headway_randomness_s,"seconds"),("link_travel_time_variation_share",baseline.link_travel_time_variation_share,"fraction"),("baseline_headway_s",plan["policy"]["baseline_headway_s"] if plan.get("policy") else baseline.headway_s,"seconds"),("parallel_route_inner_band",baseline.parallel_route_bands[0],"fraction"),("parallel_route_outer_band",baseline.parallel_route_bands[1],"fraction")):
            assumptions.append(assumption(key,value,unit,"Explicit model setting; not an observed service measurement."))
        excluded = [f"{s['package_id']} / {s['phase_id']}: {'; '.join(s['reasons'])}" for s in spec["screen"] if not s["feasible"]]
        return dict(contract_version="3.0.0",comparison_id=f"b11:{variant}",fixture=False,product_label="scenario experiment",scenario=scenario,corridor=corr,cases=cases,packages=packages,sensitivity=[],assumptions=assumptions,sources=sources,warnings=warnings+excluded,replay=None)

    base = comparison("base")
    delayed = comparison("delayed")
    return dict(comparison=base,delayedComparison=delayed,native_replay=native_replay,native_metrics=native_metrics,
                package_screen=plan["base"]["screen"],notice="Computed from B11 using shared sampled corridor cohorts and requested seeds. Incoming loads and other model assumptions remain explicit.")


def run_batch(request: dict) -> dict:
    """Run one configured simulation situation for run_count trials and return its native batch."""
    from dataclasses import fields
    from backend.simulation.inputs import SimulationInput

    baseline = load_simulation_input()
    input_fields = {field.name for field in fields(SimulationInput)}
    overrides = {key: value for key, value in request.items() if key in input_fields and value is not None}
    if ('headway_s' in overrides and abs(overrides['headway_s']-baseline.headway_s)>1e-6) or overrides.get('headway_randomness_s',baseline.headway_randomness_s)>0:
        overrides['entry_schedule_s']=()
    if "developments" not in overrides and "development_ids" in request and request["development_ids"] is not None:
        dev_ids = list(request["development_ids"])
        known = {dev.id for dev in baseline.developments}
        unknown = [dev_id for dev_id in dev_ids if dev_id not in known]
        if unknown:
            raise ValueError(f"Unknown development_ids: {unknown}")
        selected = set(dev_ids)
        overrides["developments"] = [asdict(dev) for dev in baseline.developments if dev.id in selected]
    inputs = load_simulation_input(overrides=overrides)
    run_count = request.get("run_count", 1)
    seeds = request.get("seeds")
    batch_id = request.get("id")
    return run_repeated_simulations(inputs, run_count=run_count, seeds=seeds, batch_id=batch_id)


if __name__ == "__main__":
    try:
        payload = json.load(sys.stdin)
        result = build(payload) if isinstance(payload, dict) and "source_manifest" in payload else run_batch(payload)
        if "--gzip" in sys.argv:
            with gzip.open(sys.stdout.buffer, "wt", encoding="utf-8", compresslevel=1) as output:
                json.dump(result,output,allow_nan=False,separators=(",", ":"))
        else:
            json.dump(result,sys.stdout,allow_nan=False,separators=(",", ":"))
    except Exception as error:
        # Never echo the input/environment (which can contain credentials).
        print(f"B11 bridge failed: {type(error).__name__}",file=sys.stderr)
        from pydantic import ValidationError
        if isinstance(error,ValidationError):
            print(json.dumps([{"loc":e["loc"],"msg":e["msg"]} for e in error.errors(include_input=False)[:5]]),file=sys.stderr)
        sys.exit(1)
