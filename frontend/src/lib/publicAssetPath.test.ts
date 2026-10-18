import { afterEach, expect, it, vi } from 'vitest'
import { publicAssetPath } from './publicAssetPath'

afterEach(() => vi.unstubAllEnvs())

it('keeps models and passenger routes inside the GitHub Pages repository path', () => {
  vi.stubEnv('BASE_URL', '/HTV2026-rename-later-/')
  for (const file of ['models/flexity_outlook.glb', 'models/dundas_761.mapbox.glb',
    'models/dundas_500.mapbox.glb', 'data/simulation_walking_routes.geojson', 'data/shadows.geojson']) {
    const path = publicAssetPath(file)
    expect(path).toBe(`/HTV2026-rename-later-/${file}`)
    expect(new URL(path, 'https://emtato.github.io/HTV2026-rename-later-/#/map').href)
      .toBe(`https://emtato.github.io/HTV2026-rename-later-/${file}`)
  }
})

it('supports root and relative deployments without duplicate slashes', () => {
  vi.stubEnv('BASE_URL', '/')
  expect(publicAssetPath('/models/car.glb')).toBe('/models/car.glb')
  vi.stubEnv('BASE_URL', './')
  expect(new URL(publicAssetPath('models/car.glb'), 'http://localhost:5173/map').href)
    .toBe('http://localhost:5173/models/car.glb')
})
