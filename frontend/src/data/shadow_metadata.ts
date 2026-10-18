/**
 * shadow_metadata.ts
 *
 * Precomputed solar positions and shadow metric summaries from
 * data/reviewed/shadows.geojson (Contract 1.0.0 / Lane C).
 */

export type SeasonId = 'spring_equinox' | 'summer_solstice' | 'autumn_equinox' | 'winter_solstice'
export type TimeOfDayId = 'morning' | 'noon' | 'afternoon' | 'night'

export interface ShadowSlot {
  label: SeasonId
  seasonName: string // "Spring", "Summer", "Fall", "Winter"
  subName?: string // "Spring Equinox", "Summer Solstice", etc.
  date: string
  timeId: TimeOfDayId
  timeLabel: string // "Morning", "Noon", "Afternoon", "Night"
  timeStr: string // "09:00", "12:00", "15:00", "18:00"
  clockTime: string // "9:00 AM", "12:00 PM", "3:00 PM", "Night"
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

export interface SeasonOption {
  id: SeasonId
  name: string
  subName: string
  date: string
  icon: string
}

export const SEASONS: readonly SeasonOption[] = [
  { id: 'spring_equinox', name: 'Spring', subName: 'Spring Equinox', date: 'Mar 20', icon: '🌱' },
  { id: 'summer_solstice', name: 'Summer', subName: 'Summer Solstice', date: 'Jun 21', icon: '☀️' },
  { id: 'autumn_equinox', name: 'Fall', subName: 'Autumn Equinox', date: 'Sep 22', icon: '🍂' },
  { id: 'winter_solstice', name: 'Winter', subName: 'Winter Solstice', date: 'Dec 21', icon: '❄️' },
] as const

export interface TimeStep {
  id: TimeOfDayId
  label: string
  clockTime: string
  timeStr: string
  icon: string
}

export const TIME_STEPS: readonly TimeStep[] = [
  { id: 'morning', label: 'Morning', clockTime: 'Morning', timeStr: '09:00', icon: '🌅' },
  { id: 'noon', label: 'Noon', clockTime: 'Noon', timeStr: '12:00', icon: '☀️' },
  { id: 'afternoon', label: 'Afternoon', clockTime: 'Afternoon', timeStr: '17:40', icon: '🌇' },
  { id: 'night', label: 'Night', clockTime: 'Night', timeStr: '22:00', icon: '🌙' },
] as const

// Backwards compatibility with any legacy imports
export const TIMES_OF_DAY = ['09:00', '12:00', '15:00', '18:00'] as const

export const SHADOW_SLOTS: ShadowSlot[] = [
  // --- Spring Equinox (March 20) ---
  {
    label: 'spring_equinox',
    seasonName: 'Spring',
    subName: 'Spring Equinox',
    date: '2026-03-20',
    timeId: 'morning',
    timeLabel: 'Morning',
    timeStr: '09:00',
    clockTime: 'Morning',
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
    seasonName: 'Spring',
    subName: 'Spring Equinox',
    date: '2026-03-20',
    timeId: 'noon',
    timeLabel: 'Noon',
    timeStr: '12:00',
    clockTime: 'Noon',
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
    seasonName: 'Spring',
    subName: 'Spring Equinox',
    date: '2026-03-20',
    timeId: 'afternoon',
    timeLabel: 'Afternoon',
    timeStr: '17:40',
    clockTime: 'Afternoon',
    local_time: '2026-03-20T17:40',
    utc_offset: '-0400',
    sun_altitude_deg: 18.71,
    sun_azimuth_deg: 251.32,
    sun_up: true,
    today_m2: 1118870,
    added_m2: 25187,
    removed_m2: 627,
    lightPreset: 'dusk',
  },
  {
    label: 'spring_equinox',
    seasonName: 'Spring',
    subName: 'Spring Equinox',
    date: '2026-03-20',
    timeId: 'night',
    timeLabel: 'Night',
    timeStr: '22:00',
    clockTime: 'Night',
    local_time: '2026-03-20T22:00',
    utc_offset: '-0400',
    sun_altitude_deg: -25.0,
    sun_azimuth_deg: 310.0,
    sun_up: false,
    today_m2: 0,
    added_m2: 0,
    removed_m2: 0,
    lightPreset: 'night',
  },

  // --- Summer Solstice (June 21) ---
  {
    label: 'summer_solstice',
    seasonName: 'Summer',
    subName: 'Summer Solstice',
    date: '2026-06-21',
    timeId: 'morning',
    timeLabel: 'Morning',
    timeStr: '09:00',
    clockTime: 'Morning',
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
    seasonName: 'Summer',
    subName: 'Summer Solstice',
    date: '2026-06-21',
    timeId: 'noon',
    timeLabel: 'Noon',
    timeStr: '12:00',
    clockTime: 'Noon',
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
    seasonName: 'Summer',
    subName: 'Summer Solstice',
    date: '2026-06-21',
    timeId: 'afternoon',
    timeLabel: 'Afternoon',
    timeStr: '17:40',
    clockTime: 'Afternoon',
    local_time: '2026-06-21T17:40',
    utc_offset: '-0400',
    sun_altitude_deg: 33.61,
    sun_azimuth_deg: 271.49,
    sun_up: true,
    today_m2: 905308,
    added_m2: 8318,
    removed_m2: 897,
    lightPreset: 'dusk',
  },
  {
    label: 'summer_solstice',
    seasonName: 'Summer',
    subName: 'Summer Solstice',
    date: '2026-06-21',
    timeId: 'night',
    timeLabel: 'Night',
    timeStr: '22:00',
    clockTime: 'Night',
    local_time: '2026-06-21T22:00',
    utc_offset: '-0400',
    sun_altitude_deg: -15.0,
    sun_azimuth_deg: 325.0,
    sun_up: false,
    today_m2: 0,
    added_m2: 0,
    removed_m2: 0,
    lightPreset: 'night',
  },

  // --- Fall / Autumn Equinox (September 22) ---
  {
    label: 'autumn_equinox',
    seasonName: 'Fall',
    subName: 'Autumn Equinox',
    date: '2026-09-22',
    timeId: 'morning',
    timeLabel: 'Morning',
    timeStr: '09:00',
    clockTime: 'Morning',
    local_time: '2026-09-22T09:00',
    utc_offset: '-0400',
    sun_altitude_deg: 19.61,
    sun_azimuth_deg: 109.6,
    sun_up: true,
    today_m2: 1479982,
    added_m2: 7647,
    removed_m2: 763,
    lightPreset: 'dawn',
  },
  {
    label: 'autumn_equinox',
    seasonName: 'Fall',
    subName: 'Autumn Equinox',
    date: '2026-09-22',
    timeId: 'noon',
    timeLabel: 'Noon',
    timeStr: '12:00',
    clockTime: 'Noon',
    local_time: '2026-09-22T12:00',
    utc_offset: '-0400',
    sun_altitude_deg: 43.74,
    sun_azimuth_deg: 155.35,
    sun_up: true,
    today_m2: 565199,
    added_m2: 10484,
    removed_m2: 387,
    lightPreset: 'day',
  },
  {
    label: 'autumn_equinox',
    seasonName: 'Fall',
    subName: 'Autumn Equinox',
    date: '2026-09-22',
    timeId: 'afternoon',
    timeLabel: 'Afternoon',
    timeStr: '17:40',
    clockTime: 'Afternoon',
    local_time: '2026-09-22T17:40',
    utc_offset: '-0400',
    sun_altitude_deg: 16.11,
    sun_azimuth_deg: 254.06,
    sun_up: true,
    today_m2: 1239224,
    added_m2: 22884,
    removed_m2: 839,
    lightPreset: 'dusk',
  },
  {
    label: 'autumn_equinox',
    seasonName: 'Fall',
    subName: 'Autumn Equinox',
    date: '2026-09-22',
    timeId: 'night',
    timeLabel: 'Night',
    timeStr: '22:00',
    clockTime: 'Night',
    local_time: '2026-09-22T22:00',
    utc_offset: '-0400',
    sun_altitude_deg: -25.0,
    sun_azimuth_deg: 310.0,
    sun_up: false,
    today_m2: 0,
    added_m2: 0,
    removed_m2: 0,
    lightPreset: 'night',
  },

  // --- Winter Solstice (December 21) ---
  {
    label: 'winter_solstice',
    seasonName: 'Winter',
    subName: 'Winter Solstice',
    date: '2026-12-21',
    timeId: 'morning',
    timeLabel: 'Morning',
    timeStr: '09:00',
    clockTime: 'Morning',
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
    seasonName: 'Winter',
    subName: 'Winter Solstice',
    date: '2026-12-21',
    timeId: 'noon',
    timeLabel: 'Noon',
    timeStr: '12:00',
    clockTime: 'Noon',
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
    seasonName: 'Winter',
    subName: 'Winter Solstice',
    date: '2026-12-21',
    timeId: 'afternoon',
    timeLabel: 'Afternoon',
    timeStr: '15:00',
    clockTime: 'Afternoon',
    local_time: '2026-12-21T15:00',
    utc_offset: '-0500',
    sun_altitude_deg: 13.05,
    sun_azimuth_deg: 218.23,
    sun_up: true,
    today_m2: 1783581,
    added_m2: 22137,
    removed_m2: 431,
    lightPreset: 'dusk', // Golden winter sunset preset
  },
  {
    label: 'winter_solstice',
    seasonName: 'Winter',
    subName: 'Winter Solstice',
    date: '2026-12-21',
    timeId: 'night',
    timeLabel: 'Night',
    timeStr: '22:00',
    clockTime: 'Night',
    local_time: '2026-12-21T22:00',
    utc_offset: '-0500',
    sun_altitude_deg: -35.0,
    sun_azimuth_deg: 290.0,
    sun_up: false,
    today_m2: 0,
    added_m2: 0,
    removed_m2: 0,
    lightPreset: 'night', // Dark night preset
  },
]

export function getShadowSlot(label: string, timeQuery: string): ShadowSlot | undefined {
  return SHADOW_SLOTS.find(
    (s) =>
      s.label === label &&
      (s.timeId === timeQuery ||
        s.timeStr === timeQuery ||
        (timeQuery === '15:00' && s.timeId === 'afternoon') ||
        (timeQuery === '18:00' && (s.timeId === 'afternoon' || s.timeId === 'night')) ||
        (timeQuery === '22:00' && s.timeId === 'night'))
  )
}
