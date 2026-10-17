import csv
import io
import json
from datetime import date
from unittest.mock import patch
from zipfile import ZipFile

import pytest

from backend.config import ROOT_DIR
from data.sources.base import fetch_cached
from data.sources.gtfs_static import active_services, extract_corridor, seconds
from sim.tiny_case import verify_tiny_case


def calendar():
    return [{"service_id": "weekday", "monday": "1", "tuesday": "1", "wednesday": "1",
             "thursday": "1", "friday": "1", "saturday": "0", "sunday": "0",
             "start_date": "20261001", "end_date": "20261031"}]


def test_calendar_exception_replaces_weekday_service():
    exceptions = [{"date": "20261012", "service_id": "weekday", "exception_type": "2"},
                  {"date": "20261012", "service_id": "holiday", "exception_type": "1"}]
    assert active_services(calendar(), exceptions, date(2026, 10, 12)) == {"holiday"}
    assert active_services(calendar(), exceptions, date(2026, 10, 16)) == {"weekday"}
    assert active_services(calendar(), exceptions, date(2026, 11, 2)) == set()


def test_gtfs_time_after_midnight_and_invalid_minutes():
    assert seconds("25:02:03") == 90123
    with pytest.raises(ValueError):
        seconds("07:61:00")


def make_feed(path, *, reverse=False, after_midnight=False):
    def table(rows):
        stream = io.StringIO()
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
        return stream.getvalue()
    stops = [
        {"stop_id": "2118", "stop_name": "Jarvis", "stop_lon": -79.374706, "stop_lat": 43.656947},
        {"stop_id": "999", "stop_name": "Middle", "stop_lon": -79.368653, "stop_lat": 43.658752},
        {"stop_id": "2115", "stop_name": "Broadview", "stop_lon": -79.351814, "stop_lat": 43.662249},
    ]
    hour = 25 if after_midnight else 7
    ordered = list(reversed(stops)) if reverse else stops
    tables = {
        "routes.txt": [{"route_id": "505", "route_short_name": "505", "route_type": "0"}],
        "calendar.txt": calendar(),
        "trips.txt": [{"trip_id": "trip-1", "route_id": "505", "direction_id": "0",
                       "service_id": "weekday", "shape_id": "shape-1", "trip_headsign": "East"}],
        "stops.txt": stops,
        "stop_times.txt": [
            {"trip_id": "trip-1", "stop_id": stop["stop_id"], "stop_sequence": index + 1,
             "arrival_time": f"{hour:02d}:{index * 2:02d}:00",
             "departure_time": f"{hour:02d}:{index * 2:02d}:00", "pickup_type": "0", "timepoint": "1"}
            for index, stop in enumerate(ordered)
        ],
        "shapes.txt": [
            {"shape_id": "shape-1", "shape_pt_lon": stop["stop_lon"],
             "shape_pt_lat": stop["stop_lat"], "shape_pt_sequence": index + 1}
            for index, stop in enumerate(ordered)
        ],
    }
    with ZipFile(path, "w") as archive:
        for name, rows in tables.items():
            archive.writestr(name, table(rows))


@pytest.mark.parametrize("after_midnight", [False, True])
def test_corridor_extraction_uses_date_order_times_and_metric_shape(tmp_path, after_midnight):
    path = tmp_path / "feed.zip"
    make_feed(path, after_midnight=after_midnight)
    start, end = ("25:00:00", "26:00:00") if after_midnight else ("07:00:00", "08:00:00")
    bundle = extract_corridor(path, service_date=date(2026, 10, 16), start_time=start, end_time=end)
    assert [s["gtfs_stop_id"] for s in bundle["stops"]] == ["2118", "999", "2115"]
    assert bundle["summary"]["trip_count"] == 1
    assert bundle["summary"]["median_scheduled_segment_time_s"] == 240
    assert all(link["scheduled_time_s"] == 120 for link in bundle["links"])
    assert 1900 < bundle["summary"]["length_m"] < 2200
    assert bundle["scheduled_trips"][0]["entry_t_s"] == 0


def test_wrong_endpoint_order_is_not_silently_accepted(tmp_path):
    path = tmp_path / "feed.zip"
    make_feed(path, reverse=True)
    with pytest.raises(ValueError, match="unambiguous"):
        extract_corridor(path, service_date=date(2026, 10, 16))


def test_download_cache_reuses_content_and_detects_tampering(tmp_path):
    path = tmp_path / "source.bin"
    with patch("data.sources.base.urlopen", return_value=io.BytesIO(b"source-data")) as download:
        fetch_cached("https://example.com/source", path)
        fetch_cached("https://example.com/source", path)
        assert download.call_count == 1
    path.write_bytes(b"modified")
    with pytest.raises(ValueError, match="checksum"):
        fetch_cached("https://example.com/source", path)


def test_reviewed_evidence_has_sources_and_matching_geometries():
    reviewed = ROOT_DIR / "data/reviewed"
    bundle = json.loads((reviewed / "corridor.json").read_text())
    selection = json.loads((reviewed / "project_selection.json").read_text())
    sources = {s["source_id"]: s for s in json.loads((reviewed / "sources.json").read_text())}
    assert bundle["corridor_id"] == selection["corridor_id"]
    assert bundle["direction_id"] == selection["corridor"]["direction_id"]
    assert len(bundle["stops"]) == 7
    assert len(bundle["links"]) == 6
    assert bundle["stops"][0]["gtfs_stop_id"] == selection["corridor"]["start_stop_id"]
    assert bundle["stops"][-1]["gtfs_stop_id"] == selection["corridor"]["end_stop_id"]
    assert len({s["stop_id"] for s in bundle["stops"]}) == 7
    assert all(source["sha256"] and source["retrieved_at"] and source["licence"] for source in sources.values())
    with (reviewed / "developments.csv").open(newline="") as stream:
        projects = list(csv.DictReader(stream))
    assert len(projects) == 3
    assert len({p["application_number"] for p in projects}) == 3
    for project in projects:
        assert int(project["proposed_units"]) > 0
        assert 0 < float(project["straight_line_distance_m"]) <= float(project["walk_distance_m"]) <= 500
        assert all(source_id in sources for source_id in project["source_ids"].split(";"))


def test_route_reference_contains_the_corridor_in_order():
    reviewed = ROOT_DIR / "data/reviewed"
    bundle = json.loads((reviewed / "corridor.json").read_text())
    route = json.loads((reviewed / "route_505.json").read_text())
    direction = next(d for d in route["directions"] if d["direction_id"] == bundle["direction_id"])
    marked = [s["corridor_stop_id"] for s in direction["stops"] if s["corridor_stop_id"]]
    assert marked == [s["stop_id"] for s in bundle["stops"]]
    positions = [i for i, s in enumerate(direction["stops"]) if s["corridor_stop_id"]]
    assert positions == list(range(positions[0], positions[0] + len(positions)))
    start, end = direction["stops"][positions[0]], direction["stops"][positions[-1]]
    assert abs((end["dist_from_start_m"] - start["dist_from_start_m"]) - bundle["summary"]["length_m"]) < 50


def test_hand_calculated_streetcar_case_conserves_all_ten_riders():
    result = verify_tiny_case()
    assert result["arrived"] == 8
    assert result["waiting"] == 2
    assert result["mean_completed_wait_s"] == 41.25
    assert result["passengers"]["A5"]["denied_once"]
    assert result["passengers"]["A5"]["status"] == "arrived"
    assert result["passengers"]["B5"]["status"] == "waiting"
    assert result == verify_tiny_case()
