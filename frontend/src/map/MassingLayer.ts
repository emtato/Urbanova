/**
 * MassingLayer.ts (Lane D3)
 *
 * Manages MapLibre 3D extruded building massing, corridor route alignment,
 * stops, walking catchments, and vehicle positions.
 *
 * Reusable module designed so WalkMode (4.1) reuses every layer directly.
 */

import type { Map as MapboxMap, GeoJSONSource, AnyLayer } from 'mapbox-gl'
import type { Feature, FeatureCollection } from 'geojson'
import {
  type CorridorStop,
  type CorridorDevelopment,
  normalizeStop,
  normalizeDevelopment,
} from './types'
import { reviewedWalkingRoutes, dundasStreetcarLine } from '../data'
import dundas761Site from '../data/dundas_761_site.json'
import { streetcarModelYaw } from './streetcarOrientation'
import { DEVELOPMENT_COLORS, getDevelopmentColors, developmentExtrusionColor } from './developmentColors'
import {
  DUNDAS_500_PLACEMENT,
  is500Development,
  setup500ModelLayer,
  update500ModelData,
  update500ModelPhase,
  update500ModelVisibility,
  update500ModelSelected,
} from './Dundas500Model'

export const DUNDAS_ROAD_COORDINATES: [number, number][] = (
  dundasStreetcarLine.features[0].geometry as unknown as { coordinates: [number, number][] }
).coordinates

// Existing building IDs directly on the development parcels to swap out during phases
export const OVERWRITTEN_BASE_BUILDING_IDS_P1 = [
  'osm-796691153',
  'osm-796691158',
  'osm-796691168',
  'osm-966945936',
]
export const OVERWRITTEN_BASE_BUILDING_IDS_P2 = [
  'osm-195214196',
  'osm-1446334055',
]

// Source IDs
export const SOURCE_CORRIDOR_LINKS = 'source-corridor-links'
export const SOURCE_CORRIDOR_STOPS = 'source-corridor-stops'
export const SOURCE_DEVELOPMENTS = 'source-developments'
export const SOURCE_BUILDINGS = 'source-buildings'
export const SOURCE_WALK_LINKS = 'source-walk-links'
export const SOURCE_VEHICLES = 'source-vehicles'
export const SOURCE_SHADOWS = 'source-shadows'
export const SOURCE_761_MODEL = 'source-761-model'
export const SOURCE_761_SITE = 'source-761-site'

// Layer IDs
export const LAYER_LINKS_CASING = 'layer-links-casing'
export const LAYER_LINKS_CORE = 'layer-links-core'
export const LAYER_WALK_LINKS = 'layer-walk-links'
export const LAYER_BUILDINGS_EXISTING = 'layer-buildings-existing'
export const LAYER_DEVELOPMENTS_EXTRUSION = 'layer-developments-extrusion'
export const LAYER_761_MODEL = 'layer-761-model'
export const LAYER_761_REPLACEMENT = 'layer-761-replacement'
export const LAYER_STOPS_GLOW = 'layer-stops-glow'
export const LAYER_STOPS_CIRCLE = 'layer-stops-circle'
export const LAYER_STOPS_LABEL = 'layer-stops-label'
export const LAYER_VEHICLES = 'layer-vehicles'
export const LAYER_STREETCAR_MODEL = 'layer-streetcar-model'
export const LAYER_SHADOWS_TODAY = 'layer-shadows-today'
export const LAYER_SHADOWS_REMOVED = 'layer-shadows-removed'
export const LAYER_SHADOWS_ADDED = 'layer-shadows-added'

export const MODEL_761_ID = 'model-761-dundas'
export const MODEL_761_URL = '/models/dundas_761.mapbox.glb'

const DEV_761_ID = 'toronto-app-25-236949-ste-13-oz'
const is761Id = (id: string) => id === DEV_761_ID || id === 'fixture-development-3'
const is761Development = (dev: CorridorDevelopment) =>
  is761Id(dev.dev_id) || /761.*dundas/i.test(`${dev.address} ${dev.name}`)

// Keep phase and proposal switches together: either update must preserve the other.
const model761States = new WeakMap<MapboxMap, {
  phase: number
  visibleIds: string[] | null
  present: boolean
  devId: string
  watching?: boolean
}>()

function model761State(map: MapboxMap) {
  let state = model761States.get(map)
  if (!state) {
    state = { phase: 2, visibleIds: null, present: true, devId: DEV_761_ID }
    model761States.set(map, state)
  }
  return state
}

function sync761Visibility(map: MapboxMap): void {
  const state = model761State(map)
  const visible = state.present && state.phase >= 2 && (
    state.visibleIds === null || state.visibleIds.some(id => id === state.devId || is761Id(id))
  )
  const source = map.getSource?.(SOURCE_761_MODEL) as {
    getModels?: () => Array<{ id: string }>
  } | undefined
  const ready = source?.getModels?.().some(model => model.id === MODEL_761_ID) ?? false
  for (const layer of [LAYER_761_MODEL, LAYER_761_REPLACEMENT]) {
    if (map.getLayer(layer) && typeof map.setLayoutProperty === 'function') {
      const showLayer = visible && (layer === LAYER_761_MODEL || ready)
      map.setLayoutProperty(layer, 'visibility', showLayer ? 'visible' : 'none')
    }
  }
  if (map.getLayer(LAYER_761_MODEL) && typeof map.setPaintProperty === 'function') {
    map.setPaintProperty(LAYER_761_MODEL, 'model-opacity', visible ? 1 : 0)
  }
}

