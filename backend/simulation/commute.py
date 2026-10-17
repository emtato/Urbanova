"""Commute destination sampling and the 750 m routing rule.

Turns one home location into one commute decision for the westbound 505
segment (Broadview -> TMU). See docs/commute-demand-assumptions.md.

    from random import Random
    from backend.simulation.commute import sample_streetcar_trip

    trip = sample_streetcar_trip(43.6578, -79.3727, Random(7))
    if trip is not None:
        trip.board_stop_id, trip.alight_stop_id   # alight None = rides past TMU

Use `load_commute_model().assign(...)` for the full decision, including walk,
subway and outside-model outcomes and the sampled workplace.

Scenario assumptions (not observations):
- 60% of commuters get a destination west of home, 40% elsewhere; within each
  group the 2021 Census usual-workplace tract counts weight the choice.
- "Walking distance" = straight-line distance x WALK_DETOUR_FACTOR. Workplace
  points are tract points, not buildings, so the rule is an approximation.
- Rule order: walk if work <= 750 m; else Line 1 if a station <= 750 m from home
  and another station <= 750 m from work; else 505 westbound from a stop <= 750 m
  from home to a later stop <= 750 m from work (including stops past TMU), or to
  TMU for a Line 1 transfer; else outside this simplified model.
- No travel-time comparison; Line 2, other routes and transfers are not modelled.
"""

from __future__ import annotations

import csv
import json
import math
from bisect import bisect_left, bisect_right
from dataclasses import dataclass
from functools import lru_cache
from itertools import accumulate
from pathlib import Path
from random import Random
from typing import Iterable, Literal

ROOT_DIR = Path(__file__).resolve().parents[2]
REVIEWED = ROOT_DIR / "data/reviewed"

WALK_LIMIT_M = 750.0
# Median network-walk / straight-line ratio over the 707 reviewed home-to-stop
# routes (>100 m) in data/reviewed/simulation_walking_routes.geojson.
WALK_DETOUR_FACTOR = 1.37
WESTWARD_SHARE = 0.6
TMU_STOP_ID = "ttc-stop-2136"
TMU_STATION_ID = "ttc-line1-tmu-station"
EARTH_RADIUS_M = 6_371_008.8

Mode = Literal["walk", "subway", "streetcar", "outside_model"]
Exit = Literal["corridor_stop", "beyond_segment", "line1_transfer"]


