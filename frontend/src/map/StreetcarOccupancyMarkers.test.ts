import { expect, it } from 'vitest'
import { occupancyRadius } from './StreetcarOccupancyMarkers'

it('scales the on-car circle by percentage full, including a visible empty-car circle', () => {
  expect(occupancyRadius(0, 130)).toBe(5)
  expect(occupancyRadius(65, 130)).toBe(14.5)
  expect(occupancyRadius(130, 130)).toBe(24)
  expect(occupancyRadius(65, 130)).toBe(occupancyRadius(30, 60))
  expect(occupancyRadius(200, 130)).toBe(24)
  expect(occupancyRadius(null, 130)).toBeNull()
})
