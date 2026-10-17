import json

import pytest

from backend.config import ROOT_DIR
from backend.simulation.inputs import SimulationInput
from backend.simulation.runner import run_simulation
from data.simulation_input import load_simulation_input

ASSUMPTIONS = ("westward_share", "walk_limit_m", "parallel_route_bands", "incoming_load_range", "stop_dwell_range_s")


def test_every_model_assumption_is_documented_in_the_bundle():
    bundle = json.loads((ROOT_DIR / "data/reviewed/simulation_input.json").read_text())
    for name in ASSUMPTIONS:
        assert name in bundle["inputs"]
        meta = bundle["field_metadata"][name]
        assert meta["status"] == "assumed" and meta["unit"] and meta["meaning"]


def test_bundle_values_match_the_dataclass_defaults():
    # Hand-built inputs in tests rely on the defaults behaving like the reviewed bundle.
    bundle = json.loads((ROOT_DIR / "data/reviewed/simulation_input.json").read_text())
    defaults = SimulationInput.__dataclass_fields__
    for name in ASSUMPTIONS:
        value = bundle["inputs"][name]
        assert (tuple(value) if isinstance(value, list) else value) == defaults[name].default


def test_sensitivity_ranges_bracket_the_central_value():
    bundle = json.loads((ROOT_DIR / "data/reviewed/simulation_input.json").read_text())
    for name in ASSUMPTIONS:
        sensitivity = bundle["field_metadata"][name].get("sensitivity")
        if sensitivity:
            low, central, high = (sensitivity[k] for k in ("low", "central", "high"))
            assert central == bundle["inputs"][name]
            assert low <= central <= high


def onboard_at_entry(result):
    first_seen = {}
    for entry in result["sim_log"]:
        if entry["action"] == "generate":
            first_seen.setdefault(entry["streetcar"]["id"], len(entry["streetcar"]["onboard_passenger_ids"]))
    return list(first_seen.values())


def test_incoming_load_comes_from_the_inputs():
    empty = run_simulation(load_simulation_input(overrides={"incoming_load_range": (0, 0)}))
    full = run_simulation(load_simulation_input(overrides={"incoming_load_range": (65, 130)}))
    assert set(onboard_at_entry(empty)) == {0}
    assert all(65 <= n <= 130 for n in onboard_at_entry(full))


def test_walk_limit_and_westward_share_change_generated_demand():
    base = len(run_simulation(load_simulation_input())["passengers"])
    shorter = len(run_simulation(load_simulation_input(overrides={"walk_limit_m": 500.0}))["passengers"])
    eastward = len(run_simulation(load_simulation_input(overrides={"westward_share": 0.2}))["passengers"])
    assert shorter != base
    assert eastward < base


@pytest.mark.parametrize("override", [
    {"westward_share": 1.5},
    {"walk_limit_m": 0},
    {"parallel_route_bands": (0.7, 0.3)},
    {"incoming_load_range": (30, 10)},
    {"incoming_load_range": (0, 1000)},
    {"stop_dwell_range_s": (40, 10)},
])
def test_invalid_assumptions_are_rejected(override):
    with pytest.raises(ValueError):
        load_simulation_input(overrides=override)
