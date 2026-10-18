import type { Map as MapboxMap, GeoJSONSource, AnyLayer } from 'mapbox-gl'
import type { FeatureCollection } from 'geojson'
import type { PassengerFrame } from './passengerReplay'

export const SOURCE_WALKING_PASSENGERS = 'source-walking-passengers'
export const SOURCE_PASSENGER_QUEUES = 'source-passenger-queues'
export const LAYER_WALKING_PASSENGERS = 'layer-walking-passengers'
export const LAYER_PASSENGER_QUEUES = 'layer-passenger-queues'

export function setupPassengerLayers(map: MapboxMap): void {
  for (const [source, layer, queue] of [
    [SOURCE_WALKING_PASSENGERS, LAYER_WALKING_PASSENGERS, false],
    [SOURCE_PASSENGER_QUEUES, LAYER_PASSENGER_QUEUES, true],
  ] as const) {
    if (!map.getSource(source)) {
      map.addSource(source, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
    }
    if (!map.getLayer(layer)) {
      map.addLayer({
        id: layer, type: 'circle', source, slot: 'top',
        paint: {
          'circle-color': '#000000',
          'circle-radius': queue ? 6 : 2.5,
          'circle-opacity': queue ? ['get', 'opacity'] : 0.35,
          'circle-blur': 0.1,
          'circle-pitch-alignment': 'map',
        },
      } as AnyLayer)
    }
  }
}

export function updatePassengerLayers(map: MapboxMap, frame?: PassengerFrame): void {
  const walking = map.getSource(SOURCE_WALKING_PASSENGERS) as GeoJSONSource | undefined
  const queues = map.getSource(SOURCE_PASSENGER_QUEUES) as GeoJSONSource | undefined
  const walkerData: FeatureCollection = {
    type: 'FeatureCollection',
    features: (frame?.walkers ?? []).map(p => ({
      type: 'Feature', id: p.id, properties: { passenger_id: p.id },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })),
  }
  const queueData: FeatureCollection = {
    type: 'FeatureCollection',
    features: (frame?.queues ?? []).map(p => ({
      type: 'Feature', id: p.stop_id,
      properties: { stop_id: p.stop_id, count: p.count, opacity: p.opacity },
      geometry: { type: 'Point', coordinates: [p.lon, p.lat] },
    })),
  }
  walking?.setData(walkerData)
  queues?.setData(queueData)
}