function get761Models(developments: any[]) {
  const feature = generate761ModelGeoJSON(developments).features[0]
  if (!feature) return {}
  return {
    [MODEL_761_ID]: {
      uri: typeof window === 'undefined'
        ? MODEL_761_URL
        : new URL(MODEL_761_URL, window.location.origin).href,
      position: PHASE2_761_PLACEMENT.anchor,
      featureProperties: feature.properties,
    },
  }
}

export const MODEL_STREETCAR_ID = 'model-flexity-streetcar'
export const MODEL_STREETCAR_URL = '/models/flexity_outlook.glb'

/**
 * Creates surrounding perimeter blocks (used in tests or fallback).
 * In Mapbox Standard, 3D city buildings are rendered natively by the basemap.
 */
export function generateSurroundingMassingGeoJSON(corridor?: any): FeatureCollection {
  const features: Feature[] = []
  if (corridor && corridor.stops) {
    corridor.stops.forEach((rawStop: any, i: number) => {
      const stop = normalizeStop(rawStop)
      const offsetNorth = 0.0008 + (i % 3) * 0.0004
      const offsetSouth = -0.0008 - ((i + 1) % 3) * 0.0004
      const width = 0.0012
      const heightNorth = 18 + ((i * 7) % 35)
      const heightSouth = 14 + (((i + 2) * 5) % 28)

      // North side building block
      features.push({
        type: 'Feature',
        properties: {
          id: `mass_n_${stop.stop_id}`,
          name: `Existing City Block ${i + 1}N`,
          height_m: heightNorth,
          kind: 'existing',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [stop.lon - width / 2, stop.lat + offsetNorth],
            [stop.lon + width / 2, stop.lat + offsetNorth],
            [stop.lon + width / 2, stop.lat + offsetNorth + 0.0007],
            [stop.lon - width / 2, stop.lat + offsetNorth + 0.0007],
            [stop.lon - width / 2, stop.lat + offsetNorth],
          ]],
        },
      })

      // South side building block
      features.push({
        type: 'Feature',
        properties: {
          id: `mass_s_${stop.stop_id}`,
          name: `Existing City Block ${i + 1}S`,
          height_m: heightSouth,
          kind: 'existing',
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [stop.lon - width / 2, stop.lat + offsetSouth],
            [stop.lon + width / 2, stop.lat + offsetSouth],
            [stop.lon + width / 2, stop.lat + offsetSouth - 0.0007],
            [stop.lon - width / 2, stop.lat + offsetSouth - 0.0007],
            [stop.lon - width / 2, stop.lat + offsetSouth],
          ]],
        },
      })
    })
  }

  return { type: 'FeatureCollection', features }
}

export const DEV_COORDINATES: Record<string, [number, number]> = {
  'toronto-app-22-124214-ste-13-oz': [-79.372685, 43.658009], // Phase 1: 239 Dundas St E (146.94m tower at Dundas & Pembroke)
  'fixture-development-1': [-79.372685, 43.658009],           // Phase 1 fixture
  'toronto-app-26-122451-ste-13-oz': [-79.3642039, 43.6600907], // Phase 2: 500 Dundas St E (413 units)
  'fixture-development-2': [-79.3642039, 43.6600907],
  'toronto-app-25-236949-ste-13-oz': [-79.3563946, 43.6612908], // Phase 2: 761 Dundas St E (1197 units)
  'fixture-development-3': [-79.3563946, 43.6612908],
}

export const DEV_PHASES: Record<string, number> = {
  'toronto-app-22-124214-ste-13-oz': 1,
  'fixture-development-1': 1,
  'toronto-app-26-122451-ste-13-oz': 2,
  'fixture-development-2': 2,
  'toronto-app-25-236949-ste-13-oz': 2,
  'fixture-development-3': 2,
}

export function getDevelopmentCoordinates(dev: any): [number, number] {
  const d = normalizeDevelopment(dev)
  if (DEV_COORDINATES[d.dev_id]) {
    return DEV_COORDINATES[d.dev_id]
  }
  if (d.footprint && d.footprint.coordinates[0]?.[0]) {
    return d.footprint.coordinates[0][0]
  }
  return [-79.365, 43.660]
}

export function getDevelopmentPhase(dev: any): number {
  const d = normalizeDevelopment(dev)
  return DEV_PHASES[d.dev_id] || 2
}

/**
 * Phase 1 (239 Dundas St E) Placement & Rotation Controls:
 *
 * 1. `anchor`: [longitude, latitude] of the northeast corner that directly hugs the intersection
 *    corner of Dundas Street East & Pembroke Street.
 *    - Increase longitude to nudge East towards Pembroke/Sherbourne.
 *    - Decrease longitude to nudge West towards George/Jarvis.
 *    - Increase latitude to nudge North into Dundas St E.
 *    - Decrease latitude to nudge South along Pembroke St.
 *
 * 2. `rotationDeg`: Counter-clockwise rotation angle in degrees around the corner anchor.
 *    - e.g. 0 = baseline street alignment.
 *    - Positive values rotate counter-clockwise, negative values rotate clockwise.
 *
 * 3. `scale`: Uniform scale factor (default 1.0).
 */
export interface Phase1PlacementConfig {
  anchor: [number, number]
  rotationDeg: number
  scale: number
}

export const PHASE1_PLACEMENT: Phase1PlacementConfig = {
  anchor: [-79.372429, 43.658099], // Corner of Dundas St E & Pembroke St (shifted east 2m, south 2m, 18 deg CCW)
  rotationDeg: 18,
  scale: 1.0,
}

