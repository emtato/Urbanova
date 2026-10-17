import { describe, expect, it } from 'vitest'
import type { CaseResult } from '../lib/types'
import type { NativeCaseResult } from '../lib/liveTypes'
import { spacingScore, transitMetrics } from './transitMetrics'

const row = { stop_id: 's1', rider_group: 'existing' as const, passengers: 10, completed_passengers: 8, mean_wait_s: 30, p95_wait_s: 60, denied_at_least_once_share: .2, remaining_queue: 2, headway_cv: .5 }
const fixture = { stops: [row], per_run_mean_wait_s: [30], per_run_p95_wait_s: [60], per_run_denied_share: [.2] } as CaseResult

describe('inspector metric semantics', () => {
  it('preserves missing results and distinguishes genuine zero demand', () => {
    expect(transitMetrics(undefined, 's1').existing).toBeNull()
    expect(transitMetrics(fixture, 'missing').waiting).toBeNull()
    const zero = { ...fixture, stops: [{ ...row, passengers: 0, completed_passengers: 0, mean_wait_s: null, denied_at_least_once_share: null, remaining_queue: 0 }] }
    expect(transitMetrics(zero, 's1')).toMatchObject({ existing: 0, wait: null, denied: null, waiting: 0 })
  })
  it('weights fixture waits by completed riders, and never combines cohort p95s', () => {
    const twoGroups = { ...fixture, stops: [row, { ...row, rider_group: 'new' as const, passengers: 4, completed_passengers: 2, mean_wait_s: 80 }] }
    expect(transitMetrics(twoGroups, 's1').wait).toBe(40)
    expect(transitMetrics(twoGroups, 's1').p95).toBeNull()
  })
  it('uses native physical queues and native denominators rather than the legacy projection', () => {
    const result = {
      ...fixture,
      overall_results: { metrics: { raw_waiting_at_cutoff_passengers: { mean: 9 }, unresolved_passengers: { mean: 2 }, mean_wait_s: { mean: 44 } } },
      individual_results: [1, 2].map(multiplier => ({ summary: { by_stop: [{
        stop_id: 's1', mean_wait_s: 20 * multiplier, raw_waiting_at_cutoff: 6 * multiplier,
        remaining_queue: 2, denied_at_least_once_share: .5, headway_cv: .4,
        by_rider_group: { existing: { passengers: 12 * multiplier, mean_wait_s: 15 }, new: { passengers: 3 } },
      }] } })),
    } as unknown as NativeCaseResult
    expect(transitMetrics(result, 's1')).toMatchObject({ existing: 18, added: 3, waiting: 9, denied: .5, wait: 30 })
    expect(transitMetrics(result).waiting).toBe(9)
    expect(transitMetrics(result).wait).toBe(44)
    expect(transitMetrics(result, 'absent').existing).toBeNull()
  })
  it('makes spacing variation visible on the custom scale', () => {
    expect(spacingScore(0)).toBe(10)
    expect(spacingScore(.25)).toBe(8)
    expect(spacingScore(.5)).toBe(5)
    expect(spacingScore(1)).toBe(2)
    expect(spacingScore(15)).toBeGreaterThanOrEqual(0)
    expect(spacingScore(15)).toBeLessThan(.1)
    expect(spacingScore(-1)).toBeNull()
    expect(spacingScore(NaN)).toBeNull()
    expect(spacingScore(Infinity)).toBeNull()
    expect(spacingScore(null)).toBeNull()
  })
})
