from typing import Annotated, Literal

from pydantic import Field, model_validator

from .base import ContractModel, Count, Identifier, NonNegative, Share, unique
from .development import Development
from .intervention import Intervention

DemandCase = Literal["low", "central", "high"]


class DevelopmentPhase(ContractModel):
    phase_id: Identifier
    year: int
    development_ids: list[Identifier]
    occupied_share: Share


class PlanningCriterion(ContractModel):
    max_p95_wait_s: NonNegative
    max_denied_share: Share
    max_unresolved_passengers: Count
    meaning: Identifier


class Scenario(ContractModel):
    scenario_id: Identifier
    version: Annotated[int, Field(ge=1)]
    developments: list[Development]
    phases: Annotated[list[DevelopmentPhase], Field(min_length=1)]
    demand_case: DemandCase
    interventions: list[Intervention]
    intervention_availability: dict[str, str]
    capital_budget_cad: NonNegative
    annual_operating_budget_cad: NonNegative
    budget_price_year: int
    fleet_allowance: Count
    planning_criterion: PlanningCriterion

    @model_validator(mode="after")
    def ids(self):
        from .base import references
        dev_ids = [dev.dev_id for dev in self.developments]
        phase_ids = [phase.phase_id for phase in self.phases]
        intervention_ids = [item.id for item in self.interventions]
        for values, label in ((dev_ids, "dev_id"), (phase_ids, "phase_id"), (intervention_ids, "intervention id")):
            unique(values, label)
        assigned = [dev for phase in self.phases for dev in phase.development_ids]
        unique(assigned, "development phase assignment")
        if set(assigned) != set(dev_ids):
            raise ValueError("Each development must belong to exactly one phase")
        for item in self.interventions:
            references([item.earliest_phase], phase_ids, "earliest phase")
        if set(self.intervention_availability) != set(intervention_ids):
            raise ValueError("Availability must cover every intervention")
        references(self.intervention_availability.values(), phase_ids, "availability phase")
        if [phase.year for phase in self.phases] != sorted(phase.year for phase in self.phases):
            raise ValueError("Phases must be in year order")
        return self