export function transformPhase1Point(
  xMeters: number,
  yMeters: number,
  config: Phase1PlacementConfig = PHASE1_PLACEMENT
): [number, number] {
  const rad = (config.rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  const rx = (xMeters * cos - yMeters * sin) * config.scale
  const ry = (xMeters * sin + yMeters * cos) * config.scale
  return [
    config.anchor[0] + rx / 80410,
    config.anchor[1] + ry / 111139,
  ]
}

/**
 * Phase 2 (761 Dundas St E) Placement & Rotation Controls for the 3D GLB Model:
 *
 * 1. `anchor`: [longitude, latitude] of the model center at 761 Dundas St E.
 *    - Increase longitude to nudge East.
 *    - Decrease longitude to nudge West.
 *    - Increase latitude to nudge North into Dundas St E.
 *    - Decrease latitude to nudge South.
 *
 * 2. `rotation`: [pitch, roll, yaw] in degrees around the anchor.
 *    - 3rd value (yaw/heading) rotates horizontally around vertical axis.
 *
 * 3. `scale`: [x, y, z] uniform or dimensional scale factors.
 *
 * 4. `translation`: [x, y, z] offsets in meters.
 */
export interface Phase2_761PlacementConfig {
  anchor: [number, number]
  rotation: [number, number, number]
  scale: [number, number, number]
  translation: [number, number, number]
}

export const PHASE2_761_PLACEMENT: Phase2_761PlacementConfig = {
  anchor: [-79.3565813, 43.661246], // Shifted approximately 15 metres west and 5 metres south of the site center
  rotation: [0, 0, 0],
  scale: [1, 1, 1],
  translation: [0, 0, 0],
}

export function generate761ModelGeoJSON(developments?: any[]): FeatureCollection {
  const development = developments?.map(normalizeDevelopment).find(is761Development)

  if (!development) {
    return { type: 'FeatureCollection', features: [] }
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          dev_id: development.dev_id,
          name: '761 DUNDAS ST E (3D Architectural Model)',
          phase: 2,
          model_id: MODEL_761_ID,
        },
        geometry: {
          type: 'Point',
          coordinates: PHASE2_761_PLACEMENT.anchor,
        },
      },
    ],
  }
}

/**
 * Builds GeoJSON features for development proposal towers.
 * For Phase 1 (239-255 Dundas St E), accurately renders the multi-tiered
 * architectural massing (10.60m podium base, 146.94m 52-storey tower, and mechanical penthouse)
 * as approved in City of Toronto Decision Report 22 124214 STE 13 OZ.
 */
