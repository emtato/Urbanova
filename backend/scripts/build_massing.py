"""Give every inventoried building a footprint and height, add proposal masses and sun positions.

Writes data/reviewed/buildings_3d.geojson for the 3D map and data/reviewed/sun_positions.json for shadows.
Footprints are the same OSM outlines as building_unit_inventory.json (matched by building_id).
Heights come from the City's 3D Massing (LiDAR, site plans or developer models) where it covers the
footprint, otherwise from storeys at an assumed storey height. Proposal masses are simplified boxes
sized from each application's storeys and floor area; they are not designs.

    python -m backend.scripts.build_massing
"""
import argparse
import csv
import json
import math
from collections import Counter
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

import pyogrio
from pyproj import Transformer
from shapely.geometry import Point, box, mapping
from shapely.ops import transform
from shapely.strtree import STRtree

from backend.scripts.build_simulation_data import CACHE, REVIEWED
from backend.scripts.prove_feasibility import write_json
from data.sources.base import fetch_cached, record_source
from data.sources.buildings import read_buildings
from data.sources.sun import shadow_length_m, solar_noon, solar_position

MASSING_URL = ("https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/387b2e3b-2a76-4199-8b3b-0b7d22e2ec10/"
               "resource/667237d6-4d3c-4cf3-8cb7-e91c48d59375/download/3dmassingshapefile_2025_wgs84.zip")
MASSING_LAYER = "3DMassingShapefile_2025_WGS84.shp"
LICENCE = "https://open.toronto.ca/open-data-licence/"
TIMEZONE = ZoneInfo("America/Toronto")
# Assumed floor-to-floor height for converting storeys to metres; a modelling choice, not a measurement.
STOREY_HEIGHT_M = 3.0
# Share of the OSM footprint that City massing must cover before its heights are adopted.
MEASURED_SHARE, PARTIAL_SHARE = 0.5, 0.2
KEY_DATES = {"spring_equinox": date(2026, 3, 20), "summer_solstice": date(2026, 6, 21),
             "autumn_equinox": date(2026, 9, 22), "winter_solstice": date(2026, 12, 21)}
PROPOSALS = {
    # Storeys and tower counts are quoted from each application description in the Development Pipeline.
    "22 124214 STE 13 OZ": {"storeys": 52, "towers": 1},
    "26 122451 STE 13 OZ": {"storeys": 35, "towers": 1},
    "25 236949 STE 13 OZ": {"storeys": 48, "towers": 2},
}

forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
inverse = Transformer.from_crs(26917, 4326, always_xy=True).transform


def to_lonlat(geometry):
    """GeoJSON geometry in EPSG:4326, rounded to 6 decimals (about 0.1 m)."""
    return json.loads(json.dumps(mapping(transform(inverse, geometry))), parse_float=lambda v: round(float(v), 6))


def load_massing(path, area):
    """City massing parts overlapping the area, in EPSG:26917 metres."""
    info = pyogrio.read_info(f"zip://{path}!{MASSING_LAYER}")
    to_layer = Transformer.from_crs(26917, info["crs"], always_xy=True).transform
    frame = pyogrio.read_dataframe(f"zip://{path}!{MASSING_LAYER}", bbox=transform(to_layer, area).bounds)
    frame = frame.set_crs(info["crs"], allow_override=True).to_crs(26917)
    frame["geometry"] = frame.geometry.force_2d().make_valid()
    return frame[frame.geometry.area > 0].reset_index(drop=True)


def adopt_heights(footprint, parts, index):
    """Area-weighted City heights for one OSM footprint, or None when coverage is too thin."""
    weighted, covered, tallest, lowest, sources = 0.0, 0.0, 0.0, None, Counter()
    for i in index.query(footprint):
        part = parts.iloc[int(i)]
        overlap = footprint.intersection(part.geometry).area
        if overlap <= 0:
            continue
        roof = part.AVG_HEIGHT if part.AVG_HEIGHT and part.AVG_HEIGHT > 0 else part.MAX_HEIGHT
        if not roof or roof <= 0:
            continue
        weighted += overlap * roof
        covered += overlap
        sources[part.HEIGHT_SRC] += overlap
        # Slivers of a neighbouring tower must not set this building's peak or lowest roof.
        if overlap >= 0.5 * part.geometry.area or overlap >= 0.25 * footprint.area:
            tallest = max(tallest, part.MAX_HEIGHT or roof)
            lowest = roof if lowest is None else min(lowest, roof)
    share = min(1.0, covered / footprint.area)
    if share < PARTIAL_SHARE:
        return None
    average = weighted / covered
    return {"height_m": round(average, 1), "max_height_m": round(max(tallest, average), 1),
            "min_roof_height_m": round(lowest if lowest is not None else average, 1),
            "massing_coverage_share": round(share, 2),
            "height_source": sources.most_common(1)[0][0],
            "height_status": "measured_city_massing" if share >= MEASURED_SHARE else "partial_city_massing"}


