import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  isUsingFixture,
  setUseFixture,
  fetchComparison,
  fetchCorridor,
  fetchReplayStream,
  runScenario,
  runAnalysis,
  fetchNativeReplay,
  fetchNativeMetrics,
  API_BASE_URL,
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

  it('fetches comparison fixture with official Contract schema', async () => {
    const comparison = await fetchComparison()
    expect(comparison.fixture).toBe(true)
    expect(comparison.contract_version).toMatch(/^[12]\.0\.0$/)
    expect(comparison.corridor.route_pattern).toContain('505')
    expect(comparison.corridor.stops.length).toBeGreaterThanOrEqual(7)
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
    expect(corridor.stops[corridor.stops.length - 1].name).toMatch(/(Jarvis|Yonge|Station)/)
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

describe('Live B11 transport', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); setUseFixture(true) })
  it('creates, patches, enqueues, polls and fetches the stored comparison without changing fixture flags', async () => {
    const { sampleComparison } = await import('./sampleComparison')
    const result = { ...structuredClone(sampleComparison), comparison_id: 'stored-id', fixture: false }
    const replies = [sampleComparison.scenario, { ...sampleComparison.scenario, version: 2 }, { job_id: 'job-id', status: 'queued' }, { job_id: 'job-id', status: 'completed', comparison_id: 'stored-id', stale: false }, result]
    const fetchMock = vi.fn(async () => new Response(JSON.stringify(replies.shift()), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock); vi.useFakeTimers()
    const run = runAnalysis({ capital_budget_cad: 500000 }, { seed_ids: [7], draws_id: 'paired-browser-test' })
    await vi.advanceTimersByTimeAsync(1000)
    expect(await run).toEqual(result)
    expect(fetchMock.mock.calls.map(call => String((call as unknown[])[0]))).toEqual(['/scenarios', `/scenarios/${sampleComparison.scenario.scenario_id}/patch`, '/jobs', '/jobs/job-id', '/results/stored-id'].map(path => API_BASE_URL + path))
    const options = (fetchMock.mock.calls[2] as unknown[])[1] as RequestInit
    expect(JSON.parse(String(options.body))).toMatchObject({ version: 2, evaluator: 'b11', retain_replay: true, random: { seed_ids: [7], draws_id: 'paired-browser-test' } })
  })
  it('surfaces backend failure instead of silently substituting fixture results', async () => {
    setUseFixture(false)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Database unavailable' }), { status: 503 })))
    await expect(fetchComparison('stored-id')).rejects.toThrow('Database unavailable')
  })
  it('rejects a fixture returned for a live job', async () => {
    const { sampleComparison } = await import('./sampleComparison')
    const replies = [sampleComparison.scenario, { status: 'completed', comparison_id: 'stored-id' }, sampleComparison]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(replies.shift()))))
    await expect(runAnalysis({})).rejects.toThrow('returned a fixture')
  })
  it('uses versioned replay and metric endpoints with the comparison id', async () => {
    const fetchMock = vi.fn(async (url: string) => new Response(JSON.stringify(url.includes('/replay/') ? { format_version: 'b11-events-v1', comparison_id: 'stored-id', events: [], stops: [] } : { format_version: 'b11-metrics-v1', comparison_id: 'stored-id', runs: [] })))
    vi.stubGlobal('fetch', fetchMock)
    expect((await fetchNativeReplay('stored-id')).format_version).toBe('b11-events-v1')
    expect((await fetchNativeMetrics('stored-id')).format_version).toBe('b11-metrics-v1')
    expect(fetchMock.mock.calls.map(call => call[0])).toEqual(['/replay/stored-id', '/results/stored-id/b11-metrics'].map(path => API_BASE_URL + path))
    setUseFixture(false)
    await expect(fetchReplayStream('stored-id')).rejects.toThrow('B11 replay viewer')
  })
})
