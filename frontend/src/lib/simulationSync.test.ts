import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteSimulation, getSimulations, renameSimulation } from './api'
import { activeSimulationId, currentSimulations, rememberSimulation, setActiveSimulation, syncSimulationHistory, todayBaseline } from './simulationHistory'

function batch(id: string, name = id) { return { ...structuredClone(todayBaseline), id, name } }
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status })

beforeEach(async () => { await syncSimulationHistory([]) })
afterEach(() => { vi.unstubAllGlobals() })

describe('database-authoritative simulation list', () => {
  it('replaces old entries and names in database order while preserving complete replay data', async () => {
    await rememberSimulation(batch('stale', 'Browser-only run'))
    await rememberSimulation(batch('retained', 'Old name'))
    const response = [batch('new'), batch('retained', 'Database name')]
    vi.stubGlobal('fetch', vi.fn(async () => respond(response)))
    expect(await getSimulations()).toEqual(response)
    expect(currentSimulations()).toEqual(response)
    expect(currentSimulations()[0].individual_results[0].sim_log).toEqual(response[0].individual_results[0].sim_log)
  })

  it('accepts an empty database list and clears a removed active selection', async () => {
    const storage = new Map<string, string>()
    const local = { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), removeItem: (key: string) => storage.delete(key) }
    vi.stubGlobal('window', { localStorage: local })
    vi.stubGlobal('localStorage', local)
    await rememberSimulation(batch('removed'))
    setActiveSimulation('removed')
    vi.stubGlobal('fetch', vi.fn(async () => respond([])))
    expect(await getSimulations()).toEqual([])
    expect(currentSimulations()).toEqual([])
    expect(activeSimulationId()).toBeNull()
  })

  it('keeps the last validated list on failed or malformed fetches', async () => {
    const valid = batch('valid')
    await syncSimulationHistory([valid])
    for (const reply of [respond({ error: 'Database unavailable' }, 503), respond([{ id: 'broken' }])]) {
      vi.stubGlobal('fetch', vi.fn(async () => reply))
      await expect(getSimulations()).rejects.toThrow()
      expect(currentSimulations()).toEqual([valid])
    }
  })

  it('uses the database response even when IndexedDB is unavailable', async () => {
    vi.stubGlobal('indexedDB', { open: () => { throw new Error('Browser storage blocked') } })
    const valid = batch('server-only')
    vi.stubGlobal('fetch', vi.fn(async () => respond([valid])))
    expect(await getSimulations()).toEqual([valid])
    expect(currentSimulations()).toEqual([valid])
  })

  it('does not let a delayed list response resurrect a successfully deleted simulation', async () => {
    const old = batch('deleted')
    await syncSimulationHistory([old])
    let finish!: (response: Response) => void
    vi.stubGlobal('fetch', vi.fn((url: string) => url.endsWith('/sim/fetch')
      ? new Promise<Response>(resolve => { finish = resolve })
      : Promise.resolve(respond({ id: old.id, deleted: true }))))
    const pending = getSimulations()
    await deleteSimulation(old.id)
    finish(respond([old]))
    expect(await pending).toEqual([])
    expect(currentSimulations()).toEqual([])
  })

  it('updates acknowledged renames and refuses to present missing endpoints as successful writes', async () => {
    const saved = batch('saved')
    await syncSimulationHistory([saved])
    vi.stubGlobal('fetch', vi.fn(async () => respond({ id: saved.id, name: 'Renamed in database', renamed: true })))
    await renameSimulation(saved.id, 'Renamed in database')
    expect(currentSimulations()[0].name).toBe('Renamed in database')
    vi.stubGlobal('fetch', vi.fn(async () => respond({ error: 'Simulation not found' }, 404)))
    await expect(renameSimulation(saved.id, 'Only local')).rejects.toThrow('404')
    await expect(deleteSimulation(saved.id)).rejects.toThrow('404')
    expect(currentSimulations()[0].name).toBe('Renamed in database')
  })
})
