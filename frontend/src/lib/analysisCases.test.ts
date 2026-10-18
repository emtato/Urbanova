import { describe, expect, it } from 'vitest'
import { planAnalysisCases } from './analysisCases'
import { BASELINE_HEADWAY_S } from './serviceOptions'

const settings = { run_count: 3, seed: 42, development_ids: ['new-homes'], headway_s: BASELINE_HEADWAY_S, headway_randomness_s: 12, link_travel_time_variation_share: 0.25, start_time_s: 25200, end_time_s: 32400, rush_hour_duration_s: 7200 }

describe('housing and service comparisons', () => {
  it('compares existing homes with added developments when service is unchanged', () => {
    const cases = planAnalysisCases(settings)
    expect(cases.map(item => item.role)).toEqual(['baseline', 'growth'])
    expect(cases[0].request).toEqual({ ...settings, development_ids: [] })
    expect(cases[1].request).toEqual(settings)
  })

  it('isolates growth at current service and then tests chosen service with housing fixed', () => {
    const cases = planAnalysisCases({ ...settings, headway_s: 300 })
    expect(cases.map(item => item.role)).toEqual(['baseline', 'growth', 'selected'])
    expect(cases.map(item => [item.request.development_ids, item.request.headway_s])).toEqual([
      [[], BASELINE_HEADWAY_S], [['new-homes'], BASELINE_HEADWAY_S], [['new-homes'], 300],
    ])
    for (const { request } of cases) {
      expect(request).toMatchObject({ seed: 42, run_count: 3, headway_randomness_s: 12, link_travel_time_variation_share: 0.25, start_time_s: 25200, end_time_s: 32400, rush_hour_duration_s: 7200 })
    }
  })

  it('does not create duplicate unchanged scenarios and still compares service without developments', () => {
    expect(planAnalysisCases({ ...settings, development_ids: [] }).map(item => item.role)).toEqual(['baseline'])
    expect(planAnalysisCases({ ...settings, development_ids: [], headway_s: 300 }).map(item => item.role)).toEqual(['baseline', 'selected'])
  })
})
