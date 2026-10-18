import type { Map as MapboxMap } from 'mapbox-gl'

export type NavAction =
  | 'forward'
  | 'backward'
  | 'left'
  | 'right'
  | 'turnLeft'
  | 'turnRight'
  | 'pitchUp'
  | 'pitchDown'

export interface MapKeyboardNavigationOptions {
  /** Panning speed in pixels per second. Defaults to 600. */
  panSpeed?: number
  /** Rotation (compass turning) speed in degrees per second. Defaults to 80. */
  rotateSpeed?: number
  /** Pitch tilting speed in degrees per second. Defaults to 50. */
  pitchSpeed?: number
  /** Speed multiplier when holding Shift. Defaults to 2.0. */
  sprintMultiplier?: number
  /** Whether arrow up/down adjusts pitch tilt. Defaults to true. */
  enablePitch?: boolean
  /** Whether keyboard navigation is currently active. Defaults to true or a predicate. */
  enabled?: boolean | (() => boolean)
  /** Window or target to attach listeners to. Defaults to window. */
  windowTarget?: Window
}

/**
 * Checks whether an event originated from an editable text input element
 * where keyboard events should be preserved for normal typing.
 */
export function isTextInputTarget(target: EventTarget | null): boolean {
  if (!target) return false
  const el = target as {
    tagName?: string
    type?: string
    isContentEditable?: boolean
    getAttribute?: (attr: string) => string | null
  }
  const tagName = typeof el.tagName === 'string' ? el.tagName.toLowerCase() : ''
  if (tagName === 'textarea' || tagName === 'select') return true
  if (el.isContentEditable || el.getAttribute?.('contenteditable') === 'true') return true
  if (tagName === 'input') {
    const textTypes = ['text', 'search', 'password', 'email', 'number', 'tel', 'url']
    const inputType = (el.type || 'text').toLowerCase()
    return textTypes.includes(inputType)
  }
  return false
}

/**
 * Maps keyboard events to map navigation actions.
 * - WASD keys: move forward, backward, left, right across the map.
 * - Arrow keys: ArrowLeft/ArrowRight to pan side-to-side (turn compass), ArrowUp/ArrowDown to adjust pitch.
 */
export function getNavAction(event: KeyboardEvent): NavAction | null {
  const key = event.key
  const code = event.code

  // WASD translation (case-insensitive and layout-tolerant)
  if (key === 'w' || key === 'W' || code === 'KeyW') return 'forward'
  if (key === 's' || key === 'S' || code === 'KeyS') return 'backward'
  if (key === 'a' || key === 'A' || code === 'KeyA') return 'left'
  if (key === 'd' || key === 'D' || code === 'KeyD') return 'right'

  // Arrow keys: side-to-side turns compass, up/down tilts pitch
  if (key === 'ArrowLeft' || code === 'ArrowLeft') return 'turnLeft'
  if (key === 'ArrowRight' || code === 'ArrowRight') return 'turnRight'
  if (key === 'ArrowUp' || code === 'ArrowUp') return 'pitchUp'
  if (key === 'ArrowDown' || code === 'ArrowDown') return 'pitchDown'

  return null
}

/**
 * Enables smooth WASD map movement and Arrow-key compass turning/rotation.
 * Returns a cleanup function that disposes of listeners and restores default keyboard handling.
 */
