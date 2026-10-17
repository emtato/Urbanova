"""Author the Phase 01 hand-worked fixture, not a production simulation.

All riders start waiting at t=0 and alight at the last stop. Capacity FOUR is a
deliberately tiny test value, never a TTC capacity claim. There are five existing
riders at Jarvis and (growth only) five new riders at Sherbourne.
Current: cars at 0/60 s board 4/1 existing riders; mean wait 12 s, p95 60 s.
Growth: same cars; car 2 boards three new riders at t=210; two remain queued.
Completed wait = (60 + 3*210)/8 = 86.25 s; p95 = 210 s; denied once = 6/10.
Supported growth: cars at 0/30/60; new riders board 3 at t=180 and 2 at t=210.
All ten finish; mean wait = (30 + 3*180 + 2*210)/10 = 99 s, p95 = 210 s.
The larger completed-rider mean illustrates censoring when unresolved riders
are dropped, not a claim that more service increases passenger waits.
Real stop coordinates/link medians are reused solely to exercise the contract.
"""
import csv
import json
from math import ceil

from backend.config import ROOT_DIR
from backend.schemas import Comparison
from backend.scripts.check_contract import FIXTURE_PATH, check_contract


def assumption(key, unit, meaning, low, central, high, allowed_low, allowed_high, *, source_ids=None):
    return dict(key=key, unit=unit, meaning=meaning, low=low, central=central, high=high,
                allowed_range=dict(low=allowed_low, high=allowed_high),
                status="sourced" if source_ids else "assumed", source_ids=source_ids or [])


