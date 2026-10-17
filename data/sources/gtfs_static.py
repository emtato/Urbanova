"""Extract a dated, one-direction streetcar corridor from official GTFS."""
import csv
import io
from collections import Counter, defaultdict
from datetime import date
from pathlib import Path
from statistics import median
from zipfile import ZipFile

from pyproj import Transformer
from shapely.geometry import LineString, Point, mapping
from shapely.ops import substring, transform


def seconds(value: str) -> int:
    """GTFS hours may exceed 24; never wrap them onto another service day."""
    hour, minute, second = map(int, value.split(":"))
    if hour < 0 or not 0 <= minute < 60 or not 0 <= second < 60:
        raise ValueError(f"Invalid GTFS time: {value}")
    return hour * 3600 + minute * 60 + second


def active_services(calendar: list[dict], exceptions: list[dict], day: date) -> set[str]:
    stamp = day.strftime("%Y%m%d")
    weekday = ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")[day.weekday()]
    active = {
        row["service_id"] for row in calendar
        if row["start_date"] <= stamp <= row["end_date"] and row[weekday] == "1"
    }
    for row in exceptions:
        if row["date"] == stamp:
            if row["exception_type"] == "1":
                active.add(row["service_id"])
            elif row["exception_type"] == "2":
                active.discard(row["service_id"])
            else:
                raise ValueError("Unknown GTFS calendar exception")
    return active


def _rows(archive: ZipFile, filename: str):
    if filename not in archive.namelist():
        return
    with archive.open(filename) as stream:
        yield from csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig"))


