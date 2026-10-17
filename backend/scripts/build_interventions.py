"""Build the A10 intervention data: extra service and streetcar priority (design: docs/interventions.md).

1. Service parameters from the cached TTC GTFS feed (run times, layovers, cycle, service days).
2. Costs and the priority effect from data/sources/intervention_evidence.json, in 2025 CAD.
3. Writes data/reviewed/interventions.json (values, provenance and a contract-shaped catalogue),
   one Lane C policy per target headway (data/reviewed/package_policy_<headway>.json), and
   registers the evidence sources in data/reviewed/simulation_sources.json.

    python -m backend.scripts.build_interventions
"""
import json
import math
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path
from statistics import median
from zipfile import ZipFile

import pandas as pd

from backend.config import ROOT_DIR
from backend.schemas.intervention import Intervention
from backend.scripts.prove_feasibility import write_json
from data.sources.base import fetch_cached, record_source
from data.sources.gtfs_static import active_services, seconds

REVIEWED = ROOT_DIR / "data/reviewed"
GTFS_ZIP = ROOT_DIR / "data/raw/ttc_gtfs.zip"
ROUTE = "505"
BROADVIEW_STATION, DUNDAS_WEST_STATION = "Broadview Station", "Dundas West Station"
# AM peak used to sample run times and layovers; the same window the simulation models.
PEAK_START_S, PEAK_END_S = 7 * 3600, 9 * 3600
# Gaps longer than this between a block's trips are pull-ins or breaks, not layovers.
MAX_LAYOVER_S = 30 * 60
SERVICE_YEAR = 2026
# Ontario public holidays on which TTC runs holiday (not weekday) service. The GTFS feed
# itself confirms Thanksgiving (2026-10-12) drops weekday service.
HOLIDAYS_2026 = {
    date(2026, 1, 1): "New Year's Day", date(2026, 2, 16): "Family Day", date(2026, 4, 3): "Good Friday",
    date(2026, 5, 18): "Victoria Day", date(2026, 7, 1): "Canada Day", date(2026, 8, 3): "Civic Holiday",
    date(2026, 9, 7): "Labour Day", date(2026, 10, 12): "Thanksgiving", date(2026, 12, 25): "Christmas Day",
    date(2026, 12, 28): "Boxing Day (observed)",
}


def read(archive, name, **kwargs):
    with archive.open(name) as stream:
        return pd.read_csv(stream, dtype=str, encoding="utf-8-sig", **kwargs)


def route_trips(service_date: date):
    """One row per 505 trip on the service date: block, direction, terminals, start and end times."""
    with ZipFile(GTFS_ZIP) as archive:
        calendar = read(archive, "calendar.txt").to_dict("records")
        exceptions = read(archive, "calendar_dates.txt").to_dict("records")
        services = active_services(calendar, exceptions, service_date)
        routes = read(archive, "routes.txt")
        route_id = routes[(routes.route_short_name == ROUTE) & (routes.route_type == "0")].route_id.iloc[0]
        trips = read(archive, "trips.txt")
        trips = trips[(trips.route_id == route_id) & trips.service_id.isin(services)]
        ids = set(trips.trip_id)
        with archive.open("stop_times.txt") as stream:
            chunks = pd.read_csv(stream, dtype=str, encoding="utf-8-sig", chunksize=2_000_000)
            stop_times = pd.concat(c[c.trip_id.isin(ids)] for c in chunks)
        stop_names = read(archive, "stops.txt").set_index("stop_id").stop_name
    stop_times["stop_sequence"] = stop_times.stop_sequence.astype(int)
    stop_times = stop_times.sort_values(["trip_id", "stop_sequence"])
    first = stop_times.groupby("trip_id").first()
    last = stop_times.groupby("trip_id").last()
    table = trips.set_index("trip_id").join(pd.DataFrame({
        "start_s": first.departure_time.map(seconds), "end_s": last.arrival_time.map(seconds),
        "first_stop": first.stop_id.map(stop_names), "last_stop": last.stop_id.map(stop_names),
    }))
    return table.reset_index(), sorted(services)