def sun_table(lat, lon):
    days = {f"2026-{month:02d}-21": date(2026, month, 21) for month in range(1, 13)}
    days.update({name: day for name, day in KEY_DATES.items()})
    table = []
    for label, day in days.items():
        noon = solar_noon(lat, lon, day)
        rows = []
        start = datetime(day.year, day.month, day.day, 5, 0, tzinfo=TIMEZONE)
        for step in range(0, 16 * 4 + 1):
            local = start + timedelta(minutes=15 * step)
            position = solar_position(lat, lon, local)
            rows.append({"local_time": local.strftime("%H:%M"), "utc_offset": local.strftime("%z"),
                         "altitude_deg": round(position["altitude_deg"], 2),
                         "azimuth_deg": round(position["azimuth_deg"], 2),
                         "sun_up": position["altitude_deg"] > 0,
                         "shadow_length_per_metre": None if position["altitude_deg"] <= 0
                         else round(shadow_length_m(1.0, position["altitude_deg"]), 3)})
        noon_position = solar_position(lat, lon, noon)
        table.append({"label": label, "date": day.isoformat(),
                      "solar_noon_local": noon.astimezone(TIMEZONE).strftime("%H:%M"),
                      "solar_noon_altitude_deg": round(noon_position["altitude_deg"], 2),
                      "positions": rows})
    return table