def build_fixture() -> dict:
    reviewed = ROOT_DIR / "data/reviewed"
    raw = json.loads((reviewed / "corridor.json").read_text(encoding="utf-8"))
    ids = [stop["stop_id"] for stop in raw["stops"]]
    incoming = assumption("incoming_load", "passengers/vehicle", "Fixture cars enter empty; actual Jarvis occupancy is unknown.", 0, 0, 0, 0, 300)
    capacity = assumption("vehicle_capacity", "passengers/vehicle", "FOUR places for hand arithmetic only; not a TTC streetcar capacity.", 4, 4, 6, 1, 300)
    headway = assumption("baseline_headway", "s", "Synthetic two-car dispatch separation; not the observed or scheduled 505 headway.", 60, 60, 60, 1, 1800)
    dwell = assumption("dwell", "s/stop", "Zero-dwell arithmetic fixture, not a calibrated boarding model.", 0, 0, 0, 0, 300)
    berth = assumption("berths", "vehicles/stop", "One berth per stop; fixture arrivals never overlap at a stop.", 1, 1, 1, 1, 4)
    occupied = assumption("occupied_share", "share", "Illustrative future occupied share; no observed completion dates.", .25, .5, .75, 0, 1)
    new_arrivals = assumption("new_arrivals", "passengers/window", "Synthetic new-rider counts for low/central/high demand; not derived from proposed units.", 3, 5, 7, 0, 20)
    existing_arrivals = assumption("existing_arrivals", "passengers/window", "Five existing riders at Jarvis, waiting from zero; no observed ridership claim.", 5, 5, 5, 0, 20)
    effect = assumption("extra_service_headway", "s", "Fixture dispatches 0/30/60 instead of 0/60; no fleet-cycle feasibility claim.", 30, 30, 60, 1, 1800)
    corridor = dict(corridor_id=raw["corridor_id"], route_pattern="505:0:shp-505-09", mode="streetcar",
                    direction="eastbound", crs="EPSG:4326", metric_crs="EPSG:26917",
                    peak_window=dict(start_s=25200, end_s=32400, timezone="America/Toronto", service_date=raw["service_date"]),
                    stops=raw["stops"],
                    links=[dict(link_id=item["link_id"], from_stop=item["from_stop"], to_stop=item["to_stop"],
                                length_m=item["length_m"], base_time_s=item["scheduled_time_s"], source_ids=item["source_ids"]) for item in raw["links"]],
                    berths_per_stop={stop: 1 for stop in ids}, incoming_load=incoming, source_ids=["ttc-gtfs"])
    with (reviewed / "developments.csv").open(encoding="utf-8", newline="") as handle:
        developments = [dict(dev_id=row["dev_id"], pipeline_ref=row["application_number"], address=row["address"],
                             units=int(row["proposed_units"]), stage=row["stage"], record_date=row["application_received"],
                             kind="proposal", footprint=None, footprint_status="unavailable",
                             access=[dict(stop_id=row["nearest_stop_id"], walk_m=float(row["walk_distance_m"]),
                                          status="estimated", source_ids=row["source_ids"].split(";"))],
                             source_ids=row["source_ids"].split(";")) for row in csv.DictReader(handle)]

    def cost(unit, low, central, high, scope):
        return dict(low=low, central=central, high=high, currency="CAD", price_year=2026,
                    scope=scope, unit=unit, status="assumed", source_ids=[])

    scenario = dict(scenario_id="fixture-505", version=1, developments=developments,
                    phases=[dict(phase_id="phase-1", year=2030, development_ids=[item["dev_id"] for item in developments], occupied_share=.5)],
                    demand_case="central", interventions=[dict(id="fixture-extra-service", type="extra_service", link_ids=[], headway_s=30,
                    capital_cost=cost("CAD", 0, 0, 0, "Fixture assumes an existing spare vehicle; excludes vehicle purchase."),
                    operating_cost=cost("CAD/year", 80000, 100000, 120000, "Invented annual incremental operating cost for contract testing only."),
                    extra_vehicles=1, earliest_phase="phase-1", effect=effect)],
                    intervention_availability={"fixture-extra-service": "phase-1"}, capital_budget_cad=0,
                    annual_operating_budget_cad=120000, budget_price_year=2026, fleet_allowance=1,
                    planning_criterion=dict(max_p95_wait_s=300, max_denied_share=.65, max_unresolved_passengers=0,
                    meaning="Illustrative criterion applied to every run; not a TTC service standard."))

    def stop_results(kind, new_count):
        results = []
        for index, stop in enumerate(ids):
            for group in ("existing", "new"):
                existing = index == 0 and group == "existing"
                new = index == 1 and group == "new" and kind != "current"
                passengers = 5 if existing else new_count if new else 0
                completed = min(3, passengers) if new and kind == "growth" else passengers
                new_mean = (min(3, new_count)*180 + max(new_count-3, 0)*210)/new_count
                mean = (6 if kind == "supported_growth" else 12) if existing else (new_mean if kind == "supported_growth" else 210) if new else None
                p95 = (30 if kind == "supported_growth" else 60) if existing else (180 if kind == "supported_growth" and new_count <= 3 else 210) if new else None
                results.append(dict(stop_id=stop, rider_group=group, passengers=passengers, completed_passengers=completed,
                                    mean_wait_s=mean, p95_wait_s=p95, denied_at_least_once_share=.2 if existing else 1 if new else None,
                                    remaining_queue=max(new_count-3, 0) if new and kind == "growth" else 0, headway_cv=0))
        return results

    cases = []
    for demand_case, new_count in (("central", 5), ("low", 3), ("high", 7)):
        for kind, package in (("current", "baseline"), ("growth", "baseline"), ("supported_growth", "extra-service")):
            suffix = "" if demand_case == "central" else "-" + demand_case
            count = 5 if kind == "current" else 5 + new_count
            waiting = max(new_count-3, 0) if kind == "growth" else 0
            waits = [0]*4 + [30 if kind == "supported_growth" else 60]
            if kind == "growth":
                waits += [210]*min(3, new_count)
            elif kind == "supported_growth":
                waits += [180]*min(3, new_count) + [210]*max(new_count-3, 0)
            mean, p95 = sum(waits)/len(waits), sorted(waits)[ceil(.95*len(waits))-1]
            denied = .2 if kind == "current" else (1+new_count)/(5+new_count)
            run_id = "fixture-run-" + kind + suffix
            run = dict(run_id=run_id, scenario_version=1, package=package, model_version="hand-fixture-v1",
                       data_version="ttc-S1000542-pipeline-20261008", seed_ids=[0], status="completed",
                       diagnostics=dict(passengers_created=count, passengers_arrived=count-waiting, passengers_waiting=waiting,
                                        passengers_onboard=0, conservation=True, unresolved_passengers=waiting, runtime_s=0))
            cases.append(dict(case_id="fixture-"+kind+suffix, kind=kind, package_id=package, phase_id="phase-1", demand_case=demand_case,
                              stops=stop_results(kind, new_count), runs=[run], per_run_mean_wait_s=[mean], per_run_p95_wait_s=[p95],
                              per_run_denied_share=[denied], per_run_unresolved_passengers=[waiting], run_count=1, unresolved_passengers=waiting))
    packages = []
    for package, case in (("baseline", "growth"), ("extra-service", "supported_growth")):
        evaluations = []
        for demand_case in ("central", "low", "high"):
            suffix = "" if demand_case == "central" else "-" + demand_case
            result = next(item for item in cases if item["case_id"] == "fixture-"+case+suffix)
            met = result["unresolved_passengers"] == 0 and result["per_run_denied_share"][0] <= .65
            reasons = ["All fixture limits pass."] if met else ["Fixture unresolved or denied-share limit exceeded."]
            evaluations.append(dict(phase_id="phase-1", demand_case=demand_case, case_id=result["case_id"], feasible=True,
                                    feasibility_reasons=["Fixture high-bound costs fit the budgets; availability and fleet allowance fit."],
                                    criterion_met=met, criterion_reasons=reasons))
        packages.append(dict(package_id=package, label="No additional service" if package == "baseline" else "Illustrative extra streetcar",
                             intervention_ids=[] if package == "baseline" else ["fixture-extra-service"], evaluations=evaluations))

    # Author two cars' stop visits, using the above hand-counted board/alight table.
    run_id = "fixture-run-growth"
    elapsed, times = 0, [0]
    for link in corridor["links"]:
        elapsed += link["base_time_s"]
        times.append(elapsed)
    events = []
    for car, dispatch in (("fixture-car-1", 0), ("fixture-car-2", 60)):
        load = 0

        def event(t, stop, kind, count=0, group=None):
            events.append(dict(run_id=run_id, t_s=t, kind=kind, vehicle_id=car, stop_id=stop,
                               count=count, load_after=load, rider_group=group))

        event(dispatch, ids[0], "dispatch")
        for index, stop in enumerate(ids):
            t = dispatch + times[index]
            event(t, stop, "arrive")
            if index == len(ids)-1:
                existing = 4 if car == "fixture-car-1" else 1
                load -= existing
                event(t, stop, "alight", existing, "existing")
                if car == "fixture-car-2":
                    load -= 3
                    event(t, stop, "alight", 3, "new")
            if index == 0:
                boarded = 4 if car == "fixture-car-1" else 1
                load += boarded
                event(t, stop, "board", boarded, "existing")
                if car == "fixture-car-1":
                    event(t, stop, "deny", 1, "existing")
            if index == 1:
                if car == "fixture-car-2":
                    load += 3
                    event(t, stop, "board", 3, "new")
                event(t, stop, "deny", 5 if car == "fixture-car-1" else 2, "new")
            event(t, stop, "depart")
    events.sort(key=lambda item: item["t_s"])
    source_fields = {"source_id", "title", "url", "publisher", "retrieved_at", "version", "licence"}
    sources = [{key: value for key, value in item.items() if key in source_fields}
               for item in json.loads((reviewed / "sources.json").read_text(encoding="utf-8"))]
    return dict(contract_version="1.0.0", comparison_id="fixture-505-jarvis-broadview", fixture=True,
                product_label="scenario experiment", scenario=scenario, corridor=corridor, cases=cases, packages=packages,
                sensitivity=[dict(assumption_key="vehicle_capacity", case_id="fixture-growth", tested_values=[4, 5, 6],
                                  metric="unresolved_passengers", outcomes=[2, 0, 0], status="fixture",
                                  interpretation="Hand arithmetic only, holding demand fixed. Not a fleet recommendation.")],
                assumptions=[incoming, capacity, headway, dwell, berth, occupied, effect, new_arrivals, existing_arrivals], sources=sources,
                warnings=["FIXTURE: synthetic passengers, costs, service, budgets and results; not a real 505 forecast.",
                          "Real GTFS geometry and proposed units do not validate the fixture demand. Housing totals are identical across packages.",
                          "Walking entrances/crossings need manual review; footprints unavailable, not invented.",
                          "Wait statistics include completed riders only; unresolved riders are separately reported. P95 uses nearest rank.",
                          "Fixture time starts at zero, representing 07:00 local; two illustrative dispatches do not represent the full AM service.",
                          "Zero dwell, empty incoming vehicles, four-place capacity and fleet-cycle feasibility are fixture assumptions."],
                replay=dict(run_id=run_id, horizon_s=times[-1]+60, vehicle_capacity={"fixture-car-1": 4, "fixture-car-2": 4},
                            initial_queues=[dict(stop_id=ids[0], rider_group="existing", count=5), dict(stop_id=ids[1], rider_group="new", count=5)], events=events))


def main() -> None:
    fixture = build_fixture()
    Comparison.model_validate(fixture)
    FIXTURE_PATH.parent.mkdir(parents=True, exist_ok=True)
    FIXTURE_PATH.write_text(json.dumps(fixture, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    check_contract(write=True)
    print("Authored and validated the hand-worked fixture; JSON Schema and TS copy updated.")


if __name__ == "__main__":
    main()
