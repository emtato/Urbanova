import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Map as MapboxMap } from 'mapbox-gl'
import { scheduleSolarUpdate } from './scheduleSolarUpdate'

describe('solar updates while the map style loads', () => {
  let frames: Map<number, FrameRequestCallback>
  let events: Map<string, Set<() => void>>
  let ready: boolean
  let map: MapboxMap
  const flush = () => {
    const queued = [...frames.values()]
    frames.clear()
    queued.forEach(callback => callback(0))
  }
  const emit = (event: string) => events.get(event)?.forEach(callback => callback())

  beforeEach(() => {
    frames = new Map()
    events = new Map()
    ready = false
    let nextId = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextId, callback)
      return nextId
    })
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id))
    map = {
      isStyleLoaded: () => ready,
      on: (event: string, callback: () => void) => {
        if (!events.has(event)) events.set(event, new Set())
        events.get(event)!.add(callback)
      },
      off: (event: string, callback: () => void) => events.get(event)?.delete(callback),
    } as unknown as MapboxMap
  })

  afterEach(() => vi.unstubAllGlobals())

  it('applies only the final rapid selection once the style is ready', () => {
    const applied: string[] = []
    let cancel = () => {}
    for (const time of ['morning', 'night', 'noon', 'night']) {
      cancel()
      cancel = scheduleSolarUpdate(map, () => applied.push(time))
      flush()
    }
    expect(applied).toEqual([])
    ready = true
    emit('idle')
    flush()
    expect(applied).toEqual(['night'])
    cancel()
  })

  it('does not loop when applying lighting emits style events', () => {
    ready = true
    const apply = vi.fn(() => emit('styledata'))
    const cancel = scheduleSolarUpdate(map, apply)
    flush()
    emit('idle')
    flush()
    expect(apply).toHaveBeenCalledTimes(1)
    cancel()
    expect([...events.values()].every(listeners => listeners.size === 0)).toBe(true)
  })

  it('reapplies the current selection after initial map load callbacks', () => {
    ready = true
    const apply = vi.fn()
    const cancel = scheduleSolarUpdate(map, apply)
    flush()
    emit('load')
    flush()
    expect(apply).toHaveBeenCalledTimes(2)
    cancel()
  })
})