export function generateDevelopmentsGeoJSON(developments: any[]): FeatureCollection {
  const features: Feature[] = []

  for (const rawDev of developments) {
    const dev = normalizeDevelopment(rawDev)
    const [lon, lat] = getDevelopmentCoordinates(dev)
    const phase = getDevelopmentPhase(dev)
    const isPhase1 = phase === 1 || dev.dev_id === 'fixture-development-1' || dev.dev_id === 'toronto-app-22-124214-ste-13-oz'


    if (isPhase1) {
      // 1. Heritage Base & Retail Podium (10.60m tall, grade to podium roof)
      // Follows surveyed parcel hugging the SW corner of Dundas & Pembroke: 1,038.8 m²
      // 36.1m frontage on Dundas St E, 43.5m frontage on Pembroke St
      const localPodium: [number, number][] = [
        [0, 0],           // NE corner directly hugging Dundas St E & Pembroke St
        [-1.0, -43.5],    // SE corner along Pembroke (43.5m frontage)
        [-29.0, -43.5],   // SW corner (28m south boundary)
        [-29.0, -29.5],   // West boundary behind heritage
        [-33.5, -14.0],   // Dogleg west boundary
        [0, 0],           // Close along Dundas St E (36.3m frontage)
      ]
      const podiumCoords = localPodium.map(([x, y]) => transformPhase1Point(x, y))

      features.push({
        type: 'Feature',
        properties: {
          dev_id: dev.dev_id,
          name: `${dev.address || '239 Dundas St E'} (Podium Base)`,
          units: dev.units,
          stage: dev.stage,
          phase: 1,
          tier: 'podium',
          height_m: 10.60,
          base_height_m: 0,
          kind: dev.kind,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [podiumCoords],
        },
      })

      // 2. 52-Storey Residential Tower Shaft (Exactly 146.94m to Level 49 Main Roof)
      // Inset ~2.5m from sidewalk, with retail/residential entrance articulation facing Dundas
      const localTower: [number, number][] = [
        [-2.5, -10.0],    // NE corner of tower shaft
        [-2.5, -40.5],    // SE corner of tower
        [-26.5, -40.5],   // SW corner of tower (24m tower width)
        [-26.5, -20.0],   // West wall
        [-22.0, -17.0],   // West notch step
        [-18.0, -11.5],   // Northwest wing corner
        [-10.5, -8.5],    // Entrance recess
        [-8.0, -6.5],     // North entrance protrusion facing Dundas
        [-2.5, -10.0],    // Close
      ]
      const towerCoords = localTower.map(([x, y]) => transformPhase1Point(x, y))

      features.push({
        type: 'Feature',
        properties: {
          dev_id: dev.dev_id,
          name: `${dev.address || '239 Dundas St E'} (52-Storey Tower)`,
          units: dev.units,
          stage: dev.stage,
          phase: 1,
          tier: 'tower',
          height_m: 146.94,
          base_height_m: 0,
          kind: dev.kind,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [towerCoords],
        },
      })

      // 3. Mechanical Penthouse (+6.00m roof enclosure, 146.94m to 152.94m)
      // Sits squarely on the southern half of the tower roof matching Site Plan & Elevations
      const localMech: [number, number][] = [
        [-4.0, -22.0],    // NE corner of penthouse
        [-4.0, -39.0],    // SE corner of penthouse
        [-25.0, -39.0],   // SW corner of penthouse
        [-25.0, -22.0],   // NW corner of penthouse
        [-4.0, -22.0],    // Close
      ]
      const mechCoords = localMech.map(([x, y]) => transformPhase1Point(x, y))

      features.push({
        type: 'Feature',
        properties: {
          dev_id: dev.dev_id,
          name: `${dev.address || '239 Dundas St E'} (Mechanical Penthouse)`,
          units: dev.units,
          stage: dev.stage,
          phase: 1,
          tier: 'mechanical',
          height_m: 152.94,
          base_height_m: 146.94,
          kind: dev.kind,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [mechCoords],
        },
      })
    } else if (is500Development(dev)) {
      // Keep bounds and measured asset height for inspection/street view; the
      // supplied GLB replaces this proposal's box in the rendered scene.
      const [modelLon, modelLat] = DUNDAS_500_PLACEMENT.anchor
      const halfWidth = 32.5 / 80410
      const halfDepth = 23.1 / 111139
      features.push({
        type: 'Feature',
        properties: {
          dev_id: dev.dev_id,
          name: `${dev.address} (3D Architectural Model)`,
          units: dev.units,
          stage: dev.stage,
          phase,
          tier: 'model',
          height_m: DUNDAS_500_PLACEMENT.height,
          base_height_m: 0,
          kind: dev.kind,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [modelLon - halfWidth, modelLat - halfDepth],
            [modelLon + halfWidth, modelLat - halfDepth],
            [modelLon + halfWidth, modelLat + halfDepth],
            [modelLon - halfWidth, modelLat + halfDepth],
            [modelLon - halfWidth, modelLat - halfDepth],
          ]],
        },
      })
    } else if (
      dev.dev_id === 'toronto-app-25-236949-ste-13-oz' ||
      dev.dev_id === 'fixture-development-3' ||
      /761.*dundas/i.test(dev.address || dev.name || '')
    ) {
      // 761 Dundas St E: Replaced by 3D GLB Architectural Model (49 storeys / 161.75m).
      // A polygon feature is retained with tier: 'model' and full height so tests,
      // building street-view bounds, and metrics pass seamlessly, while extrusion rendering
      // is suppressed in favor of LAYER_761_MODEL.
      const sizeX = 0.0006
      const sizeY = 0.0003
      features.push({
        type: 'Feature',
        properties: {
          dev_id: dev.dev_id,
          name: `${dev.address || '761 Dundas St E'} (3D Architectural Model)`,
          units: dev.units,
          stage: dev.stage,
          phase: 2,
          tier: 'model',
          height_m: 161.75,
          base_height_m: 0,
          kind: dev.kind,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [lon - sizeX, lat - sizeY],
            [lon + sizeX, lat - sizeY],
            [lon + sizeX, lat + sizeY],
            [lon - sizeX, lat + sizeY],
            [lon - sizeX, lat - sizeY],
          ]],
        },
      })
    } else {
      // Standard massing for Phase 2 proposals
      const size = 0.0005
      const height_m = Math.round(Math.max(45, Math.min(180, dev.units * 0.12)))

      features.push({
        type: 'Feature',
        properties: {
          dev_id: dev.dev_id,
          name: dev.address,
          units: dev.units,
          stage: dev.stage,
          phase: phase,
          tier: 'tower',
          height_m: height_m,
          base_height_m: 0,
          kind: dev.kind,
        },
        geometry: {
          type: 'Polygon',
          coordinates: [[
            [lon - size, lat - size],
            [lon + size, lat - size],
            [lon + size, lat + size],
            [lon - size, lat + size],
            [lon - size, lat - size],
          ]],
        },
      })
    }
  }

  for (const feature of features) {
    const palette = getDevelopmentColors({
      dev_id: feature.properties?.dev_id,
      address: feature.properties?.name,
    })
    feature.properties = { ...feature.properties, color_dark: palette.dark, color_light: palette.light }
  }
  return { type: 'FeatureCollection', features }
}

/**
 * Builds walking connection lines from developments to accessible stops.
 * Uses official surveyed OSM pedestrian routes if available.
 */
export function generateWalkCatchmentsGeoJSON(
  developments: any[],
  stops: any[]
): FeatureCollection {
  const normalizedDevs = developments.map(normalizeDevelopment)
  const normalizedStops = stops.map(normalizeStop)

  if (reviewedWalkingRoutes && reviewedWalkingRoutes.features && reviewedWalkingRoutes.features.length > 0) {
    const devMap = new Map<string, CorridorDevelopment>(normalizedDevs.map((d) => [d.dev_id, d]))
    const features: Feature[] = (reviewedWalkingRoutes.features as any[]).map((f) => {
      const dev = devMap.get(f.properties?.dev_id)
      const phase = dev ? getDevelopmentPhase(dev) : (DEV_PHASES[f.properties?.dev_id] || 2)
      return {
        ...f,
        properties: {
          ...f.properties,
          phase,
        },
      }
    })
    return { type: 'FeatureCollection', features }
  }

  const stopMap = new Map<string, CorridorStop>(normalizedStops.map((s) => [s.stop_id, s]))
  const features: Feature[] = []

  normalizedDevs.forEach((dev) => {
    const coords = getDevelopmentCoordinates(dev)
    const phase = getDevelopmentPhase(dev)
    dev.access?.forEach((acc: any) => {
      const stop = stopMap.get(acc.stop_id)
      if (stop) {
        features.push({
          type: 'Feature',
          properties: {
            dev_id: dev.dev_id,
            stop_id: stop.stop_id,
            walk_m: acc.walk_m,
            phase: phase,
          },
          geometry: {
            type: 'LineString',
            coordinates: [coords, [stop.lon, stop.lat]],
          },
        })
      }
    })
  })

  return { type: 'FeatureCollection', features }
}

