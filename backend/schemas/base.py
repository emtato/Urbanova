"""Shared contract rules: finite numbers, no silently ignored fields."""
from typing import Annotated

from pydantic import BaseModel, ConfigDict, Field

NonNegative = Annotated[float, Field(ge=0)]
Positive = Annotated[float, Field(gt=0)]
Count = Annotated[int, Field(ge=0)]
Share = Annotated[float, Field(ge=0, le=1)]
Identifier = Annotated[str, Field(min_length=1)]


class ContractModel(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)


def unique(values, label: str) -> None:
    if len(values) != len(set(values)):
        raise ValueError(f"Duplicate {label}")


def references(values, known, label: str) -> None:
    if set(values) - set(known):
        raise ValueError(f"Unknown {label}: {sorted(set(values) - set(known))}")
