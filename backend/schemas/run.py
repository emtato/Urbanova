from typing import Annotated, Literal

from pydantic import Field, model_validator

from .base import ContractModel, Count, Identifier, NonNegative, unique


class Diagnostics(ContractModel):
    passengers_created: Count
    passengers_arrived: Count
    passengers_waiting: Count
    passengers_onboard: Count
    conservation: bool
    unresolved_passengers: Count
    runtime_s: NonNegative

    @model_validator(mode="after")
    def accounting(self):
        conserved = self.passengers_created == self.passengers_arrived + self.passengers_waiting + self.passengers_onboard
        if self.conservation != conserved:
            raise ValueError("Conservation flag disagrees with passenger counts")
        if self.unresolved_passengers != self.passengers_waiting + self.passengers_onboard:
            raise ValueError("Unresolved passengers must include queues and onboard riders")
        return self


class Run(ContractModel):
    run_id: Identifier
    scenario_version: Annotated[int, Field(ge=1)]
    package: Identifier
    model_version: Identifier
    data_version: Identifier
    seed_ids: Annotated[list[Count], Field(min_length=1)]
    status: Literal["completed", "failed"]
    diagnostics: Diagnostics

    @model_validator(mode="after")
    def completed_conserves(self):
        unique(self.seed_ids, "seed id")
        if self.status == "completed" and not self.diagnostics.conservation:
            raise ValueError("Completed runs must conserve passengers")
        return self