/**
 * Builds corridor track alignment line GeoJSON centered directly above the actual road of Dundas
 */
export function generateCorridorLinksGeoJSON(corridor?: any): FeatureCollection {
  let coordinates: [number, number][] = []

  // 1. If corridor has explicit link geometries with coordinates, assemble them
  if (corridor && Array.isArray(corridor.links) && corridor.links.some((l: any) => l.geometry?.coordinates?.length)) {
    for (const link of corridor.links) {
      if (link.geometry?.coordinates) {
        for (const pt of link.geometry.coordinates) {
          const last = coordinates[coordinates.length - 1]
          if (!last || last[0] !== pt[0] || last[1] !== pt[1]) {
            coordinates.push([pt[0], pt[1]])
          }
        }
      }
    }
  }

  // 2. Otherwise, use the verified Dundas Street road centerline, centered directly above the road
  if (coordinates.length === 0) {
    if (corridor?.stops && corridor.stops.length > 0) {
      const stops = corridor.stops.map(normalizeStop)
      const minLon = Math.min(...stops.map((s: any) => s.lon))
      const maxLon = Math.max(...stops.map((s: any) => s.lon))
      // Filter Dundas centerline points within the stop bounds with a small buffer
      const filtered = DUNDAS_ROAD_COORDINATES.filter(
        ([lon]) => lon >= minLon - 0.0006 && lon <= maxLon + 0.0006
      )
      if (filtered.length >= 2) {
        coordinates = filtered
      }
    }
    // Fallback to full Dundas Streetcar line if no filter matched or empty stops
    if (coordinates.length === 0) {
      coordinates = [...DUNDAS_ROAD_COORDINATES]
    }
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: {
          corridor_id: corridor?.corridor_id ?? 'ttc-505-west-broadview-tmu',
          name: `Route ${corridor?.route_pattern ?? '505'} (${corridor?.direction ?? 'westbound'})`,
        },
        geometry: {
          type: 'LineString',
          coordinates,
        },
      },
    ],
  }
}

/**
 * Builds corridor stops GeoJSON
 */
export function generateCorridorStopsGeoJSON(stops: any[]): FeatureCollection {
  const normalizedStops = stops.map(normalizeStop)
  return {
    type: 'FeatureCollection',
    features: normalizedStops.map((s) => ({
      type: 'Feature',
      properties: {
        stop_id: s.stop_id,
        gtfs_stop_id: s.gtfs_stop_id,
        name: s.name,
        seq: s.seq,
      },
      geometry: {
        type: 'Point',
        coordinates: [s.lon, s.lat],
      },
    })),
  }
}

/**
 * Initializes all layers on the MapLibre instance
 */
