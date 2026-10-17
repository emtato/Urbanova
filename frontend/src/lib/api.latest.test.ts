import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const KEY = 'urbanova.latestComparisonId'

function fakeStorage(initial: Record<string, string> = {}) {
  const store = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, v) },
    removeItem: (k: string) => { store.delete(k) },
    store,
  }
}

// Fresh module per test: the remembered ID is read from storage when the module loads.
async function loadApi(storage: ReturnType<typeof fakeStorage>) {
  vi.resetModules()
  vi.stubGlobal('localStorage', storage)
  const api = await import('./api')
  api.setUseFixture(false)
  return api
}

describe('map comparison loading: no job on page load', () => {
  beforeEach(() => { vi.unstubAllGlobals() })
  afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers() })

  it('reports "no comparison" without calling the backend when nothing is remembered', async () => {
    const api = await loadApi(fakeStorage())
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
    await expect(api.fetchComparison()).rejects.toBeInstanceOf(api.NoComparisonError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('reloads the remembered comparison with a single GET', async () => {
    const { sampleComparison } = await import('./sampleComparison')
    const result = { ...structuredClone(sampleComparison), comparison_id: 'remembered-id', fixture: false }
    const api = await loadApi(fakeStorage({ [KEY]: 'remembered-id' }))
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(result)))
    vi.stubGlobal('fetch', fetchMock)
    expect((await api.fetchComparison()).comparison_id).toBe('remembered-id')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe(api.API_BASE_URL + '/results/remembered-id')
    expect(fetchMock.mock.calls[0][1]?.method).toBe('GET')
  })

  it('forgets a remembered comparison the server no longer has', async () => {
    const storage = fakeStorage({ [KEY]: 'gone-id' })
    const api = await loadApi(storage)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })))
    await expect(api.fetchComparison()).rejects.toBeInstanceOf(api.NoComparisonError)
    expect(storage.store.has(KEY)).toBe(false)
    expect(api.getLatestComparisonId()).toBeUndefined()
  })

  it('forgets a remembered ID the server rejects as invalid', async () => {
    const storage = fakeStorage({ [KEY]: 'not-a-uuid' })
    const api = await loadApi(storage)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Invalid request' }), { status: 422 })))
    await expect(api.fetchComparison()).rejects.toBeInstanceOf(api.NoComparisonError)
    expect(storage.store.has(KEY)).toBe(false)
  })

  it('keeps other errors visible and keeps the remembered ID', async () => {
    const storage = fakeStorage({ [KEY]: 'kept-id' })
    const api = await loadApi(storage)
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: 'Database unavailable' }), { status: 503 })))
    await expect(api.fetchComparison()).rejects.toThrow('Database unavailable')
    expect(storage.store.get(KEY)).toBe('kept-id')
  })

  it('remembers the comparison a completed run produced, across a reload', async () => {
    const { sampleComparison } = await import('./sampleComparison')
    const result = { ...structuredClone(sampleComparison), comparison_id: 'new-id', fixture: false }
    const storage = fakeStorage()
    const api = await loadApi(storage)
    const replies = [sampleComparison.scenario, { job_id: 'job-1', status: 'completed', comparison_id: 'new-id', stale: false }, result]
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(replies.shift()))))
    await api.runAnalysis({})
    expect(storage.store.get(KEY)).toBe('new-id')
    const reloaded = await loadApi(storage)
    expect(reloaded.getLatestComparisonId()).toBe('new-id')
  })

  it('gives the map a labelled fixture copy it can show before any live result', async () => {
    const api = await loadApi(fakeStorage())
    const first = api.fixtureComparison()
    expect(first.fixture).toBe(true)
    first.corridor.route_pattern = 'MUTATED'
    expect(api.fixtureComparison().corridor.route_pattern).not.toBe('MUTATED')
  })

  it('works when storage is unavailable', async () => {
    vi.resetModules()
    vi.stubGlobal('localStorage', { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('blocked') }, removeItem: () => { throw Error('blocked') } })
    const api = await import('./api')
    api.setUseFixture(false)
    await expect(api.fetchComparison()).rejects.toBeInstanceOf(api.NoComparisonError)
    expect(() => api.forgetLatestComparison()).not.toThrow()
  })
})
