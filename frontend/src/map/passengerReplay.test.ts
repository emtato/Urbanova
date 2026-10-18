import { describe, expect, it } from 'vitest'
import type { NativeBatch, NativeEvent } from '../lib/liveTypes'
import { indexWalkingRoutes, preparePassengerReplay, queueOpacity } from './passengerReplay'

const stop = { id: 's0', name: 'Stop', sequence: 0, latitude: 0, longitude: 0.001 }
const rider = {
  id: 'p1', origin_stop_id: 's0', destination_stop_id: null, get_to_stop_time: 99.5,
  home_id: 'home', home_latitude: 0, home_longitude: 0, rider_group: 'existing',
}
const event = (time: number, count: number): NativeEvent => ({
  time_s: time, action: 'passenger_arrive', passenger_ids: ['p1'], streetcar: null,
  stop_id: 's0', count, stop_queues: { s0: count }, onboard_count_after: null,
})
function batch(passengers: Record<string, unknown>[] = [rider], events = [event(100, 1), { ...event(110, 0), action: 'board', passenger_ids: [] }]): NativeBatch {
  return { id: 'test', individual_results: [{
    inputs: { seed: 42, stops: [stop], start_time_s: 0, end_time_s: 200, developments: [] },
    passengers, streetcars: [], sim_log: events,
  }] } as unknown as NativeBatch
}

describe('passenger movement replay', () => {
  it('walks to the assigned stop, uses the recorded arrival tick, joins its queue, and supports rewinding', () => {
    const frame = preparePassengerReplay(batch())
    expect(frame(0).walkers).toHaveLength(0)
    const walking = frame(60)
    expect(walking.walkers).toHaveLength(1)
    expect(walking.walkers[0].lon).toBeGreaterThan(0)
    expect(walking.walkers[0].lon).toBeLessThan(0.001)
    expect(walking.queues).toHaveLength(0)
    // Requested stop arrival is 99.5; the engine actually enqueued this rider at t=100.
    expect(frame(99.75).walkers).toHaveLength(1)
    expect(frame(100).walkers).toHaveLength(0)
    expect(frame(100).queues[0]).toMatchObject({ stop_id: 's0', count: 1 })
    expect(frame(110).queues).toHaveLength(0)
    expect(frame(60).walkers).toHaveLength(1)
    expect(frame(60).queues).toHaveLength(0)
  })

  it('represents a large queue with exactly one increasingly dark translucent marker', () => {
    const frame = preparePassengerReplay(batch([], [event(0, 1000)]))
    expect(frame(0).queues).toHaveLength(1)
    expect(frame(0).queues[0].count).toBe(1000)
    expect(queueOpacity(0)).toBe(0)
    expect(queueOpacity(1)).toBeCloseTo(0.12)
    expect(queueOpacity(10)).toBeGreaterThan(queueOpacity(1))
    expect(queueOpacity(1000)).toBeLessThan(1)
  })

  it('does not invent residence origins for incoming or older passengers, or create non-streetcar trips', () => {
    const incoming = { ...rider, id: 'incoming', home_id: null, home_latitude: null, home_longitude: null }
    const legacy = { ...rider, id: 'legacy', home_id: null, home_latitude: null, home_longitude: null }
    const replay = batch([rider, incoming, legacy], [
      { ...event(0, 0), action: 'generate', passenger_ids: ['incoming'] },
    ])
    // Housing inputs do not create dots; only generated streetcar passenger records do.
    replay.individual_results[0].inputs.existing_residences = [{ id: 'non-streetcar-home', latitude: 0, longitude: 0 }]
    const frame = preparePassengerReplay(replay)(60)
    expect(frame.walkers.map(value => value.id)).toEqual(['p1'])
    expect(frame.missingOrigins).toBe(1)
  })

  it('uses the matching home-to-stop walking route rather than a random or nearest-stop journey', () => {
    const routes = indexWalkingRoutes({ type: 'FeatureCollection', features: [{
      type: 'Feature', properties: { entity_id: 'home', stop_id: 's0' },
      geometry: { type: 'LineString', coordinates: [[0, 0], [0, 0.001], [0.001, 0]] },
    }] })
    const frame = preparePassengerReplay(batch(), routes)(60)
    expect(frame.walkers).toHaveLength(1)
    expect(frame.walkers[0].lat).toBeGreaterThan(0)
  })
})
