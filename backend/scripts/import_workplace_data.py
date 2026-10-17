"""Build workplace JSON from the retained official downloads; no simulation logic.

Run from the repository root with python -m backend.scripts.import_workplace_data.
Raw inputs and their download manifest live in ignored data/raw/workplaces/.
"""

import csv
import json
from collections import Counter
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform
from shapely.prepared import prep

from data.sources.base import checksum

ROOT = Path(__file__).resolve().parents[2]
RAW = ROOT / "data/raw/workplaces"
OUTPUT = ROOT / "data/reviewed"
TABLE_URL = "https://www150.statcan.gc.ca/t1/tbl1/en/tv.action?pid=9810049201"

EXPECTED_FILTERS = {
    "REF_DATE": "2021",
    "Work activity during the reference year (4A)": "Total - Work activity during the reference year",
    "Age (15A)": "Total - Age",
    "Gender (3)": "Total - Gender",
    "Industry - Sectors - North American Industry Classification System (NAICS) 2017 (21)":
        "Total - Industry - Sectors - North American Industry Classification System (NAICS) 2017",
    "Place of work status (3)": "Usual place of work",
    "SCALAR_FACTOR": "units",
    "DECIMALS": "0",
}


def write_json(name: str, payload: dict) -> None:
    OUTPUT.mkdir(parents=True, exist_ok=True)
    (OUTPUT / name).write_text(
        json.dumps(payload, indent=2, ensure_ascii=False, allow_nan=False) + "\n",
        encoding="utf-8",
    )


