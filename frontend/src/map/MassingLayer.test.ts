import { describe, it, expect } from 'vitest'
import {
  generateCorridorLinksGeoJSON,
  generateCorridorStopsGeoJSON,
  generateDevelopmentsGeoJSON,
  generate761ModelGeoJSON,
  generateWalkCatchmentsGeoJSON,
  generateSurroundingMassingGeoJSON,
  setupCorridorMapLayers,
  updateCorridorMapData,
  updateDevelopmentsPhase,
  updateDevelopmentsVisibility,
  updateDevelopmentsSelected,
  updateVehiclePositions,
  ensureStreetcarModelLayer,
  LAYER_761_MODEL,
  MODEL_761_ID,
  MODEL_761_URL,
  SOURCE_761_MODEL,
  SOURCE_761_SITE,
  LAYER_761_REPLACEMENT,
  PHASE2_761_PLACEMENT,
  LAYER_STREETCAR_MODEL,
  MODEL_STREETCAR_ID,
  LAYER_VEHICLES,
  LAYER_SHADOWS_TODAY,
  LAYER_SHADOWS_ADDED,
  updateShadowTimeAndVisibility,
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

  it('does not create a 761 model for empty or unrelated development lists', () => {
    expect(generate761ModelGeoJSON([]).features).toEqual([])
    expect(generate761ModelGeoJSON([{ id: 'other', name: '500 Dundas' }]).features).toEqual([])
    const fixture = generate761ModelGeoJSON([{ id: 'fixture-development-3' }])
    expect(fixture.features[0].properties?.dev_id).toBe('fixture-development-3')
  })

  it('loads the attached GLB at 761 and replaces only the existing site building', () => {
    const sources: Record<string, any> = {}
    const layers: Record<string, any> = {}
    const listeners: Record<string, Array<(event: any) => void>> = {}
    let modelReady = false
    const map = {
      on: (event: string, listener: (event: any) => void) => {
        ;(listeners[event] ??= []).push(listener)
      },
      getSource: (id: string) => sources[id],
      addSource: (id: string, source: any) => {
        sources[id] = {
          ...source,
          setData(value: any) { this.data = value },
          setModels(value: any) { this.models = value },
          getModels() { return modelReady ? Object.keys(this.models ?? {}).map(id => ({ id })) : [] },
        }
      },
      getLayer: (id: string) => layers[id],
      addLayer: (layer: any) => { layers[layer.id] = layer },
      setLayoutProperty: (id: string, key: string, value: any) => {
        layers[id].layout = { ...layers[id].layout, [key]: value }
      },
      setPaintProperty: (id: string, key: string, value: any) => {
        layers[id].paint[key] = value
      },
      setFilter: () => {},
    } as any

    setupCorridorMapLayers(map, data.corridor, data.scenario.developments)
    expect(layers[LAYER_VEHICLES].paint['circle-color']).toBe('#c8102e')
    expect(layers[LAYER_VEHICLES].filter).toBeUndefined()
    const model = sources[SOURCE_761_MODEL].models[MODEL_761_ID]
    expect(model.uri).toBe(MODEL_761_URL)
    expect(model.position).toEqual([-79.3565813, 43.661246])
    expect(model.featureProperties.dev_id).toBe('toronto-app-25-236949-ste-13-oz')
    expect(layers[LAYER_761_MODEL].paint['model-scale']).toEqual([1, 1, 1])
    expect(layers[LAYER_761_REPLACEMENT].layout).toMatchObject({
      'clip-layer-scope': ['basemap'],
      visibility: 'none',
    })
    // The original building survives a pending or failed GLB load.
    listeners.sourcedata.forEach(listener => listener({ sourceId: SOURCE_761_MODEL }))
    expect(layers[LAYER_761_REPLACEMENT].layout.visibility).toBe('none')
    modelReady = true
    listeners.sourcedata.forEach(listener => listener({ sourceId: SOURCE_761_MODEL }))
    expect(layers[LAYER_761_REPLACEMENT].layout.visibility).toBe('visible')
    expect(sources[SOURCE_761_SITE].data.features[0].properties.building_id)
      .toBe('osm-way-195214544')

    // An off switch must survive a phase update, and vice versa.
    updateDevelopmentsVisibility(map, [])
    updateDevelopmentsPhase(map, 2)
    expect(layers[LAYER_761_MODEL].layout.visibility).toBe('none')
    expect(layers[LAYER_761_REPLACEMENT].layout.visibility).toBe('none')
    updateDevelopmentsPhase(map, 0)
    updateDevelopmentsVisibility(map, ['toronto-app-25-236949-ste-13-oz'])
    expect(layers[LAYER_761_MODEL].layout.visibility).toBe('none')
    expect(layers[LAYER_761_REPLACEMENT].layout.visibility).toBe('none')
    updateDevelopmentsPhase(map, 2)
    expect(layers[LAYER_761_MODEL].layout.visibility).toBe('visible')

    // Switching to a dataset without this proposal restores the original building.
    updateCorridorMapData(map, data.corridor, [])
    expect(sources[SOURCE_761_MODEL].models).toEqual({})
    expect(layers[LAYER_761_MODEL].layout.visibility).toBe('none')
    expect(layers[LAYER_761_REPLACEMENT].layout.visibility).toBe('none')
    updateCorridorMapData(map, data.corridor, data.scenario.developments)
    expect(layers[LAYER_761_MODEL].layout.visibility).toBe('visible')
    expect(layers[LAYER_761_REPLACEMENT].layout.visibility).toBe('visible')
  })

  it('updates 761 model visibility across phases and development selections', () => {
    const layoutProps: Record<string, Record<string, any>> = {}
    const paintProps: Record<string, Record<string, any>> = {}
    const mockMap = {
      getLayer: (_id: string) => true,
      setFilter: (_id: string, _filter: any) => {},
      setLayoutProperty: (layerId: string, name: string, value: any) => {
        if (!layoutProps[layerId]) layoutProps[layerId] = {}
        layoutProps[layerId][name] = value
      },
      setPaintProperty: (layerId: string, name: string, value: any) => {
        if (!paintProps[layerId]) paintProps[layerId] = {}
        paintProps[layerId][name] = value
      },
    } as any

    // Phase 1: 761 model hidden
    updateDevelopmentsPhase(mockMap, 1)
    expect(layoutProps[LAYER_761_MODEL]?.visibility).toBe('none')
    expect(paintProps[LAYER_761_MODEL]?.['model-opacity']).toBe(0)

    // Phase 2: 761 model shown
    updateDevelopmentsPhase(mockMap, 2)
    expect(layoutProps[LAYER_761_MODEL]?.visibility).toBe('visible')
    expect(paintProps[LAYER_761_MODEL]?.['model-opacity']).toBe(1.0)

    // Visibility toggled off for 761
    updateDevelopmentsVisibility(mockMap, ['toronto-app-22-124214-ste-13-oz'])
    expect(layoutProps[LAYER_761_MODEL]?.visibility).toBe('none')
    expect(paintProps[LAYER_761_MODEL]?.['model-opacity']).toBe(0)

    // Visibility toggled on for 761
    updateDevelopmentsVisibility(mockMap, ['toronto-app-25-236949-ste-13-oz'])
    expect(layoutProps[LAYER_761_MODEL]?.visibility).toBe('visible')
    expect(paintProps[LAYER_761_MODEL]?.['model-opacity']).toBe(1.0)
  })

  it('updates vehicle positions with Point features, bearing, yaw, and rotation properties', () => {
    let updatedGeoJSON: any = null
    const mockMap = {
      getSource: (id: string) => {
        if (id === 'source-vehicles') {
          return {
            setData: (data: any) => {
              updatedGeoJSON = data
            },
          }
        }
        return null
      },
      getLayer: () => true,
    } as any

    updateVehiclePositions(mockMap, [
      {
        vehicle_id: 'flexity-1',
        lon: -79.356,
        lat: 43.661,
        bearing: 253,
        yaw: 287,
        load: 55,
        capacity: 130,
      },
    ])

    expect(updatedGeoJSON).not.toBeNull()
    expect(updatedGeoJSON.type).toBe('FeatureCollection')
    expect(updatedGeoJSON.features.length).toBe(1)
    const feat = updatedGeoJSON.features[0]
    expect(feat.geometry.coordinates).toEqual([-79.356, 43.661])
    expect(feat.properties.vehicle_id).toBe('flexity-1')
    expect(feat.properties.bearing).toBe(253)
    expect(feat.properties.yaw).toBe(287)
    expect(feat.properties.rotation).toEqual([0, 0, 287])
    expect(feat.properties.scale).toEqual([1, 1, 1])
    expect(feat.properties.load_known).toBe(true)
    expect(feat.properties.occupancy).toBeCloseTo(55 / 130)

    updateVehiclePositions(mockMap, [{ vehicle_id: 'unknown-load', lon: -79.356, lat: 43.661, load: null }])
    expect(updatedGeoJSON.features[0].properties.load_known).toBe(false)
  })

  it('ensures streetcar model registration and layer addition', () => {
    const addedModels: Record<string, string> = {}
    let addedLayer: any = null
    const mockMap = {
      addModel: (id: string, url: string) => {
        addedModels[id] = url
      },
      hasModel: (id: string) => !!addedModels[id],
      getSource: (id: string) => id === 'source-vehicles',
      getLayer: (id: string) => (id === LAYER_STREETCAR_MODEL ? addedLayer !== null : false),
      addLayer: (layer: any) => {
        addedLayer = layer
      },
    } as any

    ensureStreetcarModelLayer(mockMap)

    expect(addedModels[MODEL_STREETCAR_ID]).toBeDefined()
    expect(addedLayer).not.toBeNull()
    expect(addedLayer.id).toBe(LAYER_STREETCAR_MODEL)
    expect(addedLayer.type).toBe('model')
    expect(addedLayer.source).toBe('source-vehicles')
    expect(addedLayer.layout?.['model-id']).toBe(MODEL_STREETCAR_ID)
  })

  it('synchronizes added tower shadows with proposed building visibility', () => {
    const layoutProps: Record<string, Record<string, any>> = {}
    const filters: Record<string, any> = {}

    const mockMap = {
      getLayer: (id: string) => id === LAYER_SHADOWS_TODAY || id === LAYER_SHADOWS_ADDED || id === 'layer-developments-extrusion' || id === 'layer-walk-links',
      setFilter: (id: string, filter: any) => {
        filters[id] = filter
      },
      setLayoutProperty: (layerId: string, name: string, value: any) => {
        if (!layoutProps[layerId]) layoutProps[layerId] = {}
        layoutProps[layerId][name] = value
      },
      setPaintProperty: () => {},
    } as any

    // Initially setup solar time with no proposals visible
    updateShadowTimeAndVisibility(mockMap, {
      enabled: true,
      localTime: '2026-06-21T12:00',
      visibleDevIds: [],
    })

    // Today shadows are shown
    expect(layoutProps[LAYER_SHADOWS_TODAY]?.visibility).toBe('visible')
    expect(filters[LAYER_SHADOWS_TODAY]).toEqual([
      'all',
      ['==', ['get', 'local_time'], '2026-06-21T12:00'],
      ['==', ['get', 'layer'], 'today'],
    ])
    // Added tower shadow is hidden because no proposals are visible
    expect(layoutProps[LAYER_SHADOWS_ADDED]?.visibility).toBe('none')

    // User toggles to show 239 Dundas proposal
    updateDevelopmentsVisibility(mockMap, ['toronto-app-22-124214-ste-13-oz'])

    // Added tower shadow automatically appears and matches active solar time
    expect(layoutProps[LAYER_SHADOWS_ADDED]?.visibility).toBe('visible')
    expect(filters[LAYER_SHADOWS_ADDED]).toEqual([
      'all',
      ['==', ['get', 'local_time'], '2026-06-21T12:00'],
      ['==', ['get', 'layer'], 'added'],
    ])

    // Changing solar time updates both today and added tower shadow filters
    updateShadowTimeAndVisibility(mockMap, {
      enabled: true,
      localTime: '2026-06-21T15:00',
    })
    expect(filters[LAYER_SHADOWS_TODAY]).toEqual([
      'all',
      ['==', ['get', 'local_time'], '2026-06-21T15:00'],
      ['==', ['get', 'layer'], 'today'],
    ])
    expect(filters[LAYER_SHADOWS_ADDED]).toEqual([
      'all',
      ['==', ['get', 'local_time'], '2026-06-21T15:00'],
      ['==', ['get', 'layer'], 'added'],
    ])

    // User toggles off proposed building: added shadow disappears
    updateDevelopmentsVisibility(mockMap, [])
    expect(layoutProps[LAYER_SHADOWS_ADDED]?.visibility).toBe('none')
    // Today shadows remain visible
    expect(layoutProps[LAYER_SHADOWS_TODAY]?.visibility).toBe('visible')

    // When solar is disabled (e.g. night time or toggled off), both are hidden
    updateShadowTimeAndVisibility(mockMap, {
      enabled: false,
    })
    expect(layoutProps[LAYER_SHADOWS_TODAY]?.visibility).toBe('none')
    expect(layoutProps[LAYER_SHADOWS_ADDED]?.visibility).toBe('none')
  })
})
