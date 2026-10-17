import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl'
import { animateStreetView } from './animateStreetView'

describe('street-level camera transition', () => {
  let frames: Map<number, FrameRequestCallback>
  let events: Map<string, () => void>
  let snapshots: { x: number; y: number; z: number }[]
  let map: MapboxMap
  const step = (time: number) => {
    const callbacks = [...frames.values()]
    frames.clear()
    callbacks.forEach(callback => callback(time))
  }
  beforeEach(() => {
    frames = new Map()
    events = new Map()
    snapshots = []
    let id = 0
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => { frames.set(++id, callback); return id })
    vi.stubGlobal('cancelAnimationFrame', (frame: number) => frames.delete(frame))
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    const camera = new mapboxgl.FreeCameraOptions(new mapboxgl.MercatorCoordinate(.5, .5, .01), [0, 0, 0, 1])
    map = {
      stop: vi.fn(), setMaxPitch: vi.fn(), getFreeCameraOptions: () => camera,
      queryTerrainElevation: () => 0,
      setFreeCameraOptions: (value: ReturnType<MapboxMap['getFreeCameraOptions']>) => snapshots.push({ ...value.position! }),
      on: (event: string, callback: () => void) => events.set(event, callback),
      off: (event: string) => events.delete(event),
    } as unknown as MapboxMap
  })
  afterEach(() => vi.unstubAllGlobals())

  it('passes through intermediate positions and ends at 1.7 metres', () => {
    const ended = vi.fn()
    animateStreetView(map, [-79.37, 43.66], ended)
    expect(snapshots).toHaveLength(0)
    step(0)
    step(900)
    step(1800)
    const target = mapboxgl.MercatorCoordinate.fromLngLat([-79.37, 43.66], 1.7)
    expect(snapshots[1].z).toBeLessThan(snapshots[0].z)
    expect(snapshots[1].z).toBeGreaterThan(target.z)
    expect(snapshots[2].x).toBeCloseTo(target.x, 12)
    expect(snapshots[2].z).toBeCloseTo(target.z, 12)
    expect(ended).toHaveBeenCalledTimes(1)
    expect(events.size).toBe(0)
  })

  it('lets user input interrupt the camera without a later snap', () => {
    const ended = vi.fn()
    animateStreetView(map, [-79.37, 43.66], ended)
    step(0)
    events.get('wheel')!()
    step(1800)
    expect(snapshots).toHaveLength(1)
    expect(ended).toHaveBeenCalledTimes(1)
    expect(frames.size).toBe(0)
  })
})
