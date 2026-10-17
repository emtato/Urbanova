from math import isclose
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .base import ContractModel, Count, Identifier, NonNegative, Share, unique
from .replay_event import RiderGroup
from .run import Run
from .scenario import DemandCase


class StopResult(ContractModel):
    stop_id: Identifier
    rider_group: RiderGroup
    passengers: Count
    completed_passengers: Count
    mean_wait_s: NonNegative | None
    p95_wait_s: NonNegative | None
    denied_at_least_once_share: Share | None
    remaining_queue: Count
    headway_cv: NonNegative | None

    @model_validator(mode="after")
    def denominators(self):
        if self.completed_passengers + self.remaining_queue > self.passengers:
            raise ValueError("Completed and queued riders exceed arrivals")
        if (self.mean_wait_s is None) != (self.completed_passengers == 0) or (self.p95_wait_s is None) != (self.completed_passengers == 0):
            raise ValueError("Waits must be null exactly when there are no completed riders")
        if (self.denied_at_least_once_share is None) != (self.passengers == 0):
            raise ValueError("Denied share must be null exactly when there are no arrivals")
        return self


class CaseResult(ContractModel):
    case_id: Identifier
    kind: Literal["current", "growth", "supported_growth"]
    package_id: Identifier
    phase_id: Identifier
    demand_case: DemandCase
    stops: list[StopResult]
    runs: Annotated[list[Run], Field(min_length=1)]
    per_run_mean_wait_s: list[NonNegative | None]
    per_run_p95_wait_s: list[NonNegative | None]
    per_run_denied_share: list[Share | None]
    per_run_unresolved_passengers: list[Count]
    run_count: Annotated[int, Field(ge=1)]
    unresolved_passengers: Count

    @model_validator(mode="after")
    def aligned_runs(self):
        unique([run.run_id for run in self.runs], "run_id")
        unique([(stop.stop_id, stop.rider_group) for stop in self.stops], "stop/group result")
        arrays = [self.runs, self.per_run_mean_wait_s, self.per_run_p95_wait_s, self.per_run_denied_share, self.per_run_unresolved_passengers]
        if any(len(values) != self.run_count for values in arrays):
            raise ValueError("Per-run arrays must align with run_count")
        expected = [run.diagnostics.unresolved_passengers for run in self.runs]
        if expected != self.per_run_unresolved_passengers or self.unresolved_passengers != sum(expected):
            raise ValueError("Case unresolved count must equal the sum across runs")
        if any(run.package != self.package_id for run in self.runs):
            raise ValueError("Run package differs from case package")
        if self.run_count == 1:
            diagnostic = self.runs[0].diagnostics
            if (sum(item.passengers for item in self.stops), sum(item.completed_passengers for item in self.stops), sum(item.remaining_queue for item in self.stops)) != (diagnostic.passengers_created, diagnostic.passengers_arrived, diagnostic.passengers_waiting):
                raise ValueError("Stop counts disagree with single-run diagnostics")
            if diagnostic.passengers_arrived:
                mean = sum((item.mean_wait_s or 0) * item.completed_passengers for item in self.stops) / diagnostic.passengers_arrived
                if self.per_run_mean_wait_s[0] is None or not isclose(mean, self.per_run_mean_wait_s[0], abs_tol=1e-6):
                    raise ValueError("Case mean must weight completed-rider stop means")
            elif self.per_run_mean_wait_s[0] is not None or self.per_run_p95_wait_s[0] is not None:
                raise ValueError("Empty completed cohort requires null waits")
            if diagnostic.passengers_created:
                denied = sum((item.denied_at_least_once_share or 0) * item.passengers for item in self.stops) / diagnostic.passengers_created
                if self.per_run_denied_share[0] is None or not isclose(denied, self.per_run_denied_share[0], abs_tol=1e-6):
                    raise ValueError("Case denied share must weight arrivals, not denial events")
            elif self.per_run_denied_share[0] is not None:
                raise ValueError("No created passengers requires null denied share")
        return self
