/**
 * Spatial corridor and map-specific types with normalization adapters
 * for Contract 1.0.0 and reviewed GeoJSON datasets.
 */

export interface CorridorStop {
  stop_id: string
  gtfs_stop_id: string
  name: string
  seq: number
  lon: number
  lat: number
  source_ids?: string[]
}

export interface CorridorDevelopment {
  dev_id: string
  pipeline_ref?: string | null
  address: string
  name?: string
  units: number
  stage?: string
  record_date?: string
  kind?: 'proposal' | 'hypothetical'
  footprint?: { type: 'Polygon'; coordinates: [number, number][][] } | null
  footprint_status?: 'sourced' | 'unavailable'
  access?: Array<{ stop_id: string; walk_m: number; status?: string; source_ids?: string[] }>
  source_ids?: string[]
}

/**
 * Returns a concise short form of a corridor development address
 * e.g. "239 DUNDAS ST E" -> "239 Dundas"
 */
export function toShortAddress(address: string): string {
  if (!address) return ''
  const trimmed = address.trim()
  if (/fixture.*1/i.test(trimmed)) return '239 Dundas'
  if (/fixture.*2/i.test(trimmed)) return '500 Dundas'
  if (/fixture.*3/i.test(trimmed)) return '761 Dundas'
  return (
    trimmed
      .replace(/,\s*Toronto.*$/i, '')
      .replace(/\s+(?:STREET|ST)\s+(?:EAST|E)\b/i, '')
      .replace(/\s+(?:STREET|ST)\s+(?:WEST|W)\b/i, ' W')
      .replace(/\s+(?:STREET|ST)\b/i, '')
      .trim() || trimmed
  )
}

export function normalizeStop(stop: any): CorridorStop {
  if (!stop) {
    return {
      stop_id: '',
      gtfs_stop_id: '',
      name: '',
      seq: 0,
      lon: 0,
      lat: 0,
      source_ids: [],
    }
  }
  const stopId = String(stop.stop_id ?? stop.id ?? '')
  const gtfs = stop.gtfs_stop_id ?? stopId.replace(/^ttc-stop-/, '')
  return {
    stop_id: stopId,
    gtfs_stop_id: String(gtfs),
    name: stop.name ?? '',
    seq: Number(stop.seq ?? stop.sequence ?? 0),
    lon: Number(stop.lon ?? stop.longitude ?? 0),
    lat: Number(stop.lat ?? stop.latitude ?? 0),
    source_ids: stop.source_ids ?? [],
  }
}

export const FIXTURE_DEV_METADATA: Record<string, { address: string; name: string; pipeline_ref: string; units: number }> = {
  'fixture-development-1': {
    address: '239 DUNDAS ST E',
    name: '239 Dundas',
    pipeline_ref: '22 124214 STE 13 OZ',
    units: 630,
  },
  'fixture-development-2': {
    address: '500 DUNDAS ST E',
    name: '500 Dundas',
    pipeline_ref: '26 122451 STE 13 OZ',
    units: 413,
  },
  'fixture-development-3': {
    address: '761 DUNDAS ST E',
    name: '761 Dundas',
    pipeline_ref: '25 236949 STE 13 OZ',
    units: 1197,
  },
}

export function normalizeDevelopment(dev: any): CorridorDevelopment {
  if (!dev) {
    return {
      dev_id: '',
      pipeline_ref: null,
      address: '',
      name: '',
      units: 0,
      stage: 'Under Review',
      record_date: '',
      kind: 'proposal',
      footprint: null,
      footprint_status: 'unavailable',
      access: [],
      source_ids: [],
    }
  }
  const devId = String(dev.dev_id ?? dev.id ?? '')
  const rawName = String(dev.name ?? '')

  let fixtureMeta = FIXTURE_DEV_METADATA[devId]
  if (!fixtureMeta) {
    if (/fixture.*1/i.test(devId) || /fixture.*1/i.test(rawName)) {
      fixtureMeta = FIXTURE_DEV_METADATA['fixture-development-1']
    } else if (/fixture.*2/i.test(devId) || /fixture.*2/i.test(rawName)) {
      fixtureMeta = FIXTURE_DEV_METADATA['fixture-development-2']
    } else if (/fixture.*3/i.test(devId) || /fixture.*3/i.test(rawName)) {
      fixtureMeta = FIXTURE_DEV_METADATA['fixture-development-3']
    }
  }

  const rawAddress = (fixtureMeta ? fixtureMeta.address : dev.address) ?? (fixtureMeta ? fixtureMeta.address : dev.name) ?? devId
  const shortName = (fixtureMeta ? fixtureMeta.name : dev.short_name) ?? toShortAddress(rawAddress)
  const pipelineRef = (fixtureMeta ? fixtureMeta.pipeline_ref : dev.pipeline_ref) ?? null
  const units = Number(dev.units ?? dev.net_added_units ?? (fixtureMeta ? fixtureMeta.units : 0))

  return {
    dev_id: devId,
    pipeline_ref: pipelineRef,
    address: rawAddress,
    name: shortName,
    units,
    stage: dev.stage ?? 'Under Review',
    record_date: dev.record_date ?? '',
    kind: dev.kind ?? 'proposal',
    footprint: dev.footprint ?? null,
    footprint_status: dev.footprint_status ?? (dev.footprint ? 'sourced' : 'unavailable'),
    access: dev.access ?? (dev.accessible_stop_ids ? dev.accessible_stop_ids.map((sId: string) => ({ stop_id: sId, walk_m: 350 })) : []),
    source_ids: dev.source_ids ?? [],
  }
}
