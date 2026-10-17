import type { Map } from 'mapbox-gl'

// A newer selection cancels this subscription, so only the latest time is applied.
export function scheduleSolarUpdate(map: Map, apply: () => void): () => void {
  let pending = true
  let frame: number | null = null

  const schedule = () => {
    if (!pending || frame !== null) return
    frame = requestAnimationFrame(() => {
      frame = null
      if (!pending || !map.isStyleLoaded()) return
      // Clear before applying: changing the preset can emit more style events.
      pending = false
      apply()
    })
  }

  const onLoad = () => {
    pending = true
    schedule()
  }

  map.on('styledata', schedule)
  map.on('idle', schedule)
  map.on('load', onLoad)
  schedule()

  return () => {
    pending = false
    if (frame !== null) cancelAnimationFrame(frame)
    map.off('styledata', schedule)
    map.off('idle', schedule)
    map.off('load', onLoad)
  }
}