export function setupCorridorMapLayers(
  map: MapboxMap,
  corridor: any,
  developments: any[]
): void {
  // Mapbox Standard renders all 3D buildings natively via basemap style.
  // Custom corridor layers are placed in slot: 'top' to sit cleanly over the 3D city.

  // 2. Walking Catchment Connectors (Dashed paths)
  const walkCatchments = generateWalkCatchmentsGeoJSON(developments, corridor.stops)
  if (!map.getSource(SOURCE_WALK_LINKS)) {
    map.addSource(SOURCE_WALK_LINKS, { type: 'geojson', data: walkCatchments })
    map.addLayer({
      id: LAYER_WALK_LINKS,
      type: 'line',
      source: SOURCE_WALK_LINKS,
      slot: 'top',
      paint: {
        'line-color': '#06b6d4',
        'line-width': 2.5,
        'line-dasharray': [2, 3],
        'line-opacity': 0.85,
      },
    } as AnyLayer)
  }

  // 2b. Precomputed Ground Shadows (Contract 1.0.0 / Lane C)
  // Rendered in slot: 'middle' directly on terrain & streets, beneath 3D buildings
  if (!map.getSource(SOURCE_SHADOWS)) {
    map.addSource(SOURCE_SHADOWS, {
      type: 'geojson',
      data: '/data/shadows.geojson',
    })

    // Layer 1: Today - Baseline shaded open ground (Deep slate/grey)
    map.addLayer({
      id: LAYER_SHADOWS_TODAY,
      type: 'fill',
      source: SOURCE_SHADOWS,
      slot: 'middle',
      filter: [
        'all',
        ['==', ['get', 'local_time'], '2026-06-21T12:00'],
        ['==', ['get', 'layer'], 'today'],
      ],
      layout: {
        visibility: 'visible',
      },
      paint: {
        'fill-color': '#0f172a',
        'fill-opacity': 0.38,
      },
    } as AnyLayer)
  }

  // 3. Proposed Development Towers (Luminous, non-approved design stylings)
  const devFeatures = generateDevelopmentsGeoJSON(developments)
  if (!map.getSource(SOURCE_DEVELOPMENTS)) {
    map.addSource(SOURCE_DEVELOPMENTS, { type: 'geojson', data: devFeatures })
    map.addLayer({
      id: LAYER_DEVELOPMENTS_EXTRUSION,
      type: 'fill-extrusion',
      source: SOURCE_DEVELOPMENTS,
      slot: 'top',
      paint: {
        'fill-extrusion-color': developmentExtrusionColor(),
        'fill-extrusion-height': [
          'case',
          ['==', ['get', 'tier'], 'model'],
          0,
          ['get', 'height_m'],
        ],
        'fill-extrusion-base': ['coalesce', ['get', 'base_height_m'], 0],
        'fill-extrusion-opacity': 0.95,
      },
    } as AnyLayer)
  }

  // 3b. 3D Architectural Model for 761 Dundas St E (Phase 2 proposal)
  const modelFeature = generate761ModelGeoJSON(developments).features[0]
  const modelState = model761State(map)
  modelState.present = Boolean(modelFeature)
  modelState.devId = modelFeature?.properties?.dev_id ?? DEV_761_ID
  if (!modelState.watching && typeof map.on === 'function') {
    modelState.watching = true
    map.on('sourcedata', event => {
      if (event.sourceId === SOURCE_761_MODEL) sync761Visibility(map)
    })
  }

  // Reviewed footprint of the existing building on this proposal site, copied
  // from public/data/buildings_3d.geojson (osm-way-195214544). Clip only the
  // basemap, so the supplied GLB and other development overlays remain intact.
  if (!map.getSource(SOURCE_761_SITE)) {
    map.addSource(SOURCE_761_SITE, { type: 'geojson', data: dundas761Site as FeatureCollection })
    map.addLayer({
      id: LAYER_761_REPLACEMENT,
      type: 'clip',
      source: SOURCE_761_SITE,
      layout: {
        'clip-layer-types': ['model'],
        'clip-layer-scope': ['basemap'],
      },
    } as AnyLayer)
  }

  if (!map.getSource(SOURCE_761_MODEL)) {
    map.addSource(SOURCE_761_MODEL, {
      type: 'model',
      models: get761Models(developments),
    } as any)

    map.addLayer({
      id: LAYER_761_MODEL,
      type: 'model',
      source: SOURCE_761_MODEL,
      slot: 'top',
      paint: {
        'model-scale': PHASE2_761_PLACEMENT.scale,
        'model-rotation': PHASE2_761_PLACEMENT.rotation,
        'model-translation': PHASE2_761_PLACEMENT.translation,
        'model-opacity': 1.0,
        'model-color': DEVELOPMENT_COLORS.purple.dark,
        'model-color-mix-intensity': 1,
        'model-emissive-strength': 0.1,
        'model-cast-shadows': true,
        'model-receive-shadows': true,
      },
    } as AnyLayer)
  }
  sync761Visibility(map)

  // 3c. Supplied 500 Dundas St E model replaces the remaining proposal box.
  setup500ModelLayer(map, developments)

  // 4. Streetcar Corridor Track / Route Alignment
  const linksData = generateCorridorLinksGeoJSON(corridor)
  if (!map.getSource(SOURCE_CORRIDOR_LINKS)) {
    map.addSource(SOURCE_CORRIDOR_LINKS, { type: 'geojson', data: linksData })

    // Outer glow casing
    map.addLayer({
      id: LAYER_LINKS_CASING,
      type: 'line',
      source: SOURCE_CORRIDOR_LINKS,
      slot: 'top',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': 'rgba(239, 68, 68, 0.45)', // TTC red glow
        'line-width': 8,
        'line-blur': 2,
      },
    } as AnyLayer)

    // Center active track line
    map.addLayer({
      id: LAYER_LINKS_CORE,
      type: 'line',
      source: SOURCE_CORRIDOR_LINKS,
      slot: 'top',
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ef4444', // TTC Red
        'line-width': 3.5,
      },
    } as AnyLayer)
  }

  // 5. Corridor Stops (Point markers with glow)
  const stopsData = generateCorridorStopsGeoJSON(corridor.stops)
  if (!map.getSource(SOURCE_CORRIDOR_STOPS)) {
    map.addSource(SOURCE_CORRIDOR_STOPS, { type: 'geojson', data: stopsData })

    // Outer pulsing ring
    map.addLayer({
      id: LAYER_STOPS_GLOW,
      type: 'circle',
      source: SOURCE_CORRIDOR_STOPS,
      slot: 'top',
      paint: {
        'circle-radius': 11,
        'circle-color': '#06b6d4',
        'circle-opacity': 0.45,
      },
    } as AnyLayer)

    // Inner crisp circle
    map.addLayer({
      id: LAYER_STOPS_CIRCLE,
      type: 'circle',
      source: SOURCE_CORRIDOR_STOPS,
      slot: 'top',
      paint: {
        'circle-radius': 6,
        'circle-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#0f172a',
      },
    } as AnyLayer)

    // Stop Labels (without hardcoded fonts so it resolves against any base style glyphs)
    map.addLayer({
      id: LAYER_STOPS_LABEL,
      type: 'symbol',
      source: SOURCE_CORRIDOR_STOPS,
      slot: 'top',
      layout: {
        'text-field': ['get', 'name'],
        'text-size': 11,
        'text-offset': [0, 1.4],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': '#ffffff',
        'text-halo-color': '#0a0f1d',
        'text-halo-width': 2,
      },
    } as AnyLayer)
  }

  // 6. Real-time Simulation Vehicle Stream
  if (!map.getSource(SOURCE_VEHICLES)) {
    map.addSource(SOURCE_VEHICLES, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] },
    })

    // Keep the red streetcar locator visible at corridor scale, including
    // compact runs where occupancy history is unavailable.
    map.addLayer({
      id: LAYER_VEHICLES,
      type: 'circle',
      source: SOURCE_VEHICLES,
      slot: 'top',
      paint: {
        'circle-radius': 6,
        'circle-color': '#c8102e',
        'circle-stroke-width': 1.5,
        'circle-stroke-color': '#ffffff',
        'circle-opacity': 0.9,
      },
    } as AnyLayer)
  }

  // 6b. 3D Model Layer for Toronto Flexity Outlook Streetcar
  ensureStreetcarModelLayer(map)
}

