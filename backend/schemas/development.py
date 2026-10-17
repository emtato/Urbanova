from datetime import date
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .base import ContractModel, Count, Identifier, NonNegative, unique


class Footprint(ContractModel):
    # Only use actual sourced polygons. No invented building footprints.
    type: Literal["Polygon"]
    coordinates: list[list[tuple[float, float]]]

    @model_validator(mode="after")
    def closed_wgs84_rings(self):
        if not self.coordinates:
            raise ValueError("Polygon requires a ring")
        for ring in self.coordinates:
            if len(ring) < 4 or ring[0] != ring[-1]:
                raise ValueError("Polygon rings must be closed with at least four positions")
            if any(not (-180 <= lon <= 180 and -90 <= lat <= 90) for lon, lat in ring):
                raise ValueError("Polygon coordinates must use WGS84 lon/lat")
        return self


class Access(ContractModel):
    stop_id: Identifier
    walk_m: NonNegative
    status: Literal["estimated", "reviewed"]
    source_ids: list[Identifier]


class Development(ContractModel):
    dev_id: Identifier
    pipeline_ref: str | None
    address: Identifier
    units: Count
    stage: Identifier
    record_date: date
    kind: Literal["proposal", "hypothetical"]
    footprint: Footprint | None
    footprint_status: Literal["sourced", "unavailable"]
    access: Annotated[list[Access], Field(min_length=1)]
    source_ids: list[Identifier]

    @model_validator(mode="after")
    def evidence(self):
        unique([access.stop_id for access in self.access], "development access stop")
        if self.kind == "proposal" and (not self.pipeline_ref or not self.source_ids):
            raise ValueError("Proposals require pipeline_ref and source_ids")
        if (self.footprint is None) != (self.footprint_status == "unavailable"):
            raise ValueError("Footprint status must match geometry availability")
        return self
