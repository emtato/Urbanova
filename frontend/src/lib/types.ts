/**
 * FutureProof TypeScript Schemas
 * Directly mirrors backend schemas 1.5 - 1.14 (Freeze Contract)
 */

export interface SourceRef {
  source_id: string
  title: string
  url: string
  publisher: string
  retrieved_at: string
  version: string
  licence: string
}

export type AssumptionStatus = 'sourced' | 'assumed' | 'user_selected'

export interface Assumption {
  key: string
  unit: string
  meaning: string
  low: number
  central: number
  high: number
  allowed_range: [number, number]
  status: AssumptionStatus
  source_ids: string[]
}

export interface Stop {
  stop_id: string
  gtfs_stop_id: string
  name: string
  seq: number
  lon: number
  lat: number
}

export interface Link {
  link_id: string
  from_stop: string
  to_stop: string
  length_m: number
  base_time_s: number
}

export interface Corridor {
  corridor_id: string
  name: string
  route_pattern: string
  direction: string
  peak_window: string
  stops: Stop[]
  links: Link[]
  berths_per_stop: number
  incoming_load: number
}

export interface DevelopmentAccess {
  stop_id: string
  walk_m: number
}

export type DevelopmentKind = 'proposal' | 'hypothetical'

export interface Development {
  dev_id: string
  pipeline_ref: string
  address: string
  units: number
  stage: string
  record_date: string
  kind: DevelopmentKind
  coordinates: [number, number]
  height_m?: number
  phase: number
  access: DevelopmentAccess[]
  source_ids: string[]
}

export type InterventionType = 'priority_lane' | 'extra_service'

export interface CostEstimate {
  low: number
  central: number
  high: number
  year: number
  scope: string
}

export interface Intervention {
  id: string
  type: InterventionType
  name: string
  link_ids?: string[]
  headway_s?: number
  capital_cost: CostEstimate
  operating_cost: CostEstimate
  extra_vehicles: number
  earliest_phase: number
  effect: {
    description: string
    speed_gain_pct?: number
    headway_reduction_s?: number
    status: AssumptionStatus
  }
}

export interface Scenario {
  scenario_id: string
  version: string
  name: string
  developments_per_phase: Record<number, string[]>
  occupied_share: number
  demand_case: 'low' | 'central' | 'high'
  intervention_availability: Record<string, number>
  capital_budget: number
  operating_budget: number
  fleet_allowance: number
  planning_criterion: {
    max_mean_wait_s: number
    max_denied_share: number
  }
}

export interface Run {
  run_id: string
  scenario_version: string
  package_id: string
  model_version: string
  data_version: string
  seed_ids: number[]
  status: 'completed' | 'running' | 'failed'
  diagnostics: {
    conservation_error: number
    unresolved_passengers: number
    runtime_ms: number
  }
}

export type ReplayEventKind = 'dispatch' | 'arrive' | 'alight' | 'board' | 'deny' | 'depart'
export type RiderGroup = 'existing' | 'new'

export interface ReplayEvent {
  run_id: string
  t_s: number
  kind: ReplayEventKind
  vehicle_id: string
  stop_id: string
  count: number
  load_after: number
  rider_group?: RiderGroup
}

export interface RiderGroupMetrics {
  mean_wait_s: number
  p95_wait_s: number
  share_denied: number
  remaining_queue: number
}

export interface StopResult {
  stop_id: string
  stop_name: string
  existing_riders: RiderGroupMetrics
  new_riders: RiderGroupMetrics
  total_riders: RiderGroupMetrics
  headway_cv: number
  bunched_trips_share: number
}

export interface CaseSummary {
  mean_wait_s: number
  p95_wait_s: number
  total_denied_share: number
  max_queue: number
  total_boardings: number
}

export interface CaseResult {
  case_id: 'current' | 'growth' | 'supported_growth'
  case_label: string
  stop_results: Record<string, StopResult>
  summary: CaseSummary
  run_count: number
  unresolved_passengers: number
}

export interface PackageEvaluation {
  package_id: string
  name: string
  interventions: string[]
  is_feasible: boolean
  infeasibility_reasons: string[]
  capital_cost: number
  operating_cost_annual: number
  extra_vehicles: number
  criterion_met: {
    phase_1: boolean
    phase_2: boolean
  }
  rank?: number
}

export interface SensitivityAnalysis {
  demand_cases: Record<'low' | 'central' | 'high', {
    preferred_package: string
    worst_stops: string[]
  }>
  upgrade_delay: {
    preferred_package: string
    impact: string
  }
}

export interface Comparison {
  fixture: boolean
  generated_at: string
  scenario: Scenario
  corridor: Corridor
  developments: Development[]
  cases: {
    current: CaseResult
    growth: CaseResult
    supported_growth: CaseResult
  }
  packages: PackageEvaluation[]
  sensitivity: SensitivityAnalysis
  assumptions: Assumption[]
  sources: SourceRef[]
  warnings: string[]
  replay_stream?: ReplayEvent[]
}
