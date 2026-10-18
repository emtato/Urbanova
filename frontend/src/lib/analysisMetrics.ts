import type { NativeBatch, RunStatistics } from './liveTypes'
import { average, spacingScore } from '../panels/transitMetrics'

type Run = NativeBatch['individual_results'][number]
export type AnalysisMetricKey = 'mean_wait_s' | 'p95_wait_s' | 'denied_boarding_share' | 'unresolved_passengers' | 'in_progress_at_cutoff_passengers' | 'streetcar_occupancy' | 'stop_crowding' | 'observed_gap_s' | 'spacing_score'
type Kind = 'seconds' | 'share' | 'count' | 'score'
export interface AnalysisMetric {
  key: AnalysisMetricKey; label: string; help: string; kind: Kind; higherIsBetter?: boolean
}
export const ANALYSIS_METRICS: AnalysisMetric[] = [
  { key: 'mean_wait_s', label: 'Average wait', help: 'Time spent waiting by riders who boarded a streetcar.', kind: 'seconds' },
  { key: 'p95_wait_s', label: 'Longer waits', help: '95% of riders who boarded waited this long or less in each run (95th percentile).', kind: 'seconds' },
  { key: 'streetcar_occupancy', label: 'Average streetcar occupancy', help: 'Average onboard passengers at stop departures, as a share of total passenger capacity, including standing room.', kind: 'share' },
  { key: 'stop_crowding', label: 'Average people waiting per stop', help: 'Across all corridor stops over the simulation window, weighted by how long each queue lasts. Includes riders still waiting at the end.', kind: 'count' },
  { key: 'observed_gap_s', label: 'Average gap between streetcars', help: 'Observed gaps between arrivals, averaged across stops with at least two arrivals. This can differ from the chosen dispatch interval.', kind: 'seconds' },
  { key: 'spacing_score', label: 'Spacing score / 10', help: 'Uses the map’s custom formula and mean gap variation across stops in each run. Higher means more regular spacing, not more frequent service. This is not a TTC rating.', kind: 'score', higherIsBetter: true },
  { key: 'denied_boarding_share', label: 'Left behind at least once', help: 'Among riders who encountered a streetcar, the share unable to board a full one at least once.', kind: 'share' },
  { key: 'unresolved_passengers', label: 'Still waiting after a full streetcar', help: 'Riders left at a stop after being unable to board, when the simulation ended.', kind: 'count' },
  { key: 'in_progress_at_cutoff_passengers', label: 'Trips still in progress', help: 'Riders still onboard or waiting for their first streetcar when the simulation ended. These are separate from riders left behind.', kind: 'count' },
]
const number = (value: unknown): number | null => typeof value === 'number' && Number.isFinite(value) ? value : null
const object = (value: unknown): Record<string, unknown> => value && typeof value === 'object' ? value as Record<string, unknown> : {}

export const readableTime = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return 'Not available'
  const rounded = Math.round(value)
  if (rounded < 60) return `${Number(value.toFixed(1))} sec`
  const remainder = rounded % 60
  return `${Math.floor(rounded / 60)} min${remainder ? ` ${remainder} sec` : ''}`
}
export function formatAnalysisMetric(value: number | null | undefined, kind: Kind) {
  if (value == null || !Number.isFinite(value)) return 'Not available'
  if (kind === 'seconds') return readableTime(value)
  if (kind === 'share') return `${(value * 100).toFixed(1)}%`
  if (kind === 'score') return `${value.toFixed(1)} / 10`
  return value.toLocaleString(undefined, { maximumFractionDigits: 1 })
}

/** Integral of the physical stop queues over elapsed time, divided by time × stops.
 * Equal-time events contribute no extra weight. Negative-time snapshots establish
 * any warm-up queue; events after the reporting horizon cannot affect the average.
 */
export function averageStopCrowding(run: Run): number | null {
  const stops = run.inputs.stops
  const start = number(run.inputs.start_time_s), end = number(run.inputs.end_time_s)
  if (!stops?.length || start == null || end == null || end <= start || !Array.isArray(run.sim_log) || run.inputs.retention === 'summary-only') return null
  if (!run.sim_log.length) return number(object(run.summary.overview).total_passengers_in_sim) === 0 ? 0 : null
  const horizon = end - start
  let previousTime = 0, waiting = 0, personSeconds = 0
  for (const event of run.sim_log) {
    const time = number(event.time_s)
    if (time == null) return null
    if (time > horizon) break
    const counts = stops.map(stop => number(event.stop_queues?.[stop.id]))
    if (counts.some(value => value == null || value < 0)) return null
    if (time >= 0) {
      if (time < previousTime) return null
      personSeconds += waiting * (time - previousTime)
      previousTime = time
    }
    waiting = counts.reduce<number>((sum, value) => sum + value!, 0)
  }
  personSeconds += waiting * (horizon - previousTime)
  return personSeconds / (horizon * stops.length)
}

export function analysisMetricValue(run: Run, key: AnalysisMetricKey): number | null {
  const overview = object(run.summary.overview)
  if (key === 'stop_crowding') return averageStopCrowding(run)
  if (key === 'streetcar_occupancy') {
    const load = number(overview.mean_departure_load)
    const capacity = number(overview.streetcar_capacity) ?? number(run.inputs.streetcar_capacity)
    return load == null || capacity == null || capacity <= 0 ? null : load / capacity
  }
  if (key === 'observed_gap_s' || key === 'spacing_score') {
    const stops = run.summary.by_stop
    if (!Array.isArray(stops)) return null
    const mean = average(stops.map(stop => number(object(stop)[key === 'observed_gap_s' ? 'mean_headway_s' : 'headway_cv'])))
    return key === 'spacing_score' ? spacingScore(mean) : mean
  }
  return number(overview[key])
}

export function analysisStatistics(batch: NativeBatch): Record<AnalysisMetricKey, RunStatistics> {
  return Object.fromEntries(ANALYSIS_METRICS.map(({ key }) => {
    const native = batch.overall_results.metrics[key]
    if (native) return [key, native]
    const values = batch.individual_results.map(run => analysisMetricValue(run, key)).filter((value): value is number => value != null).sort((a, b) => a - b)
    const n = values.length
    const mean = average(values)
    return [key, {
      valid_run_count: n, missing_run_count: batch.overall_results.run_count - n,
      mean, median: n ? (values[Math.floor((n - 1) / 2)] + values[Math.floor(n / 2)]) / 2 : null,
      min: n ? values[0] : null, max: n ? values[n - 1] : null,
      stddev: n > 1 ? Math.sqrt(values.reduce((sum, value) => sum + (value - mean!) ** 2, 0) / (n - 1)) : null,
    }]
  })) as Record<AnalysisMetricKey, RunStatistics>
}
