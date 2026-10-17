import { describe, it, expect } from 'vitest'
import {
  generateCorridorLinksGeoJSON,
  generateCorridorStopsGeoJSON,
  generateDevelopmentsGeoJSON,
  generate761ModelGeoJSON,
  generateWalkCatchmentsGeoJSON,
  generateSurroundingMassingGeoJSON,
  updateDevelopmentsPhase,
  updateDevelopmentsVisibility,
  updateDevelopmentsSelected,
  LAYER_761_MODEL,
  MODEL_761_ID,
  PHASE2_761_PLACEMENT,
} from './MassingLayer'
import sampleComparison from '../data/sample_comparison.json'
import type { Comparison } from '../lib/types'

const data = sampleComparison as unknown as Comparison

describe('MassingLayer GeoJSON Generators (Contract 1.0.0)', () => {
  it('generates valid corridor links GeoJSON centered along Dundas road corridor', () => {
    const links = generateCorridorLinksGeoJSON(data.corridor)
    expect(links.type).toBe('FeatureCollection')
    expect(links.features.length).toBe(1)
    const geom = links.features[0].geometry as { type: string; coordinates: [number, number][] }
    expect(geom.coordinates.length).toBeGreaterThanOrEqual(7)
    // Verify line coordinates are centered along Dundas Street corridor bounds
    expect(geom.coordinates[0][0]).toBeCloseTo(-79.3513, 2)
    expect(geom.coordinates[0][1]).toBeCloseTo(43.6624, 2)
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
    expect(devs.features.length).toBeGreaterThanOrEqual(3)
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
    expect(massing.features.length).toBeGreaterThanOrEqual(14)
    expect(massing.features[0].properties?.height_m).toBeGreaterThan(0)
  })

  it('updates development visibility filters on map layers', () => {
    const filters: Record<string, any> = {}
    const mockMap = {
      getLayer: (_id: string) => true,
      setFilter: (id: string, filter: any) => {
        filters[id] = filter
      },
    } as any

    // All 3 visible
    updateDevelopmentsVisibility(mockMap, [
      'toronto-app-22-124214-ste-13-oz',
      'toronto-app-26-122451-ste-13-oz',
      'toronto-app-25-236949-ste-13-oz',
    ])
    expect(filters['layer-developments-extrusion']).toEqual([
      'any',
      ['==', ['get', 'dev_id'], 'toronto-app-22-124214-ste-13-oz'],
      ['==', ['get', 'dev_id'], 'toronto-app-26-122451-ste-13-oz'],
      ['==', ['get', 'dev_id'], 'toronto-app-25-236949-ste-13-oz'],
    ])
    expect(filters['layer-walk-links']).toEqual([
      'any',
      ['==', ['get', 'dev_id'], 'toronto-app-22-124214-ste-13-oz'],
      ['==', ['get', 'dev_id'], 'toronto-app-26-122451-ste-13-oz'],
      ['==', ['get', 'dev_id'], 'toronto-app-25-236949-ste-13-oz'],
    ])

    // None visible
    updateDevelopmentsVisibility(mockMap, [])
    expect(filters['layer-developments-extrusion']).toEqual(['==', ['get', 'dev_id'], '__none__'])
    expect(filters['layer-walk-links']).toEqual(['==', ['get', 'dev_id'], '__none__'])

    // Single visible
    updateDevelopmentsVisibility(mockMap, ['toronto-app-22-124214-ste-13-oz'])
    expect(filters['layer-developments-extrusion']).toEqual([
      '==',
      ['get', 'dev_id'],
      'toronto-app-22-124214-ste-13-oz',
    ])
  })

  it('updates building colors and keeps opacity solid (1.0) when selected/unselected', () => {
    const paintProps: Record<string, Record<string, any>> = {}
    const mockMap = {
      getLayer: (_id: string) => true,
      setPaintProperty: (layerId: string, name: string, value: any) => {
        if (!paintProps[layerId]) paintProps[layerId] = {}
        paintProps[layerId][name] = value
      },
    } as any

    updateDevelopmentsSelected(mockMap, 'toronto-app-22-124214-ste-13-oz')
    expect(paintProps['layer-developments-extrusion']['fill-extrusion-opacity']).toBe(1.0)
    expect(paintProps['layer-developments-extrusion']['fill-extrusion-color']).toBeDefined()

    // When unselected (null), opacity remains 1.0 (never see-thru)
    updateDevelopmentsSelected(mockMap, null)
    expect(paintProps['layer-developments-extrusion']['fill-extrusion-opacity']).toBe(1.0)
  })

  it('generates valid 3D model point feature for 761 Dundas with anchor and model ID', () => {
    const modelFeatures = generate761ModelGeoJSON(data.scenario.developments)
    expect(modelFeatures.type).toBe('FeatureCollection')
    expect(modelFeatures.features.length).toBe(1)
    const feature = modelFeatures.features[0]
    expect(feature.properties?.dev_id).toBe('toronto-app-25-236949-ste-13-oz')
    expect(feature.properties?.model_id).toBe(MODEL_761_ID)
    expect(feature.properties?.phase).toBe(2)
    const geom = feature.geometry as { type: string; coordinates: [number, number] }
    expect(geom.type).toBe('Point')
    expect(geom.coordinates).toEqual(PHASE2_761_PLACEMENT.anchor)
  })

  it('tags 761 Dundas with tier model in generateDevelopmentsGeoJSON to suppress extruded box', () => {
    const devs = generateDevelopmentsGeoJSON(data.scenario.developments)
    const dev761 = devs.features.find((f) => f.properties?.dev_id === 'toronto-app-25-236949-ste-13-oz')
    expect(dev761).toBeDefined()
    expect(dev761?.properties?.tier).toBe('model')
    expect(dev761?.properties?.height_m).toBe(161.75)
    expect(dev761?.geometry.type).toBe('Polygon')
  })

  it('updates 761 model visibility across phases and development selections', () => {
    const filters: Record<string, any> = {}
    const mockMap = {
      getLayer: (_id: string) => true,
      setFilter: (id: string, filter: any) => {
        filters[id] = filter
      },
    } as any

    // Phase 1: 761 model hidden
    updateDevelopmentsPhase(mockMap, 1)
    expect(filters[LAYER_761_MODEL]).toEqual(['==', ['get', 'phase'], -1])

    // Phase 2: 761 model shown
    updateDevelopmentsPhase(mockMap, 2)
    expect(filters[LAYER_761_MODEL]).toEqual(['<=', ['get', 'phase'], 2])

    // Visibility toggled off for 761
    updateDevelopmentsVisibility(mockMap, ['toronto-app-22-124214-ste-13-oz'])
    expect(filters[LAYER_761_MODEL]).toEqual(['==', ['get', 'dev_id'], '__none__'])

    // Visibility toggled on for 761
    updateDevelopmentsVisibility(mockMap, ['toronto-app-25-236949-ste-13-oz'])
    expect(filters[LAYER_761_MODEL]).toEqual([
      'any',
      ['==', ['get', 'dev_id'], 'toronto-app-25-236949-ste-13-oz'],
      ['==', ['get', 'dev_id'], 'fixture-development-3'],
    ])
  })
})
