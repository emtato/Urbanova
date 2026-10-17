"""Scoped OSM building inventory and conservative residential-unit estimates.

Published property counts remain distinct from estimates and source conflicts.
Building outlines and levels are geometry evidence, not legal dwelling counts.
"""
import re
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from statistics import median

from shapely.geometry import LineString, Polygon
from shapely.ops import polygonize, unary_union

RESIDENTIAL = {"apartments", "residential", "house", "detached", "semidetached_house", "terrace", "bungalow"}


class PageText(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip = 0
        self.parts = []

    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style"):
            self.skip += 1

    def handle_endtag(self, tag):
        if tag in ("script", "style") and self.skip:
            self.skip -= 1

    def handle_data(self, data):
        if not self.skip:
            self.parts.append(data.strip())


def extract_posted_counts(html, extractor):
    parser = PageText()
    parser.feed(html)
    text = " ".join(part for part in parser.parts if part)
    text = re.split(r"See what.s nearby", text, maxsplit=1, flags=re.I)[0]
    patterns = {
        "centrecourt": r"\b([\d,]+)\s+Units\b(?!\s*:)|\bUnits:\s*([\d,]+)",
        "panda": r"\bUnits\s+([\d,]+)\s+Condominium Suites\b|\bjust\s+([\d,]+)\s+units\b",
        "dundas_gardens": r"\b([\d,]+)\s+residential units\b|\bNumber of Units:\s*([\d,]+)",
    }
    counts = sorted({int(value.replace(",", "")) for match in re.findall(patterns[extractor], text, flags=re.I) for value in match if value})
    if not counts or any(not 0 < value < 10000 for value in counts):
        raise ValueError("Public unit-count selector needs review: " + extractor)
    return counts


def read_buildings(paths, project):
    """Read physical footprints; building multipolygon relations replace members."""
    nodes, ways, relations = {}, {}, {}
    for path in paths:
        for item in ET.parse(path).getroot():
            if item.tag == "node":
                nodes[item.attrib["id"]] = (float(item.attrib["lon"]), float(item.attrib["lat"]))
            elif item.tag in ("way", "relation"):
                tags = {tag.attrib["k"]: tag.attrib["v"] for tag in item.findall("tag")}
                if item.tag == "way":
                    ways[item.attrib["id"]] = (tags, [ref.attrib["ref"] for ref in item.findall("nd")])
                elif tags.get("building") and tags.get("type") == "multipolygon":
                    relations[item.attrib["id"]] = (tags, [member.attrib for member in item.findall("member")])
    result, replaced = [], set()
    for identity, (tags, members) in relations.items():
        pieces = {"outer": [], "inner": []}
        valid = True
        for member in members:
            if (member.get("role") or "outer") not in pieces:
                continue
            if member["type"] != "way" or member["ref"] not in ways:
                valid = False
                break
            _, refs = ways[member["ref"]]
            if any(ref not in nodes for ref in refs):
                valid = False
                break
            pieces[member.get("role") or "outer"].append(LineString([project(*nodes[ref]) for ref in refs]))
        if not valid or not pieces["outer"]:
            continue
        outer = unary_union(list(polygonize(unary_union(pieces["outer"]))))
        inner = unary_union(list(polygonize(unary_union(pieces["inner"])))) if pieces["inner"] else None
        geometry = outer.difference(inner) if inner is not None else outer
        if geometry.is_empty or not geometry.is_valid:
            continue
        replaced.update(member["ref"] for member in members if member["type"] == "way")
        result.append(dict(id="osm-relation-"+identity, osm_type="relation", osm_id=identity, tags=tags, geometry=geometry))
    for identity, (tags, refs) in ways.items():
        if identity in replaced or not tags.get("building") or tags["building"] == "no" or len(refs) < 4 or refs[0] != refs[-1] or any(ref not in nodes for ref in refs):
            continue
        geometry = Polygon([project(*nodes[ref]) for ref in refs])
        if geometry.is_valid and not geometry.is_empty and geometry.area > 1:
            result.append(dict(id="osm-way-"+identity, osm_type="way", osm_id=identity, tags=tags, geometry=geometry))
    return result


def numeric_levels(value):
    try:
        number = float(value)
        return number if 0 < number <= 100 else None
    except (TypeError, ValueError):
        return None


def calibration(anchors):
    """Median gross floor area/unit from locally matched, published city counts."""
    samples = [row for row in anchors if 30 <= row["gross_m2_per_unit"] <= 250]
    if len(samples) < 5:
        raise ValueError("Too few plausible local count/geometry anchors to estimate units")
    return dict(method="median of local published rental counts with matched footprint and storeys", sample_count=len(samples),
                gross_m2_per_unit=median(row["gross_m2_per_unit"] for row in samples), samples=samples,
                excluded_anchor_count=len(anchors)-len(samples),
                limitations="Geometry-to-property matches and uniform storeys can be wrong for podiums, split sites and building parts. Plausibility filtering is a modelling choice, not an observation.")


def estimate_units(area_m2, levels, gross_m2_per_unit):
    central = max(1, round(area_m2*levels/gross_m2_per_unit))
    # Deliberately broad scenario bounds, not statistical confidence intervals.
    return central, max(1, int(central*.5)), max(central+1, round(central*2))
