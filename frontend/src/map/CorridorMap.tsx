import { useEffect, useRef, useState, type FC } from 'react'
import mapboxgl, {
  type Map as MapboxMap,
  type MapLayerMouseEvent,
} from 'mapbox-gl'
import { scheduleSolarUpdate } from './scheduleSolarUpdate'
import { animateStreetView } from './animateStreetView'
import { buildingStreetViewLocation } from './buildingStreetView'
import type { Corridor } from '../lib/types'
import {
  normalizeStop,
  normalizeDevelopment,
  toShortAddress,
} from './types'
import {
  setupCorridorMapLayers,
  updateDevelopmentsVisibility,
  updateDevelopmentsSelected,
  updateCorridorMapData,
  updateShadowTimeAndVisibility,
  getDevelopmentCoordinates,
  LAYER_STOPS_CIRCLE,
  LAYER_DEVELOPMENTS_EXTRUSION,
} from './MassingLayer'
import {
  SEASONS,
  TIME_STEPS,
  SHADOW_SLOTS,
  getShadowSlot,
  type ShadowSlot,
  type SeasonId,
  type TimeOfDayId,
} from '../data/shadow_metadata'

export interface CorridorMapProps {
  corridor: Corridor | any
  developments: any[]
  selectedStopId?: string | null
  platformViewRequest?: { stopId: string; requestId: number } | null
  buildingViewRequest?: { devId: string; requestId: number } | null
  selectedDevId?: string | null
  activePhase?: number
  visibleDevIds?: string[]
  onToggleDevelopment?: (devId: string) => void
  shadowsEnabled?: boolean
  onToggleShadows?: (enabled: boolean) => void
  hideAllPopups?: boolean
  onSelectStop?: (stop: any) => void
  onSelectDevelopment?: (dev: any) => void
  className?: string
}

const MAPBOX_STANDARD_STYLE = 'mapbox://styles/mapbox/standard'