export function setupMapKeyboardNavigation(
  map: MapboxMap,
  options: MapKeyboardNavigationOptions = {}
): () => void {
  const {
    panSpeed = 600,
    rotateSpeed = 80,
    pitchSpeed = 50,
    sprintMultiplier = 2.0,
    enablePitch = true,
    enabled = true,
    windowTarget = typeof window !== 'undefined' ? window : undefined,
  } = options

  if (!windowTarget || !map) return () => {}

  // Disable default Mapbox keyboard handler to prevent conflicting arrow-key panning
  try {
    if (map.keyboard && typeof map.keyboard.disable === 'function') {
      map.keyboard.disable()
    }
  } catch {
    // Graceful fallback for mocked environments
  }

  const isEnabled = () => (typeof enabled === 'function' ? enabled() : enabled)

  const activeActions = new Set<NavAction>()
  let isShiftActive = false

  // Current velocities for smooth acceleration and deceleration
  let vx = 0
  let vy = 0
  let vBearing = 0
  let vPitch = 0

  let lastTime = 0
  let animationFrameId: number | null = null

  const isMoving = () =>
    activeActions.size > 0 ||
    Math.abs(vx) > 0.5 ||
    Math.abs(vy) > 0.5 ||
    Math.abs(vBearing) > 0.2 ||
    Math.abs(vPitch) > 0.2

  const tick = (now: number) => {
    if (!lastTime) lastTime = now
    const dt = Math.min((now - lastTime) / 1000, 0.08)
    lastTime = now

    const currentMultiplier = isShiftActive ? sprintMultiplier : 1.0

    // Compute target directional movement
    let targetX = 0
    let targetY = 0
    let targetBearing = 0
    let targetPitch = 0

    if (activeActions.has('forward')) targetY -= 1
    if (activeActions.has('backward')) targetY += 1
    if (activeActions.has('left')) targetX -= 1
    if (activeActions.has('right')) targetX += 1

    if (activeActions.has('turnLeft')) targetBearing -= 1
    if (activeActions.has('turnRight')) targetBearing += 1

    if (enablePitch) {
      if (activeActions.has('pitchUp')) targetPitch += 1
      if (activeActions.has('pitchDown')) targetPitch -= 1
    }

    // Normalize diagonal movement vector so diagonal is not faster
    if (targetX !== 0 && targetY !== 0) {
      const invLen = 1 / Math.hypot(targetX, targetY)
      targetX *= invLen
      targetY *= invLen
    }

    const desiredVx = targetX * panSpeed * currentMultiplier
    const desiredVy = targetY * panSpeed * currentMultiplier
    const desiredVBearing = targetBearing * rotateSpeed * currentMultiplier
    const desiredVPitch = targetPitch * pitchSpeed * currentMultiplier

    // Smoothly interpolate current velocity towards target (acceleration / damping)
    const accelRate = 18
    const dampingRate = 14
    const blendFactorX = targetX !== 0 ? 1 - Math.exp(-accelRate * dt) : 1 - Math.exp(-dampingRate * dt)
    const blendFactorY = targetY !== 0 ? 1 - Math.exp(-accelRate * dt) : 1 - Math.exp(-dampingRate * dt)
    const blendFactorB = targetBearing !== 0 ? 1 - Math.exp(-accelRate * dt) : 1 - Math.exp(-dampingRate * dt)
    const blendFactorP = targetPitch !== 0 ? 1 - Math.exp(-accelRate * dt) : 1 - Math.exp(-dampingRate * dt)

    vx += (desiredVx - vx) * blendFactorX
    vy += (desiredVy - vy) * blendFactorY
    vBearing += (desiredVBearing - vBearing) * blendFactorB
    vPitch += (desiredVPitch - vPitch) * blendFactorP

    // Apply movement delta
    const deltaX = vx * dt
    const deltaY = vy * dt
    if ((Math.abs(deltaX) > 0.001 || Math.abs(deltaY) > 0.001) && typeof map.panBy === 'function') {
      try {
        map.panBy([deltaX, deltaY], { duration: 0 })
      } catch {
        // Safe handling for teardown
      }
    }

    // Apply compass rotation (bearing)
    const deltaBearing = vBearing * dt
    if (Math.abs(deltaBearing) > 0.001 && typeof map.getBearing === 'function' && typeof map.setBearing === 'function') {
      try {
        const curBearing = map.getBearing()
        map.setBearing(curBearing + deltaBearing)
      } catch {
        // Safe handling
      }
    }

    // Apply pitch
    const deltaPitch = vPitch * dt
    if (Math.abs(deltaPitch) > 0.001 && typeof map.getPitch === 'function' && typeof map.setPitch === 'function') {
      try {
        const curPitch = map.getPitch()
        const maxPitch = typeof map.getMaxPitch === 'function' ? map.getMaxPitch() : 85
        const nextPitch = Math.min(maxPitch, Math.max(0, curPitch + deltaPitch))
        map.setPitch(nextPitch)
      } catch {
        // Safe handling
      }
    }

    // Continue animation loop if still active or coasting
    if (isMoving()) {
      animationFrameId = requestAnimationFrame(tick)
    } else {
      vx = 0
      vy = 0
      vBearing = 0
      vPitch = 0
      animationFrameId = null
      lastTime = 0
    }
  }

  const startAnimation = () => {
    if (animationFrameId === null) {
      lastTime = 0
      animationFrameId = requestAnimationFrame(tick)
    }
  }

  const handleKeyDown = (event: KeyboardEvent) => {
    if (!isEnabled()) return
    if (event.altKey || event.ctrlKey || event.metaKey) return

    const action = getNavAction(event)
    if (!action) return

    // If typing in a text field, let typing proceed
    if (isTextInputTarget(event.target)) return

    // Intercept map navigation key
    event.preventDefault()
    isShiftActive = event.shiftKey

    const isFirstPress = !activeActions.has(action)
    activeActions.add(action)

    // Give an immediate responsive impulse on keydown for instant tactile feedback
    if (isFirstPress) {
      if (typeof map.stop === 'function') {
        try { map.stop() } catch {}
      }
      const impulseMultiplier = isShiftActive ? sprintMultiplier : 1.0
      if (action === 'forward') vy = -panSpeed * 0.5 * impulseMultiplier
      else if (action === 'backward') vy = panSpeed * 0.5 * impulseMultiplier
      else if (action === 'left') vx = -panSpeed * 0.5 * impulseMultiplier
      else if (action === 'right') vx = panSpeed * 0.5 * impulseMultiplier
      else if (action === 'turnLeft') vBearing = -rotateSpeed * 0.6 * impulseMultiplier
      else if (action === 'turnRight') vBearing = rotateSpeed * 0.6 * impulseMultiplier
      else if (action === 'pitchUp') vPitch = pitchSpeed * 0.5 * impulseMultiplier
      else if (action === 'pitchDown') vPitch = -pitchSpeed * 0.5 * impulseMultiplier
    }

    startAnimation()
  }

  const handleKeyUp = (event: KeyboardEvent) => {
    isShiftActive = event.shiftKey
    const action = getNavAction(event)
    if (action) {
      activeActions.delete(action)
    }
  }

  const handleBlur = () => {
    activeActions.clear()
    isShiftActive = false
    vx = 0
    vy = 0
    vBearing = 0
    vPitch = 0
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
      lastTime = 0
    }
  }

  windowTarget.addEventListener('keydown', handleKeyDown)
  windowTarget.addEventListener('keyup', handleKeyUp)
  windowTarget.addEventListener('blur', handleBlur)

  return () => {
    windowTarget.removeEventListener('keydown', handleKeyDown)
    windowTarget.removeEventListener('keyup', handleKeyUp)
    windowTarget.removeEventListener('blur', handleBlur)
    if (animationFrameId !== null) {
      cancelAnimationFrame(animationFrameId)
      animationFrameId = null
    }
    activeActions.clear()
    try {
      if (map.keyboard && typeof map.keyboard.enable === 'function') {
        map.keyboard.enable()
      }
    } catch {
      // Ignore
    }
  }
}
