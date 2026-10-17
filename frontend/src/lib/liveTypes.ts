import type { Scenario, Stop } from './types'

export type CostRange = { low: number; central: number; high: number }
export interface PackagePolicy {
  cycle_s: number; lane_cycle_s: number; baseline_headway_s: number; service_headway_s: number
  peak_hours: number; service_days: number; cost_per_hour: CostRange; lane_capital: CostRange; lane_operating: CostRange
  price_year: number; earliest_phase: string; source_ids: string[]; assumption_label: string
}
export interface ScenarioPatch {
  demand_case?: Scenario['demand_case']; capital_budget_cad?: number; annual_operating_budget_cad?: number; fleet_allowance?: number
  phase_years?: { phase_id: string; year: number }[]; development_units?: { development_id: string; net_added_units: number }[]
  planning_criterion?: Partial<Scenario['planning_criterion']>
}
export interface NativeCar {
  id: string; capacity: number; onboard_passenger_ids: string[]; status: 'at_stop' | 'in_transit' | 'finished'
  current_stop_id: string | null; previous_stop_id: string | null; next_stop_id: string | null
  departure_time_s: number | null; expected_arrival_time_s: number | null
}
export interface NativeEvent {
  time_s: number; action: string; streetcar: NativeCar | null; stop_id: string | null; count: number
  stop_queues: Record<string, number>; onboard_count_after: number | null
}
export interface NativeReplay {
  format_version: 'b11-events-v1'; comparison_id: string; run_id: string; scenario_id: string
  model_version: string; data_version: string; source_ids: string[]; horizon_s: number; stops: Stop[]; events: NativeEvent[]
}
export interface NativeMetrics {
  format_version: 'b11-metrics-v1'; comparison_id: string; scenario_id: string; model_version: string; data_version: string; source_ids: string[]
  runs: { run_id: string; summary: { contract: { diagnostics: { in_progress_at_cutoff_excluded: number }; case_metrics: { mean_wait_s: number | null; p95_wait_s: number | null; denied_share: number | null; unresolved_passengers: number } } } }[]
}
export interface AnalysisSummary {
  comparison_id: string; fixture: boolean
  decision: { wording: string; cost_order: string; preferred_package_id: string | null; alternatives: { package_id: string; capital: number; operating: number; feasible: boolean; meets: boolean; dominated: boolean }[] }
  sensitivity: { upgrade_delay: { status: string; comparison_id: string | null; preferred_changes: boolean | null; preferred_package_id: string | null }; repeatedly_worst_stops: { stop_id: string; cases: number }[] }
}
