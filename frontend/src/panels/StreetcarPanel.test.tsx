import { expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { StreetcarPanel } from './StreetcarPanel'

const render = (vehicle?: { load?: number | null; capacity?: number }) => renderToString(
  <StreetcarPanel vehicleId="car-7" vehicle={vehicle} onClose={() => {}} />,
).replace(/<!--.*?-->/g, '')

it('shows current occupancy and capacity as the replay changes, including empty cars', () => {
  expect(render({ load: 65, capacity: 130 })).toContain('65 / 130')
  expect(render({ load: 65, capacity: 130 })).toContain('50% full')
  expect(render({ load: 0, capacity: 130 })).toContain('0 / 130')
  expect(render({ load: 130, capacity: 130 })).toContain('100% full')
})

it('distinguishes missing history and inactive cars from empty streetcars', () => {
  expect(render({ load: null, capacity: 130 })).toContain('— / 130')
  expect(render({ load: null, capacity: 130 })).toContain('Passenger history unavailable')
  expect(render()).toContain('Streetcar is not active at this replay time')
  expect(render()).toContain('Close streetcar details')
})