export const CorridorMap: FC<CorridorMapProps> = ({
  corridor,
  developments,
  selectedStopId,
  platformViewRequest,
  buildingViewRequest,
  selectedDevId,
  activePhase = 2,
  visibleDevIds,
  onToggleDevelopment,
  shadowsEnabled,
  onToggleShadows,
  hideAllPopups = false,
  onSelectStop,
  onSelectDevelopment,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const platformTransitionRef = useRef(false)
  const previousStopSelection = useRef<string | null | undefined>(undefined)
  const initialStopHydrated = useRef(false)
  const [pitch, setPitch] = useState<number>(55)
  const is3D = pitch >= 5
  const [statusMessage, setStatusMessage] = useState<string>('Initializing Mapbox Standard 3D Scene...')

  // Sunlight and Precomputed Shadow State
  const [localShadowsEnabled, setLocalShadowsEnabled] = useState(true)
  const isShadowsActive = typeof shadowsEnabled === 'boolean' ? shadowsEnabled : localShadowsEnabled
  const handleToggleShadows = (val?: boolean) => {
    const nextVal = typeof val === 'boolean' ? val : !isShadowsActive
    if (onToggleShadows) {
      onToggleShadows(nextVal)
    } else {
      setLocalShadowsEnabled(nextVal)
    }
  }

  const [isSolarMinimized, setIsSolarMinimized] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState<SeasonId>('summer_solstice')
  const [selectedTimeId, setSelectedTimeId] = useState<TimeOfDayId>('noon')
  // Derive the thumb position from the same time used by the map and labels.
  const sliderIndex = Math.max(0, TIME_STEPS.findIndex((t) => t.id === selectedTimeId))

  const handleSliderChange = (newVal: number) => {
    const clamped = Math.min(3, Math.max(0, Math.round(newVal)))
    const step = TIME_STEPS[clamped]
    if (step && step.id !== selectedTimeId) {
      setSelectedTimeId(step.id)
    }
  }

  const currentSlot: ShadowSlot =
    getShadowSlot(selectedSeason, selectedTimeId) ||
    getShadowSlot('summer_solstice', 'noon') ||
    SHADOW_SLOTS[0]

  // Development visibility state (powers the 3 development pill buttons)
  const [localVisibleDevIds, setLocalVisibleDevIds] = useState<string[]>(() =>
    developments.map(dev => normalizeDevelopment(dev).dev_id))
  useEffect(() => {
    setLocalVisibleDevIds(developments.map(dev => normalizeDevelopment(dev).dev_id))
  }, [developments])
  const currentVisibleDevIds = visibleDevIds ?? localVisibleDevIds

  const handleToggleDevelopment = (devId: string) => {
    if (onToggleDevelopment) {
      onToggleDevelopment(devId)
    } else {
      setLocalVisibleDevIds((prev) => {
        const next = prev.includes(devId)
          ? prev.filter((id) => id !== devId)
          : [...prev, devId]
        if (mapRef.current && mapRef.current.isStyleLoaded()) {
          updateDevelopmentsVisibility(mapRef.current, next)
        }
        return next
      })
    }
  }

  // Mapbox token state (checks env, then localStorage)
  const [mapboxToken, setMapboxToken] = useState<string>(() => {
    return (
      import.meta.env.VITE_MAPBOX_TOKEN ||
      (typeof window !== 'undefined' ? localStorage.getItem('urbanova_mapbox_token') || '' : '')
    )
  })
  const [tokenInput, setTokenInput] = useState<string>('')
  const [showTokenPrompt, setShowTokenPrompt] = useState<boolean>(!mapboxToken)

  const handleSaveToken = () => {
    const trimmed = tokenInput.trim()
    if (!trimmed) return
    localStorage.setItem('urbanova_mapbox_token', trimmed)
    setMapboxToken(trimmed)
    setShowTokenPrompt(false)
  }

  // Map event handlers outlive renders; read current inputs without recreating the camera.
  const latestMapInputs = useRef({
    corridor, developments, currentVisibleDevIds, selectedDevId,
    isShadowsActive, currentSlot, activePhase, onSelectStop, onSelectDevelopment,
  })
  latestMapInputs.current = {
    corridor, developments, currentVisibleDevIds, selectedDevId,
    isShadowsActive, currentSlot, activePhase, onSelectStop, onSelectDevelopment,
  }

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapRef.current) return // Prevent duplicate instances
    if (!mapboxToken) return // Wait for token

    mapboxgl.accessToken = mapboxToken

    const defaultCenter: [number, number] = [-79.364, 43.660]

    try {
      const initialBounds = new mapboxgl.LngLatBounds()
      for (const rawStop of latestMapInputs.current.corridor.stops) {
        const stop = normalizeStop(rawStop)
        initialBounds.extend([stop.lon, stop.lat])
      }
      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: MAPBOX_STANDARD_STYLE,
        center: defaultCenter,
        zoom: 14.6,
        // Establish the overview in the constructor, without a second load-time flight.
        bounds: initialBounds.isEmpty() ? undefined : initialBounds,
        fitBoundsOptions: { padding: { top: 90, bottom: 90, left: 100, right: 380 }, maxZoom: 15.6 },
        maxZoom: 24,
        maxPitch: 70,
        pitch: 55,
        bearing: -20,
      })

      map.addControl(new mapboxgl.NavigationControl({ showCompass: true }), 'bottom-right')

      map.on('style.load', () => {
        // Mapbox Standard 3D lighting configuration
        try {
          map.setConfigProperty('basemap', 'lightPreset', latestMapInputs.current.isShadowsActive
            ? latestMapInputs.current.currentSlot.lightPreset || 'day' : 'day')
          map.setConfigProperty('basemap', 'show3dObjects', true)
        } catch (e) {
          console.warn('Mapbox Standard basemap config note:', e)
        }
      })

      // Allow a near-horizontal gaze at street scale; keep wider views manageable.
      const updatePitchLimit = () => {
        const limit = platformTransitionRef.current || map.getZoom() >= 19 ? 85 : 70
        if (map.getMaxPitch() !== limit) map.setMaxPitch(limit)
      }
      map.on('zoom', updatePitchLimit)

      // Track pitch angle reactively on all camera pitch, rotation, and move events
      const updatePitch = () => {
        setPitch(Math.round(map.getPitch()))
      }

      map.on('pitch', updatePitch)
      map.on('pitchend', updatePitch)
      map.on('rotate', updatePitch)
      map.on('move', updatePitch)

      map.on('error', (e) => {
        console.warn('Mapbox event error:', e)
        if (e.error && (String(e.error).includes('Forbidden') || String(e.error).includes('Unauthorized') || String(e.error).includes('401'))) {
          setStatusMessage('Mapbox Token Invalid or Expired (401). Please check token.')
          setShowTokenPrompt(true)
        }
      })

      map.on('load', () => {
        setStatusMessage('')
        map.resize()
        updatePitch()

        try {
          const { corridor, developments, currentVisibleDevIds, selectedDevId,
            isShadowsActive, currentSlot, activePhase } = latestMapInputs.current
          setupCorridorMapLayers(map, corridor, developments)
          updateDevelopmentsVisibility(map, currentVisibleDevIds)
          updateDevelopmentsSelected(map, selectedDevId)
          updateShadowTimeAndVisibility(map, {
            enabled: isShadowsActive && currentSlot.sun_up,
            localTime: currentSlot.local_time,
            activePhase: activePhase,
          })
        } catch (err) {
          console.error('Error adding corridor layers:', err)
          setStatusMessage(`Layer load issue: ${err instanceof Error ? err.message : String(err)}`)
        }
      })

      // Click handler for stops
      map.on('click', LAYER_STOPS_CIRCLE, (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]
        const stopId = feature.properties?.stop_id
        const { corridor, onSelectStop } = latestMapInputs.current
        const stop = (corridor?.stops ?? []).find((s: any) => normalizeStop(s).stop_id === stopId)
        if (stop && onSelectStop) {
          onSelectStop(stop)
        }
      })

      // Click handler for developments
      map.on('click', LAYER_DEVELOPMENTS_EXTRUSION, (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]
        const devId = feature.properties?.dev_id
        const { developments, onSelectDevelopment } = latestMapInputs.current
        const dev = developments.find((d: any) => normalizeDevelopment(d).dev_id === devId)
        if (dev && onSelectDevelopment) {
          onSelectDevelopment(dev)
        }
      })

      // Hover cursor
      map.on('mouseenter', LAYER_STOPS_CIRCLE, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', LAYER_STOPS_CIRCLE, () => {
        map.getCanvas().style.cursor = ''
      })
      map.on('mouseenter', LAYER_DEVELOPMENTS_EXTRUSION, () => {
        map.getCanvas().style.cursor = 'pointer'
      })
      map.on('mouseleave', LAYER_DEVELOPMENTS_EXTRUSION, () => {
        map.getCanvas().style.cursor = ''
      })

      mapRef.current = map

      const resizeObserver = new ResizeObserver(() => {
        if (mapRef.current) {
          mapRef.current.resize()
        }
      })
      resizeObserver.observe(mapContainerRef.current)

      return () => {
        resizeObserver.disconnect()
        map.remove()
        mapRef.current = null
      }
    } catch (err) {
      console.error('Mapbox creation error:', err)
      setStatusMessage(`WebGL / Mapbox error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [mapboxToken])

  // Retain a dataset update until the style is ready, including saved-run switches.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    return scheduleSolarUpdate(map, () => {
      updateCorridorMapData(map, corridor, developments)
      updateDevelopmentsVisibility(map, currentVisibleDevIds)
    })
  }, [corridor, developments, currentVisibleDevIds, mapboxToken])

  // React to selected development styling changes
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      updateDevelopmentsSelected(mapRef.current, selectedDevId)
    }
  }, [selectedDevId])

  // Keep the latest selection pending while Mapbox is rebuilding its style.
  useEffect(() => {
    const map = mapRef.current
    if (!map) return

    return scheduleSolarUpdate(map, () => {
      updateShadowTimeAndVisibility(map, {
        enabled: isShadowsActive && currentSlot.sun_up,
        localTime: currentSlot.local_time,
        activePhase,
      })

      // Synchronize Mapbox Standard lighting preset with solar time.
      try {
        map.setConfigProperty('basemap', 'lightPreset',
          isShadowsActive ? currentSlot.lightPreset || 'day' : 'day')
      } catch {
        // Fallback gracefully for styles without Standard lighting presets.
      }
    })
  }, [isShadowsActive, currentSlot.local_time, currentSlot.lightPreset, currentSlot.sun_up,
    activePhase, mapboxToken, corridor, developments])

  // Center camera when selected stop changes
  useEffect(() => {
    const previous = previousStopSelection.current
    previousStopSelection.current = selectedStopId
    if (!selectedStopId) return
    // Hydrating the initial inspector must not compete with the corridor overview.
    if (!initialStopHydrated.current) {
      initialStopHydrated.current = true
      return
    }
    if (previous === selectedStopId || !mapRef.current) return
    const stop = corridor.stops.find((s: any) => {
      const norm = normalizeStop(s)
      return norm.stop_id === selectedStopId
    })
    if (stop) {
      const norm = normalizeStop(stop)
      const currentP = mapRef.current.getPitch()
      const isCurrently3D = currentP >= 5
      mapRef.current.flyTo({
        center: [norm.lon, norm.lat],
        zoom: 15.8,
        pitch: isCurrently3D ? (currentP > 20 ? currentP : 50) : 0,
        bearing: isCurrently3D ? mapRef.current.getBearing() : 0,
        speed: 1.2,
      })
    }
  }, [selectedStopId, corridor.stops])

  // An explicit request can revisit the same stop after the user pans away.
  useEffect(() => {
    const map = mapRef.current
    if (!map || !platformViewRequest) return
    const rawStop = corridor.stops.find((stop: any) =>
      normalizeStop(stop).stop_id === platformViewRequest.stopId)
    if (!rawStop) return
    const stop = normalizeStop(rawStop)
    platformTransitionRef.current = true
    return animateStreetView(map, [stop.lon, stop.lat], () => {
      platformTransitionRef.current = false
    })

  }, [platformViewRequest, corridor.stops])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !buildingViewRequest) return
    const development = developments.find(value => normalizeDevelopment(value).dev_id === buildingViewRequest.devId)
    if (!development) return
    platformTransitionRef.current = true
    return animateStreetView(map, buildingStreetViewLocation(development), () => {
      platformTransitionRef.current = false
    }, 0)
  }, [buildingViewRequest, developments])

  // Center camera when selected development changes
  useEffect(() => {
    if (!mapRef.current || !selectedDevId) return
    const dev = developments.find((d: any) => {
      const norm = normalizeDevelopment(d)
      return norm.dev_id === selectedDevId
    })
    if (dev) {
      const coords = getDevelopmentCoordinates(dev)
      const currentP = mapRef.current.getPitch()
      const isCurrently3D = currentP >= 5
      mapRef.current.flyTo({
        center: [coords[0], coords[1]],
        zoom: 16.4,
        pitch: isCurrently3D ? (currentP > 20 ? currentP : 60) : 0,
        bearing: isCurrently3D ? mapRef.current.getBearing() : 0,
        speed: 1.2,
      })
    }
  }, [selectedDevId, developments])

  // Fit bounds helper (preserves 3D pitch and adds right panel padding)
  const fitToCorridor = (map: MapboxMap, stops: any[]) => {
    if (!stops || stops.length === 0) return
    const bounds = new mapboxgl.LngLatBounds()
    stops.forEach((raw) => {
      const s = normalizeStop(raw)
      bounds.extend([s.lon, s.lat])
    })
    const currentP = map.getPitch()
    const isCurrently3D = currentP >= 5
    map.fitBounds(bounds, {
      padding: { top: 90, bottom: 90, left: 100, right: 380 },
      maxZoom: 15.6,
      duration: 900,
      pitch: isCurrently3D ? (currentP > 20 ? currentP : 55) : 0,
      bearing: isCurrently3D ? map.getBearing() : 0,
    })
  }

  // Toggle 2D / 3D tilt: reactive to current angle
  const togglePitch = () => {
    if (!mapRef.current) return
    const currentP = mapRef.current.getPitch()
    if (currentP >= 5) {
      mapRef.current.easeTo({
        pitch: 0,
        bearing: 0,
        duration: 600,
      })
    } else {
      mapRef.current.easeTo({
        pitch: 55,
        bearing: -20,
        duration: 600,
      })
    }
  }

  const displayDevs = developments ?? []

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100%',
        backgroundColor: 'hsl(var(--background))',
      }}
      className={className}
    >
      {/* Mapbox Canvas Container */}
      <div
        ref={mapContainerRef}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: '100%',
        }}
      />

      {/* Mapbox Token Prompt Dialog if missing */}
      {showTokenPrompt && (
        <div className="absolute inset-0 bg-background/80 backdrop-blur-md z-50 flex items-center justify-center p-6">
          <div className="liquid-glass-panel rounded-2xl max-w-md w-full p-6 shadow-2xl flex flex-col gap-4">
            <div>
              <div className="status-chip status-chip-sourced mb-2">OPTION A · MAPBOX STANDARD 3D</div>
              <h2
                className="text-2xl text-foreground font-normal tracking-tight"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Mapbox Standard 3D Setup
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Option A uses Mapbox GL JS 3 with <code className="text-cyan-300">mapbox://styles/mapbox/standard</code> for native city-wide 3D buildings and twilight lighting.
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-[11px] text-muted-foreground uppercase tracking-wider">
                Mapbox Public Access Token
              </label>
              <input
                type="text"
                placeholder="pk.eyJ1..."
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                className="w-full px-3 py-2 text-sm bg-black/40 border border-border/60 rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400"
              />
              <span className="text-[10px] text-muted-foreground/80">
                You can also configure <code className="text-foreground">VITE_MAPBOX_TOKEN</code> in <code className="text-foreground">frontend/.env.local</code>.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={handleSaveToken}
                disabled={!tokenInput.trim()}
                className="liquid-glass rounded-full px-5 py-2 text-xs font-medium text-cyan-300 hover:scale-[1.03] transition-transform disabled:opacity-50"
              >
                Activate Mapbox 3D
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status or Error Banner if map is initializing */}
      {statusMessage && !showTokenPrompt && (
        <div className="liquid-glass rounded-xl px-5 py-3 text-sm text-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-40 shadow-2xl">
          {statusMessage}
        </div>
      )}

      {/* Floating Map Controls Overlay (Top Left) */}
      {/* Hitbox fix: outer container is pointer-events-none and select-none so clicking outside any pill passes directly to Mapbox */}
      <div className="!absolute top-5 left-6 flex flex-col items-start gap-2.5 z-20 pointer-events-none select-none">
        {/* Development Visibility Toggle Pills & Sunlight Button */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
          {displayDevs.map((rawDev) => {
            const dev = normalizeDevelopment(rawDev)
            const isVisible = currentVisibleDevIds.includes(dev.dev_id)
            const label = dev.name || toShortAddress(dev.address) || dev.dev_id

            return (
              <button
                key={dev.dev_id}
                type="button"
                onClick={() => handleToggleDevelopment(dev.dev_id)}
                aria-pressed={isVisible}
                data-tone="cyan"
                className={`map-toggle liquid-glass rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs transition-all cursor-pointer ${
                  isVisible
                    ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-400/50 shadow-md font-medium'
                    : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/25 hover:border-white/40 shadow-md backdrop-blur-md'
                }`}
                title={isVisible ? `Hide ${label} from map` : `Show ${label} on map`}
              >
                <span
                  className={`w-2 h-2 rounded-full transition-all ${
                    isVisible
                      ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                      : 'bg-white/30 border border-white/20'
                  }`}
                />
                <span>{label}</span>
              </button>
            )
          })}

          {/* Time of Day Toggle Button */}
          <button
            type="button"
            onClick={() => handleToggleShadows()}
            aria-pressed={isShadowsActive}
            data-tone="amber"
            className={`map-toggle liquid-glass rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs transition-all cursor-pointer ${
              isShadowsActive
                ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50 shadow-md font-medium'
                : 'bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white border border-white/25 hover:border-white/40 shadow-md backdrop-blur-md'
            }`}
            title="Toggle time of day solar analysis"
          >
            <span className="text-amber-400">☀️</span>
            <span>Time of day</span>
          </button>
        </div>

        {/* Camera Perspective Controls */}
        <div className="liquid-glass rounded-full px-3 py-1 flex items-center gap-2 self-start text-xs pointer-events-auto">
          <button
            type="button"
            onClick={togglePitch}
            className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
              is3D ? 'text-rose-400 font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
            title={is3D ? 'Switch to 2D top-down plan' : 'Switch to 3D perspective view (55°)'}
          >
            {is3D ? `3D View (${pitch}°)` : '2D Plan'}
          </button>
          <span className="text-white/20">|</span>
          <button
            type="button"
            onClick={() => mapRef.current && fitToCorridor(mapRef.current, corridor.stops)}
            className="px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Fit Corridor
          </button>
        </div>

        {/* Interactive Sunlight & Shadows Panel */}
        {/* Hitbox fix: panel has its own exact bounded width with pointer-events-auto; empty space around it passes through */}
        {isShadowsActive && !hideAllPopups && (
          isSolarMinimized ? (
            /* Minimized Solar Pill */
            <div className="liquid-glass rounded-full px-4 py-1.5 flex items-center gap-2.5 text-xs shadow-xl border border-amber-500/40 animate-fade-rise self-start pointer-events-auto select-none">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-medium text-foreground">
                ☀️ {currentSlot.seasonName} · {currentSlot.timeLabel}
              </span>
              <span className="text-[11px] font-mono text-cyan-300 font-semibold">
                {currentSlot.clockTime}
              </span>
              <div className="flex items-center gap-1 border-l border-border/40 pl-2">
                <button
                  type="button"
                  onClick={() => setIsSolarMinimized(false)}
                  className="hover:text-foreground text-muted-foreground cursor-pointer text-xs p-0.5"
                  title="Expand Sunlight & Shadows Controls"
                  aria-label="Expand Sunlight & Shadows Controls"
                >
                  ▾
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleShadows(false)}
                  className="hover:text-foreground text-muted-foreground cursor-pointer text-xs p-0.5"
                  title="Turn Off Sunlight & Shadows"
                  aria-label="Turn Off Sunlight & Shadows"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Sunlight & Shadows Card */
            <div className="liquid-glass-panel map-glass-panel rounded-2xl p-4 shadow-2xl flex flex-col gap-3.5 w-[360px] max-w-[calc(100vw-3rem)] max-h-[calc(100vh-22rem)] overflow-y-auto animate-fade-rise backdrop-blur-md border border-amber-500/30 pointer-events-auto select-none">
              {/* Card Header */}
              <div className="flex items-center justify-between text-xs border-b border-border/30 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                  <span className="font-semibold text-foreground tracking-tight text-sm">Sunlight &amp; Shadows</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsSolarMinimized(true)}
                    className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer font-bold leading-none"
                    title="Minimize to pill"
                    aria-label="Minimize to pill"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleShadows(false)}
                    className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer"
                    title="Turn Off Sunlight & Shadows"
                    aria-label="Turn Off Sunlight & Shadows"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Season Selector: 4 Normal Speech Seasons */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Season</span>
                  <span className="text-amber-300 font-medium font-mono text-[10px]">{currentSlot.subName || currentSlot.seasonName} · {currentSlot.date}</span>
                </div>
                <div className="grid grid-cols-4 gap-1 bg-black/35 p-1 rounded-xl border border-white/5">
                  {SEASONS.map((season) => {
                    const isSelected = selectedSeason === season.id
                    return (
                      <button
                        key={season.id}
                        type="button"
                        onClick={() => setSelectedSeason(season.id)}
                        className={`py-1.5 px-1 rounded-lg text-center transition-all cursor-pointer flex flex-col items-center gap-0.5 ${
                          isSelected
                            ? 'bg-amber-500/25 text-amber-200 border border-amber-400/50 shadow-sm font-medium scale-[1.02]'
                            : 'text-muted-foreground hover:text-foreground hover:bg-white/5'
                        }`}
                      >
                        <span className="text-xs">{season.icon}</span>
                        <span className="text-[11px] font-medium leading-none">{season.name}</span>
                        <span className="text-[9px] text-muted-foreground/75 leading-none">{season.date}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Time of Day Slider: Morning, Noon, Afternoon, Night */}
              <div className="flex flex-col gap-2 bg-black/25 p-2.5 rounded-xl border border-white/5">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="text-muted-foreground font-medium uppercase tracking-wider text-[10px]">Time of Day</span>
                  <span className="text-cyan-300 font-mono font-medium text-xs flex items-center gap-1.5">
                    <span>{currentSlot.clockTime}</span>
                    <span className="text-[10px] text-muted-foreground font-sans">({currentSlot.timeLabel})</span>
                  </span>
                </div>

                {/* Thumb centers align with the centers of the four equal label columns. */}
                <div className="px-1 pt-1">
                  <input
                    type="range"
                    min={0}
                    max={3}
                    step={1}
                    value={sliderIndex}
                    onChange={(e) => handleSliderChange(Number(e.target.value))}
                    className="block mx-auto w-[calc(75%+1rem)] h-2 bg-black/50 rounded-lg appearance-none cursor-pointer accent-amber-400 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-amber-400 [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-amber-400"
                    aria-label="Time of Day Slider: Morning, Noon, Afternoon, Night"
                  />

                  {/* 4 Clickable Step Labels */}
                  <div className="grid grid-cols-4 items-center text-[10px] mt-2">
                    {TIME_STEPS.map((step) => {
                      const isActive = selectedTimeId === step.id
                      return (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => setSelectedTimeId(step.id)}
                          className={`flex flex-col items-center transition-all cursor-pointer ${
                            isActive
                              ? 'text-amber-300 font-semibold scale-105'
                              : 'text-muted-foreground hover:text-foreground'
                          }`}
                        >
                          <span className="text-xs">{step.icon}</span>
                          <span className="tracking-tight text-[10px] mt-0.5">{step.label}</span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>

              {/* Sun Angle Metrics */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/20 pt-1.5 px-0.5">
                <span>Sun Altitude: <strong className="text-foreground">{currentSlot.sun_altitude_deg}°{currentSlot.sun_up ? '' : ' (Night)'}</strong></span>
                <span>Azimuth: <strong className="text-foreground">{currentSlot.sun_azimuth_deg}°</strong></span>
              </div>
            </div>
          )
        )}
      </div>


    </div>
  )
}

export default CorridorMap
