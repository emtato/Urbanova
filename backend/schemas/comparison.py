"""The Phase 01 boundary shared by data, simulation, explanation and UI."""
from typing import Annotated, Literal

from pydantic import Field, model_validator

from .assumption import Assumption
from .base import ContractModel, Count, Identifier, NonNegative, Positive, references, unique
from .corridor import Corridor
from .replay_event import ReplayEvent, RiderGroup
from .results import CaseResult
from .scenario import DemandCase, Scenario
from .source import SourceRef


class PackageEvaluation(ContractModel):
    phase_id: Identifier
    demand_case: DemandCase
    case_id: Identifier
    feasible: bool
    feasibility_reasons: list[Identifier]
    criterion_met: bool
    criterion_reasons: list[Identifier]


class Package(ContractModel):
    package_id: Identifier
    label: Identifier
    intervention_ids: list[Identifier]
    evaluations: Annotated[list[PackageEvaluation], Field(min_length=1)]


class SensitivityResult(ContractModel):
    assumption_key: Identifier
    case_id: Identifier
    tested_values: Annotated[list[float], Field(min_length=2)]
    metric: Literal["mean_wait_s", "p95_wait_s", "denied_share", "unresolved_passengers"]
    outcomes: list[NonNegative]
    status: Literal["fixture", "modelled"]
    interpretation: Identifier

    @model_validator(mode="after")
    def aligned(self):
        if len(self.tested_values) != len(self.outcomes):
            raise ValueError("Sensitivity values and outcomes must align")
        return self


class InitialQueue(ContractModel):
    stop_id: Identifier
    rider_group: RiderGroup
    count: Count


class ReplayStream(ContractModel):
    run_id: Identifier
    horizon_s: Positive
    vehicle_capacity: dict[str, Annotated[int, Field(gt=0)]]
    initial_queues: list[InitialQueue]
    events: Annotated[list[ReplayEvent], Field(min_length=1)]


