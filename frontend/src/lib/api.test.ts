import { describe, it, expect, beforeEach } from 'vitest'
import {
  isUsingFixture,
  setUseFixture,
  fetchComparison,
  fetchCorridor,
  fetchReplayStream,
  runScenario,
} from './api'

describe('D1: API Client & Fixture Service (Contract 1.0.0)', () => {
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

  it('fetches comparison fixture with official Contract 1.0.0 schema', async () => {
    const comparison = await fetchComparison()
    expect(comparison.fixture).toBe(true)
    expect(comparison.contract_version).toBe('1.0.0')
    expect(comparison.corridor.route_pattern).toContain('505')
    expect(comparison.corridor.stops.length).toBe(7)
    expect(comparison.packages.length).toBe(2)
    expect(comparison.cases.length).toBeGreaterThan(0)
    expect(comparison.scenario.developments.length).toBe(3)
    expect(comparison.assumptions.length).toBeGreaterThan(0)
    expect(comparison.sources.length).toBeGreaterThan(0)
  })

  it('fetches corridor details correctly in fixture mode', async () => {
    const corridor = await fetchCorridor()
    expect(corridor.route_pattern).toContain('505')
    expect(corridor.direction).toBe('westbound')
    expect(corridor.stops[0].name).toContain('Broadview')
    expect(corridor.stops[corridor.stops.length - 1].name).toContain('Jarvis')
  })

  it('fetches replay stream with discrete events in fixture mode', async () => {
    const stream = await fetchReplayStream()
    expect(stream.length).toBeGreaterThan(0)
    expect(stream[0].vehicle_id).toBeDefined()
    expect(stream[0].kind).toBeDefined()
  })

  it('ensures fixture data immutability through deep cloning', async () => {
    const comp1 = await fetchComparison()
    comp1.corridor.route_pattern = 'MUTATED'

    const comp2 = await fetchComparison()
    expect(comp2.corridor.route_pattern).not.toBe('MUTATED')
    expect(comp2.corridor.route_pattern).toContain('505')
  })

  it('runs scenario overlay in fixture mode', async () => {
    const updated = await runScenario({ capital_budget_cad: 500000 })
    expect(updated.scenario.capital_budget_cad).toBe(500000)
  })
})