/**
 * Ensures the 3D Toronto Flexity Outlook streetcar model is registered and its layer added
 */
export function ensureStreetcarModelLayer(map: MapboxMap): void {
  const resolvedStreetcarUrl =
    typeof window !== 'undefined'
      ? `${window.location.origin}/models/flexity_outlook.glb`
      : MODEL_STREETCAR_URL

  if (typeof (map as any).addModel === 'function') {
    if (
      typeof (map as any).hasModel !== 'function' ||
      !(map as any).hasModel(MODEL_STREETCAR_ID)
    ) {
      try {
        ;(map as any).addModel(MODEL_STREETCAR_ID, resolvedStreetcarUrl)
      } catch (e) {
        console.warn('Mapbox addModel note (streetcar):', e)
      }
    }
  }

  if (!map.getLayer(LAYER_STREETCAR_MODEL) && map.getSource(SOURCE_VEHICLES)) {
    try {
      const modelIdToUse =
        typeof (map as any).addModel === 'function'
          ? MODEL_STREETCAR_ID
          : resolvedStreetcarUrl

      map.addLayer({
        id: LAYER_STREETCAR_MODEL,
        type: 'model',
        source: SOURCE_VEHICLES,
        slot: 'top',
        layout: {
          'model-id': modelIdToUse,
        },
        paint: {
          'model-scale': [1, 1, 1],
          'model-rotation': [0, 0, ['coalesce', ['get', 'yaw'], 0]],
          'model-translation': [0, 0, 0],
          'model-opacity': 1.0,
          'model-cast-shadows': true,
          'model-receive-shadows': true,
        },
      } as AnyLayer)
    } catch (e) {
      console.warn('Mapbox 3D streetcar layer note:', e)
    }
  }
}

/**
 * Toggles visibility or height of developments based on the active planning phase.
 * Today = 0 (no new towers, show original baseline buildings)
 * Phase 1 = 1 (Phase 1 Cyan tower replaces 239 Dundas parcel)
 * Phase 2 = 2 (Phase 1 + 2 towers replace 239, 500, and 761 Dundas parcels)
 */
export function updateDevelopmentsPhase(map: MapboxMap, activePhase: number): void {
  model761State(map).phase = activePhase
  update500ModelPhase(map, activePhase)
  // 1. Proposed Development Towers
  if (map.getLayer(LAYER_DEVELOPMENTS_EXTRUSION)) {
    if (activePhase === 0) {
      map.setFilter(LAYER_DEVELOPMENTS_EXTRUSION, ['==', ['get', 'phase'], -1])
    } else {
      map.setFilter(LAYER_DEVELOPMENTS_EXTRUSION, ['<=', ['get', 'phase'], activePhase])
    }
  }

  // 1b. 3D Architectural Model for 761 Dundas (Phase 2 proposal)
  sync761Visibility(map)

  // 2. Walk catchments follow active phase
  if (map.getLayer(LAYER_WALK_LINKS)) {
    if (activePhase === 0) {
      map.setFilter(LAYER_WALK_LINKS, ['==', ['get', 'phase'], -1])
    } else {
      map.setFilter(LAYER_WALK_LINKS, ['<=', ['get', 'phase'], activePhase])
    }
  }
}

/**
 * Toggles individual development visibility based on active development IDs.
 * Powers the top-left toolbar pill buttons.
 */
export function updateDevelopmentsVisibility(
  map: MapboxMap,
  visibleDevIds: string[]
): void {
  model761State(map).visibleIds = [...visibleDevIds]
  update500ModelVisibility(map, visibleDevIds)
  // 1. Proposed Development Towers
  if (map.getLayer(LAYER_DEVELOPMENTS_EXTRUSION)) {
    if (visibleDevIds.length === 0) {
      map.setFilter(LAYER_DEVELOPMENTS_EXTRUSION, ['==', ['get', 'dev_id'], '__none__'])
    } else if (visibleDevIds.length === 1) {
      map.setFilter(LAYER_DEVELOPMENTS_EXTRUSION, ['==', ['get', 'dev_id'], visibleDevIds[0]])
    } else {
      map.setFilter(LAYER_DEVELOPMENTS_EXTRUSION, [
        'any',
        ...visibleDevIds.map((id) => ['==', ['get', 'dev_id'], id]),
      ])
    }
  }

  // 1b. 3D Architectural Model for 761 Dundas
  sync761Visibility(map)

  // 2. Walk catchments follow visible developments
  if (map.getLayer(LAYER_WALK_LINKS)) {
    if (visibleDevIds.length === 0) {
      map.setFilter(LAYER_WALK_LINKS, ['==', ['get', 'dev_id'], '__none__'])
    } else if (visibleDevIds.length === 1) {
      map.setFilter(LAYER_WALK_LINKS, ['==', ['get', 'dev_id'], visibleDevIds[0]])
    } else {
      map.setFilter(LAYER_WALK_LINKS, [
        'any',
        ...visibleDevIds.map((id) => ['==', ['get', 'dev_id'], id]),
      ])
    }
  }
}

