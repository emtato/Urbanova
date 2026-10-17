"""Build the A10 intervention data: extra service and streetcar priority (design: docs/interventions.md).

Step 1 (this file so far): service parameters derived from the cached TTC GTFS feed.

    python -m backend.scripts.build_interventions
"""
import json
from collections import defaultdict
from datetime import date, timedelta
from statistics import median
from zipfile import ZipFile

import pandas as pd

from backend.config import ROOT_DIR
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


def main():
    print(json.dumps(service_parameters(), indent=2))


if __name__ == "__main__":
    main()
