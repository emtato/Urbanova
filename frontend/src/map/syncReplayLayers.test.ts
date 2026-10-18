import { expect, it } from 'vitest'
import { syncReplayLayers } from './syncReplayLayers'
import { getActiveSimulationStreetcars } from './streetcarReplay'
import { SOURCE_VEHICLES } from './MassingLayer'
import { SOURCE_WALKING_PASSENGERS, SOURCE_PASSENGER_QUEUES } from './PassengerLayer'
import type { NativeBatch } from '../lib/liveTypes'
import baseline from '../data/today_baseline.json'

it('keeps streetcars moving while passenger GeoJSON sources are busy loading', () => {
  const frames: number[][] = []
  let styleLoaded = true
  const sources = {
    [SOURCE_VEHICLES]: { setData: (value: any) => {
      frames.push(value.features[0].geometry.coordinates)
      styleLoaded = false
    } },
    [SOURCE_WALKING_PASSENGERS]: { setData: () => { styleLoaded = false } },
    [SOURCE_PASSENGER_QUEUES]: { setData: () => { styleLoaded = false } },
  }
  const map = {
    getSource: (id: string) => sources[id as keyof typeof sources],
    getLayer: () => true,
    isStyleLoaded: () => styleLoaded,
  } as any
  const batch = baseline.batch as unknown as NativeBatch
  for (const time of [0, 50, 100]) {
    const vehicles = getActiveSimulationStreetcars(batch, time, batch.individual_results[0].inputs.stops ?? [])
    syncReplayLayers(map, vehicles, { walkers: [], queues: [], hasReplay: false, missingOrigins: 0 })
  }
  expect(styleLoaded).toBe(false)
  expect(frames).toHaveLength(3)
  expect(frames[2][0]).toBeLessThan(frames[0][0])
})
