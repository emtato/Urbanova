import type { CaseResult } from '../lib/types'
import type { NativeCaseResult } from '../lib/liveTypes'

export const average = (values: (number | null | undefined)[]) => {
  const valid = values.filter((v): v is number => typeof v === 'number' && Number.isFinite(v))
  return valid.length ? valid.reduce((sum, v) => sum + v, 0) / valid.length : null
}

// Shared product rule: spacing score = 10 / (1 + (CV / 0.5)^2).
// CV = standard deviation / mean streetcar gap. Reference points:
// CV 0 -> 10, 0.25 -> 8, 0.5 -> 5, 1 -> 2. The 0.5 midpoint is a product
// choice, not a calibrated TTC standard or a measure of service frequency.
// Scores approach zero as variability increases. Preserve missing/invalid data;
// use mean CV across native runs, then calculate this display score.
export function spacingScore(cv: number | null) {
  return cv == null || !Number.isFinite(cv) || cv < 0 ? null : 10 / (1 + (cv / 0.5) ** 2)
}

export interface TransitMetrics {
  existing: number | null
  added: number | null
  existingWait: number | null
  existingP95: number | null
  wait: number | null
  p95: number | null
  denied: number | null
  waiting: number | null
  cv: number | null
  gap: number | null
  inProgress: number | null
  journey: number | null
  fullDepartures: number | null
  vehicles: number | null
}

type Row = Record<string, unknown>
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
const object = (value: unknown): Row => value && typeof value === 'object' ? value as Row : {}

export function nativeCase(result?: CaseResult): NativeCaseResult | null {
  const value = result as NativeCaseResult | undefined
  return value?.overall_results && Array.isArray(value.individual_results) ? value : null
}

export function transitMetrics(result?: CaseResult, stopId?: string): TransitMetrics {
  const native = nativeCase(result)
  if (native) {
    const rows = native.individual_results.map(run => {
      if (!stopId) return object(run.summary.overview)
      const stops = run.summary.by_stop
      return Array.isArray(stops) ? object(stops.find(row => object(row).stop_id === stopId)) : {}
    })
    const mean = (key: string) => average(rows.map(row => number(row[key])))
    const groupMean = (group: string, key: string) => average(rows.map(row =>
      number(object(object(row.by_rider_group)[group])[key])))
    // Native summary.by_stop contains all arrivals and physical queues; the older
    // case.stops projection counts stranded riders differently. Never substitute it.
    const metric = (key: string) => stopId ? mean(key) : number(native.overall_results.metrics[key]?.mean)
    return {
      existing: stopId ? groupMean('existing', 'passengers') : metric('existing_corridor_passengers'),
      added: stopId ? groupMean('new', 'passengers') : metric('new_development_passengers'),
      existingWait: stopId ? groupMean('existing', 'mean_wait_s') : null,
      existingP95: stopId ? groupMean('existing', 'p95_wait_s') : null,
      wait: metric('mean_wait_s'), p95: metric('p95_wait_s'),
      denied: metric(stopId ? 'denied_at_least_once_share' : 'denied_boarding_share'),
      waiting: metric(stopId ? 'raw_waiting_at_cutoff' : 'raw_waiting_at_cutoff_passengers'),
      cv: stopId ? mean('headway_cv') : null,
      gap: stopId ? mean('mean_headway_s') : null,
      inProgress: metric('in_progress_at_cutoff_passengers'),
      journey: stopId ? null : metric('mean_commute_time_s'),
      fullDepartures: stopId ? null : metric('full_departures_share'),
      vehicles: stopId ? null : metric('streetcars_dispatched'),
    }
  }

  const rows = result?.stops?.filter(row => !stopId || row.stop_id === stopId) ?? []
  const sum = (key: 'passengers' | 'remaining_queue', group?: string) => {
    const selected = rows.filter(row => !group || row.rider_group === group)
    return selected.length ? selected.reduce((total, row) => total + row[key], 0) : null
  }
  const weighted = (key: 'mean_wait_s' | 'denied_at_least_once_share', weight: 'completed_passengers' | 'passengers', group?: string) => {
    const selected = rows.filter(row => (!group || row.rider_group === group) && row[key] != null && row[weight] > 0)
    const total = selected.reduce((value, row) => value + row[weight], 0)
    return total ? selected.reduce((value, row) => value + row[key]! * row[weight], 0) / total : null
  }
  return {
    existing: sum('passengers', 'existing'), added: sum('passengers', 'new'),
    existingWait: weighted('mean_wait_s', 'completed_passengers', 'existing'),
    existingP95: stopId ? rows.find(row => row.rider_group === 'existing')?.p95_wait_s ?? null : null,
    wait: stopId ? weighted('mean_wait_s', 'completed_passengers') : average(result?.per_run_mean_wait_s ?? []),
    // Cohort p95s cannot be combined into a valid station p95.
    p95: stopId ? null : average(result?.per_run_p95_wait_s ?? []),
    denied: stopId ? weighted('denied_at_least_once_share', 'passengers') : average(result?.per_run_denied_share ?? []),
    waiting: sum('remaining_queue'), cv: stopId ? average(rows.map(row => row.headway_cv)) : null,
    gap: null, inProgress: null, journey: null, fullDepartures: null, vehicles: null,
  }
}
