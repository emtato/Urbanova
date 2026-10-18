import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Map as MapboxMap } from 'mapbox-gl'
import {
  getNavAction,
  isTextInputTarget,
  setupMapKeyboardNavigation,
} from './mapKeyboardNavigation'

describe('mapKeyboardNavigation', () => {
  describe('getNavAction', () => {
    it('identifies WASD keys for map translation', () => {
      expect(getNavAction({ key: 'w', code: 'KeyW' } as KeyboardEvent)).toBe('forward')
      expect(getNavAction({ key: 'W', code: 'KeyW' } as KeyboardEvent)).toBe('forward')
      expect(getNavAction({ key: 's', code: 'KeyS' } as KeyboardEvent)).toBe('backward')
      expect(getNavAction({ key: 'S', code: 'KeyS' } as KeyboardEvent)).toBe('backward')
      expect(getNavAction({ key: 'a', code: 'KeyA' } as KeyboardEvent)).toBe('left')
      expect(getNavAction({ key: 'A', code: 'KeyA' } as KeyboardEvent)).toBe('left')
      expect(getNavAction({ key: 'd', code: 'KeyD' } as KeyboardEvent)).toBe('right')
      expect(getNavAction({ key: 'D', code: 'KeyD' } as KeyboardEvent)).toBe('right')
    })

    it('identifies arrow keys for compass rotation and pitch tilt', () => {
      expect(getNavAction({ key: 'ArrowLeft', code: 'ArrowLeft' } as KeyboardEvent)).toBe('turnLeft')
      expect(getNavAction({ key: 'ArrowRight', code: 'ArrowRight' } as KeyboardEvent)).toBe('turnRight')
      expect(getNavAction({ key: 'ArrowUp', code: 'ArrowUp' } as KeyboardEvent)).toBe('pitchUp')
      expect(getNavAction({ key: 'ArrowDown', code: 'ArrowDown' } as KeyboardEvent)).toBe('pitchDown')
    })

    it('returns null for non-navigation keys', () => {
      expect(getNavAction({ key: 'Enter', code: 'Enter' } as KeyboardEvent)).toBeNull()
      expect(getNavAction({ key: ' ', code: 'Space' } as KeyboardEvent)).toBeNull()
      expect(getNavAction({ key: 'Escape', code: 'Escape' } as KeyboardEvent)).toBeNull()
      expect(getNavAction({ key: 'Tab', code: 'Tab' } as KeyboardEvent)).toBeNull()
    })
  })

  describe('isTextInputTarget', () => {
    it('returns true for text input fields, textareas, and contenteditable elements', () => {
      const textInput = {
        tagName: 'INPUT',
        type: 'text',
        isContentEditable: false,
        getAttribute: () => null,
      } as unknown as HTMLElement

      const searchInput = {
        tagName: 'INPUT',
        type: 'search',
        isContentEditable: false,
        getAttribute: () => null,
      } as unknown as HTMLElement

      const textarea = {
        tagName: 'TEXTAREA',
        isContentEditable: false,
        getAttribute: () => null,
      } as unknown as HTMLElement

      const editableDiv = {
        tagName: 'DIV',
        isContentEditable: true,
        getAttribute: () => 'true',
      } as unknown as HTMLElement

      expect(isTextInputTarget(textInput)).toBe(true)
      expect(isTextInputTarget(searchInput)).toBe(true)
      expect(isTextInputTarget(textarea)).toBe(true)
      expect(isTextInputTarget(editableDiv)).toBe(true)
    })

    it('returns false for non-text elements and range sliders', () => {
      const rangeInput = {
        tagName: 'INPUT',
        type: 'range',
        isContentEditable: false,
        getAttribute: () => null,
      } as unknown as HTMLElement

      const button = {
        tagName: 'BUTTON',
        isContentEditable: false,
        getAttribute: () => null,
      } as unknown as HTMLElement

      const div = {
        tagName: 'DIV',
        isContentEditable: false,
        getAttribute: () => null,
      } as unknown as HTMLElement

      expect(isTextInputTarget(rangeInput)).toBe(false)
      expect(isTextInputTarget(button)).toBe(false)
      expect(isTextInputTarget(div)).toBe(false)
      expect(isTextInputTarget(null)).toBe(false)
    })
  })

  describe('setupMapKeyboardNavigation integration', () => {
    let mockMap: any
    let listeners: Record<string, EventListener>
    let mockWindow: any
    let frames: Map<number, FrameRequestCallback>
    let nextFrameId: number

    const stepFrame = (time: number) => {
      const currentCallbacks = [...frames.values()]
      frames.clear()
      currentCallbacks.forEach((cb) => cb(time))
    }

    beforeEach(() => {
      listeners = {}
      frames = new Map()
      nextFrameId = 0

      mockWindow = {
        addEventListener: (event: string, handler: EventListener) => {
          listeners[event] = handler
        },
        removeEventListener: (event: string) => {
          delete listeners[event]
        },
      }

      vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
        const id = ++nextFrameId
        frames.set(id, cb)
        return id
      })
      vi.stubGlobal('cancelAnimationFrame', (id: number) => {
        frames.delete(id)
      })

      mockMap = {
        keyboard: {
          disable: vi.fn(),
          enable: vi.fn(),
        },
        stop: vi.fn(),
        panBy: vi.fn(),
        getBearing: vi.fn().mockReturnValue(-20),
        setBearing: vi.fn(),
        getPitch: vi.fn().mockReturnValue(55),
        setPitch: vi.fn(),
        getMaxPitch: vi.fn().mockReturnValue(70),
      }
    })

    afterEach(() => {
      vi.unstubAllGlobals()
    })

    it('disables map.keyboard upon setup and reenables on cleanup', () => {
      const cleanup = setupMapKeyboardNavigation(mockMap as unknown as MapboxMap, {
        windowTarget: mockWindow,
      })
      expect(mockMap.keyboard.disable).toHaveBeenCalledTimes(1)

      cleanup()
      expect(mockMap.keyboard.enable).toHaveBeenCalledTimes(1)
      expect(listeners['keydown']).toBeUndefined()
    })

    it('moves map forward with W and pans with WASD', () => {
      const cleanup = setupMapKeyboardNavigation(mockMap as unknown as MapboxMap, {
        windowTarget: mockWindow,
        panSpeed: 600,
      })

      const event = {
        key: 'w',
        code: 'KeyW',
        preventDefault: vi.fn(),
        shiftKey: false,
        target: { tagName: 'DIV' },
      } as unknown as KeyboardEvent

      listeners['keydown'](event)
      expect(event.preventDefault).toHaveBeenCalled()
      expect(mockMap.stop).toHaveBeenCalled()

      // Advance animation frame
      stepFrame(100)
      stepFrame(130)

      expect(mockMap.panBy).toHaveBeenCalled()
      const [delta] = mockMap.panBy.mock.calls[0]
      // Forward moves camera up in screen coordinates (negative Y)
      expect(delta[1]).toBeLessThan(0)

      cleanup()
    })

    it('turns compass with ArrowLeft and ArrowRight', () => {
      const cleanup = setupMapKeyboardNavigation(mockMap as unknown as MapboxMap, {
        windowTarget: mockWindow,
        rotateSpeed: 80,
      })

      // Turn compass left
      const turnLeftEvent = {
        key: 'ArrowLeft',
        code: 'ArrowLeft',
        preventDefault: vi.fn(),
        shiftKey: false,
        target: { tagName: 'DIV' },
      } as unknown as KeyboardEvent

      listeners['keydown'](turnLeftEvent)
      expect(turnLeftEvent.preventDefault).toHaveBeenCalled()

      stepFrame(100)
      stepFrame(150)

      expect(mockMap.setBearing).toHaveBeenCalled()
      const newBearingLeft = mockMap.setBearing.mock.calls[0][0]
      // Left turn decreases bearing (counter-clockwise)
      expect(newBearingLeft).toBeLessThan(-20)

      // KeyUp to stop turning left
      listeners['keyup'](turnLeftEvent)
      mockMap.setBearing.mockClear()
      mockMap.getBearing.mockReturnValue(-30)

      // Turn compass right
      const turnRightEvent = {
        key: 'ArrowRight',
        code: 'ArrowRight',
        preventDefault: vi.fn(),
        shiftKey: false,
        target: { tagName: 'DIV' },
      } as unknown as KeyboardEvent

      listeners['keydown'](turnRightEvent)
      stepFrame(200)
      stepFrame(250)

      expect(mockMap.setBearing).toHaveBeenCalled()
      const newBearingRight = mockMap.setBearing.mock.calls[0][0]
      // Right turn increases bearing (clockwise)
      expect(newBearingRight).toBeGreaterThan(-30)

      cleanup()
    })

    it('adjusts pitch with ArrowUp and ArrowDown', () => {
      const cleanup = setupMapKeyboardNavigation(mockMap as unknown as MapboxMap, {
        windowTarget: mockWindow,
        pitchSpeed: 50,
      })

      const pitchUpEvent = {
        key: 'ArrowUp',
        code: 'ArrowUp',
        preventDefault: vi.fn(),
        shiftKey: false,
        target: { tagName: 'DIV' },
      } as unknown as KeyboardEvent

      listeners['keydown'](pitchUpEvent)
      stepFrame(100)
      stepFrame(150)

      expect(mockMap.setPitch).toHaveBeenCalled()
      const newPitch = mockMap.setPitch.mock.calls[0][0]
      expect(newPitch).toBeGreaterThan(55)

      cleanup()
    })

    it('ignores input when focused on a text input element', () => {
      const cleanup = setupMapKeyboardNavigation(mockMap as unknown as MapboxMap, {
        windowTarget: mockWindow,
      })

      const textInput = {
        tagName: 'INPUT',
        type: 'text',
        isContentEditable: false,
        getAttribute: () => null,
      } as unknown as HTMLElement

      const event = {
        key: 'w',
        code: 'KeyW',
        preventDefault: vi.fn(),
        shiftKey: false,
        target: textInput,
      } as unknown as KeyboardEvent

      listeners['keydown'](event)
      expect(event.preventDefault).not.toHaveBeenCalled()
      expect(frames.size).toBe(0)

      cleanup()
    })

    it('resets velocities on blur so camera does not continuously drift', () => {
      const cleanup = setupMapKeyboardNavigation(mockMap as unknown as MapboxMap, {
        windowTarget: mockWindow,
      })

      const event = {
        key: 'w',
        code: 'KeyW',
        preventDefault: vi.fn(),
        shiftKey: false,
        target: { tagName: 'DIV' },
      } as unknown as KeyboardEvent

      listeners['keydown'](event)
      expect(frames.size).toBe(1)

      // Window blurs (e.g. user Alt-Tabs or clicks outside)
      listeners['blur'](new Event('blur'))
      expect(frames.size).toBe(0)

      cleanup()
    })

    it('supports sprint speed multiplier when shift is held', () => {
      let speedWithoutShift = 0
      let speedWithShift = 0

      // Normal speed
      const cleanupNormal = setupMapKeyboardNavigation(mockMap as unknown as MapboxMap, {
        windowTarget: mockWindow,
        panSpeed: 500,
        sprintMultiplier: 2.0,
      })

      listeners['keydown']({
        key: 'd',
        code: 'KeyD',
        preventDefault: vi.fn(),
        shiftKey: false,
        target: { tagName: 'DIV' },
      } as unknown as KeyboardEvent)
      stepFrame(100)
      stepFrame(150)
      speedWithoutShift = mockMap.panBy.mock.calls[0][0][0]
      cleanupNormal()

      // Sprint speed
      mockMap.panBy.mockClear()
      const cleanupSprint = setupMapKeyboardNavigation(mockMap as unknown as MapboxMap, {
        windowTarget: mockWindow,
        panSpeed: 500,
        sprintMultiplier: 2.0,
      })

      listeners['keydown']({
        key: 'd',
        code: 'KeyD',
        preventDefault: vi.fn(),
        shiftKey: true,
        target: { tagName: 'DIV' },
      } as unknown as KeyboardEvent)
      stepFrame(200)
      stepFrame(250)
      speedWithShift = mockMap.panBy.mock.calls[0][0][0]
      cleanupSprint()

      expect(speedWithShift).toBeGreaterThan(speedWithoutShift * 1.5)
    })
  })
})
