type SimulationTimes = { start_time_s: number; end_time_s: number; rush_hour_duration_s: number }

/** Hours are edited as strings so clearing a field never silently submits zero. */
export function simulationTimes(start: string, end: string, duration: string): { values: SimulationTimes; error: null } | { values: null; error: string } {
  const hours = [start, end, duration].map(Number)
  if ([start, end, duration].some(value => !value.trim()) || hours.some(value => !Number.isFinite(value))) {
    return { values: null, error: 'Enter a start time, end time, and rush-hour duration in hours.' }
  }
  if (hours[0] < 0 || hours[0] > 24 || hours[1] <= 0 || hours[1] > 48 || hours[2] <= 0 || hours[2] > 24) {
    return { values: null, error: 'Use start hours from 0–24, end hours above 0 up to 48, and a duration above 0 up to 24 hours.' }
  }
  const [start_time_s, end_time_s, rush_hour_duration_s] = hours.map(value => Math.round(value * 3600))
  if (start_time_s >= end_time_s) return { values: null, error: 'End time must be later than start time.' }
  if (rush_hour_duration_s < 1) return { values: null, error: 'Rush-hour duration must be at least one second.' }
  return { values: { start_time_s, end_time_s, rush_hour_duration_s }, error: null }
}
