from datetime import date
from math import isfinite
from typing import Annotated, Literal

from pydantic import Field, model_validator

from backend.simulation.objects import Stop

from .assumption import Assumption
from .base import ContractModel, Count, Identifier, Positive, unique


class Link(ContractModel):
    link_id: Identifier
    from_stop: Identifier
    to_stop: Identifier
    length_m: Positive
    base_time_s: Positive
    source_ids: list[Identifier]


class PeakWindow(ContractModel):
    start_s: Count
    end_s: Count
    timezone: Literal["America/Toronto"]
    service_date: date

    @model_validator(mode="after")
    def increasing(self):
        if self.start_s >= self.end_s:
            raise ValueError("Peak window must end after it starts")
        return self


class Corridor(ContractModel):
    corridor_id: Identifier
    route_pattern: Identifier
    mode: Literal["streetcar", "bus"]
    direction: Literal["eastbound", "westbound", "northbound", "southbound"]
    crs: Literal["EPSG:4326"]
    metric_crs: Literal["EPSG:26917"]
    peak_window: PeakWindow
    stops: Annotated[list[Stop], Field(min_length=2)]
    links: list[Link]
    berths_per_stop: dict[str, Annotated[int, Field(ge=1)]]
    incoming_load: Assumption
    source_ids: list[Identifier]

    @model_validator(mode="after")
    def continuous_pattern(self):
        ids = [stop.id for stop in self.stops]
        unique(ids, "stop id")
        for stop in self.stops:
            if not stop.id or not stop.name:
                raise ValueError("Stops require a nonempty id and name")
            if not (isfinite(stop.longitude) and -180 <= stop.longitude <= 180
                    and isfinite(stop.latitude) and -90 <= stop.latitude <= 90):
                raise ValueError("Stop coordinates must use finite WGS84 longitude/latitude")
        unique([link.link_id for link in self.links], "link_id")
        if [stop.sequence for stop in self.stops] != list(range(len(ids))):
            raise ValueError("Stop sequence must be contiguous, zero-based and ordered")
        if [(link.from_stop, link.to_stop) for link in self.links] != list(zip(ids, ids[1:])):
            raise ValueError("Links must connect each consecutive stop exactly once")
        if set(self.berths_per_stop) != set(ids):
            raise ValueError("Every stop requires a berth count")
        if self.incoming_load.unit != "passengers/vehicle":
            raise ValueError("Incoming load unit must be passengers/vehicle")
        return self