def build_workplace_data(raw_dir: Path = RAW) -> tuple[dict, dict, dict]:
    """Verify the downloads and join workplace counts to the matching 2021 tracts."""
    manifest = json.loads((raw_dir / "downloads.json").read_text())
    for source in manifest["sources"]:
        if checksum(raw_dir / source["filename"]) != source["sha256"]:
            raise ValueError(f"Source checksum mismatch: {source['filename']}")

    metadata = json.loads((raw_dir / "table_metadata.json").read_text())[0]
    if metadata["status"] != "SUCCESS" or str(metadata["object"]["productId"]) != "98100492":
        raise ValueError("Unexpected Statistics Canada table metadata")
    geographies = metadata["object"]["dimension"][0]["member"]
    cma = next(g for g in geographies if g["classificationCode"] == "535")
    expected = {
        "2021S0507" + g["classificationCode"]: g
        for g in geographies
        if g["parentMemberId"] == cma["memberId"] and g["geoLevel"] == 507
    }
    geography_quality = {g["memberId"]: {} for g in expected.values()}
    for attribute in metadata["object"]["geoAttribute"]:
        if (attribute["memberId"] in geography_quality
                and attribute["title"] in ("DQF_CODE", "DQF_NOTE", "TNR_LONG_FORM")):
            geography_quality[attribute["memberId"]][attribute["title"]] = attribute["valueEn"]

    counts = {}
    cma_total = None
    for source in manifest["sources"]:
        if source["kind"] != "workplace_counts":
            continue
        with (raw_dir / source["filename"]).open(encoding="utf-8-sig", newline="") as stream:
            for row in csv.DictReader(stream):
                if any(row[key] != value for key, value in EXPECTED_FILTERS.items()):
                    raise ValueError(f"Unexpected count filters: {row.get('DGUID')}")
                if row["STATUS"] or row["SYMBOL"] or not row["VALUE"]:
                    raise ValueError(f"Missing, suppressed or flagged count: {row['DGUID']}")
                value = int(row["VALUE"])
                if value < 0:
                    raise ValueError("Worker counts must be nonnegative")
                if row["DGUID"] == "2021S0503535":
                    if cma_total is not None:
                        raise ValueError("Duplicate CMA aggregate")
                    cma_total = value
                    continue
                if row["DGUID"] not in expected or row["DGUID"] in counts:
                    raise ValueError(f"Unexpected or duplicate tract: {row['DGUID']}")
                counts[row["DGUID"]] = value
    if counts.keys() != expected.keys() or cma_total is None:
        raise ValueError("The count downloads do not cover every Toronto CMA tract")

    tracts = json.loads((raw_dir / "census_tracts.geojson").read_text())
    city_features = json.loads((raw_dir / "toronto_city.geojson").read_text())["features"]
    if len(city_features) != 1 or city_features[0]["properties"]["CSDUID"] != "3520005":
        raise ValueError("Expected the City of Toronto boundary, CSD 3520005")
    city = shape(city_features[0]["geometry"])
    if not city.is_valid:
        raise ValueError("Invalid City of Toronto boundary")
    prepared_city = prep(city)
    project = Transformer.from_crs(4326, 3347, always_xy=True).transform
    unproject = Transformer.from_crs(3347, 4326, always_xy=True).transform
    city_projected = transform(project, city)

    destinations = []
    seen = set()
    relations = Counter()
    for feature in tracts["features"]:
        properties = feature["properties"]
        dguid = properties["DGUID"]
        if dguid not in counts or dguid in seen:
            raise ValueError(f"Unexpected or duplicate tract boundary: {dguid}")
        seen.add(dguid)
        if properties["CTUID"] != expected[dguid]["classificationCode"]:
            raise ValueError(f"Tract ID mismatch: {dguid}")
        geometry = shape(feature["geometry"])
        if not geometry.is_valid or geometry.is_empty:
            raise ValueError(f"Invalid or empty tract boundary: {dguid}")
        projected = transform(project, geometry)
        # A point inside the area is a plotting proxy, not a workplace address.
        point = transform(unproject, projected.representative_point())
        if not geometry.covers(point):
            raise ValueError(f"Representative point outside its tract: {dguid}")
        if prepared_city.covers(geometry):
            relation = "inside"
        elif (prepared_city.intersects(geometry)
              and projected.intersection(city_projected).area > 1):
            # Keep any meaningful boundary-crossing tract visible for manual review.
            relation = "crosses_boundary"
        else:
            relation = "outside"
        relations[relation] += 1
        quality = geography_quality[expected[dguid]["memberId"]]
        destinations.append({
            "census_tract_uid": properties["CTUID"],
            "dguid": dguid,
            "name": "Census tract " + properties["CTNAME"],
            "latitude": round(point.y, 6),
            "longitude": round(point.x, 6),
            "usual_workplace_workers": counts[dguid],
            "toronto_city_relation": relation,
            "census_geography_quality": {
                "code": quality.get("DQF_CODE"),
                "note": quality.get("DQF_NOTE"),
                "long_form_nonresponse_percent": float(quality["TNR_LONG_FORM"]),
            },
        })
    if seen != counts.keys():
        raise ValueError("Some workplace counts have no matching tract boundary")
    destinations.sort(key=lambda row: row["census_tract_uid"])
    tract_total = sum(counts.values())
    city_rows = [d for d in destinations if d["toronto_city_relation"] == "inside"]

    data = {
        "schema_version": 1,
        "reference_year": 2021,
        "scope": "Toronto census metropolitan area (CMA 535), including surrounding municipalities",
        "measure": "Employed people aged 15+ with a usual place of work, grouped by workplace tract",
        "count_unit": "workers; not businesses, vacancies, daily commuters or hourly arrivals",
        "filters": EXPECTED_FILTERS,
        "coordinate_method": "Point on surface of the official tract polygon in EPSG:3347, transformed to WGS84; not a workplace entrance",
        "toronto_city_relation_method": "Official Toronto CSD 3520005 boundary; positive overlaps above 1 square metre flagged for review",
        "source_ids": [s["source_id"] for s in manifest["sources"] if s["kind"] != "employment_context"],
        "published_cma_worker_total": cma_total,
        "sum_of_tract_worker_counts": tract_total,
        "city_subset": {
            "relation_filter": "inside",
            "tract_count": len(city_rows),
            "usual_workplace_workers": sum(d["usual_workplace_workers"] for d in city_rows),
        },
        "limitations": [
            "May 2021 Census conditions, including pandemic-era work patterns; not current employment.",
            "Worked-at-home and no-fixed-workplace trips are excluded by this selection.",
            "Counts are workplace totals, not home-to-work links for residents of the selected buildings.",
            "Representative area points are too coarse to establish an exact 750 m walking route.",
            "Tract counts and the CMA aggregate can differ due to Census rounding; counts have not been rescaled.",
            "No 60% directional assumption, mode choice, walking cutoff or passenger logic has been applied.",
            "Census geography quality metadata describe the tract generally; they are not error bars for its workplace count.",
        ],
        "destinations": destinations,
    }
    quality = {
        "status": "structural_and_source_checks_passed; behavioural_calibration_not_performed",
        "source_checksums_verified": len(manifest["sources"]),
        "expected_cma_tracts": len(expected),
        "count_rows": len(counts),
        "matched_boundaries": len(seen),
        "missing_counts": 0,
        "suppressed_or_flagged_counts": 0,
        "duplicate_count_rows": 0,
        "invalid_boundaries": 0,
        "points_outside_own_tract": 0,
        "zero_count_tracts": sum(value == 0 for value in counts.values()),
        "toronto_city_relation_counts": dict(sorted(relations.items())),
        "published_cma_worker_total": cma_total,
        "sum_of_tract_worker_counts": tract_total,
        "tract_sum_minus_published_total": tract_total - cma_total,
        "absolute_difference_percent": round(abs(tract_total - cma_total) / cma_total * 100, 6),
        "counts_rescaled": False,
        "nonzero_census_geography_quality_codes": sum(
            d["census_geography_quality"]["code"] != "00000" for d in destinations
        ),
        "census_geography_quality_note": "General geography flags retained for review; these differ from the count-level STATUS and SYMBOL fields, which were empty for every imported workplace count.",
        "filters": EXPECTED_FILTERS,
        "interpretation": "Suitable as historical, coarse destination weights. Not validated 505 ridership, current workplace attendance, exact addresses or commuting directions.",
    }
    return data, quality, manifest


if __name__ == "__main__":
    data, quality, manifest = build_workplace_data()
    write_json("workplaces_2021.json", data)
    write_json("workplaces_2021_quality.json", quality)
    write_json("workplaces_sources.json", manifest)
    print(f"Imported {len(data['destinations'])} workplace areas; {data['city_subset']['tract_count']} wholly inside Toronto city")
    print(f"Tract sum differs from published CMA total by {quality['tract_sum_minus_published_total']} workers; original counts retained")
