"""Build the reviewed 505 corridor and development evidence from cached official files."""
import argparse
import csv
import json
from datetime import date
from pathlib import Path
from urllib.parse import urlencode

from pyproj import Transformer
from shapely.geometry import Point

from backend.config import ROOT_DIR
from data.sources.base import checksum, fetch_cached, record_source
from data.sources.gtfs_static import extract_corridor

CATALOG = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action"
LICENCE = "https://open.toronto.ca/open-data-licence/"
ADDRESS_RESOURCE = "0b3756af-9caf-4f0f-ac28-9c6617adede4"


def write_json(path: Path, value) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def cached(url: str, path: Path, *, refresh: bool, adopt_existing: bool) -> Path:
    stamp = path.with_suffix(path.suffix + ".meta.json")
    if adopt_existing and path.exists() and not stamp.exists() and not refresh:
        write_json(stamp, {"url": url, "sha256": checksum(path),
                          "retrieved_at": record_source(path, source_id="", title="", url=url,
                                                       publisher="", version="", licence="")["retrieved_at"]})
    return fetch_cached(url, path, refresh=refresh)


def write_csv(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        for row in rows:
            writer.writerow({key: json.dumps(value) if isinstance(value, (list, dict)) else value
                             for key, value in row.items()})


def build(*, refresh: bool = False, adopt_existing: bool = False) -> dict:
    cache, raw, reviewed = (ROOT_DIR / "data" / name for name in ("cache", "raw", "reviewed"))
    selection = json.loads((reviewed / "project_selection.json").read_text())
    source_records = []
    metadata = {}
    for key, dataset in (("gtfs", "merged-gtfs-ttc-routes-and-schedules"), ("pipeline", "development-pipeline")):
        url = f"{CATALOG}/package_show?id={dataset}"
        path = cached(url, cache / f"{key}_metadata.json", refresh=refresh, adopt_existing=adopt_existing)
        response = json.loads(path.read_text(encoding="utf-8-sig"))
        if not response.get("success"):
            raise ValueError(f"Catalogue metadata failed: {dataset}")
        metadata[key] = response["result"]
    gtfs_resource = next(r for r in metadata["gtfs"]["resources"] if r["format"].upper() == "ZIP")
    pipeline_resource = next(r for r in metadata["pipeline"]["resources"] if r["name"] == "Development Pipeline.csv")
    gtfs_path = cached(gtfs_resource["url"], raw / "ttc_gtfs.zip", refresh=refresh, adopt_existing=adopt_existing)
    pipeline_path = cached(pipeline_resource["url"], raw / "development_pipeline.csv", refresh=refresh, adopt_existing=adopt_existing)
    route = selection["corridor"]
    corridor = extract_corridor(
        gtfs_path, service_date=date.fromisoformat(selection["service_date"]),
        start_time=selection["window"]["start"], end_time=selection["window"]["end"],
        route_short_name=route["route_short_name"], direction_id=route["direction_id"],
        start_stop_id=route["start_stop_id"], end_stop_id=route["end_stop_id"],
        corridor_id=selection["corridor_id"], direction=route["direction"],
    )
    source_records.append(record_source(
        gtfs_path, source_id="ttc-gtfs", title=metadata["gtfs"]["title"],
        url=gtfs_resource["url"], publisher="Toronto Transit Commission / City of Toronto",
        version=corridor["gtfs_feed_info"][0]["feed_version"], licence=LICENCE,
    ))
    source_records.append(record_source(
        pipeline_path, source_id="toronto-development-pipeline",
        title=metadata["pipeline"]["title"], url=pipeline_resource["url"],
        publisher="City of Toronto / City Planning", version=pipeline_resource["last_modified"], licence=LICENCE,
    ))
    with pipeline_path.open(encoding="utf-8-sig", newline="") as stream:
        pipeline = list(csv.DictReader(stream))
    forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
    shortlist = []
    for project in selection["projects"]:
        matches = [row for row in pipeline if row["Application Number"] == project["application_number"]]
        if len(matches) != 1:
            raise ValueError(f"Application must identify exactly one project: {project['application_number']}")
        row = matches[0]
        if row["Address"].strip().casefold() != project["address"].casefold():
            raise ValueError("Reviewed application address changed")
        params = {"resource_id": ADDRESS_RESOURCE,
                  "filters": json.dumps({"ADDRESS_FULL": project["address"]}), "limit": 100}
        url = CATALOG + "/datastore_search?" + urlencode(params)
        path = cache / (project["address"].replace(" ", "_") + ".json")
        # Earlier exploration wrapped the exact source payload; preserve the wrapper for provenance.
        if path.exists() and adopt_existing and not path.with_suffix(path.suffix + ".meta.json").exists():
            existing = json.loads(path.read_text(encoding="utf-8-sig"))
            if existing.get("url") != url:
                raise ValueError("Cached address URL mismatch")
        path = cached(url, path, refresh=refresh, adopt_existing=adopt_existing)
        address_data = json.loads(path.read_text(encoding="utf-8-sig"))
        address_data = address_data.get("payload", address_data)
        points = address_data["result"]["records"]
        if not points:
            raise ValueError(f"No official address point: {project['address']}")
        points.sort(key=lambda point: int(point["ADDRESS_POINT_ID"]))
        point = points[0]
        coordinates = json.loads(point["geometry"])["coordinates"]
        origin = Point(*forward(*coordinates))
        ranked = sorted(
            (round(origin.distance(Point(*forward(stop["lon"], stop["lat"]))), 2), stop["stop_id"])
            for stop in corridor["stops"]
        )
        source_id = "toronto-address-" + str(point["ADDRESS_POINT_ID"])
        address_source = record_source(
            path, source_id=source_id, title="Toronto One Address Repository: " + project["address"],
            url=url, publisher="City of Toronto", version="retrieved snapshot", licence=LICENCE,
        )
        source_records.append(address_source)
        item = {
            "dev_id": "toronto-app-" + row["Application Number"].replace(" ", "-").lower(),
            "application_number": row["Application Number"], "pipeline_row_id": row["_id"],
            "address": row["Address"].strip(), "proposed_units": int(row["Proposed Residential Units"]),
            "stage": row["Pipeline Status"], "application_received": row["Date Received"],
            "dataset_updated_at": pipeline_resource["last_modified"],
            "retrieved_at": source_records[1]["retrieved_at"], "lon": coordinates[0], "lat": coordinates[1],
            "address_point_id": point["ADDRESS_POINT_ID"], "nearest_stop_id": ranked[0][1],
            "straight_line_distance_m": ranked[0][0],
            "walk_distance_m": "", "walk_status": "pending_network_check",
            "selected": project["selected"], "review_note": project["reason"],
            "source_ids": "toronto-development-pipeline;" + source_id + ";ttc-gtfs",
            "application_url": row["Application Information Centre Link"],
        }
        if item["selected"] and (item["proposed_units"] <= 0 or item["straight_line_distance_m"] > selection["access_threshold_m"]):
            raise ValueError("Selected development fails the spatial/units screen")
        shortlist.append(item)
    selected = [r for r in shortlist if r["selected"]]
    if len(selected) != 3 or len({r["application_number"] for r in selected}) != 3:
        raise ValueError("Exactly three distinct applications must be selected")
    corridor["window_status"] = selection["window"]["status"]
    corridor["window_reason"] = selection["window"]["reason"]
    corridor["direction_reason"] = route["reason"]
    write_json(reviewed / "corridor.json", corridor)
    write_json(reviewed / "corridor.geojson", {
        "type": "FeatureCollection", "features": [
            {"type": "Feature", "properties": {k: v for k, v in link.items() if k != "geometry"},
             "geometry": link["geometry"]} for link in corridor["links"]
        ],
    })
    write_csv(reviewed / "stops.csv", corridor["stops"])
    write_csv(reviewed / "development_shortlist.csv", shortlist)
    write_csv(reviewed / "developments.csv", selected)
    write_json(reviewed / "sources.json", source_records)
    report = {
        "service_date": selection["service_date"], "window": selection["window"],
        "corridor": corridor["summary"], "developments": [
            {"address": r["address"], "proposed_units": r["proposed_units"],
             "stage": r["stage"], "nearest_stop_id": r["nearest_stop_id"],
             "straight_line_distance_m": r["straight_line_distance_m"],
             "walk_status": r["walk_status"]} for r in selected
        ],
        "missing_observations": [
            "Stop-level weekday passenger arrivals and destinations",
            "Incoming streetcar occupancy at " + corridor["stops"][0]["name"],
            "Observed dwell/boarding rates and travel-time variability",
            "Development occupancy dates and occupied shares",
            "Network walking distances and entrance/crossing review",
        ],
        "product_label": "scenario experiment", "contract_frozen": False,
    }
    write_json(reviewed / "feasibility_report.json", report)
    return report


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true", help="Explicitly replace cached source snapshots")
    parser.add_argument("--adopt-existing", action="store_true", help="Record checksums of the initial verified research downloads")
    parser.add_argument("--skip-walk", action="store_true", help="Build only the official-source spatial screen, leaving walk checks pending")
    args = parser.parse_args()
    report = build(refresh=args.refresh, adopt_existing=args.adopt_existing)
    if not args.skip_walk:
        from backend.scripts.check_walk_access import build_walk_access
        build_walk_access(refresh=args.refresh, adopt_existing=args.adopt_existing)
        report = json.loads((ROOT_DIR / "data/reviewed/feasibility_report.json").read_text())
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
