"""Flat-ground shadows of flat-roofed building prisms.

Geometry is in metres (EPSG:26917). A prism of height h casts the footprint swept along the
shadow vector: length h / tan(altitude), pointing away from the sun (azimuth + 180 degrees).
Terrain, roof shapes and shadows falling on walls are not modelled.
"""
import math

from shapely.affinity import translate
from shapely.geometry import Polygon
from shapely.ops import unary_union


def shadow_vector(height_m: float, altitude_deg: float, azimuth_deg: float) -> tuple[float, float]:
    """Horizontal offset (east, north) in metres of the roof's shadow; the sun must be up."""
    if altitude_deg <= 0:
        raise ValueError("No shadow is cast when the sun is below the horizon")
    length = height_m / math.tan(math.radians(altitude_deg))
    direction = math.radians(azimuth_deg + 180)
    return length * math.sin(direction), length * math.cos(direction)


def prism_shadow(footprint, height_m: float, altitude_deg: float, azimuth_deg: float):
    """Ground area shaded by one building, including the ground under it."""
    dx, dy = shadow_vector(height_m, altitude_deg, azimuth_deg)
    pieces = [footprint, translate(footprint, dx, dy)]
    polygons = getattr(footprint, "geoms", [footprint])
    for polygon in polygons:
        for ring in [polygon.exterior, *polygon.interiors]:
            points = list(ring.coords)
            for a, b in zip(points, points[1:]):
                wall = Polygon([a, b, (b[0] + dx, b[1] + dy), (a[0] + dx, a[1] + dy)])
                if wall.area > 0:
                    pieces.append(wall.buffer(0))
    return unary_union(pieces)


def ground_shadow(buildings, altitude_deg: float, azimuth_deg: float, area=None):
    """Union of shadows on open ground: building footprints are removed, then clipped to area.

    buildings is an iterable of (footprint, height_m) pairs.
    """
    buildings = list(buildings)
    shade = unary_union([prism_shadow(f, h, altitude_deg, azimuth_deg) for f, h in buildings])
    shade = shade.difference(unary_union([f for f, _ in buildings]))
    return shade.intersection(area) if area is not None else shade
