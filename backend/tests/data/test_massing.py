import json
from datetime import date, datetime
from zoneinfo import ZoneInfo

import pytest
from shapely.geometry import box

from backend.config import ROOT_DIR
from backend.scripts.build_massing import adopt_heights
from data.sources.sun import shadow_length_m, solar_noon, solar_position

REVIEWED = ROOT_DIR / "data/reviewed"
TORONTO = (43.658, -79.365)


@pytest.mark.parametrize("day, altitude", [(date(2026, 6, 21), 69.8), (date(2026, 3, 20), 46.4), (date(2026, 12, 21), 22.9)])
def test_noon_sun_matches_toronto_latitude(day, altitude):
    noon = solar_noon(*TORONTO, day)
    position = solar_position(*TORONTO, noon)
    assert position["altitude_deg"] == pytest.approx(altitude, abs=0.2)
    assert position["azimuth_deg"] == pytest.approx(180, abs=0.5)


def test_sun_rises_in_the_east_and_sets_in_the_west():
    morning = solar_position(*TORONTO, datetime(2026, 6, 21, 7, tzinfo=ZoneInfo("America/Toronto")))
    evening = solar_position(*TORONTO, datetime(2026, 6, 21, 19, tzinfo=ZoneInfo("America/Toronto")))
    night = solar_position(*TORONTO, datetime(2026, 12, 21, 22, tzinfo=ZoneInfo("America/Toronto")))
    assert 45 < morning["azimuth_deg"] < 100 and morning["altitude_deg"] > 0
    assert 260 < evening["azimuth_deg"] < 315 and evening["altitude_deg"] > 0
    assert night["altitude_deg"] < 0 and shadow_length_m(10, night["altitude_deg"]) is None
    assert shadow_length_m(10, 45) == pytest.approx(10)


class Parts:
    """Minimal stand-in for the massing frame: iloc rows with height fields."""

    def __init__(self, rows):
        self.rows = rows
        self.iloc = self

    def __getitem__(self, i):
        return self.rows[i]


class Row:
    def __init__(self, geometry, avg, peak, source="Lidar-Derived"):
        self.geometry, self.AVG_HEIGHT, self.MAX_HEIGHT, self.HEIGHT_SRC = geometry, avg, peak, source


class Index:
    def __init__(self, n):
        self.n = n

    def query(self, _):
        return range(self.n)


def test_heights_are_area_weighted_and_ignore_neighbour_slivers():
    footprint = box(0, 0, 10, 10)
    rows = [Row(box(0, 0, 10, 8), 10, 12), Row(box(0, 8, 10, 10), 20, 22), Row(box(9.9, 0, 60, 60), 150, 250)]
    adopted = adopt_heights(footprint, Parts(rows), Index(len(rows)))
    assert adopted["height_status"] == "measured_city_massing"
    assert adopted["height_m"] == pytest.approx((80 * 10 + 20 * 20 + 1 * 150) / 101, abs=0.1)
    assert adopted["max_height_m"] == 22


def test_thin_coverage_falls_back_to_estimates():
    rows = [Row(box(0, 0, 10, 1), 10, 12)]
    assert adopt_heights(box(0, 0, 10, 10), Parts(rows), Index(1)) is None


def test_committed_massing_covers_every_inventory_building():
    inventory = json.loads((REVIEWED / "building_unit_inventory.json").read_text())
    layer = json.loads((REVIEWED / "buildings_3d.geojson").read_text())
    existing = [f for f in layer["features"] if f["properties"]["kind"] == "existing"]
    assert sorted(f["properties"]["building_id"] for f in existing) == sorted(b["building_id"] for b in inventory)
    for feature in layer["features"]:
        props = feature["properties"]
        assert feature["geometry"]["type"] in {"Polygon", "MultiPolygon"}
        assert 0 < props["height_m"] <= props["max_height_m"] < 400
        assert props["height_status"]
        assert all(v is None or v > 0 for v in props["shadow_at_solar_noon_m"].values())
    proposed = [f["properties"] for f in layer["features"] if f["properties"]["kind"] == "proposed"]
    assert len({p["dev_id"] for p in proposed}) == 3
    assert all("not an approved design" in p["label"] for p in proposed)
    statuses = layer["metadata"]["height_status_counts"]
    assert sum(statuses.values()) == len(inventory)


def test_committed_sun_table_has_every_month_and_key_dates():
    sun = json.loads((REVIEWED / "sun_positions.json").read_text())
    labels = {day["label"] for day in sun["days"]}
    assert {"summer_solstice", "winter_solstice", "spring_equinox", "autumn_equinox"} <= labels
    assert sum(label.startswith("2026-") for label in labels) == 12
    winter = next(d for d in sun["days"] if d["label"] == "winter_solstice")
    assert winter["solar_noon_altitude_deg"] == pytest.approx(22.9, abs=0.2)
