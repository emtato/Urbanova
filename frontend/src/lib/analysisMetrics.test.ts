import { describe, expect, it } from 'vitest'
import { analysisMetricValue, analysisStatistics, averageStopCrowding } from './analysisMetrics'
import type { NativeBatch } from './liveTypes'

type Run = NativeBatch['individual_results'][number]
function run(): Run {
  return {
    inputs: { seed: 42, start_time_s: 0, end_time_s: 100, stops: [{ id: 'a' }, { id: 'b' }], streetcar_capacity: 100 },
    summary: { overview: { mean_departure_load: 50, streetcar_capacity: 100 }, by_stop: [{ mean_headway_s: 100, headway_cv: 0 }, { mean_headway_s: 300, headway_cv: .5 }, { mean_headway_s: null, headway_cv: null }] },
    sim_log: [
      { time_s: -10, stop_queues: { a: 2, b: 0 } },
      { time_s: 20, stop_queues: { a: 4, b: 0 } },
      { time_s: 20, stop_queues: { a: 6, b: 0 } },
      { time_s: 70, stop_queues: { a: 0, b: 2 } },
      { time_s: 110, stop_queues: { a: 999, b: 999 } },
    ],
  } as unknown as Run
}

describe('recorded crowding and reliability measures', () => {
  it('weights stop crowding by duration, including warm-up state, duplicate timestamps and the final queue', () => {
    // (2×20 + 6×50 + 2×30) / (100 seconds × 2 stops) = 2 people per stop.
    expect(averageStopCrowding(run())).toBe(2)
  })

  it('distinguishes an empty queue from missing or partial history', () => {
    const input = run()
    input.sim_log = [{ time_s: 0, action: 'passenger_arrive', streetcar: null, stop_id: 'a', count: 0, onboard_count_after: null, stop_queues: { a: 0, b: 0 } }]
    expect(averageStopCrowding(input)).toBe(0)
    input.sim_log = []
    expect(averageStopCrowding(input)).toBeNull()
    input.sim_log = run().sim_log
    input.inputs.retention = 'summary-only'
    expect(averageStopCrowding(input)).toBeNull()
    delete input.inputs.retention
    input.sim_log[0].stop_queues = { a: 2 }
    expect(averageStopCrowding(input)).toBeNull()
  })

  it('uses native departure loads, observed arrival gaps and the shared spacing formula', () => {
    expect(analysisMetricValue(run(), 'streetcar_occupancy')).toBe(.5)
    expect(analysisMetricValue(run(), 'observed_gap_s')).toBe(200)
    expect(analysisMetricValue(run(), 'spacing_score')).toBe(8)
    const input = run()
    Object.assign(input.summary.overview, { mean_departure_load: 0 })
    expect(analysisMetricValue(input, 'streetcar_occupancy')).toBe(0)
    Object.assign(input.summary.overview, { streetcar_capacity: 0 })
    expect(analysisMetricValue(input, 'streetcar_occupancy')).toBeNull()
    input.summary.by_stop = [{ mean_headway_s: null, headway_cv: null }]
    expect(analysisMetricValue(input, 'observed_gap_s')).toBeNull()
    expect(analysisMetricValue(input, 'spacing_score')).toBeNull()
  })

  it('preserves native aggregates and reports missing derived runs instead of treating them as zero', () => {
    const a = run(), b = run()
    b.sim_log = []
    b.summary.by_stop = [{ mean_headway_s: 400, headway_cv: .5 }]
    const native = { mean: null, median: null, min: null, max: null, stddev: null, valid_run_count: 0, missing_run_count: 2 }
    const batch = { overall_results: { run_count: 2, metrics: { mean_wait_s: native } }, individual_results: [a, b] } as unknown as NativeBatch
    const statistics = analysisStatistics(batch)
    expect(statistics.mean_wait_s).toBe(native)
    expect(statistics.stop_crowding).toMatchObject({ mean: 2, valid_run_count: 1, missing_run_count: 1 })
    expect(statistics.observed_gap_s.mean).toBe(300)
    expect(statistics.spacing_score.mean).toBe(6.5)
  })
})
