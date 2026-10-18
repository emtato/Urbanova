import mapboxgl, { type Map as MapboxMap, type Marker } from 'mapbox-gl'

interface Vehicle {
  vehicle_id: string
  lon: number
  lat: number
  load?: number | null
  capacity?: number
}

export function occupancyRadius(load?: number | null, capacity?: number): number | null {
  if (typeof load !== 'number' || !Number.isFinite(load) ||
      typeof capacity !== 'number' || !Number.isFinite(capacity) || capacity <= 0) return null
  return 5 + 19 * Math.max(0, Math.min(1, load / capacity))
}

const markers = new WeakMap<MapboxMap, Map<string, Marker>>()

/** Screen overlays sit on the car roof instead of being hidden beneath its GLB. */
export function updateStreetcarOccupancyMarkers(map: MapboxMap, vehicles: Vehicle[]): void {
  if (typeof document === 'undefined') return
  let current = markers.get(map)
  if (!current) {
    current = new Map()
    markers.set(map, current)
    const ownedMarkers = current
    map.once('remove', () => {
      for (const marker of ownedMarkers.values()) marker.remove()
      markers.delete(map)
    })
  }
  const visible = new Set<string>()
  for (const vehicle of vehicles) {
    const radius = occupancyRadius(vehicle.load, vehicle.capacity)
    if (radius === null) continue
    visible.add(vehicle.vehicle_id)
    let marker = current.get(vehicle.vehicle_id)
    if (!marker) {
      const element = document.createElement('div')
      element.dataset.streetcarOccupancy = vehicle.vehicle_id
      element.setAttribute('role', 'button')
      element.tabIndex = 0
      element.setAttribute('aria-label', `Show passengers on streetcar ${vehicle.vehicle_id}`)
      element.style.cssText = 'pointer-events:auto;cursor:pointer;border-radius:50%;background:rgba(0,0,0,0.35);'
      marker = new mapboxgl.Marker({
        element, anchor: 'center', altitude: 4,
        pitchAlignment: 'viewport', rotationAlignment: 'viewport', occludedOpacity: 1,
      }).setLngLat([vehicle.lon, vehicle.lat]).addTo(map)
      current.set(vehicle.vehicle_id, marker)
    }
    const element = marker.getElement()
    element.style.width = `${radius * 2}px`
    element.style.height = `${radius * 2}px`
    marker.setLngLat([vehicle.lon, vehicle.lat])
  }
  for (const [id, marker] of current) {
    if (!visible.has(id)) { marker.remove(); current.delete(id) }
  }
}
