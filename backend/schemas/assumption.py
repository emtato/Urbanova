from typing import Literal

from pydantic import model_validator

from .base import ContractModel, Identifier


class AllowedRange(ContractModel):
    low: float
    high: float


class Assumption(ContractModel):
    key: Identifier
    unit: Identifier
    meaning: Identifier
    low: float
    central: float
    high: float
    allowed_range: AllowedRange
    status: Literal["sourced", "assumed", "user_selected"]
    source_ids: list[Identifier]

    @model_validator(mode="after")
    def ordered_range(self):
        if not self.allowed_range.low <= self.low <= self.central <= self.high <= self.allowed_range.high:
            raise ValueError("Assumption values must be ordered within the allowed range")
        if self.status == "sourced" and not self.source_ids:
            raise ValueError("Sourced assumptions require source_ids")
        return self