class Comparison(ContractModel):
    contract_version: Literal["2.0.0"]
    comparison_id: Identifier
    fixture: bool
    product_label: Literal["scenario experiment"]
    scenario: Scenario
    corridor: Corridor
    cases: Annotated[list[CaseResult], Field(min_length=3)]
    packages: Annotated[list[Package], Field(min_length=1)]
    sensitivity: list[SensitivityResult]
    assumptions: list[Assumption]
    sources: Annotated[list[SourceRef], Field(min_length=1)]
    warnings: list[Identifier]
    replay: ReplayStream | None

    @model_validator(mode="after")
    def integrity(self):
        source_ids = [source.source_id for source in self.sources]
        stop_ids = [stop.id for stop in self.corridor.stops]
        link_ids = [link.link_id for link in self.corridor.links]
        phase_ids = [phase.phase_id for phase in self.scenario.phases]
        package_ids = [package.package_id for package in self.packages]
        intervention_ids = [item.id for item in self.scenario.interventions]
        case_ids = [case.case_id for case in self.cases]
        run_ids = [run.run_id for case in self.cases for run in case.runs]
        for values, label in ((source_ids, "source_id"), (package_ids, "package_id"), (case_ids, "case_id"), (run_ids, "run_id"), ([a.key for a in self.assumptions], "assumption key")):
            unique(values, label)
        if {case.kind for case in self.cases} != {"current", "growth", "supported_growth"}:
            raise ValueError("Comparison requires current, growth and supported_growth cases")
        if self.fixture and (not self.warnings or not self.replay):
            raise ValueError("Fixtures require warnings and a replay")
        if not self.fixture and any(result.status == "fixture" for result in self.sensitivity):
            raise ValueError("Fixture sensitivity cannot be presented as a live result")

        def check_sources(value):
            if isinstance(value, dict):
                if "source_ids" in value:
                    references(value["source_ids"], source_ids, "source_id")
                for child in value.values():
                    check_sources(child)
            elif isinstance(value, list):
                for child in value:
                    check_sources(child)

        check_sources(self.model_dump(mode="json"))
        for dev in self.scenario.developments:
            references(dev.accessible_stop_ids, stop_ids, "development stop")
        for item in self.scenario.interventions:
            references(item.link_ids, link_ids, "intervention link")
        for case in self.cases:
            references([case.package_id], package_ids, "case package")
            references([case.phase_id], phase_ids, "case phase")
            expected = {(stop, group) for stop in stop_ids for group in ("existing", "new")}
            if {(item.stop_id, item.rider_group) for item in case.stops} != expected:
                raise ValueError("Every case requires both rider groups at every stop")
            if any(run.scenario_version != self.scenario.version for run in case.runs):
                raise ValueError("Run scenario_version differs from scenario")
            if case.kind == "current" and any(item.passengers for item in case.stops if item.rider_group == "new"):
                raise ValueError("Current case cannot include new-development riders")
        cases = {case.case_id: case for case in self.cases}
        required_cases = {(phase, demand, kind) for phase in phase_ids for demand in ("low", "central", "high") for kind in ("current", "growth", "supported_growth")}
        if {(case.phase_id, case.demand_case, case.kind) for case in self.cases} != required_cases:
            raise ValueError("Every phase and demand case requires all three comparison kinds")
        for phase in phase_ids:
            for demand in ("low", "central", "high"):
                selected_cases = [case for case in self.cases if case.phase_id == phase and case.demand_case == demand]
                growth_cases = [case for case in selected_cases if case.kind != "current"]
                cohorts = [{group: sum(item.passengers for item in case.stops if item.rider_group == group) for group in ("existing", "new")} for case in growth_cases]
                if any(cohort != cohorts[0] for cohort in cohorts):
                    raise ValueError("Growth packages must compare the same passenger cohorts")
                seed_sets = [sorted(seed for run in case.runs for seed in run.seed_ids) for case in selected_cases]
                if any(seeds != seed_sets[0] for seeds in seed_sets):
                    raise ValueError("Package comparisons require paired seed IDs")
        phases = {phase: index for index, phase in enumerate(phase_ids)}
        interventions = {item.id: item for item in self.scenario.interventions}
        criterion = self.scenario.planning_criterion
        for package in self.packages:
            unique(package.intervention_ids, "package intervention")
            references(package.intervention_ids, intervention_ids, "package intervention")
            selected = [interventions[item] for item in package.intervention_ids]
            pairs = [(item.phase_id, item.demand_case) for item in package.evaluations]
            unique(pairs, "package phase/demand evaluation")
            if set(pairs) != {(phase, demand) for phase in phase_ids for demand in ("low", "central", "high")}:
                raise ValueError("Each package must evaluate every phase for low, central and high demand")
            for evaluation in package.evaluations:
                references([evaluation.case_id], case_ids, "evaluation case")
                case = cases[evaluation.case_id]
                if (case.package_id, case.phase_id, case.demand_case) != (package.package_id, evaluation.phase_id, evaluation.demand_case):
                    raise ValueError("Evaluation must refer to its own package, phase and demand case")
                feasible = (
                    sum(item.capital_cost.high for item in selected) <= self.scenario.capital_budget_cad
                    and sum(item.operating_cost.high for item in selected) <= self.scenario.annual_operating_budget_cad
                    and sum(item.extra_vehicles for item in selected) <= self.scenario.fleet_allowance
                    and all(phases[item.earliest_phase] <= phases[evaluation.phase_id]
                            and phases[self.scenario.intervention_availability[item.id]] <= phases[evaluation.phase_id] for item in selected)
                )
                if any(cost.price_year != self.scenario.budget_price_year for item in selected for cost in (item.capital_cost, item.operating_cost)):
                    raise ValueError("Package costs and budgets must use the same price year")
                if evaluation.feasible != feasible or (not feasible and not evaluation.feasibility_reasons):
                    raise ValueError("Feasibility must reflect high-bound costs, fleet and availability")
                meets = all(run.status == "completed" for run in case.runs) and all(
                    wait is not None and share is not None and wait <= criterion.max_p95_wait_s
                    and share <= criterion.max_denied_share and unresolved <= criterion.max_unresolved_passengers
                    for wait, share, unresolved in zip(case.per_run_p95_wait_s, case.per_run_denied_share, case.per_run_unresolved_passengers)
                )
                if evaluation.criterion_met != meets or (not meets and not evaluation.criterion_reasons):
                    raise ValueError("Criterion outcome must reflect all runs, including unresolved riders")
        assumptions = {item.key: item for item in self.assumptions}
        for result in self.sensitivity:
            references([result.assumption_key], assumptions, "sensitivity assumption")
            references([result.case_id], case_ids, "sensitivity case")
            allowed = assumptions[result.assumption_key].allowed_range
            if any(not allowed.low <= value <= allowed.high for value in result.tested_values):
                raise ValueError("Sensitivity values must stay within the assumption range")
            if result.metric == "denied_share" and any(value > 1 for value in result.outcomes):
                raise ValueError("Denied shares cannot exceed one")
        if self.replay:
            self.validate_replay(stop_ids)
        return self

    def validate_replay(self, stop_ids: list[str]) -> None:
        stream = self.replay
        run = next((run for case in self.cases for run in case.runs if run.run_id == stream.run_id), None)
        if run is None:
            raise ValueError("Replay references an unknown run")
        unique([(item.stop_id, item.rider_group) for item in stream.initial_queues], "initial queue")
        queues = {(item.stop_id, item.rider_group): item.count for item in stream.initial_queues}
        references([item.stop_id for item in stream.initial_queues], stop_ids, "replay queue stop")
        if sum(queues.values()) != run.diagnostics.passengers_created:
            raise ValueError("Replay queues must account for all created passengers")
        loads = {vehicle: {"existing": 0, "new": 0} for vehicle in stream.vehicle_capacity}
        dispatched, position, at_stop, passenger_stage = set(), {}, {}, {}
        arrived = 0
        last_time = -1
        for event in stream.events:
            if event.run_id != stream.run_id or event.t_s < last_time or event.t_s > stream.horizon_s:
                raise ValueError("Replay must be time ordered within its horizon and run")
            last_time = event.t_s
            references([event.stop_id], stop_ids, "replay stop")
            references([event.vehicle_id], loads, "replay vehicle")
            vehicle = event.vehicle_id
            if event.kind == "dispatch":
                if vehicle in dispatched or event.stop_id != stop_ids[0]:
                    raise ValueError("Vehicles dispatch once at the first stop")
                dispatched.add(vehicle)
                position[vehicle] = -1
                at_stop[vehicle] = False
            elif vehicle not in dispatched:
                raise ValueError("Vehicle event before dispatch")
            if event.kind == "arrive":
                if at_stop[vehicle] or position[vehicle] + 1 != stop_ids.index(event.stop_id):
                    raise ValueError("Vehicle must visit consecutive stops")
                position[vehicle] += 1
                at_stop[vehicle] = True
                passenger_stage[vehicle] = 0
            elif event.kind in ("alight", "board", "deny", "depart"):
                if not at_stop[vehicle] or stop_ids[position[vehicle]] != event.stop_id:
                    raise ValueError("Vehicle event requires arrival at the same stop")
                if event.kind == "depart":
                    at_stop[vehicle] = False
            if event.kind in ("board", "alight", "deny"):
                if event.rider_group is None:
                    raise ValueError("Passenger events require a rider group")
                group = event.rider_group
                stage = {"alight": 0, "board": 1, "deny": 2}[event.kind]
                if stage < passenger_stage[vehicle]:
                    raise ValueError("Alighting must precede boarding and denial")
                passenger_stage[vehicle] = stage
                key = (event.stop_id, group)
                if event.kind == "board":
                    if event.count > queues.get(key, 0):
                        raise ValueError("Cannot board more riders than are queued")
                    queues[key] -= event.count
                    loads[vehicle][group] += event.count
                elif event.kind == "alight":
                    loads[vehicle][group] -= event.count
                    arrived += event.count
                elif event.count > queues.get(key, 0):
                    raise ValueError("Denied count exceeds the queue")
                elif event.kind == "deny" and sum(loads[vehicle].values()) != stream.vehicle_capacity[vehicle]:
                    raise ValueError("Capacity denial requires a full vehicle")
            elif event.count != 0 or event.rider_group is not None:
                raise ValueError("Movement events have zero count and null rider_group")
            load = sum(loads[vehicle].values())
            if min(loads[vehicle].values()) < 0 or load != event.load_after or load > stream.vehicle_capacity[vehicle]:
                raise ValueError("Replay load accounting or capacity violation")
        if dispatched != set(loads) or any(position[vehicle] != len(stop_ids) - 1 or at_stop[vehicle] for vehicle in dispatched):
            raise ValueError("Replay must dispatch every vehicle and finish every stop")
        final = (arrived, sum(queues.values()), sum(sum(groups.values()) for groups in loads.values()))
        diagnostic = run.diagnostics
        if final != (diagnostic.passengers_arrived, diagnostic.passengers_waiting, diagnostic.passengers_onboard):
            raise ValueError("Replay totals disagree with run diagnostics")
        case = next(case for case in self.cases if any(item.run_id == stream.run_id for item in case.runs))
        if case.run_count == 1 and any(item.remaining_queue != queues.get((item.stop_id, item.rider_group), 0) for item in case.stops):
            raise ValueError("Replay queues disagree with stop results")
