import type { Map as MapboxMap, AnyLayer } from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'
import site from '../data/dundas_500_site.json'
import { normalizeDevelopment } from './types'
import { DEVELOPMENT_COLORS } from './developmentColors'
import { publicAssetPath } from '../lib/publicAssetPath'

export const SOURCE_500_MODEL = 'source-500-model'
export const SOURCE_500_SITE = 'source-500-site'
export const LAYER_500_MODEL = 'layer-500-model'
export const LAYER_500_REPLACEMENT = 'layer-500-replacement'
export const MODEL_500_ID = 'model-500-dundas'
export const MODEL_500_URL = publicAssetPath('models/dundas_500.mapbox.glb')
export const DEV_500_ID = 'toronto-app-26-122451-ste-13-oz'
export const DUNDAS_500_PLACEMENT = {
  anchor: [-79.3642039, 43.6600907] as [number, number],
  rotation: [0, 0, 0] as [number, number, number],
  scale: [1, 1, 1] as [number, number, number],
  translation: [0, 0, 0] as [number, number, number],
  height: 120.8499984741211,
}

export function is500Development(value: unknown): boolean {
  const dev = normalizeDevelopment(value)
  return dev.dev_id === DEV_500_ID || dev.dev_id === 'fixture-development-2' ||
    /500.*dundas/i.test(`${dev.address} ${dev.name}`)
}

interface ModelState {
  phase: number
  visibleIds: string[] | null
  development: ReturnType<typeof normalizeDevelopment> | undefined
  watching: boolean
}
const states = new WeakMap<MapboxMap, ModelState>()

function stateFor(map: MapboxMap): ModelState {
  let state = states.get(map)
  if (!state) {
    state = { phase: 2, visibleIds: null, development: undefined, watching: false }
    states.set(map, state)
  }
  return state
}

function syncVisibility(map: MapboxMap): void {
  const state = stateFor(map)
  const visible = Boolean(state.development) && state.phase >= 2 && (
    state.visibleIds === null || state.visibleIds.some(id =>
      id === state.development?.dev_id || id === DEV_500_ID || id === 'fixture-development-2')
  )
  const source = map.getSource?.(SOURCE_500_MODEL) as {
    getModels?: () => Array<{ id: string }>
  } | undefined
  const ready = source?.getModels?.().some(model => model.id === MODEL_500_ID) ?? false
  for (const layer of [LAYER_500_MODEL, LAYER_500_REPLACEMENT]) {
    if (map.getLayer(layer) && typeof map.setLayoutProperty === 'function') {
      const show = visible && (layer === LAYER_500_MODEL || ready)
      map.setLayoutProperty(layer, 'visibility', show ? 'visible' : 'none')
    }
  }
}

function modelsFor(state: ModelState): Record<string, {
  uri: string
  position: [number, number]
  featureProperties: { dev_id: string; name: string; phase: number }
}> {
  const dev = state.development
  if (!dev) return {}
  return {
    [MODEL_500_ID]: {
      uri: typeof window === 'undefined'
        ? MODEL_500_URL
        : new URL(MODEL_500_URL, window.location.href).href,
      position: DUNDAS_500_PLACEMENT.anchor,
      featureProperties: { dev_id: dev.dev_id, name: dev.address, phase: 2 },
    },
  }
}

export function setup500ModelLayer(map: MapboxMap, developments: unknown[]): void {
  const state = stateFor(map)
  state.development = developments.map(normalizeDevelopment).find(is500Development)
  if (!state.watching && typeof map.on === 'function') {
    state.watching = true
    map.on('sourcedata', event => {
      if (event.sourceId === SOURCE_500_MODEL) syncVisibility(map)
    })
  }
  // Reviewed existing-building footprint, restricted to the basemap. Only remove
  // the original building once the replacement GLB has finished loading.
  if (!map.getSource(SOURCE_500_SITE)) {
    map.addSource(SOURCE_500_SITE, { type: 'geojson', data: site as FeatureCollection })
    map.addLayer({
      id: LAYER_500_REPLACEMENT,
      type: 'clip',
      source: SOURCE_500_SITE,
      layout: { 'clip-layer-types': ['model'], 'clip-layer-scope': ['basemap'] },
    } as AnyLayer)
  }
  if (!map.getSource(SOURCE_500_MODEL)) {
    map.addSource(SOURCE_500_MODEL, { type: 'model', models: modelsFor(state) })
    map.addLayer({
      id: LAYER_500_MODEL,
      type: 'model',
      source: SOURCE_500_MODEL,
      slot: 'top',
      paint: {
        'model-scale': DUNDAS_500_PLACEMENT.scale,
        'model-rotation': DUNDAS_500_PLACEMENT.rotation,
        'model-translation': DUNDAS_500_PLACEMENT.translation,
        'model-opacity': 1,
        'model-color': DEVELOPMENT_COLORS.orange.dark,
        'model-color-mix-intensity': 1,
        'model-emissive-strength': 0.1,
        'model-cast-shadows': true,
        'model-receive-shadows': true,
      },
    } as AnyLayer)
  }
  syncVisibility(map)
}

export function update500ModelData(map: MapboxMap, developments: unknown[]): void {
  const state = stateFor(map)
  state.development = developments.map(normalizeDevelopment).find(is500Development)
  const source = map.getSource(SOURCE_500_MODEL) as { setModels?: (models: object) => void } | undefined
  source?.setModels?.(modelsFor(state))
  syncVisibility(map)
}

export function update500ModelPhase(map: MapboxMap, phase: number): void {
  stateFor(map).phase = phase
  syncVisibility(map)
}

export function update500ModelVisibility(map: MapboxMap, visibleIds: string[]): void {
  stateFor(map).visibleIds = [...visibleIds]
  syncVisibility(map)
}

export function update500ModelSelected(map: MapboxMap, selectedId?: string | null): void {
  if (!map.getLayer(LAYER_500_MODEL) || typeof map.setPaintProperty !== 'function') return
  const selected = Boolean(selectedId) && (
    selectedId === stateFor(map).development?.dev_id ||
    selectedId === DEV_500_ID || selectedId === 'fixture-development-2'
  )
  map.setPaintProperty(LAYER_500_MODEL, 'model-color',
    selected ? DEVELOPMENT_COLORS.orange.light : DEVELOPMENT_COLORS.orange.dark)
  map.setPaintProperty(LAYER_500_MODEL, 'model-color-mix-intensity', 1)
  map.setPaintProperty(LAYER_500_MODEL, 'model-emissive-strength', selected ? 0.25 : 0.1)
}
