"""Solar position from the NOAA solar calculator equations.

Altitude ignores atmospheric refraction (under about 0.6 degrees, only near the horizon).
Azimuth is clockwise from true north, so 180 is due south.
"""
import math
from datetime import date, datetime, timedelta, timezone


def _julian_century(when: datetime) -> float:
    days = (when - datetime(2000, 1, 1, 12, tzinfo=timezone.utc)).total_seconds() / 86400
    return days / 36525


def _declination_and_equation_of_time(century: float) -> tuple[float, float]:
    mean_longitude = (280.46646 + century * (36000.76983 + century * 0.0003032)) % 360
    mean_anomaly = 357.52911 + century * (35999.05029 - 0.0001537 * century)
    eccentricity = 0.016708634 - century * (0.000042037 + 0.0000001267 * century)
    m = math.radians(mean_anomaly)
    centre = (math.sin(m) * (1.914602 - century * (0.004817 + 0.000014 * century))
              + math.sin(2 * m) * (0.019993 - 0.000101 * century) + math.sin(3 * m) * 0.000289)
    omega = math.radians(125.04 - 1934.136 * century)
    apparent_longitude = mean_longitude + centre - 0.00569 - 0.00478 * math.sin(omega)
    mean_obliquity = 23 + (26 + (21.448 - century * (46.815 + century * (0.00059 - century * 0.001813))) / 60) / 60
    obliquity = math.radians(mean_obliquity + 0.00256 * math.cos(omega))
    declination = math.asin(math.sin(obliquity) * math.sin(math.radians(apparent_longitude)))
    y = math.tan(obliquity / 2) ** 2
    l0 = math.radians(mean_longitude)
    equation_of_time = 4 * math.degrees(
        y * math.sin(2 * l0) - 2 * eccentricity * math.sin(m)
        + 4 * eccentricity * y * math.sin(m) * math.cos(2 * l0)
        - 0.5 * y * y * math.sin(4 * l0) - 1.25 * eccentricity ** 2 * math.sin(2 * m)
    )
    return declination, equation_of_time


def solar_position(lat: float, lon: float, when: datetime) -> dict:
    """Altitude and azimuth in degrees for an aware datetime."""
    when = when.astimezone(timezone.utc)
    declination, equation_of_time = _declination_and_equation_of_time(_julian_century(when))
    minutes = when.hour * 60 + when.minute + when.second / 60
    hour_angle = math.radians(((minutes + equation_of_time + 4 * lon) % 1440) / 4 - 180)
    phi = math.radians(lat)
    cos_zenith = math.sin(phi) * math.sin(declination) + math.cos(phi) * math.cos(declination) * math.cos(hour_angle)
    zenith = math.acos(max(-1.0, min(1.0, cos_zenith)))
    if math.sin(zenith) < 1e-9:
        azimuth = 180.0
    else:
        cos_azimuth = (math.sin(phi) * math.cos(zenith) - math.sin(declination)) / (math.cos(phi) * math.sin(zenith))
        angle = math.degrees(math.acos(max(-1.0, min(1.0, cos_azimuth))))
        azimuth = (angle + 180) % 360 if hour_angle > 0 else (540 - angle) % 360
    return {"altitude_deg": 90 - math.degrees(zenith), "azimuth_deg": azimuth}


def solar_noon(lat: float, lon: float, day: date) -> datetime:
    """UTC time when the sun crosses the meridian."""
    approximate = datetime(day.year, day.month, day.day, 12, tzinfo=timezone.utc)
    _, equation_of_time = _declination_and_equation_of_time(_julian_century(approximate))
    return datetime(day.year, day.month, day.day, tzinfo=timezone.utc) + timedelta(minutes=720 - 4 * lon - equation_of_time)


def shadow_length_m(height_m: float, altitude_deg: float) -> float | None:
    """Horizontal shadow length on flat ground; None when the sun is down."""
    if altitude_deg <= 0:
        return None
    return height_m / math.tan(math.radians(altitude_deg))
