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
import type { Corridor, Development, Stop } from '../lib/types'
import { corridorMassing, reviewedWalkingRoutes } from '../data'

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

// Layer IDs
export const LAYER_LINKS_CASING = 'layer-links-casing'
export const LAYER_LINKS_CORE = 'layer-links-core'
export const LAYER_WALK_LINKS = 'layer-walk-links'
export const LAYER_BUILDINGS_EXISTING = 'layer-buildings-existing'
export const LAYER_DEVELOPMENTS_EXTRUSION = 'layer-developments-extrusion'
export const LAYER_STOPS_GLOW = 'layer-stops-glow'
export const LAYER_STOPS_CIRCLE = 'layer-stops-circle'
export const LAYER_STOPS_LABEL = 'layer-stops-label'
export const LAYER_VEHICLES = 'layer-vehicles'

/**
 * Loads real City of Toronto corridor building footprint polygons with actual heights,
 * falling back to synthetic perimeter blocks if offline or unbundled.
 */
export function generateSurroundingMassingGeoJSON(corridor?: Corridor): FeatureCollection {
  if (corridorMassing && corridorMassing.features && corridorMassing.features.length > 0) {
    return corridorMassing as unknown as FeatureCollection
  }

  const features: Feature[] = []
  if (corridor && corridor.stops) {
    corridor.stops.forEach((stop, i) => {
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
  'toronto-app-22-124214-ste-13-oz': [-79.3727167, 43.6577766], // 239 Dundas St E (630 units)
  'toronto-app-26-122451-ste-13-oz': [-79.3642039, 43.6600907], // 500 Dundas St E (413 units)
  'toronto-app-25-236949-ste-13-oz': [-79.3563946, 43.6612908], // 761 Dundas St E (1197 units)
}

export const DEV_PHASES: Record<string, number> = {
  'toronto-app-22-124214-ste-13-oz': 1,
  'toronto-app-26-122451-ste-13-oz': 2,
  'toronto-app-25-236949-ste-13-oz': 2,
}

export function getDevelopmentCoordinates(dev: Development): [number, number] {
  if (dev.footprint && dev.footprint.coordinates[0]?.[0]) {
    return dev.footprint.coordinates[0][0]
  }
  return DEV_COORDINATES[dev.dev_id] || [-79.365, 43.660]
}

export function getDevelopmentPhase(dev: Development): number {
  return DEV_PHASES[dev.dev_id] || 2
}

/**
 * Builds GeoJSON features for development proposal towers
 */
export function generateDevelopmentsGeoJSON(developments: Development[]): FeatureCollection {
  const features: Feature[] = developments.map((dev) => {
    const [lon, lat] = getDevelopmentCoordinates(dev)
    const phase = getDevelopmentPhase(dev)
    const size = 0.0006 // ~45m x 45m footprint
    const height_m = Math.round(Math.max(45, Math.min(180, dev.units * 0.12)))

    return {
      type: 'Feature',
      properties: {
        dev_id: dev.dev_id,
        name: dev.address,
        units: dev.units,
        stage: dev.stage,
        phase: phase,
        height_m: height_m,
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
    }
  })

  return { type: 'FeatureCollection', features }
}

/**
 * Builds walking connection lines from developments to accessible stops.
 * Uses official surveyed OSM pedestrian routes if available.
 */
export function generateWalkCatchmentsGeoJSON(
  developments: Development[],
  stops: Stop[]
): FeatureCollection {
  if (reviewedWalkingRoutes && reviewedWalkingRoutes.features && reviewedWalkingRoutes.features.length > 0) {
    const devMap = new Map<string, Development>(developments.map((d) => [d.dev_id, d]))
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

  const stopMap = new Map<string, Stop>(stops.map((s) => [s.stop_id, s]))
  const features: Feature[] = []

  developments.forEach((dev) => {
    const coords = getDevelopmentCoordinates(dev)
    const phase = getDevelopmentPhase(dev)
    dev.access.forEach((acc) => {
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
 * Builds corridor track alignment line GeoJSON
 */
export function generateCorridorLinksGeoJSON(corridor: Corridor): FeatureCollection {
  const coordinates: [number, number][] = []

  // Connect sequential stops
  for (let i = 0; i < corridor.stops.length; i++) {
    coordinates.push([corridor.stops[i].lon, corridor.stops[i].lat])
  }

  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { corridor_id: corridor.corridor_id, name: `Route ${corridor.route_pattern} (${corridor.direction})` },
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
export function generateCorridorStopsGeoJSON(stops: Stop[]): FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: stops.map((s) => ({
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
  corridor: Corridor,
  developments: Development[]
): void {
  // 1. Existing Background Buildings (Quiet slate 3D extrusions)
  const surroundingMassing = generateSurroundingMassingGeoJSON(corridor)
  if (!map.getSource(SOURCE_BUILDINGS)) {
    map.addSource(SOURCE_BUILDINGS, { type: 'geojson', data: surroundingMassing })
    map.addLayer({
      id: LAYER_BUILDINGS_EXISTING,
      type: 'fill-extrusion',
      source: SOURCE_BUILDINGS,
      slot: 'top',
      paint: {
        'fill-extrusion-color': '#1e293b',
        'fill-extrusion-height': ['get', 'height_m'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.85,
      },
    } as AnyLayer)
  }

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
        'fill-extrusion-color': [
          'match',
          ['get', 'phase'],
          1, '#06b6d4', // Phase 1 Cyan
          2, '#f59e0b', // Phase 2 Amber
          '#8b5cf6'      // Default purple
        ],
        'fill-extrusion-height': ['get', 'height_m'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.95,
      },
    } as AnyLayer)
  }

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

    map.addLayer({
      id: LAYER_VEHICLES,
      type: 'circle',
      source: SOURCE_VEHICLES,
      slot: 'top',
      paint: {
        'circle-radius': 8,
        'circle-color': '#3b82f6', // Streetcar Blue
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    } as AnyLayer)
  }
}

/**
 * Toggles visibility or height of developments based on the active planning phase.
 * Today = 0 (no new towers, show original baseline buildings)
 * Phase 1 = 1 (Phase 1 Cyan tower replaces 239 Dundas parcel)
 * Phase 2 = 2 (Phase 1 + 2 towers replace 239, 500, and 761 Dundas parcels)
 */
export function updateDevelopmentsPhase(map: MapboxMap, activePhase: number): void {
  // 1. Proposed Development Towers
  if (map.getLayer(LAYER_DEVELOPMENTS_EXTRUSION)) {
    if (activePhase === 0) {
      map.setFilter(LAYER_DEVELOPMENTS_EXTRUSION, ['==', ['get', 'phase'], -1])
    } else {
      map.setFilter(LAYER_DEVELOPMENTS_EXTRUSION, ['<=', ['get', 'phase'], activePhase])
    }
  }

  // 2. Overwrite / hide baseline buildings on development parcels when phase is active
  if (map.getLayer(LAYER_BUILDINGS_EXISTING)) {
    if (activePhase === 0) {
      map.setFilter(LAYER_BUILDINGS_EXISTING, null)
    } else if (activePhase === 1) {
      map.setFilter(LAYER_BUILDINGS_EXISTING, [
        '!',
        ['in', ['get', 'id'], ['literal', OVERWRITTEN_BASE_BUILDING_IDS_P1]],
      ])
    } else {
      map.setFilter(LAYER_BUILDINGS_EXISTING, [
        '!',
        [
          'in',
          ['get', 'id'],
          ['literal', [...OVERWRITTEN_BASE_BUILDING_IDS_P1, ...OVERWRITTEN_BASE_BUILDING_IDS_P2]],
        ],
      ])
    }
  }

  // 3. Walk catchments follow active phase
  if (map.getLayer(LAYER_WALK_LINKS)) {
    if (activePhase === 0) {
      map.setFilter(LAYER_WALK_LINKS, ['==', ['get', 'phase'], -1])
    } else {
      map.setFilter(LAYER_WALK_LINKS, ['<=', ['get', 'phase'], activePhase])
    }
  }
}

/**
 * Dynamically updates all corridor map sources when data changes
 */
export function updateCorridorMapData(
  map: MapboxMap,
  corridor: Corridor,
  developments: Development[]
): void {
  const buildingsSrc = map.getSource(SOURCE_BUILDINGS) as GeoJSONSource | undefined
  if (buildingsSrc) {
    buildingsSrc.setData(generateSurroundingMassingGeoJSON(corridor))
  }

  const walkSrc = map.getSource(SOURCE_WALK_LINKS) as GeoJSONSource | undefined
  if (walkSrc) {
    walkSrc.setData(generateWalkCatchmentsGeoJSON(developments, corridor.stops))
  }

  const devSrc = map.getSource(SOURCE_DEVELOPMENTS) as GeoJSONSource | undefined
  if (devSrc) {
    devSrc.setData(generateDevelopmentsGeoJSON(developments))
  }

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
  vehicles: Array<{ vehicle_id: string; lon: number; lat: number; load: number }>
): void {
  const source = map.getSource(SOURCE_VEHICLES) as GeoJSONSource | undefined
  if (!source) return

  const features: Feature[] = vehicles.map((v) => ({
    type: 'Feature',
    properties: { vehicle_id: v.vehicle_id, load: v.load },
    geometry: { type: 'Point', coordinates: [v.lon, v.lat] },
  }))

  source.setData({ type: 'FeatureCollection', features })
}


