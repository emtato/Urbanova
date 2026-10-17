import { generateDevelopmentsGeoJSON, getDevelopmentCoordinates } from './MassingLayer'

/** Stand just south of the rendered mass, facing it, rather than inside it. */
export function buildingStreetViewLocation(development: unknown): [number, number] {
  const geometry = generateDevelopmentsGeoJSON([development]).features[0]?.geometry
  if (geometry?.type === 'Polygon' && geometry.coordinates[0]?.length) {
    const ring = geometry.coordinates[0]
    const west = Math.min(...ring.map(point => point[0]))
    const east = Math.max(...ring.map(point => point[0]))
    const south = Math.min(...ring.map(point => point[1]))
    return [(west + east) / 2, south - 0.00012]
  }
  const [lon, lat] = getDevelopmentCoordinates(development)
  return [lon, lat - 0.0004]
}
