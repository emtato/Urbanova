// Contract 2.0.0; Stop/Development mirror backend/simulation/objects; other models mirror backend/schemas.
// Units and semantics: docs/contract.md.
export type Status = 'sourced' | 'assumed' | 'user_selected'
export type RiderGroup = 'existing' | 'new'
export type DemandCase = 'low' | 'central' | 'high'
export interface SourceRef {
  source_id: string; title: string; url: string; publisher: string
  retrieved_at: string; version: string; licence: string
}
export interface Assumption {
  key: string; unit: string; meaning: string; low: number; central: number; high: number
  allowed_range: { low: number; high: number }; status: Status; source_ids: string[]
}
export interface Stop {
  id: string; name: string; sequence: number; latitude: number; longitude: number
  waiting_passenger_ids: string[]; serving_streetcar_id: string | null
}
export interface Link {
  link_id: string; from_stop: string; to_stop: string; length_m: number
  base_time_s: number; source_ids: string[]
}
export interface Corridor {
  corridor_id: string; route_pattern: string; mode: 'streetcar' | 'bus'
  direction: 'eastbound' | 'westbound' | 'northbound' | 'southbound'
  crs: 'EPSG:4326'; metric_crs: 'EPSG:26917'
  peak_window: { start_s: number; end_s: number; timezone: 'America/Toronto'; service_date: string }
  stops: Stop[]; links: Link[]; berths_per_stop: Record<string, number>
  incoming_load: Assumption; source_ids: string[]
}
export interface Development {
  id: string; name: string; latitude: number; longitude: number; net_added_units: number
  occupied_share: number; residents_per_occupied_unit: number; transit_share: number
  accessible_stop_ids: string[]
}
export interface CostRange {
  low: number; central: number; high: number; currency: 'CAD'; price_year: number
  scope: string; unit: 'CAD' | 'CAD/year'; status: Status; source_ids: string[]
}
export interface Intervention {
  id: string; type: 'priority_lane' | 'extra_service'; link_ids: string[]
  headway_s: number | null; capital_cost: CostRange; operating_cost: CostRange
  extra_vehicles: number; earliest_phase: string; effect: Assumption
}
export interface DevelopmentPhase {
  phase_id: string; year: number; development_ids: string[]; occupied_share: number
}
export interface PlanningCriterion {
  max_p95_wait_s: number; max_denied_share: number; max_unresolved_passengers: number; meaning: string
}
export interface Scenario {
  scenario_id: string; version: number; developments: Development[]; phases: DevelopmentPhase[]
  demand_case: DemandCase; interventions: Intervention[]; intervention_availability: Record<string, string>
  capital_budget_cad: number; annual_operating_budget_cad: number; budget_price_year: number
  fleet_allowance: number; planning_criterion: PlanningCriterion
}
export interface Diagnostics {
  passengers_created: number; passengers_arrived: number; passengers_waiting: number
  passengers_onboard: number; conservation: boolean; unresolved_passengers: number; runtime_s: number
}
export interface Run {
  run_id: string; scenario_version: number; package: string; model_version: string
  data_version: string; seed_ids: number[]; status: 'completed' | 'failed'; diagnostics: Diagnostics
}
export interface ReplayEvent {
  run_id: string; t_s: number; kind: 'dispatch' | 'arrive' | 'alight' | 'board' | 'deny' | 'depart'
  vehicle_id: string; stop_id: string; count: number; load_after: number; rider_group: RiderGroup | null
}
export interface StopResult {
  stop_id: string; rider_group: RiderGroup; passengers: number; completed_passengers: number
  mean_wait_s: number | null; p95_wait_s: number | null; denied_at_least_once_share: number | null
  remaining_queue: number; headway_cv: number | null
}
export interface CaseResult {
  case_id: string; kind: 'current' | 'growth' | 'supported_growth'; package_id: string
  phase_id: string; demand_case: DemandCase; stops: StopResult[]; runs: Run[]
  per_run_mean_wait_s: (number | null)[]; per_run_p95_wait_s: (number | null)[]
  per_run_denied_share: (number | null)[]; per_run_unresolved_passengers: number[]
  run_count: number; unresolved_passengers: number
}
export interface PackageEvaluation {
  phase_id: string; demand_case: DemandCase; case_id: string; feasible: boolean
  feasibility_reasons: string[]; criterion_met: boolean; criterion_reasons: string[]
}
export interface Package {
  package_id: string; label: string; intervention_ids: string[]; evaluations: PackageEvaluation[]
}
export interface SensitivityResult {
  assumption_key: string; case_id: string; tested_values: number[]
  metric: 'mean_wait_s' | 'p95_wait_s' | 'denied_share' | 'unresolved_passengers'
  outcomes: number[]; status: 'fixture' | 'modelled'; interpretation: string
}
export interface InitialQueue { stop_id: string; rider_group: RiderGroup; count: number }
export interface ReplayStream {
  run_id: string; horizon_s: number; vehicle_capacity: Record<string, number>
  initial_queues: InitialQueue[]; events: ReplayEvent[]
}
export interface Comparison {
  contract_version: '2.0.0'; comparison_id: string; fixture: boolean; product_label: 'scenario experiment'
  scenario: Scenario; corridor: Corridor; cases: CaseResult[]; packages: Package[]
  sensitivity: SensitivityResult[]; assumptions: Assumption[]; sources: SourceRef[]
  warnings: string[]; replay: ReplayStream | null
}
