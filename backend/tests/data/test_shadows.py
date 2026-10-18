import json

import pytest
from pyproj import Transformer
from shapely.geometry import box, shape
from shapely.ops import transform, unary_union

from backend.config import ROOT_DIR
from data.sources.shadows import ground_shadow, prism_shadow, shadow_vector

REVIEWED = ROOT_DIR / "data/reviewed"


def test_shadow_points_away_from_the_sun_with_the_right_length():
    east, north = shadow_vector(10, 45, 180)  # sun due south, 45 degrees up
    assert east == pytest.approx(0, abs=1e-9)
    assert north == pytest.approx(10)
    east, north = shadow_vector(10, 45, 270)  # evening sun in the west
    assert east == pytest.approx(10)
    with pytest.raises(ValueError):
        shadow_vector(10, -1, 180)


def test_prism_shadow_is_the_footprint_swept_along_the_shadow():
    square = box(0, 0, 10, 10)
    shade = prism_shadow(square, 10, 45, 180)
    assert shade.symmetric_difference(box(0, 0, 10, 20)).area == pytest.approx(0, abs=1e-6)
    diagonal = prism_shadow(square, 10, 45, 225)  # sun south-west, shadow to the north-east
    assert diagonal.area == pytest.approx(100 + 2 * 10 * 7.0711, abs=0.1)


def test_ground_shadow_removes_footprints_and_clips():
    buildings = [(box(0, 0, 10, 10), 10.0), (box(0, 15, 10, 20), 3.0)]
    shade = ground_shadow(buildings, 45, 180, area=box(-50, -50, 50, 18))
    assert shade.area == pytest.approx(5 * 10 + 0)  # gap 10-15 shaded; second building and beyond are clipped or under a roof
    assert not shade.intersects(box(1, 1, 9, 9))


def test_committed_shadows_have_three_layers_for_every_sunlit_time():
    collection = json.loads((REVIEWED / "shadows.geojson").read_text())
    times = collection["metadata"]["times"]
    sunlit = [t["local_time"] for t in times if t["sun_up"]]
    assert len(times) == 20 and len(sunlit) == 18
    for time in sunlit:
        layers = {f["properties"]["layer"] for f in collection["features"] if f["properties"]["local_time"] == time}
        assert "today" in layers and layers <= {"today", "added", "removed"}
    assert {f["geometry"]["type"] for f in collection["features"]} == {"MultiPolygon"}
    assert all(shape(f["geometry"]).is_valid for f in collection["features"])


def test_added_shadow_is_new_and_never_under_a_building():
    forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
    collection = json.loads((REVIEWED / "shadows.geojson").read_text())
    buildings = json.loads((REVIEWED / "buildings_3d.geojson").read_text())
    roofs = unary_union([transform(forward, shape(f["geometry"])) for f in buildings["features"]])
    by_time = {}
    for feature in collection["features"]:
        props = feature["properties"]
        by_time.setdefault(props["local_time"], {})[props["layer"]] = transform(forward, shape(feature["geometry"]))
    for layers in by_time.values():
        if "added" in layers:
            # Simplification moves edges by up to 0.5 m, so allow a thin overlap band.
            assert layers["added"].intersection(layers["today"]).area < 0.02 * layers["added"].area + 50
            assert layers["added"].intersection(roofs).area < 0.02 * layers["added"].area + 50
