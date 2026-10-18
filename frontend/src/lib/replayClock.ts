/** Simulation inputs are local seconds after midnight, not Unix timestamps. */
export function replayClock(startTimeSeconds: number, elapsedSeconds: number): string {
  const seconds = Math.max(0, Math.floor(startTimeSeconds + elapsedSeconds))
  const day = Math.floor(seconds / 86400)
  const clock = [Math.floor(seconds / 3600) % 24, Math.floor(seconds / 60) % 60, seconds % 60]
    .map(value => String(value).padStart(2, '0')).join(':')
  return day ? `${clock} (+${day}d)` : clock
}