def extract_corridor(feed_path: Path, *, service_date: date,
                     start_time: str = "07:00:00", end_time: str = "09:00:00",
                     route_short_name: str = "505", direction_id: str = "0",
                     start_stop_id: str = "2118", end_stop_id: str = "2115") -> dict:
    start_s, end_s = seconds(start_time), seconds(end_time)
    if end_s <= start_s:
        raise ValueError("End of the analysis window must follow its start")
    with ZipFile(feed_path) as archive:
        services = active_services(list(_rows(archive, "calendar.txt")),
                                   list(_rows(archive, "calendar_dates.txt")), service_date)
        routes = [r for r in _rows(archive, "routes.txt")
                  if r["route_short_name"] == route_short_name and r["route_type"] == "0"]
        if len(routes) != 1:
            raise ValueError("Expected exactly one matching streetcar route")
        route = routes[0]
        stops = {r["stop_id"]: r for r in _rows(archive, "stops.txt")}
        trips = {r["trip_id"]: r for r in _rows(archive, "trips.txt")
                 if r["route_id"] == route["route_id"]
                 and r["direction_id"] == direction_id and r["service_id"] in services}
        by_trip = defaultdict(list)
        for row in _rows(archive, "stop_times.txt"):
            if row["trip_id"] in trips:
                by_trip[row["trip_id"]].append(row)
        segments = {}
        for trip_id, rows in by_trip.items():
            ordered = sorted(rows, key=lambda r: int(r["stop_sequence"]))
            ids = [r["stop_id"] for r in ordered]
            if len(ids) != len(set(ids)):
                # Reject ambiguous loops rather than picking an arbitrary endpoint occurrence.
                if ids.count(start_stop_id) > 1 or ids.count(end_stop_id) > 1:
                    continue
            if start_stop_id not in ids or end_stop_id not in ids:
                continue
            first, last = ids.index(start_stop_id), ids.index(end_stop_id)
            if first >= last:
                continue
            segment = ordered[first:last + 1]
            for row in segment:
                if seconds(row["departure_time"]) < seconds(row["arrival_time"]):
                    raise ValueError("GTFS departure precedes arrival")
            for left, right in zip(segment, segment[1:]):
                if seconds(right["arrival_time"]) <= seconds(left["departure_time"]):
                    raise ValueError("Non-positive scheduled corridor link time")
            if start_s <= seconds(segment[0]["arrival_time"]) < end_s:
                if any(r.get("pickup_type", "0") == "1" for r in segment):
                    continue
                segments[trip_id] = segment
        patterns = {tuple(r["stop_id"] for r in rows) for rows in segments.values()}
        if len(patterns) != 1:
            raise ValueError(f"Expected one unambiguous corridor pattern; found {len(patterns)}")
        stop_ids = next(iter(patterns))
        shape_counts = Counter(trips[t]["shape_id"] for t in segments)
        shape_id = shape_counts.most_common(1)[0][0]
        shape_rows = [r for r in _rows(archive, "shapes.txt") if r["shape_id"] == shape_id]
        shape_rows.sort(key=lambda r: int(r["shape_pt_sequence"]))
        display_line = LineString([(float(r["shape_pt_lon"]), float(r["shape_pt_lat"])) for r in shape_rows])
        forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
        reverse = Transformer.from_crs(26917, 4326, always_xy=True).transform
        metric_line = transform(forward, display_line)
        stop_records, offsets = [], []
        for seq, stop_id in enumerate(stop_ids):
            row = stops[stop_id]
            point = Point(float(row["stop_lon"]), float(row["stop_lat"]))
            metric_point = transform(forward, point)
            offset = metric_line.project(metric_point)
            if metric_point.distance(metric_line) > 100:
                raise ValueError("GTFS stop is too far from its route shape")
            if offsets and offset <= offsets[-1]:
                raise ValueError("GTFS shape does not follow the corridor stop order")
            offsets.append(offset)
            stop_records.append({
                "stop_id": f"ttc-stop-{stop_id}", "gtfs_stop_id": stop_id,
                "name": row["stop_name"], "seq": seq,
                "lon": point.x, "lat": point.y,
                "source_ids": ["ttc-gtfs"],
            })
        links = []
        for index, (left, right) in enumerate(zip(stop_records, stop_records[1:])):
            durations = []
            for trip_id, rows in segments.items():
                durations.append(seconds(rows[index + 1]["arrival_time"]) - seconds(rows[index]["departure_time"]))
            clipped = substring(metric_line, offsets[index], offsets[index + 1])
            links.append({
                "link_id": f"ttc-505-east-link-{index + 1}",
                "from_stop": left["stop_id"], "to_stop": right["stop_id"],
                "length_m": round(clipped.length, 2),
                "scheduled_time_s": median(durations),
                "scheduled_time_range_s": [min(durations), max(durations)],
                "geometry": mapping(transform(reverse, clipped)),
                "source_ids": ["ttc-gtfs"],
            })
        departures = []
        for trip_id, rows in sorted(segments.items(), key=lambda item: seconds(item[1][0]["arrival_time"])):
            departures.append({
                "trip_id": trip_id, "service_id": trips[trip_id]["service_id"],
                "headsign": trips[trip_id]["trip_headsign"], "shape_id": trips[trip_id]["shape_id"],
                "entry_time": rows[0]["arrival_time"],
                "entry_t_s": seconds(rows[0]["arrival_time"]) - start_s,
                "arrival_t_s": [seconds(r["arrival_time"]) - start_s for r in rows],
                "departure_t_s": [seconds(r["departure_time"]) - start_s for r in rows],
                "timepoints": [r.get("timepoint", "") for r in rows],
            })
        entry_times = [r["entry_t_s"] for r in departures]
        headways = [b - a for a, b in zip(entry_times, entry_times[1:])]
        feed_info = list(_rows(archive, "feed_info.txt"))
    return {
        "corridor_id": "ttc-505-east-jarvis-broadview", "route_id": route["route_id"],
        "route_short_name": route_short_name, "route_type": 0, "direction_id": direction_id,
        "direction": "eastbound", "timezone": "America/Toronto",
        "service_date": service_date.isoformat(), "window": {"start": start_time, "end": end_time},
        "window_status": "assumed", "gtfs_feed_info": feed_info,
        "active_service_ids": sorted(services), "shape_id": shape_id,
        "stops": stop_records, "links": links, "scheduled_trips": departures,
        "summary": {
            "stop_count": len(stop_records), "trip_count": len(departures),
            "length_m": round(sum(r["length_m"] for r in links), 2),
            "median_scheduled_headway_s": median(headways) if headways else None,
            "median_scheduled_segment_time_s": median(r["arrival_t_s"][-1] - r["arrival_t_s"][0] for r in departures),
        },
        "incoming_load": {"status": "assumed", "value": None, "reason": "No observed incoming passenger load supplied."},
        "interpretation": "Scheduled weekday scenario experiment; GTFS times are not observed travel times or dwell measurements.",
        "source_ids": ["ttc-gtfs"],
    }
