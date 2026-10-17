"""Build sourced inputs plus explicit scenario assumptions for SimulationInput.

Does not modify the simulator or use the synthetic comparison fixture. Raw
downloads are ignored; reviewed values, provenance and caveats are exported.
"""
import argparse
import csv
import json
import re
import xml.etree.ElementTree as ET
from urllib.error import HTTPError
from urllib.parse import urlencode

import networkx as nx
import numpy as np
import osmnx as ox
from pyproj import Transformer
from shapely.geometry import LineString, Point, shape, mapping
from shapely.ops import transform

from backend.config import ROOT_DIR
from backend.scripts.prove_feasibility import write_csv, write_json
from data.sources.base import fetch_cached, record_source
from data.sources.xlsx import worksheet_rows

CACHE = ROOT_DIR / "data/cache"
REVIEWED = ROOT_DIR / "data/reviewed"
SELECTION = ROOT_DIR / "data/sources/simulation_selection.json"
CITY_LICENCE = "https://open.toronto.ca/open-data-licence/"
SOURCES = [
    ("census-neighbourhoods-2021", "neighbourhood_profiles_2021.xlsx", "Toronto 2021 Census neighbourhood profiles, 158 model", "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/6e19a90f-971c-46b3-852c-0c48c436d1fc/resource/19d4a806-7385-4889-acf2-256f1e079060/download/nbhd_2021_census_profile_full_158model.xlsx", "City of Toronto / Statistics Canada", "2021 Census, 25% sample", CITY_LICENCE),
    ("neighbourhood-boundaries", "neighbourhood_boundaries.geojson", "Toronto neighbourhood boundaries, 158 model", "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/fc443770-ef0a-4025-9c2c-2cb558bfab00/resource/0719053b-28b7-48ea-b863-068823a93aaa/download/neighbourhoods-4326.geojson", "City of Toronto", "retrieved snapshot", CITY_LICENCE),
    ("registered-apartments", "registered_apartments.csv", "Apartment Building Registration Data", "https://ckan0.cf.opendata.inter.prod-toronto.ca/dataset/2b98b3f3-4f3a-42a4-a4e9-b44d3026595a/resource/97b8b7a4-baca-49c7-915d-335322dbcf95/download/apartment-building-registration-data.csv", "City of Toronto", "retrieved snapshot", CITY_LICENCE),
    ("tts-2022-wards", "tts2022_wards.csv", "2022 TTS Toronto ward summaries", "https://dmg.utoronto.ca/wp-content/uploads/2026/01/tts2022_ward_Toronto.csv", "University of Toronto Data Management Group", "2022 survey, published CSV January 2026", "Publisher terms; attributed numeric extracts only"),
    ("ttc-physical-capacity", "ttc_charter_capacity.html", "TTC LFLRV charter passenger capacity", "https://www.ttc.ca/en/doing-business-with-the-ttc/chartering-ttc-vehicles/charter-rates", "Toronto Transit Commission", "retrieved snapshot", "TTC website terms; attributed numeric extract"),
    ("ttc-planning-capacity", "ttc_planning_capacity.html", "TTC carrying capacity, historical 2019 section", "https://www.ttc.ca/transparency-and-accountability/Operating-Statistics/Operating-Statistics---2025/Conventional-System", "Toronto Transit Commission", "2019 capacity section on 2025 statistics page", "TTC website terms; attributed numeric extract"),
    ("ttc-505-observed-boardings", "ttc_2025_boardings.html", "Average weekday customer boardings, November 2025", "https://www.ttc.ca/transparency-and-accountability/Operating-Statistics/Operating-Statistics---2025/2025-Boardings", "Toronto Transit Commission", "November 2025", "TTC website terms; attributed numeric extract"),
    ("cmhc-vacancy-2025", "cmhc_vacancy_2025.html", "2025 Rental Market Survey release", "https://www.cmhc-schl.gc.ca/media-newsroom/news-releases/2025/canadas-vacancy-rate-rises-amid-historically-high-rental-construction", "Canada Mortgage and Housing Corporation", "2025 survey", "CMHC terms; attributed numeric extract"),
    ("planning-239-2024", "planning_239_2024.pdf", "239-255 Dundas East decision report", "https://www.toronto.ca/legdocs/mmis/2024/te/bgrd/backgroundfile-246156.pdf", "City of Toronto", "2024-05-24, pages 1-2", CITY_LICENCE),
    ("planning-500-2026", "planning_500_2026.pdf", "500 Dundas East decision report", "https://www.toronto.ca/legdocs/mmis/2026/te/bgrd/backgroundfile-288439.pdf", "City of Toronto", "2026-06-19, pages 1 and 4-5", CITY_LICENCE),
    ("planning-761-consultation", "planning_761_consultation.html", "761 Dundas East official consultation", "https://haveyoursay.toronto.ca/city-planning-development-review-community-consultations/761-dundas-street-east", "City of Toronto", "retrieved snapshot", CITY_LICENCE),
]


