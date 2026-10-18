/**
 * streetcarReplay.ts
 *
 * Interpolates vehicle positions along the physical Dundas Streetcar line geometry
 * from simulation replay states and schedules.
 */

import type { NativeBatch, NativeReplay, NativeCar } from '../lib/liveTypes'
import { replayState } from '../lib/replayState'
import { dundasStreetcarLine } from '../data'
import { normalizeStop, type CorridorStop } from './types'
import { streetcarModelYaw } from './streetcarOrientation'

export const DUNDAS_LINE_COORDS: [number, number][] = (
  dundasStreetcarLine.features[0].geometry as unknown as { coordinates: [number, number][] }
).coordinates

export interface StreetcarMarkerState {
  vehicle_id: string
  lon: number
  lat: number
  bearing: number
  yaw: number
  load: number | null
  capacity: number
  progress: number
  status: 'at_stop' | 'in_transit' | 'finished'
}

function distSq(p1: [number, number], p2: [number, number]): number {
  const dx = p1[0] - p2[0]
  const dy = p1[1] - p2[1]
  return dx * dx + dy * dy
}

/**
 * Maps each stop sequence to its closest vertex index on the Dundas road centerline geometry.
 */
export function getStopLineIndices(stops: Array<CorridorStop | any>): number[] {
  const normStops = stops.map(normalizeStop)
  const line = DUNDAS_LINE_COORDS

  const rawIndices = normStops.map((stop) => {
    let bestIdx = 0
    let bestDist = Infinity
    for (let i = 0; i < line.length; i++) {
      const d = distSq([stop.lon, stop.lat], line[i])
      if (d < bestDist) {
        bestDist = d
        bestIdx = i
      }
    }
    return bestIdx
  })

  // Ensure monotonic progression along the line (East to West)
  const monotonic = [...rawIndices]
  for (let i = 1; i < monotonic.length; i++) {
    if (monotonic[i] < monotonic[i - 1]) {
      monotonic[i] = monotonic[i - 1]
    }
  }
  return monotonic
}

/**
 * Calculates continuous coordinate and tangent bearing for any float position along stops.
 * position: 0.0 = Stop 0 (Broadview), 1.5 = halfway between Stop 1 and 2, 8.0 = Stop 8 (Yonge)
 */
export function getStreetcarPositionOnLine(
  position: number,
  stops: Array<CorridorStop | any>,
  line: [number, number][] = DUNDAS_LINE_COORDS
): { lon: number; lat: number; bearing: number; yaw: number } {
  if (line.length === 0) {
    return { lon: -79.356, lat: 43.661, bearing: 253, yaw: streetcarModelYaw(253) }
  }

  const stopIndices = getStopLineIndices(stops)
  const numStops = stopIndices.length

  if (numStops <= 1) {
    const pt = line[0]
    return { lon: pt[0], lat: pt[1], bearing: 253, yaw: streetcarModelYaw(253) }
  }

  const clampedPos = Math.max(0, Math.min(numStops - 1, position))
  const stopIdx = Math.floor(clampedPos)
  const stopFrac = clampedPos - stopIdx

  let lineTarget: number
  if (stopIdx >= numStops - 1) {
    lineTarget = stopIndices[numStops - 1]
  } else {
    const idx0 = stopIndices[stopIdx]
    const idx1 = stopIndices[stopIdx + 1]
    lineTarget = idx0 + stopFrac * (idx1 - idx0)
  }

  const k = Math.min(line.length - 2, Math.max(0, Math.floor(lineTarget)))
  const rem = lineTarget - k
  const p0 = line[k]
  const p1 = line[k + 1]

  const lon = p0[0] + rem * (p1[0] - p0[0])
  const lat = p0[1] + rem * (p1[1] - p0[1])

  let dx = p1[0] - p0[0]
  let dy = p1[1] - p0[1]

  if (Math.abs(dx) < 1e-7 && Math.abs(dy) < 1e-7 && k > 0) {
    dx = p0[0] - line[k - 1][0]
    dy = p0[1] - line[k - 1][1]
  }

  const latRad = (lat * Math.PI) / 180
  const bearing = (Math.atan2(dx * Math.cos(latRad), dy) * (180 / Math.PI) + 360) % 360
  const yaw = streetcarModelYaw(bearing)

  return { lon, lat, bearing, yaw }
}

