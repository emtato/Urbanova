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
  it('marks the selected preset and labels today', () => {
    const out = html(<HeadwaySelector value={300} onChange={() => {}} />)
    expect(out).toContain('Current')
    expect(out).toContain('360 s')
    expect(out).toContain('240 s')
    expect(out).toContain('Custom…')
    expect(out).toMatch(/aria-pressed="true"[^>]*>\s*<span class="headway-option-label">300 s/)
  })

  it('opens the custom field for a non-preset value', () => {
    const out = html(<HeadwaySelector value={270} onChange={() => {}} />)
    expect(out).toContain('Custom headway (s)')
    expect(out).toContain('value="270"')
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
})

describe('before/after card', () => {
  it('prompts for a run when there is no comparison', () => {
    expect(html(<HeadwayImpactCard pair={null} />)).toContain('Run a simulation with a headway other than today')
  })

  it('shows before, after and change, marking improvements', () => {
    const before = batch('a', { mean_wait_s: 200, p95_wait_s: 600, denied_boarding_share: 0.3, unresolved_passengers: 10 })
    const after = batch('b', { mean_wait_s: 150, p95_wait_s: 400, denied_boarding_share: 0.1, unresolved_passengers: 10 })
    const out = html(<HeadwayImpactCard pair={{ before, after, before_headway_s: BASELINE_HEADWAY_S, after_headway_s: 300 }} />)
    expect(out).toContain('200.0 s')
    expect(out).toContain('150.0 s')
    expect(out).toContain('−50.0 s (−25%)')
    expect(out).toContain('−20.0 pts (−67%)')
    expect(out).toContain('no change')
    expect(out).toContain('class="is-better"')
  })
})