def normalized_address(value: str) -> str:
    return " ".join(value.upper().split())


def query_address(value: str) -> str:
    return " ".join(word.upper() if word in ("E", "W", "N", "S") else word for word in " ".join(value.split()).title().split())


def source_download(spec, *, refresh=False):
    source_id, filename, title, url, publisher, version, licence = spec
    path = fetch_cached(url, CACHE / filename, refresh=refresh)
    stamp = json.loads(path.with_suffix(path.suffix + ".meta.json").read_text())
    return path, record_source(path, source_id=source_id, title=title, url=url, publisher=publisher,
                               version=version, licence=licence, retrieved_at=stamp["retrieved_at"])


def housing_addresses(rows, selection, *, refresh=False):
    addresses = sorted({query_address(row["SITE_ADDRESS"]) for row in rows if row["PCODE"] in selection["housing_postal_areas"]})
    addresses = sorted(set(addresses + [re.sub(r"^(\d+)-\d+", r"\1", address) for address in addresses]))
    records, sources = [], []
    for index in range(0, len(addresses), 25):
        query = {"resource_id": "0b3756af-9caf-4f0f-ac28-9c6617adede4", "filters": json.dumps({"ADDRESS_FULL": addresses[index:index+25]}), "limit": 1000}
        url = "https://ckan0.cf.opendata.inter.prod-toronto.ca/api/3/action/datastore_search?" + urlencode(query)
        path, source = source_download((f"housing-addresses-{index//25}", f"housing_addresses_{index//25}.json", "Municipal address points for registered housing", url, "City of Toronto", "retrieved snapshot", CITY_LICENCE), refresh=refresh)
        response = json.loads(path.read_text(encoding="utf-8"))
        if not response.get("success") or response["result"]["total"] >= 1000:
            raise ValueError("Address query failed or was truncated")
        records.extend(response["result"]["records"])
        sources.append(source)
    return records, sources


