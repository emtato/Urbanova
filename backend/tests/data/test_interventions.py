import json
import math

import pytest

from backend.config import ROOT_DIR
from backend.schemas.intervention import Intervention


REVIEWED = ROOT_DIR / "data/reviewed"
PRICE_YEAR = 2026
HEADWAYS = (360, 300, 240)


def load_json(name):
    return json.loads((REVIEWED / name).read_text(encoding="utf-8"))


def test_a10_catalogue_is_contract_valid_and_uses_lane_c_budget_price_year():
    interventions = load_json("interventions.json")
    source_ids = {item["source_id"] for item in load_json("simulation_sources.json")}

    assert interventions["format_version"] == "interventions-v1"
    assert interventions["price_year"] == PRICE_YEAR
    assert interventions["default_policy"] == "package_policy_300.json"
    assert interventions["policies"] == {str(headway): f"package_policy_{headway}.json" for headway in HEADWAYS}
    assert set(interventions["source_ids"]) <= source_ids
    assert {item["id"] for item in interventions["catalogue"]} == {
        "extra-service-360s", "extra-service-300s", "extra-service-240s", "streetcar-priority-segment",
    }

    for item in interventions["catalogue"]:
        validated = Intervention.model_validate(item)
        assert validated.capital_cost.price_year == PRICE_YEAR
        assert validated.operating_cost.price_year == PRICE_YEAR
        assert set(validated.capital_cost.source_ids) <= source_ids
        assert set(validated.operating_cost.source_ids) <= source_ids


@pytest.mark.parametrize("headway,vehicles,extra_vehicles", [(360, 22, 3), (300, 27, 8), (240, 33, 14)])
def test_a10_policy_matches_catalogue_and_has_ordered_2026_costs(headway, vehicles, extra_vehicles):
    interventions = load_json("interventions.json")
    policy = load_json(f"package_policy_{headway}.json")
    source_ids = {item["source_id"] for item in load_json("simulation_sources.json")}
    option = next(item for item in interventions["extra_service"]["headway_options"] if item["headway_s"] == headway)

    assert policy["price_year"] == PRICE_YEAR
    assert policy["service_headway_s"] == headway
    assert set(policy["source_ids"]) <= source_ids
    assert all(cost["low"] <= cost["central"] <= cost["high"] for cost in (
        policy["cost_per_hour"], policy["lane_capital"], policy["lane_operating"],
    ))
    assert math.ceil(policy["cycle_s"] / policy["baseline_headway_s"]) == 19
    assert math.ceil(policy["cycle_s"] / headway) == vehicles
    assert vehicles - 19 == extra_vehicles == option["extra_vehicles"]
    assert option["annual_operating_cad"]["central"] == round(
        extra_vehicles * policy["peak_hours"] * policy["service_days"] * policy["cost_per_hour"]["central"]
    )
