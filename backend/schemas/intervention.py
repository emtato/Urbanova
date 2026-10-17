from typing import Literal

from pydantic import model_validator

from .assumption import Assumption
from .base import ContractModel, Count, Identifier, NonNegative, Positive


class CostRange(ContractModel):
    low: NonNegative
    central: NonNegative
    high: NonNegative
    currency: Literal["CAD"]
    price_year: int
    scope: Identifier
    unit: Literal["CAD", "CAD/year"]
    status: Literal["sourced", "assumed", "user_selected"]
    source_ids: list[Identifier]

    @model_validator(mode="after")
    def ordered(self):
        if not self.low <= self.central <= self.high:
            raise ValueError("Cost range must be ordered")
        if self.status == "sourced" and not self.source_ids:
            raise ValueError("Sourced costs require provenance")
        return self


class Intervention(ContractModel):
    id: Identifier
    type: Literal["priority_lane", "extra_service"]
    link_ids: list[Identifier]
    headway_s: Positive | None
    capital_cost: CostRange
    operating_cost: CostRange
    extra_vehicles: Count
    earliest_phase: Identifier
    effect: Assumption

    @model_validator(mode="after")
    def type_and_units(self):
        if self.type == "priority_lane" and (not self.link_ids or self.headway_s is not None):
            raise ValueError("Priority lane requires links and no headway")
        if self.type == "extra_service" and (self.headway_s is None or self.extra_vehicles < 1 or self.link_ids):
            raise ValueError("Extra service requires headway and extra vehicles, with no lane links")
        if self.capital_cost.unit != "CAD" or self.operating_cost.unit != "CAD/year":
            raise ValueError("Capital costs use CAD; operating costs use CAD/year")
        return self
