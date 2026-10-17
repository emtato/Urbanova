import { describe, it, expect } from 'vitest'
import {
  generateCorridorLinksGeoJSON,
  generateCorridorStopsGeoJSON,
  generateDevelopmentsGeoJSON,
  generateWalkCatchmentsGeoJSON,
  generateSurroundingMassingGeoJSON,
} from './MassingLayer'
import sampleComparison from '../data/sample_comparison.json'
import type { Comparison } from '../lib/types'

const data = sampleComparison as unknown as Comparison

describe('MassingLayer GeoJSON Generators (Contract 1.0.0)', () => {
  it('generates valid corridor links GeoJSON with 7 coordinates', () => {
    const links = generateCorridorLinksGeoJSON(data.corridor)
    expect(links.type).toBe('FeatureCollection')
    expect(links.features.length).toBe(1)
    const geom = links.features[0].geometry as { type: string; coordinates: [number, number][] }
    expect(geom.coordinates.length).toBe(7)
  })

  it('generates valid corridor stops GeoJSON with 7 point features', () => {
    const stops = generateCorridorStopsGeoJSON(data.corridor.stops)
    expect(stops.type).toBe('FeatureCollection')
    expect(stops.features.length).toBe(7)
    expect(stops.features[0].properties?.name).toContain('Broadview')
    expect(stops.features[6].properties?.name).toContain('Jarvis')
  })

  it('generates valid 3D development polygons with heights', () => {
    const devs = generateDevelopmentsGeoJSON(data.scenario.developments)
    expect(devs.features.length).toBe(3)
    devs.features.forEach((f) => {
      expect(f.properties?.height_m).toBeGreaterThan(0)
      expect(f.properties?.phase).toBeDefined()
    })
  })

  it('generates walk catchment connections', () => {
    const catchments = generateWalkCatchmentsGeoJSON(data.scenario.developments, data.corridor.stops)
    expect(catchments.features.length).toBeGreaterThan(0)
    catchments.features.forEach((f) => {
      expect(f.properties?.walk_m).toBeGreaterThan(0)
    })
  })

  it('generates surrounding background 3D massing blocks', () => {
    const massing = generateSurroundingMassingGeoJSON(data.corridor)
    expect(massing.features.length).toBe(14) // 2 blocks per stop for 7 stops
  })
})