def is_terminal(name: str, station: str) -> bool:
    return name.startswith(station)


def service_parameters(service_date: date = date(2026, 10, 16)) -> dict:
    trips, services = route_trips(service_date)
    full = {
        "westbound": trips[trips.first_stop.map(lambda n: is_terminal(n, BROADVIEW_STATION))
                           & trips.last_stop.map(lambda n: is_terminal(n, DUNDAS_WEST_STATION))],
        "eastbound": trips[trips.first_stop.map(lambda n: is_terminal(n, DUNDAS_WEST_STATION))
                           & trips.last_stop.map(lambda n: is_terminal(n, BROADVIEW_STATION))],
    }
    run_s, run_n = {}, {}
    for direction, rows in full.items():
        peak = rows[(rows.start_s >= PEAK_START_S) & (rows.start_s < PEAK_END_S)]
        durations = list(peak.end_s - peak.start_s)
        run_s[direction], run_n[direction] = median(durations), len(durations)

    # Layover: a block's gap between arriving at a terminal and leaving it again on its next trip.
    layovers = defaultdict(list)
    round_trips = []
    for _, block in trips.sort_values("start_s").groupby("block_id"):
        rows = block.to_dict("records")
        for previous, following in zip(rows, rows[1:]):
            gap = following["start_s"] - previous["end_s"]
            if previous["last_stop"] == following["first_stop"] and 0 <= gap <= MAX_LAYOVER_S \
                    and PEAK_START_S <= previous["end_s"] < PEAK_END_S:
                station = DUNDAS_WEST_STATION if is_terminal(previous["last_stop"], DUNDAS_WEST_STATION) else BROADVIEW_STATION
                layovers[station].append(gap)
        # Observed cycle: same block leaving Broadview Station twice on full trips, with a full trip between.
        starts = [r for r in rows if is_terminal(r["first_stop"], BROADVIEW_STATION) and is_terminal(r["last_stop"], DUNDAS_WEST_STATION)]
        for a, b in zip(starts, starts[1:]):
            between = [r for r in rows if a["start_s"] < r["start_s"] < b["start_s"]]
            if PEAK_START_S <= a["start_s"] < PEAK_END_S and len(between) == 1 \
                    and is_terminal(between[0]["first_stop"], DUNDAS_WEST_STATION) and is_terminal(between[0]["last_stop"], BROADVIEW_STATION):
                round_trips.append(b["start_s"] - a["start_s"])
    layover_s = {station: median(values) for station, values in layovers.items()}
    composed_cycle = run_s["westbound"] + run_s["eastbound"] + sum(layover_s.values())

    # Cars actually scheduled in service at 08:00, as a check on cycle / headway.
    in_service = trips[(trips.start_s <= 8 * 3600) & (trips.end_s >= 8 * 3600)].block_id.nunique()

    simulation = json.loads((REVIEWED / "simulation_input.json").read_text())["inputs"]
    weekdays = [date(SERVICE_YEAR, 1, 1) + timedelta(days=i) for i in range(365)]
    weekdays = [d for d in weekdays if d.weekday() < 5]
    holidays_on_weekdays = [d for d in HOLIDAYS_2026 if d.weekday() < 5]

    return {
        "service_date": service_date.isoformat(), "gtfs_service_ids": services,
        "run_s": run_s, "run_trip_count": run_n,
        "layover_s": layover_s, "layover_sample_count": {k: len(v) for k, v in layovers.items()},
        "cycle_s_composed": composed_cycle,
        "cycle_s_observed_median": median(round_trips) if round_trips else None,
        "cycle_observed_sample_count": len(round_trips),
        "baseline_headway_s": simulation["headway_s"],
        "cars_in_service_at_0800": in_service,
        "service_days": len(weekdays) - len(holidays_on_weekdays),
        "weekdays_in_year": len(weekdays), "holidays_on_weekdays": len(holidays_on_weekdays),
    }


