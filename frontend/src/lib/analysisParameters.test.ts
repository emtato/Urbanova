import { describe, expect, it } from 'vitest'
import { simulationTimes } from './analysisParameters'

describe('simulation hours sent to the API', () => {
  it('preserves the existing 07:00–09:00 defaults in seconds', () => {
    expect(simulationTimes('7', '9', '2').values).toEqual({ start_time_s: 25200, end_time_s: 32400, rush_hour_duration_s: 7200 })
  })
  it('converts fractional hours and rounds to integer seconds', () => {
    expect(simulationTimes('7.5', '9.25', '1.5').values).toEqual({ start_time_s: 27000, end_time_s: 33300, rush_hour_duration_s: 5400 })
    expect(simulationTimes('7.333333', '25', '2').values?.start_time_s).toBe(26400)
  })
  it('rejects empty, invalid, reversed, and out-of-bounds time inputs', () => {
    for (const values of [['', '9', '2'], ['no', '9', '2'], ['9', '7', '2'], ['7', '7', '2'], ['-1', '9', '2'], ['7', '49', '2'], ['7', '9', '0'], ['7', '9', '25'], ['7', '9', '0.00001']]) {
      expect(simulationTimes(...values as [string, string, string]).error).toBeTruthy()
    }
  })
})
