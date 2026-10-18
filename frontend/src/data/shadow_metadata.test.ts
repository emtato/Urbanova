import { describe, it, expect } from 'vitest'
import {
  SEASONS,
  TIME_STEPS,
  getShadowSlot,
} from './shadow_metadata'

describe('shadow_metadata (Contract 1.0.0 / Sunlight & Shadows)', () => {
  it('includes all 4 seasons with user-friendly names including Fall', () => {
    const seasonIds = SEASONS.map((s) => s.id)
    expect(seasonIds).toContain('spring_equinox')
    expect(seasonIds).toContain('summer_solstice')
    expect(seasonIds).toContain('autumn_equinox')
    expect(seasonIds).toContain('winter_solstice')

    const fall = SEASONS.find((s) => s.id === 'autumn_equinox')
    expect(fall).toBeDefined()
    expect(fall?.name).toBe('Fall')
    expect(fall?.date).toBe('Sep 22')
  })

  it('defines the 4 slider steps with words only and no clock times', () => {
    const stepIds = TIME_STEPS.map((t) => t.id)
    expect(stepIds).toEqual(['morning', 'noon', 'afternoon', 'night'])
    for (const step of TIME_STEPS) {
      expect(step.clockTime).toBe(step.label)
      expect(step.clockTime).not.toMatch(/\d+:\d+/)
      expect(step.clockTime).not.toMatch(/(AM|PM)/)
    }
  })

  it('configures afternoon to sunset/dusk preset across seasons', () => {
    for (const season of SEASONS) {
      const afternoon = getShadowSlot(season.id, 'afternoon')
      expect(afternoon).toBeDefined()
      expect(afternoon?.timeId).toBe('afternoon')
      expect(afternoon?.lightPreset).toBe('dusk')
      expect(afternoon?.sun_up).toBe(true)
      expect(afternoon?.sun_altitude_deg).toBeGreaterThan(0)
    }
  })

  it('fixes winter night to dark night preset rather than falling back to bright daylight', () => {
    const winterNight = getShadowSlot('winter_solstice', 'night')
    expect(winterNight).toBeDefined()
    expect(winterNight?.timeId).toBe('night')
    expect(winterNight?.lightPreset).toBe('night')
    expect(winterNight?.sun_up).toBe(false)
    expect(winterNight?.added_m2).toBe(0)
  })

  it('resolves Fall equinox slots for all 4 times with precomputed metrics', () => {
    const fallMorning = getShadowSlot('autumn_equinox', 'morning')
    const fallNoon = getShadowSlot('autumn_equinox', 'noon')
    const fallAfternoon = getShadowSlot('autumn_equinox', 'afternoon')
    const fallNight = getShadowSlot('autumn_equinox', 'night')

    expect(fallMorning).toBeDefined()
    expect(fallMorning?.lightPreset).toBe('dawn')
    expect(fallMorning?.sun_up).toBe(true)
    expect(fallMorning?.today_m2).toBeGreaterThan(0)

    expect(fallNoon).toBeDefined()
    expect(fallNoon?.lightPreset).toBe('day')
    expect(fallNoon?.sun_up).toBe(true)

    expect(fallAfternoon).toBeDefined()
    expect(fallAfternoon?.lightPreset).toBe('dusk')
    expect(fallAfternoon?.sun_up).toBe(true)

    expect(fallNight).toBeDefined()
    expect(fallNight?.lightPreset).toBe('night')
    expect(fallNight?.sun_up).toBe(false)
  })

  it('supports backwards compatibility lookup by clock strings', () => {
    expect(getShadowSlot('summer_solstice', '09:00')?.timeId).toBe('morning')
    expect(getShadowSlot('summer_solstice', '12:00')?.timeId).toBe('noon')
    expect(getShadowSlot('summer_solstice', '15:00')?.timeId).toBe('afternoon')
    expect(getShadowSlot('summer_solstice', '17:40')?.timeId).toBe('afternoon')
    expect(getShadowSlot('summer_solstice', '18:00')?.timeId).toBe('afternoon')
    expect(getShadowSlot('summer_solstice', '22:00')?.timeId).toBe('night')
  })
})
