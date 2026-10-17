"""Estimate nearest-stop pedestrian access from small, cached OpenStreetMap tiles."""
import csv
import json
import math
import xml.etree.ElementTree as ET
from pathlib import Path
from urllib.parse import urlencode

import networkx as nx
import osmnx as ox
from pyproj import Transformer
from shapely.geometry import LineString, Point, mapping
from shapely.ops import transform

from backend.config import ROOT_DIR
from data.sources.base import record_source


def build_walk_access(*, refresh: bool = False, adopt_existing: bool = False) -> dict:
    # Imported here to keep source download/cache handling consistent.
    from backend.scripts.prove_feasibility import cached, write_csv, write_json

    reviewed, cache = ROOT_DIR / "data/reviewed", ROOT_DIR / "data/cache"
    selection = json.loads((reviewed / "project_selection.json").read_text())
    corridor = json.loads((reviewed / "corridor.json").read_text())
    stops = {s["stop_id"]: s for s in corridor["stops"]}
    with (reviewed / "developments.csv").open(encoding="utf-8", newline="") as stream:
        projects = list(csv.DictReader(stream))
    forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
    sources = json.loads((reviewed / "sources.json").read_text())
    sources = [s for s in sources if not s["source_id"].startswith("osm-walk-")]
    access, features = [], []
    excluded = {"motorway", "motorway_link", "construction", "proposed", "abandoned", "bus_guideway", "raceway"}
    for project in projects:
        selected = next(p for p in selection["projects"] if p["application_number"] == project["application_number"])
        bbox = selected["osm_bbox"]
        url = "https://api.openstreetmap.org/api/0.6/map?" + urlencode({"bbox": ",".join(map(str, bbox))}, safe=",")
        number = project["address"].split()[0]
        raw_path = cached(url, cache / f"walk_{number}.osm", refresh=refresh, adopt_existing=adopt_existing)
        tree = ET.parse(raw_path)
        xml_root = tree.getroot()
        for way in list(xml_root.findall("way")):
            tags = {t.attrib["k"]: t.attrib["v"] for t in way.findall("tag")}
            if (not tags.get("highway") or tags["highway"] in excluded
                    or tags.get("area") == "yes" or tags.get("access") in {"private", "no"}
                    or tags.get("foot") in {"private", "no"}):
                xml_root.remove(way)
        for relation in list(xml_root.findall("relation")):
            xml_root.remove(relation)
        filtered = cache / f"walk_{number}_filtered.osm"
        tree.write(filtered, encoding="utf-8", xml_declaration=True)
        graph = ox.graph_from_xml(filtered, bidirectional=True)
        positions = {node: Point(*forward(data["x"], data["y"])) for node, data in graph.nodes(data=True)}
        for u, v, key, edge in graph.edges(keys=True, data=True):
            geometry = edge.get("geometry", LineString([(graph.nodes[u]["x"], graph.nodes[u]["y"]),
                                                       (graph.nodes[v]["x"], graph.nodes[v]["y"])]))
            edge["walk_length_m"] = transform(forward, geometry).length
        origin_lonlat = (float(project["lon"]), float(project["lat"]))
        stop = stops[project["nearest_stop_id"]]
        destination_lonlat = (stop["lon"], stop["lat"])
        origin, destination = Point(*forward(*origin_lonlat)), Point(*forward(*destination_lonlat))
        origin_node = min(positions, key=lambda n: positions[n].distance(origin))
        destination_node = min(positions, key=lambda n: positions[n].distance(destination))
        origin_connector = positions[origin_node].distance(origin)
        destination_connector = positions[destination_node].distance(destination)
        if max(origin_connector, destination_connector) > 100:
            raise ValueError(f"Walking network snap exceeds 100m: {project['address']}")
        route = nx.shortest_path(graph, origin_node, destination_node, weight="walk_length_m")
        coordinates = [origin_lonlat, (graph.nodes[origin_node]["x"], graph.nodes[origin_node]["y"])]
        street_names, network_m = [], 0.0
        for u, v in zip(route, route[1:]):
            edge = min(graph.get_edge_data(u, v).values(), key=lambda e: e["walk_length_m"])
            network_m += edge["walk_length_m"]
            name = edge.get("name", edge.get("highway", "unnamed path"))
            street_names.extend(name if isinstance(name, list) else [name])
            geometry = edge.get("geometry")
            edge_coordinates = list(geometry.coords) if geometry is not None else [
                (graph.nodes[u]["x"], graph.nodes[u]["y"]), (graph.nodes[v]["x"], graph.nodes[v]["y"])
            ]
            if Point(edge_coordinates[-1]).distance(Point(coordinates[-1])) < Point(edge_coordinates[0]).distance(Point(coordinates[-1])):
                edge_coordinates.reverse()
            coordinates.extend(edge_coordinates)
        coordinates.append(destination_lonlat)
        total_m = network_m + origin_connector + destination_connector
        if not math.isfinite(total_m) or total_m > selection["access_threshold_m"]:
            raise ValueError(f"Development exceeds the selected walking threshold: {project['address']}")
        source_id = "osm-walk-" + number
        sources.append(record_source(
            raw_path, source_id=source_id, title="OpenStreetMap pedestrian map around " + project["address"],
            url=url, publisher="OpenStreetMap contributors", version="retrieved snapshot",
            licence="https://www.openstreetmap.org/copyright",
        ))
        result = {
            "dev_id": project["dev_id"], "address": project["address"], "stop_id": stop["stop_id"],
            "walk_m": round(total_m, 2), "network_m": round(network_m, 2),
            "origin_connector_m": round(origin_connector, 2),
            "stop_connector_m": round(destination_connector, 2),
            "method": "OSM pedestrian shortest path plus straight-line address/stop connectors",
            "manual_review": "pending", "street_names": list(dict.fromkeys(street_names)),
            "source_ids": project["source_ids"].split(";") + [source_id],
        }
        access.append(result)
        features.append({"type": "Feature", "properties": result,
                         "geometry": mapping(LineString(coordinates))})
        project["walk_distance_m"] = round(total_m, 2)
        project["walk_status"] = "network_estimate_manual_review_pending"
        project["source_ids"] += ";" + source_id
    write_review_map(features)
    write_csv(reviewed / "developments.csv", projects)
    write_json(reviewed / "walking_access.json", access)
    write_json(reviewed / "walking_routes.geojson", {"type": "FeatureCollection", "features": features})
    write_json(reviewed / "sources.json", sources)
    report = json.loads((reviewed / "feasibility_report.json").read_text())
    for item, route in zip(report["developments"], access):
        item["walk_distance_m"] = route["walk_m"]
        item["walk_status"] = "network_estimate_manual_review_pending"
    report["missing_observations"] = [v for v in report["missing_observations"] if v != "Network walking distances and entrance/crossing review"]
    report["missing_observations"].append("Verified development entrances and manual walking-route/crossing review")
    write_json(reviewed / "feasibility_report.json", report)
    return {"routes": access, "manual_review_required": True}


