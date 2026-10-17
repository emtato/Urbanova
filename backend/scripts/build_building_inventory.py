"""Inventory all mapped buildings and expand housing with labelled unit estimates."""
import argparse
import copy
import csv
import json
import re
from collections import Counter
from statistics import median

from pyproj import Transformer
from shapely.geometry import Point
from shapely.strtree import STRtree

from backend.config import ROOT_DIR
from backend.scripts.build_simulation_data import CACHE, REVIEWED, census_context, source_download, walking_graph
from backend.scripts.prove_feasibility import write_csv, write_json
from data.sources.base import fetch_cached, record_source
from data.sources.buildings import RESIDENTIAL, calibration, estimate_units, extract_posted_counts, numeric_levels, read_buildings


def address_key(value):
    value = value.upper().replace(".", "")
    for full, short in (("STREET", "ST"), ("AVENUE", "AVE"), ("BOULEVARD", "BLVD"), ("EAST", "E"), ("WEST", "W"), ("ROAD", "RD")):
        value = re.sub(r"\b"+full+r"\b", short, value)
    return " ".join(value.split())


def build_inventory(*, access=None, refresh=False):
    rental_path = REVIEWED / "registered_rental_input.json"
    bundle = json.loads(rental_path.read_text(encoding="utf-8"))
    base = copy.deepcopy(bundle)
    corridor = json.loads((REVIEWED / "corridor.json").read_text(encoding="utf-8"))
    sources = json.loads((REVIEWED / "simulation_sources.json").read_text(encoding="utf-8"))
    # Running this command again must not duplicate the extra source records.
    sources = [source for source in sources if not source["source_id"].startswith("posted-building-")]
    osm_sources = [source for source in sources if source["source_id"].startswith("osm-housing-")]
    paths = [fetch_cached(source["url"], CACHE / ("housing_walk_"+source["source_id"].removeprefix("osm-housing-")+".osm")) for source in osm_sources]
    forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
    inverse = Transformer.from_crs(26917, 4326, always_xy=True).transform
    stop_points = [Point(*forward(stop["lon"], stop["lat"])) for stop in corridor["stops"]]
    buildings = [row for row in read_buildings(paths, forward) if min(row["geometry"].distance(stop) for stop in stop_points) <= 500]
    buildings.sort(key=lambda row: row["id"])
    print(f"Inventoried {len(buildings)} mapped building footprints.", flush=True)
    geometries = [row["geometry"] for row in buildings]
    index = STRtree(geometries)
    registry_rows = list(csv.DictReader((CACHE / "registered_apartments.csv").open(encoding="utf-8-sig")))
    registry = {"rentsafe-"+row["RSN"]: row for row in registry_rows}
    by_address = {}
    for row in registry_rows:
        by_address.setdefault(address_key(row["SITE_ADDRESS"]), []).append(row)
    claimed = {row["id"] for row in base["inputs"]["existing_residences"]}
    covered, anchors = {}, []
    for home in base["inputs"]["existing_residences"]:
        point = Point(*forward(home["longitude"], home["latitude"]))
        candidates = sorted(index.query(point.buffer(50)), key=lambda i: (geometries[i].distance(point), geometries[i].area))
        if not candidates:
            continue
        matched = int(candidates[0])
        covered.setdefault(matched, []).append(home)
        storeys = numeric_levels(registry[home["id"]]["CONFIRMED_STOREYS"] or registry[home["id"]]["NO_OF_STOREYS"])
        if storeys is not None and len(covered[matched]) == 1:
            anchors.append(dict(building_id=buildings[matched]["id"], registry_id=home["id"],
                                published_units=home["total_units"], published_storeys=storeys,
                                footprint_m2=round(geometries[matched].area, 2),
                                match_distance_m=round(geometries[matched].distance(point), 2),
                                gross_m2_per_unit=geometries[matched].area*storeys/home["total_units"]))
    duplicate_anchors = {buildings[i]["id"] for i, homes in covered.items() if len(homes) > 1}
    anchors = [row for row in anchors if row["building_id"] not in duplicate_anchors]
    model = calibration(anchors)
    model["source_ids"] = ["registered-apartments"]+[source["source_id"] for source in osm_sources]
    model["uncertainty"] = "Estimates use half to twice the central count, rounded to units. This is an assumed sensitivity band, not a confidence interval. Missing levels use local building-type medians."
    published = {}
    source_urls = {source["source_id"]: source["url"] for source in sources}
    specs_path = ROOT_DIR / "data/sources/posted_building_counts.json"
    specs = json.loads(specs_path.read_text(encoding="utf-8"))
    for spec in specs:
        source_id = "posted-building-"+spec["osm_way_id"]
        if "reviewed_counts" in spec:
            counts = spec["reviewed_counts"]
            source = record_source(specs_path, source_id=source_id, title="Manually reviewed public unit-count fact for "+spec["name"], url=spec["url"], publisher=spec["publisher"], version="Manual numeric extraction; checksum covers committed fact file, not upstream HTML", licence="Publisher website terms; numeric facts only", retrieved_at=spec["reviewed_on"])
            source["review_note"] = spec["evidence"]
            if refresh:
                raise ValueError("Manually extracted project counts require explicit source review before refresh: "+spec["name"])
        else:
            path, source = source_download((source_id, spec["cache_file"], "Public unit-count page for "+spec["name"], spec["url"], spec["publisher"], "retrieved published developer page", "Publisher website terms; numeric facts only"), refresh=refresh)
            counts = extract_posted_counts(path.read_text(encoding="utf-8"), spec["extractor"])
        published["osm-way-"+spec["osm_way_id"]] = dict(counts=counts, source_id=source_id)
        sources.append(source)
        source_urls[source_id] = source["url"]
    known_levels = {kind: [] for kind in sorted(RESIDENTIAL)}
    for building in buildings:
        kind = building["tags"]["building"]
        levels = numeric_levels(building["tags"].get("building:levels"))
        if kind in known_levels and levels is not None:
            known_levels[kind].append(levels)
    level_defaults = {kind: median(values) if values else (median(known_levels["apartments"]) if kind in ("apartments", "residential") else 2) for kind, values in known_levels.items()}
    model["assumed_storeys_by_type"] = level_defaults
    if access is None:
        access, _ = walking_graph(corridor)
    _, polygons = census_context(CACHE / "neighbourhood_boundaries.geojson", CACHE / "neighbourhood_profiles_2021.xlsx", corridor)
    inputs = bundle["inputs"]
    template = inputs["existing_residences"][0]
    audit = json.loads((REVIEWED / "existing_housing_audit.json").read_text(encoding="utf-8"))
    audit = [row for row in audit if not row["id"].startswith("osm-")]
    routes_path = REVIEWED / "simulation_walking_routes.geojson"
    # Keep the original rental/development routes, replacing earlier expansion.
    routes = [row for row in json.loads(routes_path.read_text(encoding="utf-8"))["features"] if not row["properties"]["entity_id"].startswith("osm-")]
    inventory, new_homes = [], []
    for position, building in enumerate(buildings):
        tags, polygon = building["tags"], building["geometry"]
        point = polygon.representative_point()
        lon, lat = inverse(point.x, point.y)
        kind = tags["building"]
        name = tags.get("name", "")
        address = " ".join(part for part in (tags.get("addr:housenumber", ""), tags.get("addr:street", "")) if part)
        levels = numeric_levels(tags.get("building:levels"))
        levels_status = "osm_posted" if levels is not None else "assumed_local_type_median"
        if levels is None:
            levels = level_defaults.get(kind, level_defaults["residential"])
        conditional, low, high = estimate_units(polygon.area, levels, model["gross_m2_per_unit"])
        posted_flats = tags.get("building:flats")
        osm_count = int(posted_flats) if posted_flats and posted_flats.isdigit() and int(posted_flats) > 0 else None
        row = dict(building_id=building["id"], name=name, address=address, latitude=lat, longitude=lon,
                   building_type=kind, footprint_m2=round(polygon.area, 2), storeys=levels, storeys_status=levels_status,
                   published_unit_counts=[], osm_posted_units=osm_count, published_source_url=None, selected_units=None, units_low=low, units_high=high,
                   conditional_residential_estimate=conditional, unit_count_status="unknown_use",
                   method="No confirmed residential use; conditional area/storeys estimate is not automatically added to housing.",
                   included_in_simulation=False, represented_by=[], accessible_stop_ids=[], source_ids=[source["source_id"] for source in osm_sources],
                   source_url="https://www.openstreetmap.org/"+building["osm_type"]+"/"+building["osm_id"], review_flags=[])
        homes = covered.get(position, [])
        if homes:
            counts = [home["total_units"] for home in homes]
            row.update(selected_units=sum(counts), units_low=sum(counts), units_high=sum(counts), published_unit_counts=counts,
                       unit_count_status="published_city", method="Published registration counts; footprint association uses nearest geometry within 50m, not verified parcel ownership.",
                       included_in_simulation=True, represented_by=[home["id"] for home in homes])
            row["accessible_stop_ids"] = sorted({stop for home in homes for stop in home["accessible_stop_ids"]})
            row["source_ids"].append("registered-apartments")
            row["published_source_url"] = source_urls["registered-apartments"]
            row["review_flags"].append("geometry_to_registry_match_estimated")
            inventory.append(row)
            continue
        city_records = by_address.get(address_key(address), []) if address else []
        city_ids = {"rentsafe-"+record["RSN"] for record in city_records}
        if city_ids & claimed:
            row.update(unit_count_status="covered_by_existing_record", represented_by=sorted(city_ids & claimed), method="Already counted through the published rental record; this geometry does not add demand again.")
            inventory.append(row)
            continue
        posted = published.get(building["id"])
        city_counts = [int(record["CONFIRMED_UNITS"] or record["NO_OF_UNITS"]) for record in city_records if (record["CONFIRMED_UNITS"] or record["NO_OF_UNITS"]).isdigit()]
        if len(city_counts) == 1:
            count = city_counts[0]
            row.update(selected_units=count, units_low=count, units_high=count, published_unit_counts=[count], unit_count_status="published_city", method="Exact normalized address match to City registered-apartment unit count.")
            row["source_ids"].append("registered-apartments")
            row["published_source_url"] = source_urls["registered-apartments"]
        elif posted:
            values = posted["counts"]
            count = round(median(values))
            row.update(selected_units=count, units_low=min(values), units_high=max(values), published_unit_counts=values,
                       unit_count_status="published_developer" if len(values) == 1 else "estimated_conflicting_published",
                       method="Developer's main project text, excluding related-project cards." if len(values) == 1 else "Same primary page posts conflicting counts; midpoint adopted as an explicit estimate, with posted min/max retained.")
            row["source_ids"].append(posted["source_id"])
            row["published_source_url"] = source_urls[posted["source_id"]]
            row["review_flags"].append("posted_project_count_not_verified_current_occupancy")
            if len(values) > 1:
                row["review_flags"].append("published_counts_conflict")
            if osm_count is not None and osm_count not in values:
                row["review_flags"].append("developer_vs_osm_count_conflict")
        elif osm_count is not None:
            row.update(selected_units=osm_count, units_low=osm_count, units_high=osm_count, published_unit_counts=[osm_count], unit_count_status="published_osm", method="Explicit OSM building:flats value; crowdsourced, not verified as a legal unit count.")
            row["published_source_url"] = row["source_url"]
        elif kind in RESIDENTIAL:
            row.update(selected_units=conditional, unit_count_status="estimated", method="Footprint area times storeys divided by locally calibrated gross m2/unit; missing storeys use a local building-type median.")
            row["source_ids"].append("registered-apartments")
            row["review_flags"].append("geometry_and_storeys_do_not_verify_legal_units")
            if levels_status != "osm_posted":
                row["review_flags"].append("storeys_assumed")
        elif kind != "yes":
            row.update(unit_count_status="not_identified_as_household_residential", method="Mapped use is not ordinary household housing; do not convert hotels, dormitory beds, shops or campuses into dwelling units without evidence.")
        if row["selected_units"] is not None:
            options = access(lon, lat, building["id"])
            row["accessible_stop_ids"] = [option["properties"]["stop_id"] for option in options]
            if options:
                contexts = [context for geometry, context in polygons if geometry.covers(Point(lon, lat))]
                if len(contexts) != 1:
                    raise ValueError("New building needs a unique census context: "+building["id"])
                home = dict(id=building["id"], name=name or address or building["id"], latitude=lat, longitude=lon,
                            total_units=row["selected_units"], occupied_share=template["occupied_share"], residents_per_occupied_unit=contexts[0]["residents_per_occupied_unit_2021"],
                            transit_share=template["transit_share"], accessible_stop_ids=row["accessible_stop_ids"])
                new_homes.append(home)
                claimed.update(city_ids)
                row.update(included_in_simulation=True, represented_by=[home["id"]])
                routes.extend(options)
                audit.append(dict(id=home["id"], address=address, status="included_expanded_building", unit_count_status=row["unit_count_status"], total_units=home["total_units"], source_ids=row["source_ids"]))
            else:
                row["review_flags"].append("no_mapped_walk_under_500m")
        inventory.append(row)
    inputs["existing_residences"] = base["inputs"]["existing_residences"] + new_homes
    status_counts = Counter(row["unit_count_status"] for row in inventory)
    summary = dict(mapped_buildings=len(inventory), by_unit_count_status=dict(status_counts), registry_buildings_preserved=len(base["inputs"]["existing_residences"]),
                   expanded_housing_buildings=len(new_homes), total_housing_records=len(inputs["existing_residences"]),
                   modelled_units=sum(home["total_units"] for home in inputs["existing_residences"]),
                   estimated_housing_records=sum(row["included_in_simulation"] and row["unit_count_status"].startswith("estimated") for row in inventory),
                   unresolved_use_records=status_counts["unknown_use"],
                   coverage="Every complete, valid OSM building footprint in the cached corridor tiles within 500m of a stop; not a guarantee every physical building is mapped. Unknown-use buildings have conditional estimates but are not silently treated as homes.")
    bundle["coverage"] = "Expanded mapped-building residential scenario: published counts plus explicitly estimated missing counts; unknown-use buildings remain flagged and excluded. Not a complete observed housing census or 505 demand estimate."
    bundle["building_inventory"] = dict(file="building_unit_inventory.json", summary=summary, calibration_file="building_unit_calibration.json")
    bundle["field_metadata"]["existing_residences"]["meaning"] = "Published city/developer/OSM counts where available; missing residential counts estimated from local footprint/storey calibration. Per-building source, method, range and inclusion are in building_unit_inventory.json. Occupancy and travel shares remain transferred assumptions."
    bundle["field_metadata"]["existing_residences"]["unit"] = "housing units, including explicit estimates"
    bundle["field_metadata"]["existing_residences"]["source_ids"] += [source["source_id"] for source in osm_sources] + ["posted-building-"+spec["osm_way_id"] for spec in specs]
    bundle["evidence"]["housing_audit"] = "existing_housing_audit.json and building_unit_inventory.json"
    bundle["evidence"]["existing_occupied_share"] += " Expanded condos and small homes also use this explicit scenario proxy; regional rental vacancy does not measure their occupancy."
    bundle["unresolved"][0] = summary["coverage"]
    bundle["unresolved"].append("Unpublished residential unit counts are estimates with broad assumed ranges; unknown building use, podium/storey ambiguity and conflicting posted figures require review. OSM geometry matches cannot verify legal units.")
    bundle["source_ids"] = [source["source_id"] for source in sources]
    write_json(REVIEWED / "building_unit_inventory.json", inventory)
    write_csv(REVIEWED / "building_unit_inventory.csv", inventory)
    write_json(REVIEWED / "building_unit_calibration.json", model)
    write_json(REVIEWED / "building_unit_summary.json", summary)
    write_json(REVIEWED / "existing_housing_audit.json", audit)
    write_json(REVIEWED / "simulation_sources.json", sources)
    write_json(REVIEWED / "simulation_input.json", bundle)
    write_csv(REVIEWED / "existing_residences.csv", inputs["existing_residences"])
    write_json(routes_path, dict(type="FeatureCollection", features=routes))
    print(json.dumps(summary, indent=2), flush=True)
    return bundle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true")
    args = parser.parse_args()
    build_inventory(refresh=args.refresh)


if __name__ == "__main__":
    main()
