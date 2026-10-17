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
  units: number
  stage?: string
  record_date?: string
  kind?: 'proposal' | 'hypothetical'
  footprint?: { type: 'Polygon'; coordinates: [number, number][][] } | null
  footprint_status?: 'sourced' | 'unavailable'
  access?: Array<{ stop_id: string; walk_m: number; status?: string; source_ids?: string[] }>
  source_ids?: string[]
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

export function normalizeDevelopment(dev: any): CorridorDevelopment {
  if (!dev) {
    return {
      dev_id: '',
      pipeline_ref: null,
      address: '',
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
  return {
    dev_id: devId,
    pipeline_ref: dev.pipeline_ref ?? null,
    address: dev.address ?? dev.name ?? devId,
    units: Number(dev.units ?? dev.net_added_units ?? 0),
    stage: dev.stage ?? 'Under Review',
    record_date: dev.record_date ?? '',
    kind: dev.kind ?? 'proposal',
    footprint: dev.footprint ?? null,
    footprint_status: dev.footprint_status ?? (dev.footprint ? 'sourced' : 'unavailable'),
    access: dev.access ?? (dev.accessible_stop_ids ? dev.accessible_stop_ids.map((sId: string) => ({ stop_id: sId, walk_m: 350 })) : []),
    source_ids: dev.source_ids ?? [],
  }
}
