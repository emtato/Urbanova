import copy
import json

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from backend.main import app
from backend.schemas import Comparison
from backend.scripts.build_fixture import build_fixture
from backend.scripts.check_contract import FIXTURE_PATH, check_contract


@pytest.fixture
def sample():
    return json.loads(FIXTURE_PATH.read_text(encoding="utf-8"))


def test_hand_fixture_rebuilds_and_generated_contract_has_no_drift(sample):
    assert build_fixture() == sample
    check_contract()
    comparison = Comparison.model_validate(sample)
    assert comparison.corridor.mode == "streetcar"
    assert comparison.corridor.direction == "westbound"
    assert comparison.corridor.route_pattern == "505:1:shp-505-60"
    assert comparison.corridor.stops[0].gtfs_stop_id == "1756"
    assert comparison.corridor.stops[-1].gtfs_stop_id == "2136"
    assert len(comparison.corridor.stops) == 9
    assert [case.per_run_mean_wait_s[0] for case in comparison.cases[:3]] == [12, 95.625, 111.5]
    assert [case.unresolved_passengers for case in comparison.cases[:3]] == [0, 2, 0]
    assert len(comparison.cases) == 9
    assert all({item.demand_case for item in package.evaluations} == {"low", "central", "high"} for package in comparison.packages)
    assert all(case.runs[0].diagnostics.conservation for case in comparison.cases)


@pytest.mark.parametrize("path,value", [
    (("corridor", "stops", 0, "lon"), 200),
    (("corridor", "stops", 1, "seq"), 9),
    (("corridor", "links", 0, "to_stop"), "unknown"),
    (("corridor", "links", 0, "length_m"), -1),
    (("corridor", "links", 0, "base_time_s"), float("nan")),
    (("corridor", "source_ids"), ["invented-source"]),
    (("assumptions", 1, "central"), 999),
    (("scenario", "phases", 0, "occupied_share"), 1.5),
    (("scenario", "phases", 0, "development_ids"), []),
    (("scenario", "developments", 0, "access", 0, "stop_id"), "unknown"),
    (("scenario", "developments", 0, "footprint_status"), "sourced"),
    (("scenario", "interventions", 0, "headway_s"), None),
    (("scenario", "interventions", 0, "operating_cost", "price_year"), 2025),
    (("scenario", "fleet_allowance"), 0),
    (("scenario", "annual_operating_budget_cad"), 1),
    (("cases", 1, "per_run_unresolved_passengers"), [0]),
    (("cases", 1, "runs", 0, "diagnostics", "conservation"), False),
    (("cases", 1, "per_run_mean_wait_s"), [1]),
    (("cases", 1, "per_run_denied_share"), [0]),
    (("cases", 1, "runs", 0, "scenario_version"), 2),
    (("cases", 1, "run_count"), 2),
    (("cases", 1, "runs", 0, "seed_ids"), [99]),
    (("packages", 0, "evaluations", 0, "criterion_met"), True),
    (("packages", 0, "evaluations", 0, "case_id"), "fixture-supported_growth"),
    (("sensitivity", 0, "assumption_key"), "invented"),
    (("replay", "events", 2, "load_after"), 99),
    (("replay", "events", 2, "count"), 99),
    (("replay", "events", 0, "t_s"), 1000),
    (("replay", "events", 0, "run_id"), "unknown-run"),
    (("replay", "events", 0, "stop_id"), "unknown-stop"),
    (("replay", "initial_queues", 0, "count"), 100),
    (("replay", "horizon_s"), 1),
    (("warnings",), []),
    (("contract_version",), "2.0.0"),
    (("unexpected",), True),
])
def test_contract_rejects_broken_boundaries(sample, path, value):
    payload = copy.deepcopy(sample)
    target = payload
    for key in path[:-1]:
        target = target[key]
    target[path[-1]] = value
    with pytest.raises(ValidationError):
        Comparison.model_validate(payload)


def test_replay_covers_two_cars_every_stop_and_preserves_denied_riders(sample):
    replay = Comparison.model_validate(sample).replay
    arrivals = [event for event in replay.events if event.kind == "arrive"]
    assert len(arrivals) == 18
    for car in replay.vehicle_capacity:
        assert [event.stop_id for event in arrivals if event.vehicle_id == car] == [stop["stop_id"] for stop in sample["corridor"]["stops"]]
    new_boards = [event for event in replay.events if event.kind == "board" and event.rider_group == "new"]
    assert [(event.t_s, event.count) for event in new_boards] == [(235, 3)]
    assert sum(event.count for event in replay.events if event.kind == "alight") == 8


def test_fixture_endpoint_validates_and_cannot_appear_as_a_live_result():
    client = TestClient(app)
    response = client.get("/api/fixtures/sample-comparison")
    assert response.status_code == 200
    assert response.headers["X-FutureProof-Fixture"] == "true"
    assert Comparison.model_validate(response.json()).fixture is True
    assert "Comparison" in client.get("/openapi.json").json()["components"]["schemas"]
