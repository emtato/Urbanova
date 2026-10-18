import { describe, it, expect } from 'vitest'
import {
  getStopLineIndices,
  getStreetcarPositionOnLine,
  getActiveSimulationStreetcars,
  DUNDAS_LINE_COORDS,
} from './streetcarReplay'
import sampleComparison from '../data/sample_comparison.json'
import todayBaseline from '../data/today_baseline.json'
import type { NativeBatch } from '../lib/liveTypes'
import { streetcarModelYaw } from './streetcarOrientation'

describe('streetcarReplay module', () => {
  const stops = sampleComparison.corridor.stops

  it('aligns the GLB nose with the geographic travel direction after Mapbox swaps Y/Z', () => {
    for (const bearing of [0, 90, 180, 270, 253, 286, 359]) {
      const yaw = streetcarModelYaw(bearing) * Math.PI / 180
      // glTF +Z becomes map +Y (south), then Mapbox applies its Z rotation.
      const modelEast = -Math.sin(yaw)
      const modelNorth = -Math.cos(yaw)
      expect(modelEast).toBeCloseTo(Math.sin(bearing * Math.PI / 180), 10)
      expect(modelNorth).toBeCloseTo(Math.cos(bearing * Math.PI / 180), 10)
    }
    for (const position of [0, 2.5, stops.length - 1]) {
      const point = getStreetcarPositionOnLine(position, stops)
      expect(point.yaw).toBeCloseTo(streetcarModelYaw(point.bearing), 10)
    }
  })

  it('maps stop sequences to monotonic indices on Dundas line geometry', () => {
    const indices = getStopLineIndices(stops)
    expect(indices.length).toBe(stops.length)
    for (let i = 1; i < indices.length; i++) {
      expect(indices[i]).toBeGreaterThanOrEqual(indices[i - 1])
    }
    expect(indices[0]).toBeGreaterThanOrEqual(0)
    expect(indices[indices.length - 1]).toBeLessThan(DUNDAS_LINE_COORDS.length)
  })

  it('calculates continuous coordinates and westbound bearing along Dundas Street', () => {
    // Stop 0: Broadview
    const p0 = getStreetcarPositionOnLine(0, stops)
    expect(p0.lon).toBeCloseTo(-79.3514, 2)
    expect(p0.lat).toBeCloseTo(43.6624, 2)
    expect(p0.bearing).toBeGreaterThan(200)
    expect(p0.bearing).toBeLessThan(295)

    // Mid-route position: 3.5 (between Parliament and Ontario)
    const pMid = getStreetcarPositionOnLine(3.5, stops)
    expect(pMid.lon).toBeLessThan(p0.lon) // West of Broadview
    expect(pMid.bearing).toBeGreaterThan(200)
    expect(pMid.bearing).toBeLessThan(295)

    // End-route position: last stop in sample corridor (Jarvis)
    const pEnd = getStreetcarPositionOnLine(stops.length - 1, stops)
    expect(pEnd.lon).toBeCloseTo(-79.3744, 2)
    expect(pEnd.lon).toBeLessThan(pMid.lon)
  })

  it('computes active streetcars for a simulation batch over elapsed time', () => {
    const batch = todayBaseline.batch as unknown as NativeBatch
    // At t=0, first streetcar is dispatched
    const carsAtStart = getActiveSimulationStreetcars(batch, 0, stops)
    expect(carsAtStart.length).toBeGreaterThanOrEqual(1)
    expect(carsAtStart[0].vehicle_id).toBe('flexity-1')
    expect(carsAtStart[0].progress).toBe(0)

    // At t=350, streetcar has moved along the line
    const carsAt350 = getActiveSimulationStreetcars(batch, 350, stops)
    expect(carsAt350.length).toBeGreaterThanOrEqual(1)
    expect(carsAt350[0].progress).toBeGreaterThan(0)
    expect(carsAt350[0].lon).toBeLessThan(carsAtStart[0].lon) // Progressing westward
  })
})
