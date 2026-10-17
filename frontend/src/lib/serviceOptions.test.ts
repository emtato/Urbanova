import { describe, expect, it } from 'vitest'
import { reviewedInterventions } from '../data'
import reviewed from '../../../data/reviewed/interventions.json'
import { BASELINE_HEADWAY_S, BASELINE_VEHICLES, CUSTOM_MAX_S, CUSTOM_MIN_S, DEFAULT_HEADWAY_S, HEADWAY_PRESETS, formatCad, isBaseline, serviceCost, validateCustomHeadway } from './serviceOptions'

describe('extra-service headway options (A10)', () => {
  it('keeps the frontend copy identical to data/reviewed/interventions.json', () => {
    expect(reviewedInterventions).toEqual(reviewed)
  })

  it('offers today plus 360/300/240 s, with 300 s as the default', () => {
    expect(HEADWAY_PRESETS.map(p => p.headway_s)).toEqual([BASELINE_HEADWAY_S, 360, 300, 240])
    expect(HEADWAY_PRESETS[0].current).toBe(true)
    expect(DEFAULT_HEADWAY_S).toBe(300)
  })

  it('reproduces the reviewed vehicles and annual costs for every option', () => {
    for (const option of reviewedInterventions.extra_service.headway_options) {
      const cost = serviceCost(option.headway_s)
      expect(cost.vehicles).toBe(option.vehicles)
      expect(cost.extra_vehicles).toBe(option.extra_vehicles)
      expect(cost.annual_operating_cad).toEqual(option.annual_operating_cad)
    }
  })

  it('costs today’s service at zero extra', () => {
    const cost = serviceCost(BASELINE_HEADWAY_S)
    expect(cost.extra_vehicles).toBe(0)
    expect(cost.vehicles).toBe(BASELINE_VEHICLES)
    expect(cost.annual_operating_cad).toEqual({ low: 0, central: 0, high: 0 })
    expect(isBaseline(BASELINE_HEADWAY_S)).toBe(true)
    expect(isBaseline(300)).toBe(false)
  })

  it('bounds custom headways between 3 minutes and today', () => {
    expect(validateCustomHeadway(270)).toBeNull()
    expect(validateCustomHeadway(CUSTOM_MIN_S - 1)).toMatch(/between/)
    expect(validateCustomHeadway(CUSTOM_MAX_S + 1)).toMatch(/between/)
    expect(validateCustomHeadway(Number.NaN)).toMatch(/Enter/)
    expect(() => serviceCost(0)).toThrow()
  })

  it('formats dollars compactly', () => {
    expect(formatCad(1_420_660)).toBe('$1.42M')
    expect(formatCad(532_748)).toBe('$533k')
  })
})
