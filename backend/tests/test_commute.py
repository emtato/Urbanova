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
    assert len(m._workplaces) == 585  # Default scope="city" (Toronto-only tracts).
    corridor_ids = [s.corridor_stop_id for s in m.route if s.corridor_stop_id]
    rng = Random(0)
    trips = [sample_streetcar_trip(43.6600907, -79.3642039, rng) for _ in range(2_000)]  # 500 Dundas E.
    used = [t for t in trips if t is not None]
    assert used and len(used) < len(trips)
    for trip in used:
        assert trip.board_stop_id in corridor_ids
        if trip.alight_stop_id is not None:
            assert corridor_ids.index(trip.alight_stop_id) > corridor_ids.index(trip.board_stop_id)


def test_terminus_boarding_handles_overcrowding_and_wait_detection():
    from backend.simulation.inputs import SimulationInput
    from backend.simulation.objects import Passenger, Stop
    from backend.simulation.runner import run_simulation

    stops = (
        Stop(id="s0", name="Start", sequence=0, latitude=LAT, longitude=lon_at(0)),
        Stop(id="s1", name="TMU", sequence=1, latitude=LAT, longitude=lon_at(400)),
    )
    inputs = SimulationInput(
        stops=stops,
        existing_residences=(),
        developments=(),
        link_travel_times_s=(10.0,),
        streetcar_capacity=1,
        headway_s=20.0,
        rush_hour_duration_s=30.0,
        trips_per_resident_in_window=0.3,
        start_time_s=0,
        end_time_s=40,
    )
    # p1 boards at s0 and rides past s1 (occupies the 1-person streetcar through s1).
    # p2 waits at s1 (TMU terminus) at t=5s to ride beyond_segment: denied on car 1 at t=10s, boards car 2 at t=30s.
    passengers = {
        "p1": Passenger(id="p1", origin_stop_id="s0", destination_stop_id=None, get_to_stop_time=0, rider_group="existing"),
        "p2": Passenger(id="p2", origin_stop_id="s1", destination_stop_id=None, get_to_stop_time=5, rider_group="existing"),
    }
    run_simulation(inputs, passengers)

    assert passengers["p1"].status == "beyond_segment"
    assert passengers["p1"].boarding_time_s == 0
    assert passengers["p1"].exit_time_s == 10

    assert passengers["p2"].denied_boarding_once is True
    assert passengers["p2"].boarding_time_s == 30
    assert passengers["p2"].boarding_time_s - passengers["p2"].get_to_stop_time == 25
    assert passengers["p2"].status == "beyond_segment"
    assert len(stops[1].waiting_passenger_ids) == 0


def test_run_simulation_generates_passengers_via_commute_helper():
    from backend.simulation.inputs import SimulationInput
    from backend.simulation.objects import Development, Stop
    from backend.simulation.runner import run_simulation

    m = load_commute_model()
    corridor_stops = tuple(
        Stop(id=s.corridor_stop_id, name=s.name, sequence=i, latitude=s.latitude, longitude=s.longitude)
        for i, s in enumerate(s for s in m.route if s.corridor_stop_id)
    )
    dev = Development(
        id="dev-500-dundas",
        name="500 Dundas St E",
        latitude=43.6600907,
        longitude=-79.3642039,
        net_added_units=413,
        occupied_share=1.0,
        residents_per_occupied_unit=1.8,
        transit_share=0.3,
        accessible_stop_ids=("ttc-stop-2125",),
    )
    inputs = SimulationInput(
        stops=corridor_stops,
        existing_residences=(),
        developments=(dev,),
        link_travel_times_s=(60.0,) * (len(corridor_stops) - 1),
        streetcar_capacity=130,
        headway_s=360.0,
        rush_hour_duration_s=1800.0,
        trips_per_resident_in_window=0.3,
        start_time_s=0,
        end_time_s=2400,
    )
    result = run_simulation(inputs)
    assert len(result["passengers"]) > 0
    assert all(p["origin_stop_id"] == "ttc-stop-2125" for p in result["passengers"])
    assert all(p["rider_group"] == "new" and p["development_id"] == "dev-500-dundas" for p in result["passengers"])
    assert any(p["status"] in ("arrived", "beyond_segment") for p in result["passengers"])
