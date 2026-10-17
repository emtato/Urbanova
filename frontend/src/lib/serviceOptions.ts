/**
 * Extra-service headway options and their costs, from Lane A's A10 data
 * (data/reviewed/interventions.json, copied to src/data). Vehicle and cost
 * arithmetic matches Lane C's package screen and backend/scripts/build_interventions.py:
 *   vehicles = ceil(cycle_s / headway_s); extra = vehicles - today's vehicles;
 *   annual cost = extra × peak hours/day × service days/year × cost per streetcar-hour.
 */
import { reviewedInterventions } from '../data'

type Range = { low: number; central: number; high: number }

const service = reviewedInterventions.service
const extraService = reviewedInterventions.extra_service

export const CYCLE_S = service.cycle_s.value
export const BASELINE_HEADWAY_S = service.baseline_headway_s.value
export const BASELINE_VEHICLES = service.baseline_vehicles
export const PEAK_HOURS = service.peak_hours.value
export const SERVICE_DAYS = service.service_days.value
export const PRICE_YEAR = reviewedInterventions.price_year
export const COST_PER_HOUR: Range = {
  low: extraService.cost_per_hour_cad.low,
  central: extraService.cost_per_hour_cad.central,
  high: extraService.cost_per_hour_cad.high,
}
export const DEFAULT_HEADWAY_S = extraService.default_headway_s
// Custom headways stay between 3 minutes and today's service; cuts would need a savings view.
export const CUSTOM_MIN_S = 180
export const CUSTOM_MAX_S = Math.floor(BASELINE_HEADWAY_S)

export interface HeadwayPreset {
  headway_s: number
  label: string
  detail: string
  current: boolean
}

const minutes = (s: number) => `${Number((s / 60).toFixed(1))} min`

export const HEADWAY_PRESETS: HeadwayPreset[] = [
  { headway_s: BASELINE_HEADWAY_S, label: 'Current', detail: `${Math.round(BASELINE_HEADWAY_S)} s · every ${minutes(BASELINE_HEADWAY_S)}`, current: true },
  ...extraService.headway_options.map(option => ({
    headway_s: option.headway_s,
    label: `${option.headway_s} s`,
    detail: `every ${minutes(option.headway_s)}${option.headway_s === DEFAULT_HEADWAY_S ? ' · default' : ''}`,
    current: false,
  })),
]

export interface ServiceCost {
  headway_s: number
  vehicles: number
  extra_vehicles: number
  extra_vehicle_hours_per_year: number
  annual_operating_cad: Range
  capital_cad: number
  price_year: number
}

/** Round half to even, like Python's round(), so costs match the reviewed data to the dollar. */
function roundHalfEven(value: number): number {
  const floor = Math.floor(value)
  const diff = value - floor
  if (Math.abs(diff - 0.5) > 1e-9) return Math.round(value)
  return floor % 2 === 0 ? floor : floor + 1
}

export function serviceCost(headway_s: number): ServiceCost {
  if (!Number.isFinite(headway_s) || headway_s <= 0) throw Error('Headway must be a positive number of seconds')
  const vehicles = Math.ceil(CYCLE_S / headway_s)
  const extra = Math.max(0, vehicles - BASELINE_VEHICLES)
  const hours = extra * PEAK_HOURS * SERVICE_DAYS
  return {
    headway_s,
    vehicles: Math.max(vehicles, BASELINE_VEHICLES),
    extra_vehicles: extra,
    extra_vehicle_hours_per_year: hours,
    annual_operating_cad: {
      low: roundHalfEven(hours * COST_PER_HOUR.low),
      central: roundHalfEven(hours * COST_PER_HOUR.central),
      high: roundHalfEven(hours * COST_PER_HOUR.high),
    },
    capital_cad: 0,
    price_year: PRICE_YEAR,
  }
}

export function validateCustomHeadway(value: number): string | null {
  if (!Number.isFinite(value)) return 'Enter a headway in seconds'
  if (value < CUSTOM_MIN_S || value > CUSTOM_MAX_S) return `Enter a headway between ${CUSTOM_MIN_S} and ${CUSTOM_MAX_S} seconds`
  return null
}

export const isBaseline = (headway_s: number) => Math.abs(headway_s - BASELINE_HEADWAY_S) < 1e-6

export const formatCad = (value: number) =>
  value >= 1_000_000 ? `$${(value / 1_000_000).toFixed(2)}M` : `$${Math.round(value / 1000)}k`
