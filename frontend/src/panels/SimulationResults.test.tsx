import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { SimulationResults, readableTime } from './SimulationResults'
import type { NativeBatch } from '../lib/liveTypes'

function batch(count: number): NativeBatch {
  const values = { mean_wait_s: 138, p95_wait_s: 275, denied_boarding_share: 0, unresolved_passengers: 0, in_progress_at_cutoff_passengers: 197 }
  return {
    id: 'test-batch', name: 'Morning commute',
    overall_results: {
      run_count: count, seeds: Array.from({ length: count }, (_, i) => 42 + i),
      metrics: Object.fromEntries(Object.entries(values).map(([key, value]) => [key, { mean: value, median: value, min: value, max: value, stddev: count > 1 ? 0 : null, valid_run_count: count, missing_run_count: 0 }])),
      runtime: { total_s: 0.9, per_run_s: [], statistics_s: {} },
    },
    individual_results: Array.from({ length: count }, (_, i) => ({ inputs: { seed: 42 + i }, summary: { overview: values } })),
  } as unknown as NativeBatch
}

describe('readable simulation results', () => {
  it('preserves zero, missing values and duration units', () => {
    expect(readableTime(0)).toBe('0 sec')
    expect(readableTime(null)).toBe('Not available')
    expect(readableTime(138)).toBe('2 min 18 sec')
    expect(readableTime(59.9)).toBe('1 min')
    expect(readableTime(0.9)).toBe('0.9 sec')
  })

  it('shows one-run results without a redundant statistics table or run selector', () => {
    const out = renderToStaticMarkup(<SimulationResults batch={batch(1)} selectedRunIndex={0} onSelectRun={() => {}} />)
    expect(out).toContain('2 min 18 sec')
    expect(out).toContain('4 min 35 sec')
    expect(out).toContain('0.0%')
    expect(out).toContain('197')
    expect(out).toContain('Still waiting after a full streetcar')
    expect(out).toContain('Trips still in progress')
    expect(out).toContain('waiting for their first streetcar')
    expect(out).not.toContain('<table')
    expect(out).not.toContain('<select')
    expect(out).not.toContain('mean_wait_s')
  })

  it('distinguishes average percentiles and neutral riders, and retains run selection and missing-data counts', () => {
    const input = batch(2)
    input.overall_results.metrics.mean_wait_s = { mean: null, median: null, min: null, max: null, stddev: null, valid_run_count: 0, missing_run_count: 2 }
    const out = renderToStaticMarkup(<SimulationResults batch={input} selectedRunIndex={1} onSelectRun={() => {}} />)
    expect(out).toContain('Not available')
    expect(out).toContain('0 / 2')
    expect(out).toContain('not a percentile of all riders combined')
    expect(out).toContain('not a confidence interval')
    expect(out).toContain('<option value="1" selected=""')
    expect(out).toContain('the replay below belong to run 2')
    expect(out).toContain('Detailed statistics and run information')
  })
})
