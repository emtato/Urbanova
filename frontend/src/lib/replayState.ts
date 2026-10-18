import type { NativeCar, NativeReplay } from './liveTypes'

// Advance through the event log once during playback; rebuild only on a rewind.
const cursors = new WeakMap<NativeReplay, {
  time: number; next: number; vehicles: Map<string, NativeCar>; queues: Record<string, number>
}>()

export function replayState(replay: NativeReplay, time: number) {
  let cursor = cursors.get(replay)
  if (!cursor || time < cursor.time) {
    cursor = { time: -Infinity, next: 0, vehicles: new Map(), queues: {} }
    cursors.set(replay, cursor)
  }
  while (cursor.next < replay.events.length && replay.events[cursor.next].time_s <= time) {
    const event = replay.events[cursor.next++]
    cursor.queues = event.stop_queues
    if (event.streetcar) cursor.vehicles.set(event.streetcar.id, event.streetcar)
  }
  cursor.time = time
  const position = (car: NativeCar) => {
    const index = (id: string | null) => replay.stops.findIndex(stop => stop.id === id)
    if (car.current_stop_id) return index(car.current_stop_id)
    const from = index(car.previous_stop_id), to = index(car.next_stop_id)
    if (from < 0 || to < 0) return -1
    const start = car.departure_time_s ?? time, end = car.expected_arrival_time_s ?? start
    const progress = end > start ? Math.max(0, Math.min(1, (time - start) / (end - start))) : 0
    return from + (to - from) * progress
  }
  return { queues: cursor.queues, vehicles: [...cursor.vehicles.values()].filter(car => car.status !== 'finished').map(car => ({ ...car, position: position(car) })).filter(car => car.position >= 0) }
}
