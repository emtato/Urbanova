from math import isfinite
from typing import Annotated, Literal

from pydantic import Field, model_validator

from backend.simulation.objects import Development

from .base import ContractModel, Count, Identifier, NonNegative, Share, unique
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
        dev_ids = [dev.id for dev in self.developments]
        phase_ids = [phase.phase_id for phase in self.phases]
        intervention_ids = [item.id for item in self.interventions]
        for values, label in ((dev_ids, "development id"), (phase_ids, "phase_id"), (intervention_ids, "intervention id")):
            unique(values, label)
        # Validate shared dataclasses at the API boundary; the simulator owns their fields.
        for dev in self.developments:
            if not dev.id or not dev.name:
                raise ValueError("Developments require a nonempty id and name")
            if not (isfinite(dev.longitude) and -180 <= dev.longitude <= 180
                    and isfinite(dev.latitude) and -90 <= dev.latitude <= 90):
                raise ValueError("Development coordinates must use finite WGS84 longitude/latitude")
            if dev.net_added_units < 0:
                raise ValueError("Net added units cannot be negative")
            if not isfinite(dev.residents_per_occupied_unit) or dev.residents_per_occupied_unit < 0:
                raise ValueError("Residents per occupied unit must be finite and nonnegative")
            if not (0 <= dev.occupied_share <= 1 and 0 <= dev.transit_share <= 1):
                raise ValueError("Occupancy and transit shares must be between zero and one")
            if any(not stop_id for stop_id in dev.accessible_stop_ids):
                raise ValueError("Accessible stop IDs must be nonempty")
            unique(dev.accessible_stop_ids, "development accessible stop")
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
