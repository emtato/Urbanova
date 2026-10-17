import json

import pytest

from backend.config import ROOT_DIR
from data.sources.buildings import calibration, estimate_units, extract_posted_counts

REVIEWED = ROOT_DIR / "data/reviewed"


def read(name):
    return json.loads((REVIEWED / name).read_text(encoding="utf-8"))


def test_scraper_ignores_related_projects_and_script_content():
    html = '<script>999 Units</script><h2>563</h2><span>Units</span><h2>See what\'s nearby</h2><p>Units: 800</p>'
    assert extract_posted_counts(html, "centrecourt") == [563]
    assert extract_posted_counts("Height: 129.2 m Stories: 39 Units: 484", "centrecourt") == [484]
    with pytest.raises(ValueError, match="selector needs review"):
        extract_posted_counts("Project text changed; no unit count", "centrecourt")


def test_scraper_retains_conflicting_primary_counts():
    assert extract_posted_counts("Units 560 Condominium Suites. With just 555 units", "panda") == [555, 560]
    assert extract_posted_counts("Featuring 1012 residential units. Number of Units: 968", "dundas_gardens") == [968, 1012]


def test_estimates_require_local_evidence_and_keep_sensitivity_bounds():
    with pytest.raises(ValueError, match="Too few"):
        calibration([dict(gross_m2_per_unit=100)]*4)
    assert estimate_units(1000, 5, 100) == (50, 25, 100)
    assert estimate_units(1000, 10, 100)[0] == 100
    assert estimate_units(1, 1, 100) == (1, 1, 2)


def test_inventory_separates_published_estimated_and_unknown_counts():
    rows = read("building_unit_inventory.json")
    by_id = {row["building_id"]: row for row in rows}
    assert len(by_id) == len(rows)
    for identity, count in (("668372120", 563), ("965836277", 484), ("35159806", 681), ("205665801", 596), ("261802899", 995), ("234014500", 363)):
        row = by_id["osm-way-"+identity]
        assert row["unit_count_status"] == "published_developer"
        assert row["selected_units"] == count
        assert row["published_source_url"].startswith("https://")
    for identity, low, high in (("111661971", 555, 560), ("668372121", 968, 1012)):
        row = by_id["osm-way-"+identity]
        assert row["unit_count_status"] == "estimated_conflicting_published"
        assert (row["units_low"], row["units_high"]) == (low, high)
        assert "published_counts_conflict" in row["review_flags"]
    for row in rows:
        assert row["units_low"] <= row["units_high"]
        if row["included_in_simulation"]:
            assert row["accessible_stop_ids"]
        if row["unit_count_status"] == "unknown_use":
            assert row["selected_units"] is None
            assert row["conditional_residential_estimate"] > 0
            assert not row["included_in_simulation"]
        if row["unit_count_status"] == "estimated":
            assert row["published_unit_counts"] == []
            assert row["units_low"] <= row["selected_units"] <= row["units_high"]


def test_expansion_preserves_baseline_and_does_not_repeat_registered_units():
    baseline = read("registered_rental_input.json")["inputs"]["existing_residences"]
    expanded = read("simulation_input.json")["inputs"]["existing_residences"]
    assert expanded[:len(baseline)] == baseline
    assert len({home["id"] for home in expanded}) == len(expanded)
    summary = read("building_unit_summary.json")
    assert summary["modelled_units"] == sum(home["total_units"] for home in expanded)
    assert summary["mapped_buildings"] == sum(summary["by_unit_count_status"].values())
    represented = [identity for row in read("building_unit_inventory.json") if row["included_in_simulation"] for identity in row["represented_by"]]
    assert len(set(represented)) == len(represented)
    source_ids = {source["source_id"] for source in read("simulation_sources.json")}
    assert all(set(row["source_ids"]) <= source_ids for row in read("building_unit_inventory.json"))