def straight_line_m(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Haversine great-circle distance in metres."""
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp, dl = p2 - p1, math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * EARTH_RADIUS_M * math.asin(math.sqrt(a))


@dataclass(frozen=True)
class Place:
    id: str
    name: str
    latitude: float
    longitude: float


@dataclass(frozen=True)
class Workplace:
    tract_uid: str
    latitude: float
    longitude: float
    workers: int  # 2021 usual-workplace workers; used only as a weight.


@dataclass(frozen=True)
class RouteStop:
    """A westbound 505 stop. `order` increases in travel direction."""
    order: int
    gtfs_stop_id: str
    name: str
    latitude: float
    longitude: float
    corridor_stop_id: str | None  # None = past TMU, outside the modelled segment.


@dataclass(frozen=True)
class StreetcarTrip:
    board_stop_id: str
    # Matches Passenger.destination_stop_id: None means "beyond the modelled corridor".
    alight_stop_id: str | None
    exit: Exit
    beyond_segment_stop: RouteStop | None = None  # Actual off-corridor 505 stop, if any.
    transfer_station_id: str | None = None  # Line 1 station reached after TMU transfer.
    walk_to_board_m: float = 0.0
    walk_from_exit_m: float = 0.0  # From alighting stop (or work-end Line 1 station) to work.


@dataclass(frozen=True)
class CommuteAssignment:
    mode: Mode
    workplace: Workplace
    westward: bool  # Which sampling group produced the workplace.
    reason: str
    streetcar: StreetcarTrip | None = None
    home_station_id: str | None = None  # Subway mode only.
    work_station_id: str | None = None  # Subway mode or Line 1 transfer.
    home_to_work_walk_m: float = 0.0


class CommuteModel:
    def __init__(
        self,
        workplaces: Iterable[Workplace],
        corridor_stops: Iterable[Place],
        beyond_stops: Iterable[Place],
        line1_stations: Iterable[Place],
        *,
        walk_limit_m: float = WALK_LIMIT_M,
        detour_factor: float = WALK_DETOUR_FACTOR,
        westward_share: float = WESTWARD_SHARE,
        tmu_stop_id: str = TMU_STOP_ID,
        tmu_station_id: str = TMU_STATION_ID,
    ):
        if not 0 <= westward_share <= 1 or walk_limit_m <= 0 or detour_factor < 1:
            raise ValueError("Invalid commute model parameters")
        self.walk_limit_m = walk_limit_m
        self.detour_factor = detour_factor
        self.westward_share = westward_share
        self.tmu_station_id = tmu_station_id

        places = [w for w in workplaces if w.workers > 0]
        if not places:
            raise ValueError("At least one weighted workplace is required")
        self._workplaces = sorted(places, key=lambda w: w.longitude)  # West -> east.
        self._longitudes = [w.longitude for w in self._workplaces]
        self._cumulative = list(accumulate(w.workers for w in self._workplaces))

        # Corridor stops first (already in travel order), then stops past TMU.
        self.route = tuple(
            RouteStop(i, p.id.removeprefix("ttc-stop-"), p.name, p.latitude, p.longitude, corridor)
            for i, (p, corridor) in enumerate(
                [(p, p.id) for p in corridor_stops] + [(p, None) for p in beyond_stops]
            )
        )
        self._by_corridor_id = {s.corridor_stop_id: s for s in self.route if s.corridor_stop_id}
        if tmu_stop_id not in self._by_corridor_id:
            raise ValueError("TMU must be a corridor stop")
        self._tmu = self._by_corridor_id[tmu_stop_id]
        self.stations = tuple(line1_stations)

    # -- distances ---------------------------------------------------------
    def walk_m(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        return straight_line_m(lat1, lon1, lat2, lon2) * self.detour_factor

    def _within(self, lat: float, lon: float, items, get=lambda x: (x.latitude, x.longitude)):
        """Items within the walking limit, nearest first, as (walk_m, item)."""
        found = [(self.walk_m(lat, lon, *get(item)), item) for item in items]
        return sorted((pair for pair in found if pair[0] <= self.walk_limit_m), key=lambda p: p[0])

    # -- destination sampling ---------------------------------------------
    def sample_workplace(self, home_lon: float, rng: Random) -> tuple[Workplace, bool]:
        """Pick westward (prob. westward_share) or other, then weight by workers."""
        split = bisect_left(self._longitudes, home_lon)  # [0, split) lie west of home.
        west_total = self._cumulative[split - 1] if split else 0
        total = self._cumulative[-1]
        westward = rng.random() < self.westward_share
        if west_total == 0:
            westward = False  # Empty group: fall back to the other one.
        elif west_total == total:
            westward = True
        low, high = (0, west_total) if westward else (west_total, total)
        index = bisect_right(self._cumulative, low + rng.random() * (high - low))
        return self._workplaces[min(index, len(self._workplaces) - 1)], westward

    # -- routing ------------------------------------------------------------
    def route_to(
        self, home_lat: float, home_lon: float, work: Workplace, *, westward: bool = True,
        accessible_stop_ids: Iterable[str] | None = None,
    ) -> CommuteAssignment:
        """Apply the 750 m rules to a known workplace. Deterministic."""
        direct = self.walk_m(home_lat, home_lon, work.latitude, work.longitude)
        base = dict(workplace=work, westward=westward, home_to_work_walk_m=direct)

        # Rule 1: walk directly.
        if direct <= self.walk_limit_m:
            return CommuteAssignment("walk", reason="Workplace within walking limit", **base)

        # Rule 2: a Line 1 station near home that reaches a different one near work.
        home_stations = self._within(home_lat, home_lon, self.stations)
        work_stations = self._within(work.latitude, work.longitude, self.stations)
        for _, home_station in home_stations:
            for _, work_station in work_stations:
                if work_station.id != home_station.id:
                    return CommuteAssignment(
                        "subway", reason="Useful Line 1 station within walking limit of home",
                        home_station_id=home_station.id, work_station_id=work_station.id, **base,
                    )

        # Rule 3: westbound 505 from an accessible stop.
        if accessible_stop_ids is not None:
            boards = [
                (self.walk_m(home_lat, home_lon, s.latitude, s.longitude), s)
                for s in (self._by_corridor_id[i] for i in accessible_stop_ids)
            ]
            boards.sort(key=lambda p: p[0])
        else:
            boards = self._within(home_lat, home_lon, [s for s in self.route if s.corridor_stop_id])
        alights = self._within(work.latitude, work.longitude, self.route)
        transfer = next((pair for pair in work_stations if pair[1].id != self.tmu_station_id), None)

        for board_walk, board in boards:
            downstream = [pair for pair in alights if pair[1].order > board.order]
            if downstream:
                exit_walk, stop = downstream[0]  # Nearest to work.
                beyond = stop.corridor_stop_id is None
                trip = StreetcarTrip(
                    board.corridor_stop_id, stop.corridor_stop_id,
                    "beyond_segment" if beyond else "corridor_stop",
                    beyond_segment_stop=stop if beyond else None,
                    walk_to_board_m=board_walk, walk_from_exit_m=exit_walk,
                )
                return CommuteAssignment("streetcar", reason="505 stop within walking limit of work",
                                         streetcar=trip, **base)
            if transfer and board.order < self._tmu.order:
                exit_walk, station = transfer
                trip = StreetcarTrip(
                    board.corridor_stop_id, self._tmu.corridor_stop_id, "line1_transfer",
                    transfer_station_id=station.id,
                    walk_to_board_m=board_walk, walk_from_exit_m=exit_walk,
                )
                return CommuteAssignment("streetcar", reason="505 to TMU, then Line 1",
                                         streetcar=trip, work_station_id=station.id, **base)

        reason = ("No 505 stop within walking limit of home" if not boards
                  else "Workplace not served by the westbound 505 or a Line 1 transfer")
        return CommuteAssignment("outside_model", reason=reason, **base)

    def assign(
        self, home_lat: float, home_lon: float, rng: Random, *,
        accessible_stop_ids: Iterable[str] | None = None,
    ) -> CommuteAssignment:
        """Sample one commuter's workplace and route it."""
        work, westward = self.sample_workplace(home_lon, rng)
        return self.route_to(home_lat, home_lon, work, westward=westward,
                             accessible_stop_ids=accessible_stop_ids)


# -- loading reviewed data ------------------------------------------------------
def _load_workplaces(scope: Literal["cma", "city"]) -> list[Workplace]:
    data = json.loads((REVIEWED / "workplaces_2021.json").read_text(encoding="utf-8"))
    return [
        Workplace(d["census_tract_uid"], d["latitude"], d["longitude"], d["usual_workplace_workers"])
        for d in data["destinations"]
        if scope == "cma" or d["toronto_city_relation"] == "inside"
    ]


def _load_corridor_stops() -> list[Place]:
    with (REVIEWED / "stops.csv").open(encoding="utf-8") as stream:
        rows = sorted(csv.DictReader(stream), key=lambda r: int(r["seq"]))
    return [Place(r["stop_id"], r["name"], float(r["lat"]), float(r["lon"])) for r in rows]


def _load_beyond_stops(corridor_ids: set[str]) -> list[Place]:
    """Westbound 505 stops after the last corridor stop (TMU -> Dundas West)."""
    route = json.loads((REVIEWED / "route_505.json").read_text(encoding="utf-8"))
    westbound = next(d for d in route["directions"] if d["direction_id"] == "1")
    stops = sorted(westbound["stops"], key=lambda s: s["seq"])
    last = max(i for i, s in enumerate(stops) if s["corridor_stop_id"] in corridor_ids)
    return [
        Place(f"ttc-stop-{s['gtfs_stop_id']}", s["name"], s["lat"], s["lon"])
        for s in stops[last + 1:]
    ]


def _load_line1_stations() -> list[Place]:
    data = json.loads((REVIEWED / "line1_stations.json").read_text(encoding="utf-8"))
    return [Place(s["station_id"], s["name"], s["latitude"], s["longitude"]) for s in data["stations"]]


@lru_cache(maxsize=None)
def load_commute_model(scope: Literal["cma", "city"] = "cma", **params) -> CommuteModel:
    """Build (once) the model from data/reviewed. scope="city" keeps Toronto-only tracts."""
    corridor = _load_corridor_stops()
    return CommuteModel(
        _load_workplaces(scope), corridor, _load_beyond_stops({p.id for p in corridor}),
        _load_line1_stations(), **params,
    )


def sample_streetcar_trip(
    home_lat: float, home_lon: float, rng: Random, *,
    accessible_stop_ids: Iterable[str] | None = None,
) -> StreetcarTrip | None:
    """One commuter: where they board/alight the westbound 505, or None if they don't use it."""
    return load_commute_model().assign(
        home_lat, home_lon, rng, accessible_stop_ids=accessible_stop_ids
    ).streetcar
