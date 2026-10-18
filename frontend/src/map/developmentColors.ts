import { normalizeDevelopment } from './types'

export const DEVELOPMENT_COLORS = {
  cyan: { tone: 'cyan', dark: '#0e7490', light: '#67e8f9' },
  orange: { tone: 'orange', dark: '#c2410c', light: '#fdba74' },
  purple: { tone: 'purple', dark: '#6d28d9', light: '#c4b5fd' },
} as const

/** One palette for each building, shared by its map rendering and toggle. */
export function getDevelopmentColors(value: unknown) {
  const dev = normalizeDevelopment(value)
  const address = `${dev.address} ${dev.name}`
  if (dev.dev_id === 'toronto-app-22-124214-ste-13-oz' ||
      dev.dev_id === 'fixture-development-1' || /239.*dundas/i.test(address)) {
    return DEVELOPMENT_COLORS.cyan
  }
  if (dev.dev_id === 'toronto-app-26-122451-ste-13-oz' ||
      dev.dev_id === 'fixture-development-2' || /500.*dundas/i.test(address)) {
    return DEVELOPMENT_COLORS.orange
  }
  return DEVELOPMENT_COLORS.purple
}

export function developmentExtrusionColor(selectedId?: string | null): [string, ...unknown[]] {
  return [
    'case',
    ['==', ['get', 'tier'], 'model'], 'rgba(0, 0, 0, 0)',
    ['==', ['get', 'dev_id'], selectedId ?? ''],
    ['coalesce', ['get', 'color_light'], DEVELOPMENT_COLORS.purple.light],
    ['coalesce', ['get', 'color_dark'], DEVELOPMENT_COLORS.purple.dark],
  ]
}
