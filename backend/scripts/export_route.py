"""Export one whole TTC route from the cached GTFS feed as reference JSON.

For each direction: the stops of the most common weekday pattern (distance and median
scheduled time from the first stop), every pattern with trip counts, and weekday trips
per start hour. Stops inside the modelled corridor carry their corridor stop_id.
Run prove_feasibility first so data/raw/ttc_gtfs.zip and corridor.json exist.

    python -m backend.scripts.export_route            # 505 Dundas
    python -m backend.scripts.export_route --route 504
"""
import argparse
import json
from zipfile import ZipFile

import pandas as pd

from backend.config import ROOT_DIR
from backend.scripts.prove_feasibility import write_json
from data.sources.gtfs_static import seconds

DAY_TYPES = {"weekday": "wednesday", "saturday": "saturday", "sunday": "sunday"}


def read(archive: ZipFile, name: str, **kwargs) -> pd.DataFrame:
    with archive.open(name) as stream:
        return pd.read_csv(stream, dtype=str, encoding="utf-8-sig", **kwargs)


def export_route(route_short_name: str = "505") -> dict:
    reviewed = ROOT_DIR / "data/reviewed"
    with ZipFile(ROOT_DIR / "data/raw/ttc_gtfs.zip") as archive:
        routes = read(archive, "routes.txt")
        route = routes[routes.route_short_name == route_short_name].iloc[0]
        calendar = read(archive, "calendar.txt")
        day_services = {day: set(calendar[calendar[column] == "1"].service_id) for day, column in DAY_TYPES.items()}
        trips = read(archive, "trips.txt")
        trips = trips[trips.route_id == route.route_id]
        trip_ids = set(trips.trip_id)
        with archive.open("stop_times.txt") as stream:
            chunks = pd.read_csv(stream, dtype=str, encoding="utf-8-sig", chunksize=2_000_000)
            stop_times = pd.concat(c[c.trip_id.isin(trip_ids)] for c in chunks)
        stops = read(archive, "stops.txt").set_index("stop_id")
        feed_version = read(archive, "feed_info.txt").feed_version.iloc[0]

    stop_times = stop_times.merge(trips, on="trip_id")
    stop_times["arrival_s"] = stop_times.arrival_time.map(seconds)
    stop_times["stop_sequence"] = stop_times.stop_sequence.astype(int)
    corridor = json.loads((reviewed / "corridor.json").read_text())
    corridor_stops = {s["gtfs_stop_id"]: s["stop_id"] for s in corridor["stops"]}

    def trip_counts(frame: pd.DataFrame) -> dict:
        return {day: int(frame[frame.service_id.isin(ids)].trip_id.nunique()) for day, ids in day_services.items()}

    directions = []
    for direction_id, group in stop_times.groupby("direction_id"):
        weekday = group[group.service_id.isin(day_services["weekday"])]
        main_shape = weekday.groupby("shape_id").trip_id.nunique().idxmax()
        main = weekday[weekday.shape_id == main_shape]
        main = main.assign(offset_s=main.arrival_s - main.groupby("trip_id").arrival_s.transform("min"))
        offsets = main.groupby("stop_id").offset_s.median()
        sample = main[main.trip_id == main.trip_id.iloc[0]].sort_values("stop_sequence")
        stop_rows = []
        for row in sample.itertuples():
            stop = stops.loc[row.stop_id]
            distance = row.shape_dist_traveled
            stop_rows.append({
                "seq": int(row.stop_sequence), "gtfs_stop_id": row.stop_id, "name": stop.stop_name,
                "lat": float(stop.stop_lat), "lon": float(stop.stop_lon),
                # The merged TTC feed publishes shape_dist_traveled in metres.
                "dist_from_start_m": 0 if pd.isna(distance) else round(float(distance)),
                "scheduled_from_start_s": int(offsets[row.stop_id]),
                "corridor_stop_id": corridor_stops.get(row.stop_id),
            })
        if not 1_000 < stop_rows[-1]["dist_from_start_m"] < 100_000:
            raise ValueError("Route length is implausible; check the feed's shape_dist_traveled units")
        patterns = []
        for (shape_id, headsign), pattern in group.groupby(["shape_id", "trip_headsign"]):
            ordered = pattern[pattern.trip_id == pattern.trip_id.iloc[0]].sort_values("stop_sequence")
            patterns.append({
                "shape_id": shape_id, "headsign": headsign,
                "first_stop": stops.loc[ordered.stop_id.iloc[0], "stop_name"],
                "last_stop": stops.loc[ordered.stop_id.iloc[-1], "stop_name"],
                "stop_count": int(len(ordered)), "trips": trip_counts(pattern),
            })
        patterns.sort(key=lambda p: -p["trips"]["weekday"])
        starts = weekday.loc[weekday.groupby("trip_id").stop_sequence.idxmin()]
        per_hour = (starts.arrival_s // 3600).value_counts().sort_index()
        directions.append({
            "direction_id": direction_id, "headsign": sample.trip_headsign.iloc[0],
            "main_shape_id": main_shape, "length_m": stop_rows[-1]["dist_from_start_m"],
            "scheduled_run_s": stop_rows[-1]["scheduled_from_start_s"], "trips": trip_counts(group),
            "first_departure": starts.arrival_time.iloc[starts.arrival_s.argmin()],
            "last_departure": starts.arrival_time.iloc[starts.arrival_s.argmax()],
            "weekday_trips_by_start_hour": {f"{int(h):02d}": int(n) for h, n in per_hour.items()},
            "stops": stop_rows, "patterns": patterns,
        })

    result = {
        "route_id": route.route_id, "route_short_name": route.route_short_name,
        "route_long_name": route.route_long_name,
        "mode": {"0": "streetcar", "3": "bus"}.get(route.route_type, route.route_type),
        "gtfs_feed_version": feed_version,
        "day_types": {day: sorted(ids) for day, ids in day_services.items()},
        "time_unit": "seconds; GTFS times after 24:00 continue past 86400",
        "interpretation": "Scheduled reference only; not observed headways or travel times.",
        "directions": directions, "source_ids": ["ttc-gtfs"],
    }
    write_json(reviewed / f"route_{route_short_name}.json", result)
    return result


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--route", default="505")
    args = parser.parse_args()
    result = export_route(args.route)
    for direction in result["directions"]:
        print(direction["headsign"], len(direction["stops"]), "stops", direction["trips"])


if __name__ == "__main__":
    main()
