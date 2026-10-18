import { describe, expect, it } from 'vitest'
import {
  DEV_500_ID, DUNDAS_500_PLACEMENT,
  LAYER_500_MODEL, LAYER_500_REPLACEMENT,
  MODEL_500_ID, MODEL_500_URL, SOURCE_500_MODEL, SOURCE_500_SITE,
  setup500ModelLayer, update500ModelData, update500ModelPhase,
  update500ModelVisibility, update500ModelSelected,
} from './Dundas500Model'
import { generateDevelopmentsGeoJSON } from './MassingLayer'
import { DEVELOPMENT_COLORS } from './developmentColors'

const development = { id: DEV_500_ID, name: '500 DUNDAS ST E', net_added_units: 413 }

function createMap() {
  const sources: Record<string, any> = {}
  const layers: Record<string, any> = {}
  const listeners: Record<string, Array<(event: any) => void>> = {}
  let ready = false
  const map = {
    on: (event: string, listener: (event: any) => void) => {
      ;(listeners[event] ??= []).push(listener)
    },
    getSource: (id: string) => sources[id],
    addSource: (id: string, source: any) => {
      sources[id] = {
        ...source,
        setModels(value: any) { this.models = value },
        getModels() { return ready ? Object.keys(this.models ?? {}).map(id => ({ id })) : [] },
      }
    },
    getLayer: (id: string) => layers[id],
    addLayer: (layer: any) => { layers[layer.id] = layer },
    setLayoutProperty: (id: string, key: string, value: any) => {
      layers[id].layout = { ...layers[id].layout, [key]: value }
    },
    setPaintProperty: (id: string, key: string, value: any) => { layers[id].paint[key] = value },
  } as any
  return {
    map, sources, layers,
    finishLoading() {
      ready = true
      listeners.sourcedata.forEach(listener => listener({ sourceId: SOURCE_500_MODEL }))
    },
  }
}

describe('500 Dundas architectural model', () => {
  it('replaces the proposal box while retaining its measured height and inspection bounds', () => {
    const features = generateDevelopmentsGeoJSON([development]).features
    expect(features).toHaveLength(1)
    expect(features[0].properties).toMatchObject({ dev_id: DEV_500_ID, tier: 'model' })
    expect(features[0].properties?.height_m).toBeCloseTo(120.85)
    expect(features[0].geometry.type).toBe('Polygon')
  })

  it('loads at the existing site at original scale and waits before removing the baseline building', () => {
    const { map, sources, layers, finishLoading } = createMap()
    setup500ModelLayer(map, [development])
    expect(sources[SOURCE_500_MODEL].models[MODEL_500_ID]).toMatchObject({
      uri: MODEL_500_URL,
      position: [-79.3642039, 43.6600907],
      featureProperties: { dev_id: DEV_500_ID, phase: 2 },
    })
    expect(layers[LAYER_500_MODEL].paint['model-scale']).toEqual(DUNDAS_500_PLACEMENT.scale)
    expect(layers[LAYER_500_REPLACEMENT].layout).toMatchObject({
      visibility: 'none', 'clip-layer-scope': ['basemap'],
    })
    expect(sources[SOURCE_500_SITE].data.features[0].properties.building_id)
      .toBe('osm-way-195214196')
    finishLoading()
    expect(layers[LAYER_500_MODEL].layout.visibility).toBe('visible')
    expect(layers[LAYER_500_REPLACEMENT].layout.visibility).toBe('visible')

    update500ModelVisibility(map, [])
    update500ModelPhase(map, 2)
    expect(layers[LAYER_500_MODEL].layout.visibility).toBe('none')
    expect(layers[LAYER_500_REPLACEMENT].layout.visibility).toBe('none')
    update500ModelPhase(map, 0)
    update500ModelVisibility(map, [DEV_500_ID])
    expect(layers[LAYER_500_MODEL].layout.visibility).toBe('none')
    update500ModelPhase(map, 2)
    expect(layers[LAYER_500_MODEL].layout.visibility).toBe('visible')

    update500ModelData(map, [])
    expect(sources[SOURCE_500_MODEL].models).toEqual({})
    expect(layers[LAYER_500_REPLACEMENT].layout.visibility).toBe('none')
    update500ModelData(map, [development])
    expect(layers[LAYER_500_MODEL].layout.visibility).toBe('visible')
  })

  it('keeps fixture identities selectable and independent of the 761 Dundas switch', () => {
    const { map, sources, layers, finishLoading } = createMap()
    setup500ModelLayer(map, [{ id: 'fixture-development-2' }])
    finishLoading()
    expect(sources[SOURCE_500_MODEL].models[MODEL_500_ID].featureProperties.dev_id)
      .toBe('fixture-development-2')
    update500ModelVisibility(map, ['fixture-development-3'])
    expect(layers[LAYER_500_MODEL].layout.visibility).toBe('none')
    update500ModelVisibility(map, ['fixture-development-2'])
    expect(layers[LAYER_500_MODEL].layout.visibility).toBe('visible')
    update500ModelSelected(map, 'fixture-development-2')
    expect(layers[LAYER_500_MODEL].paint['model-color']).toBe(DEVELOPMENT_COLORS.orange.light)
    expect(layers[LAYER_500_MODEL].paint['model-color-mix-intensity']).toBe(1)
    update500ModelSelected(map, null)
    expect(layers[LAYER_500_MODEL].paint['model-color']).toBe(DEVELOPMENT_COLORS.orange.dark)
    expect(layers[LAYER_500_MODEL].paint['model-color-mix-intensity']).toBe(1)
  })
})
