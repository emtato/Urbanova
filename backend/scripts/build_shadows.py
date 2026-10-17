"""Ground shadows today and with the proposals, for a set of dates and times.

Reads data/reviewed/buildings_3d.geojson (run build_massing first) and writes
data/reviewed/shadows.geojson. For each time there are three layers:
  today   - open ground shaded by existing buildings
  added   - ground that is sunny today and shaded with the proposals
  removed - ground that is shaded today and sunny once the proposal sites are cleared
The view with the proposals is today, plus added, minus removed. Ground under a building in
either scenario is left out of added/removed. The file is written without indentation to stay small.

    python -m backend.scripts.build_shadows                          # default dates and times
    python -m backend.scripts.build_shadows --at 2026-12-21T15:00     # one or more custom times
"""
import argparse
import json
from datetime import datetime
from zoneinfo import ZoneInfo

from pyproj import Transformer
from shapely import make_valid, set_precision
from shapely.geometry import MultiPolygon, box, mapping, shape
from shapely.ops import transform, unary_union

from backend.scripts.build_simulation_data import REVIEWED
from data.sources.shadows import ground_shadow
from data.sources.sun import solar_position

TIMEZONE = ZoneInfo("America/Toronto")
DEFAULT_DATES = {"spring_equinox": "2026-03-20", "summer_solstice": "2026-06-21", "winter_solstice": "2026-12-21"}
DEFAULT_TIMES = ["09:00", "12:00", "15:00", "18:00"]
# Simplification tolerance in metres; keeps the file small without visibly moving edges.
SIMPLIFY_M = 0.5
# Polygon pieces smaller than this are numerical slivers from the overlays.
MIN_PIECE_M2 = 1.0

forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
inverse = Transformer.from_crs(26917, 4326, always_xy=True).transform


def polygons_only(geometry, min_area=MIN_PIECE_M2):
    """Keep the polygon pieces of an overlay result, dropping stray lines, points and slivers."""
    pieces = []
    for part in getattr(geometry, "geoms", [geometry]):
        if part.geom_type == "Polygon" and part.area >= min_area:
            pieces.append(part)
        elif part.geom_type in ("MultiPolygon", "GeometryCollection"):
            pieces += list(polygons_only(part, min_area).geoms)
    return MultiPolygon(pieces)


def to_lonlat(geometry):
    """Simplify in metres, then snap to a 6-decimal lon/lat grid and repair, so every output polygon is valid."""
    lonlat = transform(inverse, geometry.simplify(SIMPLIFY_M, preserve_topology=True))
    snapped = make_valid(set_precision(lonlat, 1e-6))
    return mapping(polygons_only(snapped, min_area=0))


def load_buildings():
    layer = json.loads((REVIEWED / "buildings_3d.geojson").read_text(encoding="utf-8"))
    today, future = [], []
    for feature in layer["features"]:
        props = feature["properties"]
        item = (transform(forward, shape(feature["geometry"])), props["height_m"])
        if props["kind"] == "existing":
            today.append(item)
            if not props.get("on_proposal_site"):
                future.append(item)
        else:
            future.append(item)
    return layer, today, future


def snapshot(label, when, today, future, area, centre):
    sun = solar_position(*centre, when)
    base = {"label": label, "local_time": when.strftime("%Y-%m-%dT%H:%M"), "utc_offset": when.strftime("%z"),
            "sun_altitude_deg": round(sun["altitude_deg"], 2), "sun_azimuth_deg": round(sun["azimuth_deg"], 2)}
    if sun["altitude_deg"] <= 0:
        return [], {**base, "sun_up": False}
    alt, az = sun["altitude_deg"], sun["azimuth_deg"]
    today_shade = ground_shadow(today, alt, az, area)
    future_shade = ground_shadow(future, alt, az, area)
    under_any = unary_union([f for f, _ in today] + [f for f, _ in future])
    layers = {
        "today": polygons_only(today_shade),
        "added": polygons_only(future_shade.difference(today_shade).difference(under_any)),
        "removed": polygons_only(today_shade.difference(future_shade).difference(under_any)),
    }
    features = [{"type": "Feature", "geometry": to_lonlat(geometry),
                 "properties": {**base, "layer": name, "area_m2": round(geometry.area)}}
                for name, geometry in layers.items() if not geometry.is_empty]
    summary = {**base, "sun_up": True, **{f"{name}_m2": round(geometry.area) for name, geometry in layers.items()}}
    return features, summary


def build(times=None):
    layer, today, future = load_buildings()
    bounds = [f.bounds for f, _ in today]
    area = box(min(b[0] for b in bounds), min(b[1] for b in bounds), max(b[2] for b in bounds), max(b[3] for b in bounds))
    lon, lat = inverse(area.centroid.x, area.centroid.y)
    centre = (lat, lon)
    if times is None:
        times = [(label, datetime.fromisoformat(f"{day}T{clock}").replace(tzinfo=TIMEZONE))
                 for label, day in DEFAULT_DATES.items() for clock in DEFAULT_TIMES]
    features, summaries = [], []
    for label, when in times:
        new_features, summary = snapshot(label, when, today, future, area, centre)
        features += new_features
        summaries.append(summary)
        print(f"{summary['local_time']}: " + ("sun down" if not summary["sun_up"] else
              f"added {summary['added_m2']:,} m², removed {summary['removed_m2']:,} m²"), flush=True)
    metadata = {
        "corridor_id": layer["metadata"]["corridor_id"],
        "layers": {"today": "Open ground shaded by existing buildings",
                   "added": "Sunny today, shaded with the proposals",
                   "removed": "Shaded today, sunny once the proposal sites are cleared"},
        "future_view": "today + added - removed",
        "times": summaries,
        "sun_location": {"lat": round(lat, 6), "lon": round(lon, 6)},
        "clip_area": "Bounding box of the building inventory; shadows of buildings outside it are missing near the edges",
        "method": "Flat-roofed prisms at height_m swept along the sun direction onto flat ground (data/sources/shadows.py)",
        "limitations": [
            "Ground is treated as flat; real slopes lengthen or shorten shadows.",
            "Each building is one flat-roofed prism at its average roof height; towers on podiums are approximated.",
            "Shadows falling on walls and roofs are not shown; only open ground is shaded.",
            "Proposal masses are simplified boxes, so their shadows are indicative, not a design study.",
            "Trees, canopies and signs are not modelled.",
        ],
        "simplify_tolerance_m": SIMPLIFY_M,
        "source": "buildings_3d.geojson",
    }
    collection = {"type": "FeatureCollection", "metadata": metadata, "features": features}
    (REVIEWED / "shadows.geojson").write_text(json.dumps(collection, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    return metadata


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--at", nargs="+", metavar="YYYY-MM-DDTHH:MM", help="Local Toronto times instead of the defaults")
    args = parser.parse_args()
    times = None
    if args.at:
        times = [("custom", datetime.fromisoformat(value).replace(tzinfo=TIMEZONE)) for value in args.at]
    build(times)


if __name__ == "__main__":
    main()