EVIDENCE = ROOT_DIR / "data/sources/intervention_evidence.json"
CACHE = ROOT_DIR / "data/cache/a10"
LICENCE_TORONTO = "https://open.toronto.ca/open-data-licence/"
HEADWAY_OPTIONS_S = (360, 300, 240)
DEFAULT_HEADWAY_S = 300
# Hours/day an extra AM-peak car is costed: 07:00-09:00 plus carhouse travel (assumption, see doc).
PEAK_HOURS = 2.5
# Team-selected share of link time saved by streetcar priority (assumption; evidence-based central is 0).
PRIORITY_SAVING = {"low": 0.0, "evidence_central": 0.0, "selected": 0.12}
EARLIEST_PHASE = "phase-1"
POLICY_SOURCE_IDS = ["ttc-gtfs", "ttc-2025-operating-budget", "munro-2017-queen-cost", "statcan-cpi-annual",
                     "toronto-king-pilot-2017", "toronto-king-extension-2018", "toronto-king-results-2019",
                     "toronto-king-update-2024"]


def to_2025(evidence, amount, year):
    cpi = evidence["cpi"]["index_2002_100"]
    return amount * cpi[str(evidence["price_year"])] / cpi[str(year)]


def cost_ranges(evidence, cycle_s):
    """Low/central/high in 2025 CAD for streetcar-hour, priority capital and priority operating costs."""
    f = evidence["figures"]
    route = json.loads((REVIEWED / "route_505.json").read_text())
    km_per_vehicle_hour = sum(d["length_m"] for d in route["directions"]) / 1000 / (cycle_s / 3600)
    factors = f["ttc_streetcar_cost_factors_2015"]
    running = factors["per_vehicle_hour"] + factors["per_vehicle_km"] * km_per_vehicle_hour
    per_hour = {
        "low": to_2025(evidence, running, 2015),
        "central": f["ttc_cost_per_service_hour"]["value"],
        "high": to_2025(evidence, running + factors["per_vehicle_day"] / PEAK_HOURS, 2015),
    }
    pilot = to_2025(evidence, f["king_pilot_capital_2017"]["value"], 2017)
    permanent = to_2025(evidence, f["king_permanent_capital_2019"]["value"], 2019)
    improvements = to_2025(evidence, f["king_improvements_capital_2024"]["value"], 2024)
    capital = {"low": pilot, "central": pilot + permanent, "high": pilot + permanent + improvements}
    annual = [to_2025(evidence, f[key]["value"] / f[key]["months_covered"] * 12, 2019)
              for key in ("king_operating_2019_jan_jul", "king_operating_2019_remainder")]
    operating = {"low": annual[0], "central": sum(annual) / 2, "high": annual[1]}
    rounded = lambda r: {k: round(v) for k, v in r.items()}
    return rounded(per_hour), rounded(capital), rounded(operating), round(km_per_vehicle_hour, 2)


def register_sources(evidence):
    """Add the evidence documents to the reviewed source manifest Lane C checks policy source IDs against."""
    path = REVIEWED / "simulation_sources.json"
    manifest = json.loads(path.read_text())
    known = {s["source_id"] for s in manifest}
    pages = {d["source_id"]: d for d in evidence["documents"]}
    pages["statcan-cpi-annual"] = {"source_id": "statcan-cpi-annual", "title": evidence["cpi"]["title"],
                                   "publisher": evidence["cpi"]["publisher"], "url": evidence["cpi"]["url"]}
    added = []
    for source_id in POLICY_SOURCE_IDS:
        if source_id in known:
            continue
        doc = pages[source_id]
        suffix = ".pdf" if doc["url"].endswith(".pdf") else ".html"
        cached = fetch_cached(doc["url"], CACHE / f"{source_id}{suffix}")
        record = record_source(cached, source_id=source_id, title=doc["title"], url=doc["url"],
                               publisher=doc["publisher"], version="retrieved snapshot",
                               licence=LICENCE_TORONTO if "toronto.ca" in doc["url"] or "ttc.ca" in doc["url"] else "see source")
        manifest.append(record)
        added.append(source_id)
    write_json(path, manifest)
    return added


