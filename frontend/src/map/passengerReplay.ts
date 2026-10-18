import type { FeatureCollection } from 'geojson'
import type { NativeBatch } from '../lib/liveTypes'
import { replayState } from '../lib/replayState'
import { batchToReplay } from './streetcarReplay'
import { normalizeStop } from './types'

export const WALKING_ANIMATION_SPEED_MPS = 1.4
type Point = [number, number]
interface Path { points: Point[]; cumulative: number[]; length: number }
export type WalkingRoutes = Map<string, Point[]>
export interface PassengerFrame {
  walkers: Array<{ id: string; lon: number; lat: number }>
  queues: Array<{ stop_id: string; lon: number; lat: number; count: number; opacity: number }>
  missingOrigins: number
  hasReplay: boolean
}
interface Journey { id: string; start: number; end: number; path: Path }

export function indexWalkingRoutes(collection: FeatureCollection): WalkingRoutes {
  const routes: WalkingRoutes = new Map()
  for (const feature of collection.features) {
    if (feature.geometry.type !== 'LineString') continue
    const { entity_id, stop_id } = feature.properties ?? {}
    if (typeof entity_id !== 'string' || typeof stop_id !== 'string') continue
    const points = feature.geometry.coordinates
      .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
      .map(p => [p[0], p[1]] as Point)
    if (points.length >= 2) routes.set(`${entity_id}:${stop_id}`, points)
  }
  return routes
}

function metres(a: Point, b: Point) {
  const rad = Math.PI / 180
  const value = Math.sin((b[1] - a[1]) * rad / 2) ** 2 +
    Math.cos(a[1] * rad) * Math.cos(b[1] * rad) * Math.sin((b[0] - a[0]) * rad / 2) ** 2
  return 2 * 6371008.8 * Math.asin(Math.sqrt(Math.min(1, value)))
}

function pathBetween(home: Point, stop: Point, route?: Point[]): Path {
  const points = [home, ...(route ?? []), stop]
  const cumulative = [0]
  for (let i = 1; i < points.length; i++) cumulative.push(cumulative[i - 1] + metres(points[i - 1], points[i]))
  return { points, cumulative, length: cumulative[cumulative.length - 1] }
}

function pointOn(path: Path, progress: number): Point {
  const distance = Math.max(0, Math.min(1, progress)) * path.length
  let low = 1, high = path.cumulative.length - 1
  while (low < high) {
    const mid = (low + high) >>> 1
    if (path.cumulative[mid] < distance) low = mid + 1
    else high = mid
  }
  const a = path.points[low - 1], b = path.points[low]
  const length = path.cumulative[low] - path.cumulative[low - 1]
  const fraction = length > 0 ? (distance - path.cumulative[low - 1]) / length : 0
  return [a[0] + (b[0] - a[0]) * fraction, a[1] + (b[1] - a[1]) * fraction]
}

/** Equivalent opacity to overlapping 12%-black dots, capped below opaque. */
export function queueOpacity(count: number): number {
  return Math.min(0.92, -Math.expm1(Math.max(0, count) * Math.log1p(-0.12)))
}

/** Precompute journeys once; each frame visits only currently walking riders. */
export function preparePassengerReplay(batch: NativeBatch | null, routes: WalkingRoutes = new Map()) {
  const replay = batch ? batchToReplay(batch) : null
  const run = batch?.individual_results[0]
  const stops = new Map((replay?.stops ?? []).map(raw => {
    const stop = normalizeStop(raw)
    return [stop.stop_id, stop] as const
  }))
  const journeys: Journey[] = []
  let missingOrigins = 0
  const arrivals = new Map<string, number>()
  const incoming = new Set<string>()
  for (const event of replay?.events ?? []) {
    if (event.action === 'generate') {
      for (const id of event.passenger_ids ?? event.streetcar?.onboard_passenger_ids ?? []) incoming.add(id)
    }
    if (event.action === 'passenger_arrive') {
      for (const id of event.passenger_ids ?? []) arrivals.set(id, event.time_s)
    }
  }
  const paths = new Map<string, Path>()
  for (const passenger of run?.passengers ?? []) {
    const id = passenger.id
    if (typeof id !== 'string' || incoming.has(id)) continue
    const stop = stops.get(String(passenger.origin_stop_id))
    const arrival = arrivals.get(id) ?? passenger.get_to_stop_time
    if (!stop || typeof arrival !== 'number' || !Number.isFinite(arrival)) continue
    let lat = passenger.home_latitude, lon = passenger.home_longitude
    const homeId = typeof passenger.home_id === 'string' ? passenger.home_id : passenger.development_id
    // Older proposal runs retain their exact development ID; older existing
    // riders do not retain home identity, so never assign them a guessed home.
    if ((typeof lat !== 'number' || typeof lon !== 'number') && typeof homeId === 'string') {
      const home = run?.inputs.developments?.find(dev => dev.id === homeId)
      lat = home?.latitude; lon = home?.longitude
    }
    if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      missingOrigins++
      continue
    }
    const key = `${homeId ?? `${lon},${lat}`}:${stop.stop_id}`
    let path = paths.get(key)
    if (!path) {
      path = pathBetween([lon, lat], [stop.lon, stop.lat], routes.get(key))
      paths.set(key, path)
    }
    if (path.length < 0.1) continue
    journeys.push({ id, end: arrival, start: arrival - path.length / WALKING_ANIMATION_SPEED_MPS, path })
  }
  journeys.sort((a, b) => a.start - b.start)
  let previousTime = -Infinity, next = 0
  const active = new Map<string, Journey>()
  return (time: number): PassengerFrame => {
    if (time < previousTime) { next = 0; active.clear() }
    previousTime = time
    while (next < journeys.length && journeys[next].start <= time) {
      const journey = journeys[next++]
      if (time < journey.end) active.set(journey.id, journey)
    }
    const walkers: PassengerFrame['walkers'] = []
    for (const [id, journey] of active) {
      if (time >= journey.end) { active.delete(id); continue }
      const [lon, lat] = pointOn(journey.path, (time - journey.start) / (journey.end - journey.start))
      walkers.push({ id, lon, lat })
    }
    const queues: PassengerFrame['queues'] = []
    const counts = replay ? replayState(replay, time).queues : {}
    for (const [stopId, count] of Object.entries(counts)) {
      const stop = stops.get(stopId)
      if (stop && count > 0) queues.push({ stop_id: stopId, lon: stop.lon, lat: stop.lat, count, opacity: queueOpacity(count) })
    }
    return { walkers, queues, missingOrigins, hasReplay: Boolean(replay?.events.length) }
  }
}
