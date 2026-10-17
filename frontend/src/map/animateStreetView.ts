import mapboxgl, { type Map as MapboxMap } from 'mapbox-gl'

/** Animate the real camera to eye level, rather than flying to a ground target. */
export function animateStreetView(map: MapboxMap, location: [number, number], onEnd: () => void, bearing = 270) {
  map.stop()
  map.setMaxPitch(85)
  const camera = map.getFreeCameraOptions()
  const start = camera.position
  const orientation = camera.orientation
  if (!start || !orientation) { onEnd(); return () => {} }

  const from = { x: start.x, y: start.y, z: start.z }
  const fromRotation = Array.from(orientation)
  const ground = map.queryTerrainElevation(location) ?? 0
  const destination = mapboxgl.MercatorCoordinate.fromLngLat(location, ground + 1.7)
  const target = new mapboxgl.FreeCameraOptions()
  target.setPitchBearing(85, bearing)
  const toRotation = Array.from(target.orientation!)
  // q and -q describe the same orientation; choose the shorter rotation.
  const sign = fromRotation.reduce((sum, value, index) => sum + value * toRotation[index], 0) < 0 ? -1 : 1
  const duration = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1800
  let began: number | null = null
  let frame: number | null = null
  let finished = false

  const cancel = () => {
    if (finished) return
    finished = true
    if (frame !== null) cancelAnimationFrame(frame)
    map.off('mousedown', cancel)
    map.off('touchstart', cancel)
    map.off('wheel', cancel)
    onEnd()
  }

  const tick = (now: number) => {
    if (finished) return
    began ??= now
    const progress = duration ? Math.min(1, (now - began) / duration) : 1
    const t = progress * progress * (3 - 2 * progress)
    // Logarithmic altitude gives a gradual descent even from an aerial view.
    const z = from.z > 0 && destination.z > 0
      ? Math.exp(Math.log(from.z) * (1 - t) + Math.log(destination.z) * t)
      : from.z + (destination.z - from.z) * t
    camera.position = new mapboxgl.MercatorCoordinate(
      from.x + (destination.x - from.x) * t,
      from.y + (destination.y - from.y) * t, z)
    const rotation = fromRotation.map((value, index) => value * (1 - t) + toRotation[index] * sign * t)
    const length = Math.hypot(...rotation)
    camera.orientation = rotation.map(value => value / length) as [number, number, number, number]
    map.setFreeCameraOptions(camera)
    if (progress === 1) cancel()
    else frame = requestAnimationFrame(tick)
  }

  map.on('mousedown', cancel)
  map.on('touchstart', cancel)
  map.on('wheel', cancel)
  frame = requestAnimationFrame(tick)
  return cancel
}
