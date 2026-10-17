from random import Random

import pytest

from backend.simulation.commute import (
    CommuteModel, Place, Workplace, load_commute_model, sample_streetcar_trip, straight_line_m,
)

# Synthetic east-west street at lat 43.65; ~80.5 m per 0.001 deg longitude.
LAT = 43.65


def lon_at(metres_west: float) -> float:
    return -79.30 - metres_west / 80_500


def stop(i: int, metres_west: float) -> Place:
    return Place(f"s{i}", f"Stop {i}", LAT, lon_at(metres_west))


CORRIDOR = [stop(i, i * 400) for i in range(5)]  # s4 plays TMU at 1,600 m.
BEYOND = [Place("b0", "Beyond 0", LAT, lon_at(3_000))]
STATIONS = [Place("tmu", "TMU", LAT + 0.0005, lon_at(1_600)), Place("far", "Far", LAT + 0.05, lon_at(1_600))]


def model(workplaces=(Workplace("w", LAT, lon_at(5_000), 1),), **kw) -> CommuteModel:
    return CommuteModel(workplaces, CORRIDOR, BEYOND, STATIONS, detour_factor=1.0,
                        tmu_stop_id="s4", tmu_station_id="tmu", **kw)


def test_distance_sanity():
    assert straight_line_m(LAT, lon_at(0), LAT, lon_at(1_000)) == pytest.approx(1_000, rel=0.01)


def test_walk_when_work_is_close():
    m = model()
    result = m.route_to(LAT, lon_at(0), Workplace("w", LAT, lon_at(500), 1))
    assert result.mode == "walk" and result.streetcar is None


def test_streetcar_alights_at_corridor_stop_nearest_work():
    m = model()
    result = m.route_to(LAT, lon_at(0), Workplace("w", LAT, lon_at(1_250), 1))
    assert result.mode == "streetcar"
    assert (result.streetcar.board_stop_id, result.streetcar.alight_stop_id) == ("s0", "s3")


def test_beyond_segment_uses_none_destination():
    result = model().route_to(LAT, lon_at(0), Workplace("w", LAT, lon_at(3_100), 1))
    assert result.streetcar.alight_stop_id is None and result.streetcar.exit == "beyond_segment"
    assert result.streetcar.beyond_segment_stop.gtfs_stop_id == "b0"


def test_line1_transfer_at_tmu():
    far = STATIONS[1]
    result = model().route_to(LAT, lon_at(0), Workplace("w", far.latitude, far.longitude, 1))
    assert result.streetcar.alight_stop_id == "s4" and result.streetcar.exit == "line1_transfer"
    assert result.streetcar.transfer_station_id == "far"


def test_subway_beats_streetcar_when_station_near_home():
    far = STATIONS[1]
    result = model().route_to(LAT, lon_at(1_500), Workplace("w", far.latitude, far.longitude, 1))
    assert result.mode == "subway" and result.streetcar is None
    assert (result.home_station_id, result.work_station_id) == ("tmu", "far")


def test_eastbound_destination_is_outside_model():
    result = model().route_to(LAT, lon_at(1_600), Workplace("w", LAT, lon_at(-2_000), 1))
    assert result.mode == "outside_model" and result.streetcar is None


def test_home_far_from_corridor_is_outside_model():
    result = model().route_to(LAT + 0.1, lon_at(0), Workplace("w", LAT, lon_at(1_200), 1))
    assert result.mode == "outside_model" and "home" in result.reason


def test_accessible_stop_ids_restrict_boarding():
    result = model().route_to(LAT, lon_at(0), Workplace("w", LAT, lon_at(1_250), 1),
                              accessible_stop_ids=["s1"])
    assert result.streetcar.board_stop_id == "s1"


def test_westward_split_and_reproducibility():
    west, east = Workplace("west", LAT, lon_at(5_000), 1), Workplace("east", LAT, lon_at(-5_000), 99)
    m = model(workplaces=(west, east), westward_share=0.6)
    picks = [m.sample_workplace(lon_at(0), Random(3))[0].tract_uid for _ in range(1)]
    rng = Random(11)
    shares = sum(m.sample_workplace(lon_at(0), rng)[0].tract_uid == "west" for _ in range(20_000)) / 20_000
    assert shares == pytest.approx(0.6, abs=0.02)  # Group share, not employment share.
    assert picks == [m.sample_workplace(lon_at(0), Random(3))[0].tract_uid]


def test_real_data_returns_valid_corridor_trips():
    m = load_commute_model()
    corridor_ids = [s.corridor_stop_id for s in m.route if s.corridor_stop_id]
    rng = Random(0)
    trips = [sample_streetcar_trip(43.6600907, -79.3642039, rng) for _ in range(2_000)]  # 500 Dundas E.
    used = [t for t in trips if t is not None]
    assert used and len(used) < len(trips)
    for trip in used:
        assert trip.board_stop_id in corridor_ids
        if trip.alight_stop_id is not None:
            assert corridor_ids.index(trip.alight_stop_id) > corridor_ids.index(trip.board_stop_id)
