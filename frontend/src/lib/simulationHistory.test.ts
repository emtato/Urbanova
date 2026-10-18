import { describe, it, expect } from 'vitest'
import { addComparison, todayBaseline, batchCase, comparisonProblem, configurationName, effectiveConfiguration, formatSimulationTimestamp, mapComparison, readHistory } from './simulationHistory'
import { transitMetrics } from '../panels/transitMetrics'

describe('saved simulation identity and bundled baseline', () => {
  it('formats simulation timestamp to date and minute (YYYY-MM-DD HH:mm)', () => {
    const testDate = new Date(2026, 9, 18, 4, 15)
    expect(formatSimulationTimestamp(testDate)).toBe('2026-10-18 04:15')
    const paddedDate = new Date(2026, 0, 5, 9, 7)
    expect(formatSimulationTimestamp(paddedDate)).toBe('2026-01-05 09:07')
  })
  it('bundles real conservation-valid native runs without adding history entries', async () => {
    expect(todayBaseline.overall_results.all_runs_conservation_valid).toBe(true)
    expect(todayBaseline.overall_results.run_count).toBe(3)
    expect(todayBaseline.individual_results[0].inputs.developments).toEqual([])
    expect(transitMetrics(batchCase(todayBaseline)).existing).toBeGreaterThan(0)
    expect(await readHistory()).toEqual([])
    expect(mapComparison(todayBaseline).fixture).toBe(false)
  })
  it('does not classify random seed changes as a new configuration', () => {
    const changed = structuredClone(todayBaseline)
    changed.individual_results[0].inputs.seed = 912
    expect(effectiveConfiguration(changed)).toBe(effectiveConfiguration(todayBaseline))
    expect(configurationName(changed)).toBe('Today configuration')
    changed.individual_results[0].inputs.headway_s = 200
    expect(configurationName(changed)).toBe('Custom configuration')
  })
  it('blocks comparisons across different windows or corridors while allowing service changes', () => {
    const changed = structuredClone(todayBaseline)
    changed.individual_results[0].inputs.headway_s = 200
    expect(comparisonProblem(changed)).toBeNull()
    changed.individual_results[0].inputs.start_time_s = 0
    expect(comparisonProblem(changed)).toMatch(/time window/)
    changed.individual_results[0].inputs.start_time_s = todayBaseline.individual_results[0].inputs.start_time_s
    changed.individual_results[0].inputs.stops = []
    expect(comparisonProblem(changed)).toMatch(/corridor/)
  })
  it('limits comparisons to two distinct runs and can prioritize the loaded run', () => {
    expect(addComparison(['one'], 'one')).toEqual(['one'])
    expect(addComparison(['one'], 'two')).toEqual(['one', 'two'])
    expect(addComparison(['one', 'two'], 'three')).toEqual(['one', 'two'])
    expect(addComparison(['one', 'two'], 'three', true)).toEqual(['three', 'one'])
    expect(addComparison(['one'], 'three')).toEqual(['one', 'three'])
  })
  it('loads exactly the saved housing configuration into the map', () => {
    const custom = structuredClone(todayBaseline)
    custom.id = 'user-run'
    custom.individual_results[0].inputs.developments = [{ id: 'proposal', name: 'A proposal', latitude: 43.66, longitude: -79.37, net_added_units: 50, occupied_share: 1, residents_per_occupied_unit: 2, transit_share: .3, accessible_stop_ids: ['ttc-stop-2123'] }]
    const loaded = mapComparison(custom)
    expect(loaded.comparison_id).toBe('user-run')
    expect(loaded.scenario.developments).toEqual(custom.individual_results[0].inputs.developments)
    expect(loaded.cases).toHaveLength(1)
    expect(loaded.packages).toEqual([])
  })
})
