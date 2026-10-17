import type { NativeCar, NativeReplay } from './liveTypes'

export function replayState(replay: NativeReplay, time: number) {
  const vehicles = new Map<string, NativeCar>()
  let queues: Record<string, number> = {}
  for (const event of replay.events) {
    if (event.time_s > time) break
    queues = event.stop_queues
    if (event.streetcar) vehicles.set(event.streetcar.id, event.streetcar)
  }
  const position = (car: NativeCar) => {
    const index = (id: string | null) => replay.stops.findIndex(stop => stop.id === id)
    if (car.current_stop_id) return index(car.current_stop_id)
    const from = index(car.previous_stop_id), to = index(car.next_stop_id)
    if (from < 0 || to < 0) return -1
    const start = car.departure_time_s ?? time, end = car.expected_arrival_time_s ?? start
    const progress = end > start ? Math.max(0, Math.min(1, (time - start) / (end - start))) : 0
    return from + (to - from) * progress
  }
  return { queues, vehicles: [...vehicles.values()].filter(car => car.status !== 'finished').map(car => ({ ...car, position: position(car) })).filter(car => car.position >= 0) }
}