/**
 * Builds a NativeReplay object from a batch.
 */
const replayCache = new WeakMap<NativeBatch, Map<number, NativeReplay>>()

export function batchToReplay(batch: NativeBatch, runIndex = 0): NativeReplay | null {
  const cached = replayCache.get(batch)?.get(runIndex)
  if (cached) return cached
  const run = batch.individual_results?.[runIndex] ?? batch.individual_results?.[0]
  if (!run || !Array.isArray(run.inputs?.stops)) return null
  const start = typeof run.inputs.start_time_s === 'number' ? run.inputs.start_time_s : 25200
  const end = typeof run.inputs.end_time_s === 'number' ? run.inputs.end_time_s : 32400
  const replay: NativeReplay = {
    format_version: 'b11-events-v1',
    comparison_id: batch.id,
    run_id: `${batch.id}:seed-${run.inputs.seed ?? 42}`,
    scenario_id: '505-westbound-planning',
    model_version: 'b11',
    data_version: 'reviewed',
    source_ids: [],
    horizon_s: Math.max(1, end - start),
    stops: run.inputs.stops,
    events: run.sim_log ?? [],
  }
  const entries = replayCache.get(batch) ?? new Map<number, NativeReplay>()
  entries.set(runIndex, replay)
  replayCache.set(batch, entries)
  return replay
}

/**
 * Calculates current active streetcars on the line for a given simulation time.
 * If real sim_log events are present, evaluates replayState.
 * If events are empty, evaluates realistic headway schedule dispatches across Dundas corridor.
 */
export function getActiveSimulationStreetcars(
  batch: NativeBatch | null,
  timeSeconds: number,
  stops: Array<CorridorStop | any>
): StreetcarMarkerState[] {
  if (!batch) return []

  const replay = batchToReplay(batch, 0)
  if (!replay) return []

  const normStops = stops.length > 0 ? stops.map(normalizeStop) : replay.stops.map(normalizeStop)
  if (normStops.length === 0) return []

  // 1. If sim_log events exist, use discrete event interpolation from replayState
  if (replay.events && replay.events.length > 0) {
    const state = replayState(replay, timeSeconds)
    return state.vehicles.map((car: NativeCar & { position: number }) => {
        const { lon, lat, bearing, yaw } = getStreetcarPositionOnLine(car.position, normStops)
        return {
          vehicle_id: car.id,
          lon,
          lat,
          bearing,
          yaw,
          load: car.onboard_passenger_ids?.length ?? 0,
          capacity: car.capacity ?? 130,
          progress: car.position,
          status: car.status ?? 'in_transit',
        }
    })
  }

  // 2. Schedule-based kinematic interpolation fallback
  // Ensures smooth continuous motion even for baseline or compact runs
  const run = batch.individual_results?.[0]
  const headwayS = Number(run?.inputs?.headway_s ?? 300)
  const numStops = normStops.length
  const totalTravelTimeS = (numStops - 1) * 110 // ~110s between stops with dwell
  const horizon = replay.horizon_s ?? 7200

  const activeVehicles: StreetcarMarkerState[] = []
  const maxDispatches = Math.floor(horizon / headwayS) + 1

  for (let j = 0; j <= maxDispatches; j++) {
    const dispatchTime = j * headwayS
    const elapsedSinceDispatch = timeSeconds - dispatchTime

    if (elapsedSinceDispatch >= 0 && elapsedSinceDispatch <= totalTravelTimeS) {
      const progressFrac = elapsedSinceDispatch / totalTravelTimeS
      const progressPos = progressFrac * (numStops - 1)
      const { lon, lat, bearing, yaw } = getStreetcarPositionOnLine(progressPos, normStops)

      activeVehicles.push({
        vehicle_id: `flexity-${j + 1}`,
        lon,
        lat,
        bearing,
        yaw,
        // Compact runs do not retain occupancy. Never invent a load halo.
        load: null,
        capacity: Number(run?.inputs?.streetcar_capacity ?? 130),
        progress: progressPos,
        status: 'in_transit',
      })
    }
  }

  return activeVehicles
}
