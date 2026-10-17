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
  { id: 'morning', label: 'Morning', clockTime: '9:00 AM', timeStr: '09:00', icon: '🌅' },
  { id: 'noon', label: 'Noon', clockTime: '12:00 PM', timeStr: '12:00', icon: '☀️' },
  { id: 'afternoon', label: 'Afternoon', clockTime: '3:00 PM', timeStr: '15:00', icon: '🌤️' },
  { id: 'night', label: 'Night', clockTime: 'Night', timeStr: '18:00', icon: '🌙' },
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
    clockTime: '9:00 AM',
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
    clockTime: '12:00 PM',
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
    timeStr: '15:00',
    clockTime: '3:00 PM',
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
    seasonName: 'Spring',
    subName: 'Spring Equinox',
    date: '2026-03-20',
    timeId: 'night',
    timeLabel: 'Night',
    timeStr: '18:00',
    clockTime: 'Night',
    local_time: '2026-03-20T18:00',
    utc_offset: '-0400',
    sun_altitude_deg: -12.0,
    sun_azimuth_deg: 255.1,
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
    clockTime: '9:00 AM',
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
    clockTime: '12:00 PM',
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
    timeStr: '15:00',
    clockTime: '3:00 PM',
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
    seasonName: 'Summer',
    subName: 'Summer Solstice',
    date: '2026-06-21',
    timeId: 'night',
    timeLabel: 'Night',
    timeStr: '18:00',
    clockTime: 'Night',
    local_time: '2026-06-21T18:00',
    utc_offset: '-0400',
    sun_altitude_deg: -12.0,
    sun_azimuth_deg: 274.82,
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
    clockTime: '9:00 AM',
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
    clockTime: '12:00 PM',
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
    timeStr: '15:00',
    clockTime: '3:00 PM',
    local_time: '2026-09-22T15:00',
    utc_offset: '-0400',
    sun_altitude_deg: 40.01,
    sun_azimuth_deg: 217.03,
    sun_up: true,
    today_m2: 820121,
    added_m2: 16512,
    removed_m2: 197,
    lightPreset: 'day',
  },
  {
    label: 'autumn_equinox',
    seasonName: 'Fall',
    subName: 'Autumn Equinox',
    date: '2026-09-22',
    timeId: 'night',
    timeLabel: 'Night',
    timeStr: '18:00',
    clockTime: 'Night',
    local_time: '2026-09-22T18:00',
    utc_offset: '-0400',
    sun_altitude_deg: -12.0,
    sun_azimuth_deg: 257.73,
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
    clockTime: '9:00 AM',
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
    clockTime: '12:00 PM',
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
    clockTime: '3:00 PM',
    local_time: '2026-12-21T15:00',
    utc_offset: '-0500',
    sun_altitude_deg: 13.05,
    sun_azimuth_deg: 218.23,
    sun_up: true,
    today_m2: 1783581,
    added_m2: 22137,
    removed_m2: 431,
    lightPreset: 'day', // Realistic daytime sunlight, fixing winter afternoon prematurely looking like sunset/night
  },
  {
    label: 'winter_solstice',
    seasonName: 'Winter',
    subName: 'Winter Solstice',
    date: '2026-12-21',
    timeId: 'night',
    timeLabel: 'Night',
    timeStr: '18:00',
    clockTime: 'Night',
    local_time: '2026-12-21T18:00',
    utc_offset: '-0500',
    sun_altitude_deg: -13.24,
    sun_azimuth_deg: 250.1,
    sun_up: false,
    today_m2: 0,
    added_m2: 0,
    removed_m2: 0,
    lightPreset: 'night', // Dark night preset, fixing winter night option being completely bright daylight
  },
]

export function getShadowSlot(label: string, timeQuery: string): ShadowSlot | undefined {
  return SHADOW_SLOTS.find(
    (s) => s.label === label && (s.timeId === timeQuery || s.timeStr === timeQuery)
  )
}