def walking_graph(corridor, *, refresh=False):
    """Merge small OSM tiles; split a tile if OSM rejects its node count."""
    stops = corridor["stops"]
    west, east = min(stop["lon"] for stop in stops)-.007, max(stop["lon"] for stop in stops)+.007
    south, north = min(stop["lat"] for stop in stops)-.005, max(stop["lat"] for stop in stops)+.005
    root, seen, sources = ET.Element("osm", version="0.6", generator="FutureProof"), set(), []

    def tile(bounds, name, depth=0):
        url = "https://api.openstreetmap.org/api/0.6/map?" + urlencode({"bbox": ",".join(map(str, bounds))}, safe=",")
        try:
            path, source = source_download(("osm-housing-"+name, "housing_walk_"+name+".osm", "OSM pedestrian network for corridor housing", url, "OpenStreetMap contributors", "retrieved snapshot", "https://www.openstreetmap.org/copyright"), refresh=refresh)
        except HTTPError as error:
            if error.code != 400 or depth >= 2:
                raise
            w, s, e, n = bounds
            middle = (w+e)/2
            tile((w, s, middle, n), name+"a", depth+1)
            tile((middle, s, e, n), name+"b", depth+1)
            return
        sources.append(source)
        for element in ET.parse(path).getroot():
            identity = (element.tag, element.attrib.get("id"))
            if element.tag in ("node", "way") and identity not in seen:
                root.append(element)
                seen.add(identity)

    for x in range(4):
        for y in range(2):
            tile((west+(east-west)*x/4, south+(north-south)*y/2, west+(east-west)*(x+1)/4, south+(north-south)*(y+1)/2), f"{x}-{y}")
    excluded = {"motorway", "motorway_link", "construction", "proposed", "abandoned", "bus_guideway", "raceway"}
    usable_ways = []
    for way in root.findall("way"):
        tags = {tag.attrib["k"]: tag.attrib["v"] for tag in way.findall("tag")}
        if tags.get("highway") and tags["highway"] not in excluded and tags.get("area") != "yes" and tags.get("access") not in ("private", "no") and tags.get("foot") not in ("private", "no"):
            usable_ways.append(way)
    used_nodes = {ref.attrib["ref"] for way in usable_ways for ref in way.findall("nd")}
    filtered_root = ET.Element("osm", version="0.6", generator="FutureProof")
    filtered_root.extend(node for node in root.findall("node") if node.attrib["id"] in used_nodes)
    filtered_root.extend(usable_ways)
    path = CACHE / "housing_walk_merged.osm"
    ET.ElementTree(filtered_root).write(path, encoding="utf-8", xml_declaration=True)
    graph = ox.graph_from_xml(path, bidirectional=True, retain_all=True)
    forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
    for u, v, key, edge in graph.edges(keys=True, data=True):
        geometry = edge.get("geometry", LineString([(graph.nodes[u]["x"], graph.nodes[u]["y"]), (graph.nodes[v]["x"], graph.nodes[v]["y"])]))
        edge["walk_m"] = transform(forward, geometry).length
    nodes = list(graph.nodes)
    xy = np.array([forward(graph.nodes[node]["x"], graph.nodes[node]["y"]) for node in nodes])

    def nearest(lon, lat):
        distances = np.linalg.norm(xy-np.array(forward(lon, lat)), axis=1)
        index = int(np.argmin(distances))
        return nodes[index], float(distances[index])

    paths = {}
    for stop in stops:
        node, connector = nearest(stop["lon"], stop["lat"])
        if connector > 75:
            raise ValueError("Stop exceeds the network snap limit")
        distances, routes = nx.single_source_dijkstra(graph, node, weight="walk_m", cutoff=600)
        paths[stop["stop_id"]] = (connector, distances, routes)

    def access(lon, lat, entity_id):
        node, connector = nearest(lon, lat)
        if connector > 75:
            return []
        options = []
        for stop in stops:
            stop_connector, distances, routes = paths[stop["stop_id"]]
            if node not in distances:
                continue
            length = connector + stop_connector + distances[node]
            if length > 500:
                continue
            route = list(reversed(routes[node]))
            coords = [(lon, lat)]
            for u, v in zip(route, route[1:]):
                edge = min(graph.get_edge_data(u, v).values(), key=lambda item: item["walk_m"])
                geometry = edge.get("geometry")
                segment = list(geometry.coords) if geometry is not None else [(graph.nodes[u]["x"], graph.nodes[u]["y"]), (graph.nodes[v]["x"], graph.nodes[v]["y"])]
                if Point(segment[-1]).distance(Point(graph.nodes[u]["x"], graph.nodes[u]["y"])) < Point(segment[0]).distance(Point(graph.nodes[u]["x"], graph.nodes[u]["y"])):
                    segment.reverse()
                coords.extend(segment)
            if len(route) == 1:
                coords.append((graph.nodes[node]["x"], graph.nodes[node]["y"]))
            coords.append((stop["lon"], stop["lat"]))
            options.append({"type": "Feature", "properties": {"entity_id": entity_id, "stop_id": stop["stop_id"], "walk_m": round(length, 2), "address_connector_m": round(connector, 2), "stop_connector_m": round(stop_connector, 2), "manual_review": "pending", "method": "OSM network plus estimated address/stop connectors"}, "geometry": mapping(LineString(coords))})
        return sorted(options, key=lambda option: option["properties"]["walk_m"])[:2]
    return access, sources