def write_review_map(features: list[dict]) -> None:
    """Offline SVG for reviewing sidewalks, crossings and estimated connectors."""
    from html import escape

    forward = Transformer.from_crs(4326, 26917, always_xy=True).transform
    svg = ['<svg xmlns="http://www.w3.org/2000/svg" width="1260" height="500" viewBox="0 0 1260 500">',
           '<rect width="1260" height="500" fill="#f7f8fa"/>',
           '<text x="20" y="27" font-family="Arial" font-size="19">505 Dundas: pedestrian access review</text>']
    for index, feature in enumerate(features):
        properties = feature["properties"]
        route = [forward(*coordinate) for coordinate in feature["geometry"]["coordinates"]]
        xs, ys = zip(*route)
        x_min, x_max, y_min, y_max = min(xs) - 80, max(xs) + 80, min(ys) - 80, max(ys) + 80
        scale = min(380 / (x_max - x_min), 330 / (y_max - y_min))
        x_base = 20 + index * 420
        def xy(point):
            return (x_base + (point[0] - x_min) * scale, 420 - (point[1] - y_min) * scale)
        def points(coordinates):
            return " ".join(f"{x:.1f},{y:.1f}" for x, y in map(xy, coordinates))
        svg.extend([
            f'<text x="{x_base}" y="57" font-family="Arial" font-size="15">{escape(properties["address"])}</text>',
            f'<text x="{x_base}" y="77" font-family="Arial" font-size="12">{properties["walk_m"]:.0f} m estimate · {escape(properties["stop_id"])}</text>',
            f'<defs><clipPath id="panel-{index}"><rect x="{x_base}" y="90" width="390" height="340"/></clipPath></defs>',
            f'<g clip-path="url(#panel-{index})">',
        ])
        number = properties["address"].split()[0]
        tree = ET.parse(ROOT_DIR / f"data/cache/walk_{number}.osm").getroot()
        nodes = {node.attrib["id"]: forward(float(node.attrib["lon"]), float(node.attrib["lat"]))
                 for node in tree.findall("node")}
        for way in tree.findall("way"):
            tags = {tag.attrib["k"]: tag.attrib["v"] for tag in way.findall("tag")}
            coordinates = [nodes[ref.attrib["ref"]] for ref in way.findall("nd") if ref.attrib["ref"] in nodes]
            if len(coordinates) < 2:
                continue
            if "building" in tags:
                svg.append(f'<polygon points="{points(coordinates)}" fill="#e5e7eb" stroke="#c9ced6" stroke-width="0.6"/>')
            elif "highway" in tags:
                width = 1 if tags["highway"] in {"footway", "path", "steps"} else 4
                svg.append(f'<polyline points="{points(coordinates)}" fill="none" stroke="#bec7d2" stroke-width="{width}"/>')
                if tags.get("name") == "Dundas Street East":
                    x, y = xy(coordinates[len(coordinates) // 2])
                    svg.append(f'<text x="{x:.1f}" y="{y:.1f}" font-family="Arial" font-size="10" fill="#596579">Dundas East</text>')
        svg.append(f'<polyline points="{points(route)}" fill="none" stroke="#155eef" stroke-width="3"/>')
        for connector in (route[:2], route[-2:]):
            svg.append(f'<polyline points="{points(connector)}" fill="none" stroke="#d92d20" stroke-width="3" stroke-dasharray="4 3"/>')
        for point, label, colour in ((route[0], "Development", "#b54708"), (route[-1], "Streetcar stop", "#067647")):
            x, y = xy(point)
            svg.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="{colour}" stroke="white"/>')
            svg.append(f'<text x="{x + 8:.1f}" y="{y - 8:.1f}" font-family="Arial" font-size="11" fill="{colour}">{label}</text>')
        svg.append("</g>")
    svg.extend([
        '<text x="20" y="459" font-family="Arial" font-size="12">Blue: mapped pedestrian route. Red dashes: estimated address/stop connectors; actual entrances require review.</text>',
        '<text x="20" y="481" font-family="Arial" font-size="11">Map data © OpenStreetMap contributors (ODbL); development/address data © City of Toronto. Sources and timestamps: sources.json.</text>',
        '</svg>',
    ])
    (ROOT_DIR / "data/reviewed/walking_routes.svg").write_text("\n".join(svg) + "\n", encoding="utf-8")


def main() -> None:
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--refresh", action="store_true")
    parser.add_argument("--adopt-existing", action="store_true")
    args = parser.parse_args()
    print(json.dumps(build_walk_access(refresh=args.refresh, adopt_existing=args.adopt_existing), indent=2))


if __name__ == "__main__":
    main()