def build():
    service = service_parameters()
    evidence = json.loads(EVIDENCE.read_text())
    corridor = json.loads((REVIEWED / "corridor.json").read_text())
    cycle_s = service["cycle_s_observed_median"]
    baseline_headway_s = service["baseline_headway_s"]
    per_hour, capital, operating, km_per_hour = cost_ranges(evidence, cycle_s)

    segment_s = corridor["summary"]["median_scheduled_segment_time_s"]
    saving_s = round(PRIORITY_SAVING["selected"] * segment_s * 2)  # both directions on the modelled segment
    lane_cycle_s = cycle_s - saving_s
    baseline_vehicles = math.ceil(cycle_s / baseline_headway_s)
    price_year = evidence["price_year"]

    catalogue, options = [], []
    for headway in HEADWAY_OPTIONS_S:
        extra = math.ceil(cycle_s / headway) - baseline_vehicles
        hours = extra * PEAK_HOURS * service["service_days"]
        annual = {k: round(hours * v) for k, v in per_hour.items()}
        options.append({"headway_s": headway, "default": headway == DEFAULT_HEADWAY_S,
                        "vehicles": baseline_vehicles + extra, "extra_vehicles": extra,
                        "extra_vehicle_hours_per_year": hours, "annual_operating_cad": annual})
        catalogue.append(Intervention.model_validate({
            "id": f"extra-service-{headway}s", "type": "extra_service", "link_ids": [], "headway_s": headway,
            "capital_cost": {"low": 0, "central": 0, "high": 0, "currency": "CAD", "price_year": price_year,
                             "scope": "no new vehicles purchased; spare fleet assumed", "unit": "CAD",
                             "status": "assumed", "source_ids": []},
            "operating_cost": {**annual, "currency": "CAD", "price_year": price_year,
                               "scope": f"{extra} extra cars x {PEAK_HOURS} h/day x {service['service_days']} days",
                               "unit": "CAD/year", "status": "assumed",
                               "source_ids": ["ttc-2025-operating-budget", "munro-2017-queen-cost", "statcan-cpi-annual"]},
            "extra_vehicles": extra, "earliest_phase": EARLIEST_PHASE,
            "effect": {"key": "headway_s", "unit": "seconds between westbound cars at Broadview & Dundas",
                       "meaning": f"Scheduled AM-peak headway with extra service ({headway} s)",
                       "low": headway, "central": headway, "high": headway,
                       "allowed_range": {"low": 180, "high": 600}, "status": "user_selected", "source_ids": []},
        }).model_dump(mode="json"))
    king_sources = ["toronto-king-pilot-2017", "toronto-king-extension-2018", "toronto-king-results-2019",
                    "toronto-king-update-2024", "statcan-cpi-annual"]
    catalogue.append(Intervention.model_validate({
        "id": "streetcar-priority-segment", "type": "priority_lane",
        "link_ids": [link["link_id"] for link in corridor["links"]], "headway_s": None,
        "capital_cost": {**capital, "currency": "CAD", "price_year": price_year,
                         "scope": "King Street pilot, permanent and 2024 improvement costs; similar-project budgets, not a quote",
                         "unit": "CAD", "status": "assumed", "source_ids": king_sources},
        "operating_cost": {**operating, "currency": "CAD", "price_year": price_year,
                           "scope": "King Street 2019 operating and maintenance, annualised; traffic-agent cost not included",
                           "unit": "CAD/year", "status": "assumed", "source_ids": king_sources},
        "extra_vehicles": 0, "earliest_phase": EARLIEST_PHASE,
        "effect": {"key": "link_time_saving_share", "unit": "share of scheduled link time saved",
                   "meaning": "AM-peak link time saved by streetcar priority; team-selected 12% stands in for congestion growth since 2019. Evidence alone suggests about 0%. Not simulated yet.",
                   "low": PRIORITY_SAVING["low"], "central": PRIORITY_SAVING["selected"], "high": PRIORITY_SAVING["selected"],
                   "allowed_range": {"low": 0, "high": 0.5}, "status": "assumed", "source_ids": ["toronto-king-results-2019", "toronto-king-update-2024"]},
    }).model_dump(mode="json"))

    label = ("A10 reviewed policy for 505 Dundas, 2025 CAD. Cycle and headways from the TTC GTFS schedule. "
             "Cost per streetcar-hour: central is the TTC 2025 system-wide average; low/high from 2015 TTC streetcar cost factors. "
             f"Extra cars run {PEAK_HOURS} h/day (AM peak plus carhouse travel, assumed). Priority costs transferred from King Street "
             "reports (budgets, not quotes). Priority time saving of 12% is a team-selected assumption; evidence suggests about 0% in the AM. "
             "See docs/interventions.md.")
    policies = {}
    for headway in HEADWAY_OPTIONS_S:
        policy = {"cycle_s": cycle_s, "lane_cycle_s": lane_cycle_s, "baseline_headway_s": baseline_headway_s,
                  "service_headway_s": headway, "peak_hours": PEAK_HOURS, "service_days": service["service_days"],
                  "cost_per_hour": per_hour, "lane_capital": capital, "lane_operating": operating,
                  "price_year": price_year, "earliest_phase": EARLIEST_PHASE,
                  "source_ids": POLICY_SOURCE_IDS, "assumption_label": label}
        name = f"package_policy_{headway}.json"
        write_json(REVIEWED / name, policy)
        policies[str(headway)] = name

    added_sources = register_sources(evidence)
    write_json(REVIEWED / "interventions.json", {
        "format_version": "interventions-v1", "corridor_id": corridor["corridor_id"], "price_year": price_year,
        "focus": "Extra service is the focus. Streetcar priority is optional: costs are filled in, its effect is not simulated yet.",
        "service": {
            "cycle_s": {"value": cycle_s, "status": "derived", "source_ids": ["ttc-gtfs"],
                        "method": "Median time between a block's consecutive Broadview Station departures, AM peak",
                        "composed_check_s": service["cycle_s_composed"]},
            "run_s": service["run_s"], "layover_s": service["layover_s"],
            "baseline_headway_s": {"value": baseline_headway_s, "status": "derived", "source_ids": ["ttc-gtfs"],
                                   "method": "Same mean scheduled entry gap the simulator uses"},
            "baseline_vehicles": baseline_vehicles, "cars_in_service_at_0800": service["cars_in_service_at_0800"],
            "service_days": {"value": service["service_days"], "status": "derived",
                             "method": "2026 weekdays minus Ontario holidays on weekdays"},
            "peak_hours": {"value": PEAK_HOURS, "status": "assumed", "method": "07:00-09:00 plus carhouse travel"},
            "km_per_vehicle_hour": km_per_hour,
        },
        "extra_service": {"headway_options": options, "default_headway_s": DEFAULT_HEADWAY_S,
                          "cost_per_hour_cad": {**per_hour, "selected": "central"}, "applies_to": "whole 505 route",
                          "simulated": True},
        "streetcar_priority": {"link_ids": [link["link_id"] for link in corridor["links"]],
                               "time_saving_share": PRIORITY_SAVING, "saving_per_cycle_s": saving_s,
                               "lane_cycle_s": lane_cycle_s, "capital_cad": {**capital, "selected": "central"},
                               "operating_cad_per_year": {**operating, "selected": "central"}, "simulated": False},
        "catalogue": catalogue,
        "policies": policies, "default_policy": policies[str(DEFAULT_HEADWAY_S)],
        "manifest_source_ids": POLICY_SOURCE_IDS,
        "limitations": [
            "Costs are 2025 CAD estimates from budgets and cost factors, not TTC quotes.",
            "The central streetcar-hour cost is a system-wide average including subway and overheads.",
            "Spare fleet for 3-14 extra streetcars is not established; fleet_allowance stays a scenario input.",
            "Costs cover both directions; simulated benefits are westbound AM only.",
            "Priority effect is a team-selected assumption and is not simulated yet.",
        ],
        "source_ids": POLICY_SOURCE_IDS,
    })
    return {"cycle_s": cycle_s, "lane_cycle_s": lane_cycle_s, "baseline_vehicles": baseline_vehicles,
            "options": options, "cost_per_hour": per_hour, "capital": capital, "operating": operating,
            "sources_added": added_sources}


def main():
    print(json.dumps(build(), indent=2))


if __name__ == "__main__":
    main()
