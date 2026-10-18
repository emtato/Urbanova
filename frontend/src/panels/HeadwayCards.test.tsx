import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { HeadwaySelector } from './HeadwaySelector'
import { ServiceCostCard } from './ServiceCostCard'
import { HeadwayImpactCard } from './HeadwayImpactCard'
import { BASELINE_HEADWAY_S } from '../lib/serviceOptions'
import type { NativeBatch } from '../lib/liveTypes'

const html = (node: React.ReactElement) => renderToString(node).replace(/<!--.*?-->/g, '')

function batch(id: string, metrics: Record<string, number>): NativeBatch {
  const stat = (mean: number) => ({ mean, median: mean, min: mean, max: mean, stddev: 0, valid_run_count: 2, missing_run_count: 0 })
  return {
    id,
    overall_results: {
      run_count: 2, seeds: [42, 43],
      metrics: Object.fromEntries(Object.entries(metrics).map(([k, v]) => [k, stat(v)])),
      runtime: { total_s: 1 },
    },
    individual_results: [],
  } as unknown as NativeBatch
}

describe('headway selector', () => {
  it('offers a bounded slider and an always-visible custom seconds field', () => {
    const out = html(<HeadwaySelector value={300} onChange={() => {}} />)
    expect(out).toContain('type="range"')
    expect(out).toContain('min="60"')
    expect(out).toContain('max="1200"')
    expect(out).toContain('Custom headway (s)')
    expect(out).toContain('value="300"')
    expect(out).toContain('Use today’s service')
  })

  it('displays custom intervals and rounds the exact reviewed baseline for the control', () => {
    expect(html(<HeadwaySelector value={270} onChange={() => {}} />)).toContain('value="270"')
    const today = html(<HeadwaySelector value={BASELINE_HEADWAY_S} onChange={() => {}} />)
    expect(today).toContain('value="420"')
  })
})

describe('service cost card', () => {
  it('shows extra cars and the yearly cost range for 300 s', () => {
    const out = html(<ServiceCostCard headway_s={300} />)
    expect(out).toContain('+8')
    expect(out).toContain('$1.42M')
    expect(out).toContain('$858k')
    expect(out).toContain('$2.23M')
    expect(out).toContain('not TTC quotes')
  })

  it('shows no extra cost for today', () => {
    expect(html(<ServiceCostCard headway_s={BASELINE_HEADWAY_S} />)).toContain('no extra cost')
  })

  it('shows reduced service note for headways longer than today', () => {
    expect(html(<ServiceCostCard headway_s={600} />)).toContain('Reduced service: 14 streetcars needed')
  })
})

describe('before/after card', () => {
  it('prompts for a run when there is no comparison', () => {
    expect(html(<HeadwayImpactCard pair={null} />)).toContain('Select developments or change the streetcar interval, then run a simulation to compare impacts.')
  })

  it('shows before, after and change, marking improvements', () => {
    const before = batch('a', { mean_wait_s: 200, p95_wait_s: 600, denied_boarding_share: 0.3, unresolved_passengers: 10 })
    const after = batch('b', { mean_wait_s: 150, p95_wait_s: 400, denied_boarding_share: 0.1, unresolved_passengers: 10 })
    const out = html(<HeadwayImpactCard pair={{ before, after, before_headway_s: BASELINE_HEADWAY_S, after_headway_s: 300 }} />)
    expect(out).toContain('3 min 20 sec')
    expect(out).toContain('2 min 30 sec')
    expect(out).toContain('−50.0 s (−25%)')
    expect(out).toContain('−20.0 percentage points')
    expect(out).toContain('no change')
    expect(out).toContain('class="is-better"')
  })

  it('labels housing comparisons correctly and scores more regular spacing as an improvement', () => {
    const before = batch('a', { streetcar_occupancy: .8, stop_crowding: 10, observed_gap_s: 300, spacing_score: 2 })
    const after = batch('b', { streetcar_occupancy: .6, stop_crowding: 5, observed_gap_s: 200, spacing_score: 8 })
    const out = html(<HeadwayImpactCard pair={{ before, after, kind: 'housing', before_headway_s: BASELINE_HEADWAY_S, after_headway_s: BASELINE_HEADWAY_S }} />)
    expect(out).toContain('Existing homes')
    expect(out).toContain('With new homes')
    expect(out).toContain('Service stays at a streetcar every')
    expect(out).toContain('Average streetcar occupancy')
    expect(out).toContain('Average people waiting per stop')
    expect(out).toContain('Average gap between streetcars')
    expect(out).toContain('80.0%')
    expect(out).toContain('60.0%')
    expect(out).toContain('<dd class="is-better">+6.0 points</dd>')
  })
})
