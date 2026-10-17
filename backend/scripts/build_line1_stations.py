"""Extract Line 1 (Yonge-University) station points from the retained TTC GTFS.

Run from the repository root with python -m backend.scripts.build_line1_stations.
Requires data/raw/ttc_gtfs.zip (same feed used for route_505.json). Each station
point is the mean of its Line 1 platform coordinates: a station location, not an
entrance. Used only by the 750 m commute routing rule.
"""

import csv
import io
import json
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path
from zipfile import ZipFile

from data.sources.base import checksum

ROOT = Path(__file__).resolve().parents[2]
FEED = ROOT / "data/raw/ttc_gtfs.zip"
OUTPUT = ROOT / "data/reviewed/line1_stations.json"
LINE1_ROUTE_ID = "1"


def _rows(archive: ZipFile, name: str):
    with archive.open(name) as stream:
        yield from csv.DictReader(io.TextIOWrapper(stream, encoding="utf-8-sig"))


def build_line1_stations(feed: Path = FEED) -> dict:
    with ZipFile(feed) as archive:
        feed_version = next(_rows(archive, "feed_info.txt"))["feed_version"]
        trips = {t["trip_id"] for t in _rows(archive, "trips.txt") if t["route_id"] == LINE1_ROUTE_ID}
        platform_ids = {st["stop_id"] for st in _rows(archive, "stop_times.txt") if st["trip_id"] in trips}
        stops = {s["stop_id"]: s for s in _rows(archive, "stops.txt") if s["stop_id"] in platform_ids}

    grouped: dict[str, list[dict]] = defaultdict(list)
    for stop in stops.values():
        grouped[stop["stop_name"].split(" - ")[0].strip()].append(stop)
    if len(grouped) < 30:
        raise ValueError(f"Expected the full Line 1 station list, found {len(grouped)}")

    stations = [
        {
            "station_id": f"ttc-line1-{name.lower().replace(' ', '-').replace(chr(39), '')}",
            "name": name,
            "latitude": round(sum(float(p["stop_lat"]) for p in platforms) / len(platforms), 6),
            "longitude": round(sum(float(p["stop_lon"]) for p in platforms) / len(platforms), 6),
            "gtfs_platform_stop_ids": sorted(p["stop_id"] for p in platforms),
        }
        for name, platforms in sorted(grouped.items())
    ]
    return {
        "schema_version": 1,
        "route": "TTC Line 1 Yonge-University",
        "gtfs_feed_version": feed_version,
        "gtfs_sha256": checksum(feed),
        "built_at": datetime.now(timezone.utc).isoformat(),
        "coordinate_method": "Mean of the station's Line 1 platform coordinates; not an entrance",
        "source_ids": ["ttc-gtfs"],
        "stations": stations,
    }


def main() -> None:
    payload = build_line1_stations()
    OUTPUT.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"Wrote {len(payload['stations'])} Line 1 stations to {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
