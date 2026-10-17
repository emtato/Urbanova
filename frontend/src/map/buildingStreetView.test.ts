import { describe, expect, it } from 'vitest'
import { buildingStreetViewLocation } from './buildingStreetView'
import { generateDevelopmentsGeoJSON } from './MassingLayer'
import { mapProposals } from './proposals'

describe('building eye-level destination', () => {
  it('stands outside the rendered building mass for all three proposals', () => {
    for (const proposal of mapProposals([])) {
      const point = buildingStreetViewLocation(proposal)
      const geometry = generateDevelopmentsGeoJSON([proposal]).features[0].geometry
      expect(geometry.type).toBe('Polygon')
      if (geometry.type !== 'Polygon') throw new Error('Expected a rendered proposal footprint')
      const ring = geometry.coordinates[0]
      expect(point[1]).toBeLessThan(Math.min(...ring.map(value => value[1])))
      expect(point[0]).toBeGreaterThanOrEqual(Math.min(...ring.map(value => value[0])))
      expect(point[0]).toBeLessThanOrEqual(Math.max(...ring.map(value => value[0])))
    }
  })
})
