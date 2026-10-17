import { describe, it, expect, beforeEach } from 'vitest'
import {
  isUsingFixture,
  setUseFixture,
  fetchComparison,
  fetchCorridor,
  fetchReplayStream,
  runScenario,
} from './api'

describe('D1: API Client & Fixture Service', () => {
  beforeEach(() => {
    setUseFixture(true)
  })

  it('defaults to fixture mode', () => {
    expect(isUsingFixture()).toBe(true)
  })

  it('supports runtime fixture toggling', () => {
    setUseFixture(false)
    expect(isUsingFixture()).toBe(false)
    setUseFixture(true)
    expect(isUsingFixture()).toBe(true)
  })

  it('fetches comparison fixture with all required schema properties', async () => {
    const comparison = await fetchComparison()
    expect(comparison.fixture).toBe(true)
    expect(comparison.corridor.corridor_id).toBe('corr_505_dundas_wb')
    expect(comparison.corridor.stops.length).toBe(11)
    expect(comparison.packages.length).toBe(4)
    expect(comparison.cases.current).toBeDefined()
    expect(comparison.cases.growth).toBeDefined()
    expect(comparison.cases.supported_growth).toBeDefined()
    expect(comparison.assumptions.length).toBeGreaterThan(0)
    expect(comparison.sources.length).toBeGreaterThan(0)
  })

  it('fetches corridor details correctly in fixture mode', async () => {
    const corridor = await fetchCorridor()
    expect(corridor.name).toContain('505 Dundas')
    expect(corridor.stops[0].name).toContain('Broadview Station')
    expect(corridor.stops[10].name).toContain('Yonge St')
  })

  it('fetches replay stream with discrete events in fixture mode', async () => {
    const stream = await fetchReplayStream()
    expect(stream.length).toBeGreaterThan(0)
    expect(stream[0].vehicle_id).toBeDefined()
    expect(stream[0].kind).toBe('dispatch')
  })

  it('ensures fixture data immutability through deep cloning', async () => {
    const comp1 = await fetchComparison()
    comp1.corridor.name = 'MUTATED_NAME'

    const comp2 = await fetchComparison()
    expect(comp2.corridor.name).not.toBe('MUTATED_NAME')
    expect(comp2.corridor.name).toContain('505 Dundas')
  })

  it('runs scenario overlay in fixture mode', async () => {
    const updated = await runScenario({ occupied_share: 0.99 })
    expect(updated.scenario.occupied_share).toBe(0.99)
  })
})