def build(*, refresh=False):
    inventory = json.loads((REVIEWED / "building_unit_inventory.json").read_text(encoding="utf-8"))
    sources = json.loads((REVIEWED / "simulation_sources.json").read_text(encoding="utf-8"))
    osm_sources = [s for s in sources if s["source_id"].startswith("osm-housing-")]
    paths = [fetch_cached(s["url"], CACHE / ("housing_walk_" + s["source_id"].removeprefix("osm-housing-") + ".osm"), refresh=refresh)
             for s in osm_sources]
    footprints = {row["id"]: row["geometry"] for row in read_buildings(paths, forward)}
    missing = [b["building_id"] for b in inventory if b["building_id"] not in footprints]
    if missing:
        raise ValueError(f"{len(missing)} inventory buildings have no OSM footprint, e.g. {missing[:3]}; rebuild the inventory first")

    massing_path = fetch_cached(MASSING_URL, CACHE.parent / "raw" / "3d_massing_2025_wgs84.zip", refresh=refresh)
    bounds = [footprints[b["building_id"]].bounds for b in inventory]
    area = box(min(b[0] for b in bounds) - 50, min(b[1] for b in bounds) - 50,
               max(b[2] for b in bounds) + 50, max(b[3] for b in bounds) + 50)
    parts = load_massing(massing_path, area)
    index = STRtree(list(parts.geometry))

    developments = list(csv.DictReader((REVIEWED / "developments.csv").open(encoding="utf-8", newline="")))
    pipeline = {r["Application Number"]: r for r in csv.DictReader((CACHE.parent / "raw" / "development_pipeline.csv").open(encoding="utf-8-sig"))}
    site_points = {d["dev_id"]: Point(*forward(float(d["lon"]), float(d["lat"]))) for d in developments}

    centre = area.centroid
    lon0, lat0 = inverse(centre.x, centre.y)
    noon_altitudes = {name: solar_position(lat0, lon0, solar_noon(lat0, lon0, day))["altitude_deg"]
                      for name, day in KEY_DATES.items() if name != "autumn_equinox"}

    features, statuses = [], Counter()
    for building in inventory:
        footprint = footprints[building["building_id"]]
        adopted = adopt_heights(footprint, parts, index)
        if adopted is None:
            storeys = building["storeys"]
            adopted = {"height_m": round(storeys * STOREY_HEIGHT_M, 1), "max_height_m": round(storeys * STOREY_HEIGHT_M, 1),
                       "min_roof_height_m": None, "massing_coverage_share": 0.0, "height_source": None,
                       "height_status": "estimated_from_osm_storeys" if building["storeys_status"] == "osm_posted"
                       else "estimated_from_assumed_storeys"}
        statuses[adopted["height_status"]] += 1
        on_site = [dev_id for dev_id, point in site_points.items() if footprint.buffer(5).contains(point)]
        features.append({"type": "Feature", "geometry": to_lonlat(footprint), "properties": {
            "building_id": building["building_id"], "kind": "existing", "name": building["name"],
            "address": building["address"], "building_type": building["building_type"],
            "footprint_m2": building["footprint_m2"], "storeys": building["storeys"],
            "storeys_status": building["storeys_status"], **adopted,
            "base_height_m": 0.0,
            "shadow_at_solar_noon_m": {name: round(shadow_length_m(adopted["height_m"], alt), 1) for name, alt in noon_altitudes.items()},
            "on_proposal_site": on_site[0] if on_site else None,
            "included_in_simulation": building["included_in_simulation"],
            "source_ids": ["osm-housing", "toronto-3d-massing-2025"] if adopted["height_source"] else ["osm-housing"],
            "source_url": building["source_url"],
        }})

    for development in developments:
        spec = PROPOSALS[development["application_number"]]
        record = pipeline[development["application_number"]]
        total_gfa = float(record["Proposed Gross Floor Area"])
        height = spec["storeys"] * STOREY_HEIGHT_M
        side = math.sqrt(total_gfa / spec["storeys"] / spec["towers"])
        centre_point = site_points[development["dev_id"]]
        offsets = [0.0] if spec["towers"] == 1 else [-(side / 2 + 10), side / 2 + 10]
        for number, offset in enumerate(offsets, start=1):
            mass = box(centre_point.x + offset - side / 2, centre_point.y - side / 2,
                       centre_point.x + offset + side / 2, centre_point.y + side / 2)
            features.append({"type": "Feature", "geometry": to_lonlat(mass), "properties": {
                "building_id": f"{development['dev_id']}-tower-{number}", "kind": "proposed",
                "dev_id": development["dev_id"], "application_number": development["application_number"],
                "address": development["address"], "storeys": spec["storeys"], "storeys_status": "application_description",
                "height_m": round(height, 1), "max_height_m": round(height, 1), "base_height_m": 0.0,
                "height_status": "assumed_from_application_storeys", "footprint_m2": round(mass.area, 1),
                "footprint_status": "assumed_square_from_total_gfa_per_storey",
                "shadow_at_solar_noon_m": {name: round(shadow_length_m(height, alt), 1) for name, alt in noon_altitudes.items()},
                "label": "Simplified mass from the application's storeys and floor area; not an approved design.",
                "source_ids": development["source_ids"].split(";"), "source_url": development["application_url"],
            }})

    massing_source = record_source(massing_path, source_id="toronto-3d-massing-2025", title="3D Massing (2025, WGS84 shapefile)",
                                   url=MASSING_URL, publisher="City of Toronto", version="DBF last updated 2025-12-02; LiDAR heights from 2015",
                                   licence=LICENCE)
    metadata = {
        "corridor_id": json.loads((REVIEWED / "corridor.json").read_text())["corridor_id"],
        "building_count": len(inventory), "proposal_mass_count": sum(1 for f in features if f["properties"]["kind"] == "proposed"),
        "height_status_counts": dict(statuses), "storey_height_m": STOREY_HEIGHT_M,
        "storey_height_status": "assumed",
        "coverage_thresholds": {"measured": MEASURED_SHARE, "partial": PARTIAL_SHARE},
        "height_definition": ("height_m is the area-weighted average roof height above ground; extrude from base_height_m to height_m. "
                              "max_height_m is the tallest roof of City massing parts that substantially overlap the footprint; one City part can "
                              "span a podium and tower mapped as separate OSM buildings, so max_height_m is context, not an extrusion height."),
        "shadow_definition": "shadow_at_solar_noon_m is the flat-ground shadow length at solar noon, ignoring terrain and neighbouring buildings.",
        "interpretation": "Existing heights are City measurements where available and labelled estimates otherwise. Proposal masses are simplified boxes, not designs.",
        "sources": [massing_source] + osm_sources,
    }
    write_json(REVIEWED / "buildings_3d.geojson", {"type": "FeatureCollection", "metadata": metadata, "features": features})
    write_json(REVIEWED / "sun_positions.json", {
        "location": {"lat": round(lat0, 6), "lon": round(lon0, 6), "description": "Centre of the building inventory"},
        "timezone": "America/Toronto", "method": "NOAA solar position equations; refraction ignored",
        "azimuth_convention": "degrees clockwise from true north; shadows point to azimuth + 180",
        "shadow_length_per_metre": "horizontal shadow length on flat ground per metre of building height",
        "days": sun_table(lat0, lon0),
    })
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--refresh", action="store_true", help="Replace cached source snapshots")
    args = parser.parse_args()
    metadata = build(refresh=args.refresh)
    print(json.dumps({k: v for k, v in metadata.items() if k != "sources"}, indent=2))


if __name__ == "__main__":
    main()
