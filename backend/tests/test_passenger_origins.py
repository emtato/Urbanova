"""Retain real sampled home provenance without adding non-505 commuters."""
from dataclasses import asdict
from types import SimpleNamespace

from backend.simulation.inputs import SimulationInput
from backend.simulation.objects import Development, ExistingResidences, Stop
from backend.simulation.runner import generate_passengers


def test_generated_passengers_keep_their_actual_home_and_assigned_stop(monkeypatch):
    monkeypatch.setattr('backend.simulation.runner.corridor_505_share', lambda *args, **kwargs: 1)

    def assign(lat, lon, rng, **kwargs):
        if lon == -79.35:
            return None  # Direct walk/subway/outside-model trips never become passenger dots.
        return SimpleNamespace(board_stop_id='s1', alight_stop_id=None)

    monkeypatch.setattr('backend.simulation.runner.sample_streetcar_trip', assign)
    inputs = SimulationInput(
        stops=(
            Stop(id='s0', name='Near home', latitude=43.66, longitude=-79.36, sequence=0),
            Stop(id='s1', name='Assigned stop', latitude=43.66, longitude=-79.37, sequence=1),
        ),
        existing_residences=(
            ExistingResidences('existing-home', 'Home', 43.66, -79.36, 1, 1, 1, 1),
            ExistingResidences('non-streetcar-home', 'Other home', 43.66, -79.35, 1, 1, 1, 1),
        ),
        developments=(Development('proposed-home', 'Proposal', 43.661, -79.365, 1, 1, 1, 1),),
        link_travel_times_s=(10,), streetcar_capacity=10, headway_s=30,
        rush_hour_duration_s=60, trips_per_resident_in_window=1, start_time_s=0, end_time_s=60,
    )
    passengers = list(generate_passengers(inputs).values())
    assert {p.home_id for p in passengers} == {'existing-home', 'proposed-home'}
    assert all(p.origin_stop_id == 's1' for p in passengers)
    assert [(p.home_latitude, p.home_longitude) for p in passengers] == [(43.66, -79.36), (43.661, -79.365)]
    assert all(0 <= p.get_to_stop_time < 60 for p in passengers)
    assert [asdict(p) for p in passengers] == [asdict(p) for p in generate_passengers(inputs).values()]
