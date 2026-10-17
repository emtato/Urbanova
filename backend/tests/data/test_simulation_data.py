import json
from zipfile import ZipFile

import pytest

from backend.config import ROOT_DIR
from data.simulation_input import load_simulation_input
from data.sources.xlsx import worksheet_rows

REVIEWED = ROOT_DIR / "data/reviewed"


def test_census_reader_preserves_labels_sparse_cells_and_cached_numbers(tmp_path):
    path = tmp_path / "source.xlsx"
    namespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
    with ZipFile(path, "w") as archive:
        archive.writestr("xl/sharedStrings.xml", f'<sst xmlns="{namespace}"><si><r><t>Average </t></r><r><t>household size</t></r></si></sst>')
        archive.writestr("xl/worksheets/sheet1.xml", f'<worksheet xmlns="{namespace}"><sheetData><row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1"><v>1.6</v></c><c r="D1"><f>1+1</f><v>2</v></c></row></sheetData></worksheet>')
    assert worksheet_rows(path) == [{"A": "Average household size", "C": "1.6", "D": "2"}]


def test_bundle_matches_the_simulation_owners_actual_dataclasses():
    result = load_simulation_input()
    assert len(result.stops) == 9
    assert (result.stops[0].id, result.stops[-1].id) == ("ttc-stop-1756", "ttc-stop-2136")
    assert len(result.link_travel_times_s) == 8
    assert result.rush_hour_duration_s == 7200
    assert (result.start_time_s, result.end_time_s) == (25200, 32400)
    assert result.link_travel_time_variation_share == 0
    assert result.streetcar_capacity == 251
    assert [project.net_added_units for project in result.developments] == [624, 413, 1197]
    assert result.existing_residences
    assert all(building.total_units > 0 for building in result.existing_residences)
    assert sum(building.total_units for building in result.existing_residences) == 6269
    again = load_simulation_input()
    result.stops[0].waiting_passenger_ids.append("test-rider")
    assert not again.stops[0].waiting_passenger_ids


@pytest.mark.parametrize("overrides", [
    {"streetcar_capacity": 0}, {"headway_s": -1},
    {"headway_randomness_s": 10000}, {"commuter_distribution": [0, 0]},
    {"link_travel_times_s": [100]}, {"trips_per_resident_in_window": -1},
    {"unknown_input": 1},
    {"start_time_s": 32400}, {"link_travel_time_variation_share": 1.0},
])
def test_bad_inputs_fail_before_reaching_the_simulator(overrides):
    with pytest.raises(ValueError):
        load_simulation_input(overrides=overrides)


def test_registry_counts_are_unique_and_walks_are_network_estimates():
    bundle = json.loads((REVIEWED / "simulation_input.json").read_text(encoding="utf-8"))
    audit = json.loads((REVIEWED / "existing_housing_audit.json").read_text(encoding="utf-8"))
    included = {row["id"]: row for row in audit if row["status"] == "included_partial_rental_baseline"}
    homes = bundle["inputs"]["existing_residences"]
    assert len({home["id"] for home in homes}) == len(homes)
    assert {home["id"] for home in homes} == set(included)
    assert all(home["total_units"] == included[home["id"]]["total_units"] for home in homes)
    routes = json.loads((REVIEWED / "simulation_walking_routes.geojson").read_text(encoding="utf-8"))["features"]
    route_keys = {(route["properties"]["entity_id"], route["properties"]["stop_id"]) for route in routes}
    for home in homes + bundle["inputs"]["developments"]:
        assert all((home["id"], stop) in route_keys for stop in home["accessible_stop_ids"])
    assert all(0 <= route["properties"]["walk_m"] <= 500 and route["properties"]["manual_review"] == "pending" for route in routes)


def test_demand_proxies_are_not_labelled_as_observed_corridor_boardings():
    bundle = json.loads((REVIEWED / "simulation_input.json").read_text(encoding="utf-8"))
    travel = json.loads((REVIEWED / "travel_context_2022.json").read_text(encoding="utf-8"))
    observed = bundle["observed_passenger_demand"]
    assert observed["average_weekday_boardings"] == 32100
    assert observed["segment_am_boardings"] is None
    assert observed["incoming_occupancy"] is None
    assert bundle["inputs"]["trips_per_resident_in_window"] == pytest.approx(travel["trips_per_resident_3h"]*2/3)
    assert bundle["inputs"]["developments"][0]["transit_share"] == pytest.approx((12087+154+147)/41558)
    conflict = bundle["evidence"]["developments"][0]
    assert conflict["pipeline_proposed_units"] == 630
    assert conflict["adopted_total_units"] == 632
    assert conflict["removed_existing_units"] == 8
    assert bundle["evidence"]["developments"][2]["status"] == "assumed_replacement_count"


def test_evidence_sources_resolve_without_raw_files_or_credentials():
    bundle = json.loads((REVIEWED / "simulation_input.json").read_text(encoding="utf-8"))
    sources = json.loads((REVIEWED / "simulation_sources.json").read_text(encoding="utf-8"))
    ids = {source["source_id"] for source in sources}
    assert len(ids) == len(sources)
    assert set(bundle["source_ids"]) <= ids
    assert all(source["url"].startswith("https://") and source["sha256"] and source["retrieved_at"] for source in sources)
    assert all(set(item["source_ids"]) <= ids for item in bundle["evidence"]["developments"])
    assert set(bundle["field_metadata"]) == set(bundle["inputs"])
    assert all(set(item["source_ids"]) <= ids for item in bundle["field_metadata"].values())
