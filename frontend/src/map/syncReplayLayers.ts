import type { Map as MapboxMap } from 'mapbox-gl'
import { updateVehiclePositions } from './MassingLayer'
import { updatePassengerLayers } from './PassengerLayer'
import type { PassengerFrame } from './passengerReplay'
import { updateStreetcarOccupancyMarkers } from './StreetcarOccupancyMarkers'

/** A streaming source need not be idle before receiving its next replay frame. */
export function syncReplayLayers(
  map: MapboxMap,
  vehicles: Parameters<typeof updateVehiclePositions>[1],
  passengers?: PassengerFrame,
): void {
  updateVehiclePositions(map, vehicles)
  updateStreetcarOccupancyMarkers(map, vehicles)
  updatePassengerLayers(map, passengers)
}
