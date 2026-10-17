"""Load the reviewed data into the simulation owner's existing dataclasses.

This adapter creates fresh Stop queues each time. It supplies inputs only and
does not run, configure or alter the simulation engine.
"""
import json
import math
from dataclasses import fields
from pathlib import Path

from pydantic import TypeAdapter

from backend.config import ROOT_DIR
from backend.simulation.inputs import SimulationInput

DEFAULT_PATH = ROOT_DIR / "data/reviewed/simulation_input.json"


def load_simulation_input(path: Path = DEFAULT_PATH, *, overrides: dict | None = None) -> SimulationInput:
    bundle = json.loads(Path(path).read_text(encoding="utf-8"))
    if bundle.get("format_version") != "simulation-input-v1" or bundle.get("fixture") is not False:
        raise ValueError("Expected the reviewed scenario input bundle, not a synthetic contract fixture")
    values = bundle["inputs"] | (overrides or {})
    expected = {field.name for field in fields(SimulationInput)}
    if set(values) != expected:
        raise ValueError(f"SimulationInput field drift: missing={sorted(expected-set(values))}, extra={sorted(set(values)-expected)}")
    result = TypeAdapter(SimulationInput).validate_python(values)
    ids = [stop.id for stop in result.stops]
    if len(set(ids)) != len(ids) or [stop.sequence for stop in result.stops] != list(range(len(ids))):
        raise ValueError("Stops must have unique IDs and a contiguous travel order")
    if len(result.link_travel_times_s) != len(result.stops)-1:
        raise ValueError("One travel time is required per adjacent stop pair")
    positive = [result.streetcar_capacity, result.headway_s, result.rush_hour_duration_s, *result.link_travel_times_s]
    if any(not math.isfinite(value) or value <= 0 for value in positive):
        raise ValueError("Capacity, headway, duration and link times must be finite and positive")
    if not math.isfinite(result.trips_per_resident_in_window) or result.trips_per_resident_in_window < 0:
        raise ValueError("Trip rate must be finite and nonnegative")
    if not 0 <= result.headway_randomness_s < result.headway_s:
        raise ValueError("Bounded headway randomness must be nonnegative and below the mean")
    if not 0 <= result.start_time_s < result.end_time_s:
        raise ValueError("Reporting times must use increasing nonnegative service-day seconds")
    if not math.isfinite(result.link_travel_time_variation_share) or not 0 <= result.link_travel_time_variation_share < 1:
        raise ValueError("Travel-time variation must be a finite fraction from zero up to, but excluding, one")
    if not result.commuter_distribution or any(not math.isfinite(value) or value < 0 for value in result.commuter_distribution) or sum(result.commuter_distribution) <= 0:
        raise ValueError("Arrival weights must be finite, nonnegative and have a positive sum")
    housing = [*result.existing_residences, *result.developments]
    if len({item.id for item in housing}) != len(housing):
        raise ValueError("Existing and new housing IDs must be unique")
    for item in housing:
        if not -90 <= item.latitude <= 90 or not -180 <= item.longitude <= 180:
            raise ValueError("Housing coordinates must use WGS84")
        if not 0 <= item.occupied_share <= 1 or not 0 <= item.transit_share <= 1:
            raise ValueError("Occupancy and transit share must be fractions")
        if not math.isfinite(item.residents_per_occupied_unit) or item.residents_per_occupied_unit <= 0:
            raise ValueError("Residents per occupied unit must be finite and positive")
        units = getattr(item, "total_units", getattr(item, "net_added_units", -1))
        if units < 0:
            raise ValueError("Housing units must be nonnegative")
        if not item.accessible_stop_ids or len(set(item.accessible_stop_ids)) != len(item.accessible_stop_ids) or set(item.accessible_stop_ids)-set(ids):
            raise ValueError("Housing access requires distinct known corridor stops")
    return result
