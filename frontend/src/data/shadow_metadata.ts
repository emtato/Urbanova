/**
 * shadow_metadata.ts
 *
 * Precomputed solar positions and shadow metric summaries from
 * data/reviewed/shadows.geojson (Contract 1.0.0 / Lane C).
 */

export interface ShadowSlot {
  label: 'spring_equinox' | 'summer_solstice' | 'winter_solstice'
  seasonName: string
  date: string
  timeStr: string // "09:00", "12:00", "15:00", "18:00"
  local_time: string
  utc_offset: string
  sun_altitude_deg: number
  sun_azimuth_deg: number
  sun_up: boolean
  today_m2: number
  added_m2: number
  removed_m2: number
  lightPreset: 'dawn' | 'day' | 'dusk' | 'night'
}

export const SHADOW_SLOTS: ShadowSlot[] = [
  // Spring Equinox (March 20)
  {
    label: 'spring_equinox',
    seasonName: 'Spring Equinox',
    date: '2026-03-20',
    timeStr: '09:00',
    local_time: '2026-03-20T09:00',
    utc_offset: '-0400',
    sun_altitude_deg: 16.94,
    sun_azimuth_deg: 106.94,
    sun_up: true,
    today_m2: 1593561,
    added_m2: 6417,
    removed_m2: 1074,
    lightPreset: 'dawn',
  },
  {
    label: 'spring_equinox',
    seasonName: 'Spring Equinox',
    date: '2026-03-20',
    timeStr: '12:00',
    local_time: '2026-03-20T12:00',
    utc_offset: '-0400',
    sun_altitude_deg: 42.43,
    sun_azimuth_deg: 150.64,
    sun_up: true,
    today_m2: 628935,
    added_m2: 11069,
    removed_m2: 383,
    lightPreset: 'day',
  },
  {
    label: 'spring_equinox',
    seasonName: 'Spring Equinox',
    date: '2026-03-20',
    timeStr: '15:00',
    local_time: '2026-03-20T15:00',
    utc_offset: '-0400',
    sun_altitude_deg: 41.52,
    sun_azimuth_deg: 212.61,
    sun_up: true,
    today_m2: 791602,
    added_m2: 15481,
    removed_m2: 236,
    lightPreset: 'day',
  },
  {
    label: 'spring_equinox',
    seasonName: 'Spring Equinox',
    date: '2026-03-20',
    timeStr: '18:00',
    local_time: '2026-03-20T18:00',
    utc_offset: '-0400',
    sun_altitude_deg: 15.25,
    sun_azimuth_deg: 255.1,
    sun_up: true,
    today_m2: 1303466,
    added_m2: 22201,
    removed_m2: 947,
    lightPreset: 'dusk',
  },

  // Summer Solstice (June 21)
  {
    label: 'summer_solstice',
    seasonName: 'Summer Solstice',
    date: '2026-06-21',
    timeStr: '09:00',
    local_time: '2026-06-21T09:00',
    utc_offset: '-0400',
    sun_altitude_deg: 33.85,
    sun_azimuth_deg: 88.74,
    sun_up: true,
    today_m2: 895343,
    added_m2: 5528,
    removed_m2: 878,
    lightPreset: 'dawn',
  },
  {
    label: 'summer_solstice',
    seasonName: 'Summer Solstice',
    date: '2026-06-21',
    timeStr: '12:00',
    local_time: '2026-06-21T12:00',
    utc_offset: '-0400',
    sun_altitude_deg: 64.03,
    sun_azimuth_deg: 134.7,
    sun_up: true,
    today_m2: 390606,
    added_m2: 6170,
    removed_m2: 207,
    lightPreset: 'day',
  },
  {
    label: 'summer_solstice',
    seasonName: 'Summer Solstice',
    date: '2026-06-21',
    timeStr: '15:00',
    local_time: '2026-06-21T15:00',
    utc_offset: '-0400',
    sun_altitude_deg: 61.09,
    sun_azimuth_deg: 233.79,
    sun_up: true,
    today_m2: 415987,
    added_m2: 8345,
    removed_m2: 140,
    lightPreset: 'day',
  },
  {
    label: 'summer_solstice',
    seasonName: 'Summer Solstice',
    date: '2026-06-21',
    timeStr: '18:00',
    local_time: '2026-06-21T18:00',
    utc_offset: '-0400',
    sun_altitude_deg: 30.0,
    sun_azimuth_deg: 274.82,
    sun_up: true,
    today_m2: 1017942,
    added_m2: 9681,
    removed_m2: 956,
    lightPreset: 'dusk',
  },

  // Winter Solstice (December 21)
  {
    label: 'winter_solstice',
    seasonName: 'Winter Solstice',
    date: '2026-12-21',
    timeStr: '09:00',
    local_time: '2026-12-21T09:00',
    utc_offset: '-0500',
    sun_altitude_deg: 9.31,
    sun_azimuth_deg: 135.53,
    sun_up: true,
    today_m2: 2037472,
    added_m2: 32847,
    removed_m2: 0,
    lightPreset: 'dawn',
  },
  {
    label: 'winter_solstice',
    seasonName: 'Winter Solstice',
    date: '2026-12-21',
    timeStr: '12:00',
    local_time: '2026-12-21T12:00',
    utc_offset: '-0500',
    sun_altitude_deg: 22.81,
    sun_azimuth_deg: 176.11,
    sun_up: true,
    today_m2: 1101717,
    added_m2: 24182,
    removed_m2: 667,
    lightPreset: 'day',
  },
  {
    label: 'winter_solstice',
    seasonName: 'Winter Solstice',
    date: '2026-12-21',
    timeStr: '15:00',
    local_time: '2026-12-21T15:00',
    utc_offset: '-0500',
    sun_altitude_deg: 13.05,
    sun_azimuth_deg: 218.23,
    sun_up: true,
    today_m2: 1783581,
    added_m2: 22137,
    removed_m2: 431,
    lightPreset: 'dusk',
  },
]

export const SEASONS = [
  { id: 'spring_equinox', name: 'Spring Equinox', date: 'Mar 20' },
  { id: 'summer_solstice', name: 'Summer Solstice', date: 'Jun 21' },
  { id: 'winter_solstice', name: 'Winter Solstice', date: 'Dec 21' },
] as const

export const TIMES_OF_DAY = ['09:00', '12:00', '15:00', '18:00'] as const

export function getShadowSlot(label: string, timeStr: string): ShadowSlot | undefined {
  return SHADOW_SLOTS.find((s) => s.label === label && s.timeStr === timeStr)
}
