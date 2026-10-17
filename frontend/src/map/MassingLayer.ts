/**
 * MassingLayer.ts (Lane D3)
 *
 * Manages MapLibre 3D extruded building massing, corridor route alignment,
 * stops, walking catchments, and vehicle positions.
 *
 * Reusable module designed so WalkMode (4.1) reuses every layer directly.
 */

import type { Map as MapLibreMap, GeoJSONSource } from 'maplibre-gl'
import type { Feature, FeatureCollection } from 'geojson'
import type { Corridor, Development, Stop } from '../lib/types'

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
 * Creates surrounding city building footprint polygons around Dundas Street
 * for realistic background 3D context.
 */
export function generateSurroundingMassingGeoJSON(corridor: Corridor): FeatureCollection {
  const features: Feature[] = []

  // Generate synthetic perimeter blocks along the corridor stops
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

  return { type: 'FeatureCollection', features }
}

/**
 * Builds GeoJSON features for development proposal towers
 */
export function generateDevelopmentsGeoJSON(developments: Development[]): FeatureCollection {
  const features: Feature[] = developments.map((dev) => {
    const [lon, lat] = dev.coordinates
    const size = 0.0008 // roughly 60m x 60m tower footprint

    return {
      type: 'Feature',
      properties: {
        dev_id: dev.dev_id,
        name: dev.address,
        units: dev.units,
        stage: dev.stage,
        phase: dev.phase,
        height_m: dev.height_m || Math.max(35, Math.min(180, dev.units * 0.18)),
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
 * Builds walking connection lines from developments to accessible stops
 */
export function generateWalkCatchmentsGeoJSON(
  developments: Development[],
  stops: Stop[]
): FeatureCollection {
  const stopMap = new Map<string, Stop>(stops.map((s) => [s.stop_id, s]))
  const features: Feature[] = []

  developments.forEach((dev) => {
    dev.access.forEach((acc) => {
      const stop = stopMap.get(acc.stop_id)
      if (stop) {
        features.push({
          type: 'Feature',
          properties: {
            dev_id: dev.dev_id,
            stop_id: stop.stop_id,
            walk_m: acc.walk_m,
            phase: dev.phase,
          },
          geometry: {
            type: 'LineString',
            coordinates: [dev.coordinates, [stop.lon, stop.lat]],
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
        properties: { corridor_id: corridor.corridor_id, name: corridor.name },
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
  map: MapLibreMap,
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
      paint: {
        'fill-extrusion-color': '#2a374a',
        'fill-extrusion-height': ['get', 'height_m'],
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.65,
      },
    })
  }

  // 2. Walking Catchment Connectors (Dashed paths)
  const walkCatchments = generateWalkCatchmentsGeoJSON(developments, corridor.stops)
  if (!map.getSource(SOURCE_WALK_LINKS)) {
    map.addSource(SOURCE_WALK_LINKS, { type: 'geojson', data: walkCatchments })
    map.addLayer({
      id: LAYER_WALK_LINKS,
      type: 'line',
      source: SOURCE_WALK_LINKS,
      paint: {
        'line-color': '#06b6d4',
        'line-width': 2,
        'line-dasharray': [2, 3],
        'line-opacity': 0.75,
      },
    })
  }

  // 3. Proposed Development Towers (Luminous, non-approved design stylings)
  const devFeatures = generateDevelopmentsGeoJSON(developments)
  if (!map.getSource(SOURCE_DEVELOPMENTS)) {
    map.addSource(SOURCE_DEVELOPMENTS, { type: 'geojson', data: devFeatures })
    map.addLayer({
      id: LAYER_DEVELOPMENTS_EXTRUSION,
      type: 'fill-extrusion',
      source: SOURCE_DEVELOPMENTS,
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
        'fill-extrusion-opacity': 0.92,
      },
    })
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
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': 'rgba(239, 68, 68, 0.45)', // TTC red glow
        'line-width': 8,
        'line-blur': 2,
      },
    })

    // Center active track line
    map.addLayer({
      id: LAYER_LINKS_CORE,
      type: 'line',
      source: SOURCE_CORRIDOR_LINKS,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#ef4444', // TTC Red
        'line-width': 3.5,
      },
    })
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
      paint: {
        'circle-radius': 11,
        'circle-color': '#06b6d4',
        'circle-opacity': 0.35,
      },
    })

    // Inner crisp circle
    map.addLayer({
      id: LAYER_STOPS_CIRCLE,
      type: 'circle',
      source: SOURCE_CORRIDOR_STOPS,
      paint: {
        'circle-radius': 6,
        'circle-color': '#ffffff',
        'circle-stroke-width': 2,
        'circle-stroke-color': '#0f172a',
      },
    })

    // Stop Labels (without hardcoded fonts so it resolves against any base style glyphs)
    map.addLayer({
      id: LAYER_STOPS_LABEL,
      type: 'symbol',
      source: SOURCE_CORRIDOR_STOPS,
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
    })
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
      paint: {
        'circle-radius': 8,
        'circle-color': '#3b82f6', // Streetcar Blue
        'circle-stroke-width': 2.5,
        'circle-stroke-color': '#ffffff',
      },
    })
  }
}

/**
 * Toggles visibility or height of developments based on the active planning phase.
 * Today = 0 (no new towers), Phase 1 = 1 (Phase 1 towers), Phase 2 = 2 (Phase 1 + 2 towers)
 */
export function updateDevelopmentsPhase(map: MapLibreMap, activePhase: number): void {
  if (!map.getLayer(LAYER_DEVELOPMENTS_EXTRUSION)) return

  if (activePhase === 0) {
    // Today: Hide proposed developments
    map.setFilter(LAYER_DEVELOPMENTS_EXTRUSION, ['==', ['get', 'phase'], -1])
  } else {
    // Show developments up to activePhase
    map.setFilter(LAYER_DEVELOPMENTS_EXTRUSION, ['<=', ['get', 'phase'], activePhase])
  }
}

/**
 * Updates positions of simulated moving streetcars on the map
 */
export function updateVehiclePositions(
  map: MapLibreMap,
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