def census_context(boundaries_path, workbook_path, corridor):
    rows = worksheet_rows(workbook_path)
    headers = rows[0]
    household = next(row for row in rows if row.get("A", "").strip() == "Average household size")
    occupied = next(row for row in rows if row.get("A", "").strip() == "Total - Private households by household size - 25% sample data")
    forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
    stop_points = [Point(*forward(stop["lon"], stop["lat"])) for stop in corridor["stops"]]
    contexts, polygons = [], []
    for feature in json.loads(boundaries_path.read_text(encoding="utf-8"))["features"]:
        geometry = shape(feature["geometry"])
        if not any(transform(forward, geometry).distance(point) <= 500 for point in stop_points):
            continue
        name = feature["properties"]["AREA_NAME"]
        canonical = lambda value: re.sub(r"[^a-z0-9]", "", value.lower())
        columns = [key for key, value in headers.items() if canonical(value) == canonical(name)]
        if len(columns) != 1:
            raise ValueError("Census neighbourhood name does not match boundaries: " + name)
        column = columns[0]
        contexts.append(dict(neighbourhood=name, occupied_private_households_2021=int(occupied[column]), residents_per_occupied_unit_2021=float(household[column]), census_sample="25%", source_ids=["census-neighbourhoods-2021", "neighbourhood-boundaries"]))
        polygons.append((geometry, contexts[-1]))
    return contexts, polygons


def travel_context(path):
    rows = list(csv.reader(path.open(encoding="utf-8-sig")))
    column = rows[2].index("Ward 13 of Toronto")

    def value(label):
        matched = [row for row in rows if row and row[0] == label]
        if len(matched) != 1 or matched[0][column] in ("*", "", "N/A"):
            raise ValueError("Missing/suppressed TTS row: " + label)
        return int(matched[0][column])

    residents = value("Total Number of persons")
    trips = value("Total number of trips made by residents during the morning peak period (6:00am to 8:59 pm)")
    transit = value("Number of trips by residents by transit excluding GO rail during the morning peak period (6:00 am to 8:59 am)")
    go = value("Number of trips by residents by GO rail only during the morning peak period (6:00am to 8:59 pm)")
    joint = value("Number of trips by residents by joint GO rail and public transit during the morning peak period (6:00am to 8:59 pm)")
    return dict(geography="Toronto Ward 13", survey_year=2022, source_window="06:00-09:00", residents=residents, all_mode_resident_trips=trips,
                transit_excluding_go_rail=transit, go_rail_only=go, joint_go_and_transit=joint, transit_share=(transit+go+joint)/trips,
                trips_per_resident_3h=trips/residents, source_ids=["tts-2022-wards"],
                caveat="CSV contains an 8:59 pm typo on AM rows; adjacent AM transit row specifies am. These are expanded resident-trip survey estimates, not trips originating in the area or observed 505 boardings.")


