import { expect, it } from 'vitest'
import { replayState } from './replayState'
import type { NativeReplay, NativeCar } from './liveTypes'
import { sampleComparison } from './sampleComparison'

it('replays timed arrivals and incoming occupancy, interpolates motion and removes finished vehicles', () => {
  const stops = sampleComparison.corridor.stops.slice(0, 2)
  const car: NativeCar = { id: 'car', capacity: 4, onboard_passenger_ids: ['incoming-1', 'incoming-2'], status: 'at_stop', current_stop_id: stops[0].id, previous_stop_id: null, next_stop_id: stops[1].id, departure_time_s: null, expected_arrival_time_s: null }
  const replay: NativeReplay = { format_version: 'b11-events-v1', comparison_id: 'test', scenario_id: 'test', run_id: 'test', model_version: 'test', data_version: 'test', source_ids: [], horizon_s: 60, stops, events: [
    { time_s: 0, action: 'generate', streetcar: car, stop_id: stops[0].id, count: 2, stop_queues: { [stops[0].id]: 0 }, onboard_count_after: 2 },
    { time_s: 5, action: 'passenger_arrive', streetcar: null, stop_id: stops[0].id, count: 1, stop_queues: { [stops[0].id]: 1 }, onboard_count_after: null },
    { time_s: 10, action: 'depart', streetcar: { ...car, status: 'in_transit', current_stop_id: null, previous_stop_id: stops[0].id, departure_time_s: 10, expected_arrival_time_s: 30 }, stop_id: stops[0].id, count: 0, stop_queues: { [stops[0].id]: 1 }, onboard_count_after: 2 },
    { time_s: 40, action: 'terminate', streetcar: { ...car, status: 'finished' }, stop_id: stops[1].id, count: 0, stop_queues: { [stops[0].id]: 1 }, onboard_count_after: 0 },
  ] }
  expect(replayState(replay, 0).queues[stops[0].id]).toBe(0)
  expect(replayState(replay, 5).queues[stops[0].id]).toBe(1)
  expect(replayState(replay, 20).vehicles[0]).toMatchObject({ position: .5, onboard_passenger_ids: ['incoming-1', 'incoming-2'] })
  expect(replayState(replay, 40).vehicles).toHaveLength(0)
  expect(replayState(replay, 5).queues[stops[0].id]).toBe(1)
  expect(replayState(replay, 0).queues[stops[0].id]).toBe(0)
})