/**
 * Updates building colors and styling when selected or unselected.
 * When not selected, buildings remain solid and opaque (never see-thru).
 */
export function updateDevelopmentsSelected(
  map: MapboxMap,
  selectedDevId?: string | null
): void {
  update500ModelSelected(map, selectedDevId)
  if (map.getLayer(LAYER_DEVELOPMENTS_EXTRUSION)) {
    map.setPaintProperty(LAYER_DEVELOPMENTS_EXTRUSION, 'fill-extrusion-color',
      developmentExtrusionColor(selectedDevId))

    // Always keep fully solid and opaque so they are never see-thru
    map.setPaintProperty(LAYER_DEVELOPMENTS_EXTRUSION, 'fill-extrusion-opacity', 1.0)
  }

  // 3D Architectural Model highlight
  if (map.getLayer(LAYER_761_MODEL)) {
    const is761Selected =
      selectedDevId === 'toronto-app-25-236949-ste-13-oz' ||
      selectedDevId === 'fixture-development-3'

    if (typeof (map as any).setPaintProperty === 'function') {
      try {
        map.setPaintProperty(LAYER_761_MODEL, 'model-color',
          is761Selected ? DEVELOPMENT_COLORS.purple.light : DEVELOPMENT_COLORS.purple.dark)
        map.setPaintProperty(LAYER_761_MODEL, 'model-color-mix-intensity', 1)
        map.setPaintProperty(LAYER_761_MODEL, 'model-emissive-strength', is761Selected ? 0.25 : 0.1)
      } catch {
        // Fallback gracefully for mock or environments without model-color
      }
    }
  }
}

/**
 * Dynamically updates all corridor map sources when data changes
 */
export function updateCorridorMapData(
  map: MapboxMap,
  corridor: any,
  developments: any[]
): void {

  const walkSrc = map.getSource(SOURCE_WALK_LINKS) as GeoJSONSource | undefined
  if (walkSrc) {
    walkSrc.setData(generateWalkCatchmentsGeoJSON(developments, corridor.stops))
  }

  const devSrc = map.getSource(SOURCE_DEVELOPMENTS) as GeoJSONSource | undefined
  if (devSrc) {
    devSrc.setData(generateDevelopmentsGeoJSON(developments))
  }

  const modelFeature = generate761ModelGeoJSON(developments).features[0]
  const modelState = model761State(map)
  modelState.present = Boolean(modelFeature)
  modelState.devId = modelFeature?.properties?.dev_id ?? DEV_761_ID
  const model761Src = map.getSource(SOURCE_761_MODEL) as any
  if (model761Src && typeof model761Src.setModels === 'function') {
    model761Src.setModels(get761Models(developments))
  }
  sync761Visibility(map)

  update500ModelData(map, developments)

  const linksSrc = map.getSource(SOURCE_CORRIDOR_LINKS) as GeoJSONSource | undefined
  if (linksSrc) {
    linksSrc.setData(generateCorridorLinksGeoJSON(corridor))
  }

  const stopsSrc = map.getSource(SOURCE_CORRIDOR_STOPS) as GeoJSONSource | undefined
  if (stopsSrc) {
    stopsSrc.setData(generateCorridorStopsGeoJSON(corridor.stops))
  }
}

/**
 * Updates positions of simulated moving streetcars on the map
 */
export function updateVehiclePositions(
  map: MapboxMap,
  vehicles: Array<{
    vehicle_id: string
    lon: number
    lat: number
    load?: number | null
    capacity?: number
    bearing?: number
    yaw?: number
  }>
): void {
  const source = map.getSource(SOURCE_VEHICLES) as GeoJSONSource | undefined
  if (!source) return

  ensureStreetcarModelLayer(map)

  const features: Feature[] = vehicles.map((v) => {
    const bearing = v.bearing ?? 253
    const calculatedYaw = v.yaw ?? streetcarModelYaw(bearing)
    const loadKnown = typeof v.load === 'number' && Number.isFinite(v.load) &&
      typeof v.capacity === 'number' && Number.isFinite(v.capacity) && v.capacity > 0

    return {
      type: 'Feature',
      properties: {
        vehicle_id: v.vehicle_id,
        load: v.load ?? 0,
        capacity: v.capacity ?? 130,
        load_known: loadKnown,
        occupancy: loadKnown ? Math.max(0, Math.min(1, v.load! / v.capacity!)) : 0,
        bearing,
        yaw: calculatedYaw,
        rotation: [0, 0, calculatedYaw],
        scale: [1, 1, 1],
      },
      geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
    }
  })

  source.setData({ type: 'FeatureCollection', features })
}

/**
 * Toggles visibility and updates solar time filter for ground shadow layers.
 * Sunlight and shadows are cast at all times.
 */
export function updateShadowTimeAndVisibility(
  map: MapboxMap,
  options: {
    enabled?: boolean
    localTime?: string
    activePhase?: number
  }
): void {
  const { enabled = true, localTime = '2026-06-21T12:00' } = options

  const isLayerReady = (id: string) => !!map.getLayer(id)

  if (!isLayerReady(LAYER_SHADOWS_TODAY)) return

  if (!enabled) {
    map.setLayoutProperty(LAYER_SHADOWS_TODAY, 'visibility', 'none')
    return
  }

  // When enabled, update filter and show baseline today shadows
  map.setLayoutProperty(LAYER_SHADOWS_TODAY, 'visibility', 'visible')
  map.setFilter(LAYER_SHADOWS_TODAY, [
    'all',
    ['==', ['get', 'local_time'], localTime],
    ['==', ['get', 'layer'], 'today'],
  ])
}