def build(*, refresh=False, expand_buildings=True):
    selection = json.loads(SELECTION.read_text(encoding="utf-8"))
    corridor = json.loads((REVIEWED / "corridor.json").read_text(encoding="utf-8"))
    paths, sources = {}, json.loads((REVIEWED / "sources.json").read_text(encoding="utf-8"))
    for spec in SOURCES:
        paths[spec[0]], source = source_download(spec, refresh=refresh)
        sources.append(source)
    print("Official evidence downloaded or verified in cache.", flush=True)
    census, polygons = census_context(paths["neighbourhood-boundaries"], paths["census-neighbourhoods-2021"], corridor)
    travel = travel_context(paths["tts-2022-wards"])
    registry = list(csv.DictReader(paths["registered-apartments"].open(encoding="utf-8-sig")))
    address_rows, address_sources = housing_addresses(registry, selection, refresh=refresh)
    sources.extend(address_sources)
    address_map = {}
    for row in address_rows:
        address_map.setdefault(normalized_address(row["ADDRESS_FULL"]), []).append(row)
    access, walk_sources = walking_graph(corridor, refresh=refresh)
    print("Pedestrian graph and stop routes built.", flush=True)
    sources.extend(walk_sources)
    forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
    stop_points = [Point(*forward(stop["lon"], stop["lat"])) for stop in corridor["stops"]]
    route_features, residences, audit, seen = [], [], [], set()

    def household_size(lon, lat):
        matched = [context for polygon, context in polygons if polygon.covers(Point(lon, lat))]
        if len(matched) != 1:
            raise ValueError("Housing point does not match exactly one census neighbourhood")
        return matched[0]

    for row in registry:
        if row["PCODE"] not in selection["housing_postal_areas"]:
            continue
        identity = "rentsafe-" + row["RSN"]
        if identity in seen:
            raise ValueError("Duplicate registered building RSN")
        seen.add(identity)
        key = normalized_address(row["SITE_ADDRESS"])
        candidates = address_map.get(key) or address_map.get(re.sub(r"^(\d+)-\d+", r"\1", key), [])
        candidates = {candidate["ADDRESS_POINT_ID"]: candidate for candidate in candidates}
        if len(candidates) != 1:
            audit.append(dict(id=identity, address=row["SITE_ADDRESS"], status="address_unmatched_or_ambiguous", candidates=len(candidates)))
            continue
        address = next(iter(candidates.values()))
        geometry = address["geometry"]
        if isinstance(geometry, str):
            geometry = json.loads(geometry)
        lon, lat = geometry["coordinates"]
        if min(point.distance(Point(*forward(lon, lat))) for point in stop_points) > selection["housing_screen_m"]:
            continue
        units = row["CONFIRMED_UNITS"] or row["NO_OF_UNITS"]
        if not units or int(units) <= 0:
            audit.append(dict(id=identity, address=row["SITE_ADDRESS"], status="missing_unit_count", candidates=1))
            continue
        options = access(lon, lat, identity)
        if not options:
            audit.append(dict(id=identity, address=row["SITE_ADDRESS"], status="no_mapped_walk_under_500m", candidates=1))
            continue
        context = household_size(lon, lat)
        residences.append(dict(id=identity, name=row["SITE_ADDRESS"].strip(), latitude=lat, longitude=lon, total_units=int(units),
                               occupied_share=selection["existing_occupied_share"], residents_per_occupied_unit=context["residents_per_occupied_unit_2021"],
                               transit_share=travel["transit_share"], accessible_stop_ids=[option["properties"]["stop_id"] for option in options]))
        audit.append(dict(id=identity, address=row["SITE_ADDRESS"], status="included_partial_rental_baseline", candidates=1,
                          total_units=int(units), unit_field="CONFIRMED_UNITS" if row["CONFIRMED_UNITS"] else "NO_OF_UNITS", address_point_id=address["ADDRESS_POINT_ID"],
                          neighbourhood=context["neighbourhood"], source_ids=["registered-apartments", "census-neighbourhoods-2021"]+[item["source_id"] for item in address_sources]))
        route_features.extend(options)
    developments, development_evidence = [], []
    with (REVIEWED / "developments.csv").open(encoding="utf-8", newline="") as handle:
        for row in csv.DictReader(handle):
            rule = selection["development_reconciliation"][row["application_number"]]
            lon, lat = float(row["lon"]), float(row["lat"])
            context = household_size(lon, lat)
            options = access(lon, lat, row["dev_id"])
            if not options:
                raise ValueError("No mapped development access: " + row["address"])
            developments.append(dict(id=row["dev_id"], name=row["address"], latitude=lat, longitude=lon,
                                     net_added_units=rule["adopted_total_units"]-rule["removed_existing_units"], occupied_share=selection["new_occupied_share"],
                                     residents_per_occupied_unit=context["residents_per_occupied_unit_2021"], transit_share=travel["transit_share"],
                                     accessible_stop_ids=[option["properties"]["stop_id"] for option in options]))
            development_evidence.append(dict(id=row["dev_id"], pipeline_proposed_units=int(row["proposed_units"]), **rule))
            route_features.extend(options)
    if not residences:
        raise ValueError("No existing housing was included")
    entries = sorted(trip["entry_t_s"] for trip in corridor["scheduled_trips"])
    mean_gap = sum(b-a for a, b in zip(entries, entries[1:])) / (len(entries)-1)
    start, end = (sum(int(part)*factor for part, factor in zip(corridor["window"][key].split(":"), (3600, 60, 1))) for key in ("start", "end"))
    inputs = dict(stops=[dict(id=stop["stop_id"], name=stop["name"], latitude=stop["lat"], longitude=stop["lon"], sequence=stop["seq"]) for stop in corridor["stops"]],
                  existing_residences=residences, developments=developments,
                  link_travel_times_s=[link["scheduled_time_s"] for link in corridor["links"]], streetcar_capacity=selection["streetcar_capacity"], headway_s=mean_gap,
                  rush_hour_duration_s=end-start, start_time_s=start, end_time_s=end,
                  trips_per_resident_in_window=travel["trips_per_resident_3h"]*selection["am_window_transfer_factor"],
                  headway_randomness_s=selection["headway_randomness_s"], commuter_distribution=selection["commuter_distribution"], seed=selection["seed"])
    inputs["link_travel_time_variation_share"] = selection["link_travel_time_variation_share"]
    bundle = dict(format_version="simulation-input-v1", corridor_id=corridor["corridor_id"], fixture=False, product_label="scenario experiment", coverage=selection["model_scope"], inputs=inputs,
                  evidence=dict(developments=development_evidence, housing_audit="existing_housing_audit.json", household_size="2021 neighbourhood mean transferred to each building: assumption, not observed building occupancy",
                                existing_occupied_share="Assumed transfer: 1 minus CMHC 2025 Toronto CMA purpose-built vacancy of 3%; not an observed building rate, especially for social housing.",
                                new_occupied_share="Assumed future fully occupied phase; no completion date or current occupancy claim.",
                                transit_share="Assumed transfer of TTS 2022 Ward 13 resident-trip AM share including GO-only and GO+transit; not specifically 505 or westbound.",
                                trips_per_resident_in_window="Assumed uniform transfer from TTS 06:00-09:00 to 07:00-09:00 using factor 2/3.",
                                link_travel_times_s="GTFS schedule differences as proxy; may include dwell. Do not add another dwell component without correcting for overlap.",
                                streetcar_capacity="TTC physical maximum 251 (70 seats + 181 standing). Historical planned loading is 130, not the same quantity.",
                                headway_s="Arithmetic mean of adjacent dated GTFS entry gaps, not median or observed reliability.",
                                arrival_variability="Regular headways and uniform passenger arrivals are assumptions; seed is internal."),
                  observed_passenger_demand=dict(route="505", average_weekday_boardings=32100, period="November 2025", geography="whole route, both directions, all day", source_ids=["ttc-505-observed-boardings"], segment_am_boardings=None, incoming_occupancy=None),
                  unresolved=["Only registered rental buildings with unambiguous address matches and mapped walks under 500m are included. Condos, small homes, unmatched buildings and other baseline riders are omitted; this is not a complete catchment census.",
                              "No observed stop/direction/time-window boardings or incoming load were found. Do not scale whole-route daily boardings into this segment without an explicit model.",
                              "transit_share is all transit; the owner must agree corridor/direction/destination assignment before interpreting generated riders as 505 demand.",
                              "Walking paths use estimated connectors; legal crossings, entrances and closures remain unverified. Network access is not field sign-off.",
                              "761 existing-unit replacement is assumed zero. 239 report and pipeline versions disagree; the chosen report revision is explicit.",
                              "The default reporting cap is 09:00, the end of passenger arrivals. Late cars/riders may remain unresolved; the simulation owner must choose and record a clearance rule."],
                  source_manifest="simulation_sources.json", source_ids=[source["source_id"] for source in sources])
    bundle["field_metadata"] = {
        "stops": dict(unit="WGS84 degrees; zero-based sequence", status="sourced", source_ids=["ttc-gtfs"]),
        "existing_residences": dict(unit="registered housing units", status="mixed", source_ids=["registered-apartments", "census-neighbourhoods-2021", "cmhc-vacancy-2025", "tts-2022-wards"], meaning="Unit counts sourced; coordinates geocoded; household size, occupancy and transit share transferred assumptions; mapped access still needs review."),
        "developments": dict(unit="net-added units", status="mixed", source_ids=["planning-239-2024", "planning-500-2026", "planning-761-consultation"], meaning="See per-project revision and replacement-count reconciliation. Future occupied share is an assumption, not today's occupancy."),
        "link_travel_times_s": dict(unit="seconds", status="proxy", source_ids=["ttc-gtfs"], meaning="Scheduled stop-time differences may include dwell; not an observed movement-only measure."),
        "streetcar_capacity": dict(unit="passengers/vehicle", status="sourced", source_ids=["ttc-physical-capacity"], meaning="251 is the physical maximum. Historical TTC planned loading is 130; the owner can model a lower effective cap explicitly."),
        "headway_s": dict(unit="seconds/entry", status="derived_schedule", source_ids=["ttc-gtfs"], meaning="Mean of successive entry gaps; not the 360-second median and not observed service."),
        "rush_hour_duration_s": dict(unit="seconds", status="user_selected", source_ids=[], meaning="07:00-09:00 Toronto time on the selected GTFS service date."),
        "start_time_s": dict(unit="service-day seconds", status="user_selected", source_ids=[], meaning="07:00 local is 25200 seconds after midnight."),
        "end_time_s": dict(unit="service-day seconds", status="user_selected", source_ids=[], meaning="09:00 local is 32400 seconds. This is an explicit reporting cap; late vehicles remain unresolved unless the owner extends it."),
        "trips_per_resident_in_window": dict(unit="all-mode trips/resident/2h", status="assumed_transfer", source_ids=["tts-2022-wards"], meaning="Resident-trip AM survey total divided by resident population, then multiplied by 2/3 under a uniform-within-3h assumption."),
        "headway_randomness_s": dict(unit="seconds, maximum deviation", status="assumed", source_ids=[], meaning="Zero retains regular entries; this is not measured variability or a standard deviation."),
        "link_travel_time_variation_share": dict(unit="fractional maximum duration variation", status="user_selected", source_ids=[], meaning="Zero keeps fixed link times. This control is not an observed variation estimate or standard deviation."),
        "commuter_distribution": dict(unit="relative arrival weights", status="assumed", source_ids=[], meaning="A single bin assumes uniform arrivals over the window."),
        "seed": dict(unit="integer", status="internal", source_ids=[], meaning="Reproducible random seed; not real-world data."),
    }
    write_json(REVIEWED / "registered_rental_input.json", bundle)
    write_json(REVIEWED / "simulation_input.json", bundle)
    write_json(REVIEWED / "simulation_sources.json", sources)
    write_json(REVIEWED / "housing_context_2021.json", census)
    write_json(REVIEWED / "travel_context_2022.json", travel)
    write_json(REVIEWED / "existing_housing_audit.json", audit)
    write_csv(REVIEWED / "existing_residences.csv", residences)
    write_json(REVIEWED / "simulation_walking_routes.geojson", dict(type="FeatureCollection", features=route_features))
    print(json.dumps(dict(existing_buildings=len(residences), registered_units=sum(item["total_units"] for item in residences),
                          net_development_units=[item["net_added_units"] for item in developments], mean_scheduled_headway_s=mean_gap,
                          trips_per_resident_in_window=inputs["trips_per_resident_in_window"], transit_share=travel["transit_share"], walking_routes=len(route_features)), indent=2))
    if expand_buildings:
        from backend.scripts.build_building_inventory import build_inventory
        return build_inventory(access=access, refresh=refresh)
    return bundle


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--rental-only", action="store_true", help="Rebuild only the published registered-rental baseline")
    args = parser.parse_args()
    build(refresh=args.refresh, expand_buildings=not args.rental_only)


if __name__ == "__main__":
    main()
