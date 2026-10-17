import { useEffect, useRef, useState, type FC } from 'react'
import mapboxgl, {
  Map as MapboxMap,
  NavigationControl,
  LngLatBounds,
  type MapLayerMouseEvent,
} from 'mapbox-gl'
import type { Corridor, Development, Stop } from '../lib/types'
import {
  setupCorridorMapLayers,
  updateDevelopmentsPhase,
  updateCorridorMapData,
  updateShadowTimeAndVisibility,
  getDevelopmentCoordinates,
  LAYER_STOPS_CIRCLE,
  LAYER_DEVELOPMENTS_EXTRUSION,
} from './MassingLayer'
import {
  SEASONS,
  TIMES_OF_DAY,
  getShadowSlot,
  type ShadowSlot,
} from '../data/shadow_metadata'

export interface CorridorMapProps {
  corridor: Corridor
  developments: Development[]
  selectedStopId?: string | null
  selectedDevId?: string | null
  activePhase?: number // 0 = Today, 1 = Phase 1, 2 = Phase 2
  shadowsEnabled?: boolean
  onToggleShadows?: (enabled: boolean) => void
  hideAllPopups?: boolean
  onToggleHideAllPopups?: () => void
  onSelectStop?: (stop: Stop) => void
  onSelectDevelopment?: (dev: Development) => void
  className?: string
}

const MAPBOX_STANDARD_STYLE = 'mapbox://styles/mapbox/standard'

export const CorridorMap: FC<CorridorMapProps> = ({
  corridor,
  developments,
  selectedStopId,
  selectedDevId,
  activePhase = 2,
  shadowsEnabled,
  onToggleShadows,
  hideAllPopups = false,
  onToggleHideAllPopups,
  onSelectStop,
  onSelectDevelopment,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [is3D, setIs3D] = useState(true)
  const [currentPhase, setCurrentPhase] = useState(activePhase)
  const [statusMessage, setStatusMessage] = useState<string>('Initializing Mapbox Standard 3D Scene...')

  // Sunlight and Precomputed Shadow State (Contract 1.0.0 / Lane C)
  const [localShadowsEnabled, setLocalShadowsEnabled] = useState(false)
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
  const [isLegendMinimized, setIsLegendMinimized] = useState(false)
  const [selectedSeason, setSelectedSeason] = useState<string>('summer_solstice')
  const [selectedTimeStr, setSelectedTimeStr] = useState<string>('12:00')

  const currentSlot: ShadowSlot =
    getShadowSlot(selectedSeason, selectedTimeStr) ||
    getShadowSlot('summer_solstice', '12:00')!

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

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapRef.current) return // Prevent duplicate instances
    if (!mapboxToken) return // Wait for token

    mapboxgl.accessToken = mapboxToken

    const defaultCenter: [number, number] = [-79.364, 43.660]

    try {
      const map = new MapboxMap({
        container: mapContainerRef.current,
        style: MAPBOX_STANDARD_STYLE,
        center: defaultCenter,
        zoom: 14.6,
        pitch: 55,
        bearing: -20,
      })

      map.addControl(new NavigationControl({ showCompass: true }), 'bottom-right')

      map.on('style.load', () => {
        // Mapbox Standard 3D lighting configuration
        try {
          map.setConfigProperty('basemap', 'lightPreset', 'dusk')
          map.setConfigProperty('basemap', 'show3dObjects', true)
        } catch (e) {
          console.warn('Mapbox Standard basemap config note:', e)
        }
      })

      map.on('error', (e) => {
        console.warn('Mapbox event error:', e)
        if (e.error && String(e.error).includes('Forbidden') || String(e.error).includes('Unauthorized') || String(e.error).includes('401')) {
          setStatusMessage('Mapbox Token Invalid or Expired (401). Please check token.')
          setShowTokenPrompt(true)
        }
      })

      map.on('load', () => {
        setStatusMessage('')
        map.resize()

        try {
          setupCorridorMapLayers(map, corridor, developments)
          updateDevelopmentsPhase(map, currentPhase)
          fitToCorridor(map, corridor.stops)
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
        const stop = corridor.stops.find((s) => s.stop_id === stopId)
        if (stop && onSelectStop) {
          onSelectStop(stop)
        }
      })

      // Click handler for developments
      map.on('click', LAYER_DEVELOPMENTS_EXTRUSION, (e: MapLayerMouseEvent) => {
        if (!e.features || e.features.length === 0) return
        const feature = e.features[0]
        const devId = feature.properties?.dev_id
        const dev = developments.find((d) => d.dev_id === devId)
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
  }, [mapboxToken, corridor, developments])

  // React to phase or dataset changes
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      updateCorridorMapData(mapRef.current, corridor, developments)
      updateDevelopmentsPhase(mapRef.current, activePhase)
      setCurrentPhase(activePhase)
    }
  }, [corridor, developments, activePhase])

  // Synchronize analytical ground shadows and ambient sunlight with map
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      updateShadowTimeAndVisibility(mapRef.current, {
        enabled: isShadowsActive,
        localTime: currentSlot.local_time,
        activePhase: currentPhase,
      })

      // Synchronize Mapbox Standard lighting preset with solar time of day
      try {
        if (isShadowsActive && currentSlot.lightPreset) {
          mapRef.current.setConfigProperty('basemap', 'lightPreset', currentSlot.lightPreset)
        } else {
          mapRef.current.setConfigProperty('basemap', 'lightPreset', 'dusk')
        }
      } catch (e) {
        // Fallback gracefully if style doesn't support lightPreset config
      }
    }
  }, [isShadowsActive, currentSlot, currentPhase])

  // Center camera when selected stop changes
  useEffect(() => {
    if (!mapRef.current || !selectedStopId) return
    const stop = corridor.stops.find((s) => s.stop_id === selectedStopId)
    if (stop) {
      mapRef.current.flyTo({
        center: [stop.lon, stop.lat],
        zoom: 15.8,
        pitch: is3D ? 50 : 0,
        bearing: is3D ? -20 : 0,
        speed: 1.2,
      })
    }
  }, [selectedStopId, corridor.stops, is3D])

  // Center camera when selected development changes
  useEffect(() => {
    if (!mapRef.current || !selectedDevId) return
    const dev = developments.find((d) => d.dev_id === selectedDevId)
    if (dev) {
      const coords = getDevelopmentCoordinates(dev)
      mapRef.current.flyTo({
        center: [coords[0], coords[1]],
        zoom: 16.4,
        pitch: is3D ? 60 : 0,
        bearing: is3D ? -25 : 0,
        speed: 1.2,
      })
    }
  }, [selectedDevId, developments, is3D])

  // Fit bounds helper (preserves 3D pitch and adds right panel padding)
  const fitToCorridor = (map: MapboxMap, stops: Stop[]) => {
    if (stops.length === 0) return
    const bounds = new LngLatBounds()
    stops.forEach((s) => bounds.extend([s.lon, s.lat]))
    map.fitBounds(bounds, {
      padding: { top: 90, bottom: 90, left: 100, right: 380 },
      maxZoom: 15.6,
      duration: 900,
      pitch: is3D ? 55 : 0,
      bearing: is3D ? -20 : 0,
    })
  }

  // Toggle 2D / 3D tilt
  const togglePitch = () => {
    if (!mapRef.current) return
    const next3D = !is3D
    setIs3D(next3D)
    mapRef.current.easeTo({
      pitch: next3D ? 55 : 0,
      bearing: next3D ? -25 : 0,
      duration: 800,
    })
  }

  const handlePhaseChange = (phase: number) => {
    setCurrentPhase(phase)
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      updateDevelopmentsPhase(mapRef.current, phase)
      updateShadowTimeAndVisibility(mapRef.current, {
        enabled: isShadowsActive,
        localTime: currentSlot.local_time,
        activePhase: phase,
      })
    }
  }

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
      <div className="!absolute top-5 left-6 flex flex-col gap-2.5 z-20">
        <div className="flex flex-wrap items-center gap-2">
          {/* Phase Toggle Controls */}
          <div className="liquid-glass rounded-full px-4 py-1.5 flex items-center gap-2 text-xs">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">
              Phase:
            </span>
            <button
              type="button"
              className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                currentPhase === 0
                  ? 'bg-white/20 text-white font-medium shadow-sm'
                  : 'text-muted-foreground hover:text-white'
              }`}
              onClick={() => handlePhaseChange(0)}
            >
              Today
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                currentPhase === 1
                  ? 'bg-cyan-500/25 text-cyan-300 font-medium border border-cyan-500/50 shadow-sm'
                  : 'text-muted-foreground hover:text-cyan-300'
              }`}
              onClick={() => handlePhaseChange(1)}
            >
              Phase 1
            </button>
            <button
              type="button"
              className={`px-3 py-1 rounded-full text-xs transition-all cursor-pointer ${
                currentPhase === 2
                  ? 'bg-amber-500/25 text-amber-300 font-medium border border-amber-500/50 shadow-sm'
                  : 'text-muted-foreground hover:text-amber-300'
              }`}
              onClick={() => handlePhaseChange(2)}
            >
              Phase 2
            </button>
          </div>

          {/* Sunlight Impact Toggle Button (Contract 1.0.0 / Lane C) */}
          <button
            type="button"
            onClick={() => handleToggleShadows()}
            className={`liquid-glass rounded-full px-3.5 py-1.5 flex items-center gap-2 text-xs transition-all cursor-pointer ${
              isShadowsActive
                ? 'bg-amber-500/25 text-amber-200 border-amber-400/50 shadow-md font-medium'
                : 'text-muted-foreground hover:text-white'
            }`}
            title="Toggle precomputed sunlight impact & ground shadows (Contract 1.0.0 / Lane C)"
          >
            <span className="text-amber-400">☀️</span>
            <span>Sunlight Impact</span>
            <span
              className={`text-[9px] px-1.5 py-0.5 rounded-full font-mono uppercase ${
                isShadowsActive
                  ? 'bg-amber-400 text-black font-semibold'
                  : 'bg-white/10 text-muted-foreground'
              }`}
            >
              {isShadowsActive ? 'ON' : 'OFF'}
            </span>
          </button>
        </div>

        {/* Camera Perspective & Global UI Visibility Controls */}
        <div className="liquid-glass rounded-full px-3 py-1 flex items-center gap-2 self-start text-xs">
          <button
            type="button"
            onClick={togglePitch}
            className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer ${
              is3D ? 'text-rose-400 font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {is3D ? '3D View (55°)' : '2D Plan'}
          </button>
          <span className="text-white/20">|</span>
          <button
            type="button"
            onClick={() => mapRef.current && fitToCorridor(mapRef.current, corridor.stops)}
            className="px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          >
            Fit Corridor
          </button>
          <span className="text-white/20">|</span>
          <button
            type="button"
            onClick={() => setShowTokenPrompt(true)}
            className="px-2.5 py-1 rounded-full text-muted-foreground hover:text-cyan-300 transition-colors cursor-pointer"
            title="Configure Mapbox Token"
          >
            Token
          </button>
          {onToggleHideAllPopups && (
            <>
              <span className="text-white/20">|</span>
              <button
                type="button"
                onClick={onToggleHideAllPopups}
                className={`px-2.5 py-1 rounded-full transition-colors cursor-pointer flex items-center gap-1 ${
                  hideAllPopups ? 'bg-cyan-500/25 text-cyan-300 font-medium' : 'text-muted-foreground hover:text-foreground'
                }`}
                title={hideAllPopups ? 'Show all map popups and overlays' : 'Hide all popups for unobstructed map view'}
              >
                <span>{hideAllPopups ? '👁️ Show All' : '👁️ Hide All'}</span>
              </button>
            </>
          )}
        </div>

        {/* Interactive Solar Impact Analysis Panel (Lane C) */}
        {isShadowsActive && !hideAllPopups && (
          isSolarMinimized ? (
            /* Minimized Solar Pill */
            <div className="liquid-glass rounded-full px-4 py-1.5 flex items-center gap-2.5 text-xs shadow-xl border border-amber-500/40 animate-fade-rise self-start">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
              <span className="font-medium text-foreground">
                ☀️ {currentSlot.seasonName.split(' ')[0]} {currentSlot.timeStr}
              </span>
              <span className="text-[11px] font-mono text-orange-400 font-semibold">
                {currentPhase === 0 ? '0 m² (Today)' : `+${currentSlot.added_m2.toLocaleString()} m²`}
              </span>
              <div className="flex items-center gap-1 border-l border-border/40 pl-2">
                <button
                  type="button"
                  onClick={() => setIsSolarMinimized(false)}
                  className="hover:text-foreground text-muted-foreground cursor-pointer text-xs p-0.5"
                  title="Expand Solar Controls"
                  aria-label="Expand Solar Controls"
                >
                  ▾
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleShadows(false)}
                  className="hover:text-foreground text-muted-foreground cursor-pointer text-xs p-0.5"
                  title="Turn Off Shadows"
                  aria-label="Turn Off Shadows"
                >
                  ✕
                </button>
              </div>
            </div>
          ) : (
            /* Expanded Solar Impact Card */
            <div className="liquid-glass-panel rounded-2xl p-4 shadow-2xl flex flex-col gap-3 max-w-sm max-h-[calc(100vh-26rem)] overflow-y-auto animate-fade-rise backdrop-blur-md border border-amber-500/30">
              <div className="flex items-center justify-between text-xs border-b border-border/30 pb-2">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24]" />
                  <span className="font-semibold text-foreground tracking-tight">Solar Impact Analysis</span>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setIsSolarMinimized(true)}
                    className="text-muted-foreground hover:text-foreground text-sm p-1 cursor-pointer font-bold leading-none"
                    title="Minimize to pill"
                    aria-label="Minimize to pill"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleShadows(false)}
                    className="text-muted-foreground hover:text-foreground text-sm p-1 cursor-pointer"
                    title="Turn Off Shadows"
                    aria-label="Turn Off Shadows"
                  >
                    ✕
                  </button>
                </div>
              </div>

              {/* Season Selector */}
              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl">
                {SEASONS.map((season) => (
                  <button
                    key={season.id}
                    type="button"
                    onClick={() => setSelectedSeason(season.id)}
                    className={`flex-1 py-1 px-1.5 rounded-lg text-[11px] font-medium transition-all cursor-pointer ${
                      selectedSeason === season.id
                        ? 'bg-amber-500/25 text-amber-200 border border-amber-500/40 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <div>{season.name.split(' ')[0]}</div>
                    <div className="text-[9px] text-muted-foreground/80">{season.date}</div>
                  </button>
                ))}
              </div>

              {/* Time of Day Slots */}
              <div className="flex items-center gap-1 bg-black/30 p-1 rounded-xl">
                {TIMES_OF_DAY.map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedTimeStr(t)}
                    className={`flex-1 py-1 text-xs font-mono font-medium rounded-lg transition-all cursor-pointer ${
                      selectedTimeStr === t
                        ? 'bg-cyan-500/25 text-cyan-200 border border-cyan-500/40 shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {/* Live Net Impact Metrics */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-amber-950/40 border border-amber-500/30 rounded-xl p-2.5">
                  <div className="text-[10px] text-amber-300 uppercase tracking-wider font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-orange-500 shrink-0" />
                    <span>Sunlight Lost</span>
                  </div>
                  <div className="text-base font-mono font-semibold text-orange-300 mt-1">
                    {currentPhase === 0 ? '0 m² (Today)' : `+${currentSlot.added_m2.toLocaleString()} m²`}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">New tower shade</div>
                </div>

                <div className="bg-emerald-950/40 border border-emerald-500/30 rounded-xl p-2.5">
                  <div className="text-[10px] text-emerald-300 uppercase tracking-wider font-medium flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-sm bg-emerald-500 shrink-0" />
                    <span>Sunlight Gained</span>
                  </div>
                  <div className="text-base font-mono font-semibold text-emerald-300 mt-1">
                    {currentPhase === 0 ? '0 m² (Today)' : `+${currentSlot.removed_m2.toLocaleString()} m²`}
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Demolished parcel</div>
                </div>
              </div>

              {/* Sun Angle Metrics */}
              <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t border-border/20 pt-1.5 px-0.5">
                <span>Sun Altitude: <strong className="text-foreground">{currentSlot.sun_altitude_deg}°</strong></span>
                <span>Azimuth: <strong className="text-foreground">{currentSlot.sun_azimuth_deg}°</strong></span>
              </div>
            </div>
          )
        )}
      </div>

      {/* Legend Badge Bottom Left (Minimizable & Collision-Free) */}
      {!hideAllPopups && (
        isLegendMinimized ? (
          <div className="!absolute bottom-6 left-6 z-20 animate-fade-rise">
            <button
              type="button"
              onClick={() => setIsLegendMinimized(false)}
              className="liquid-glass rounded-full px-3.5 py-1.5 text-xs text-foreground hover:scale-[1.02] transition-transform flex items-center gap-2 shadow-xl border border-border/40 cursor-pointer"
              title="Expand Map Legend"
              aria-label="Expand Map Legend"
            >
              <span>🗺️</span>
              <span className="font-medium">Legend</span>
              <span className="text-[10px] text-muted-foreground font-mono">505 Dundas</span>
              <span className="text-xs">▴</span>
            </button>
          </div>
        ) : (
          <div className="!absolute bottom-6 left-6 z-20 min-w-[210px] max-w-[270px] max-h-[260px] overflow-y-auto liquid-glass rounded-2xl p-4 text-xs flex flex-col gap-2 shadow-2xl animate-fade-rise border border-border/30">
            <div className="flex items-center justify-between border-b border-border/30 pb-1.5">
              <span
                className="text-sm tracking-tight text-foreground"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                505 Dundas Corridor
              </span>
              <button
                type="button"
                onClick={() => setIsLegendMinimized(true)}
                className="text-muted-foreground hover:text-foreground text-xs p-1 cursor-pointer font-bold leading-none"
                title="Minimize legend to pill"
                aria-label="Minimize legend to pill"
              >
                −
              </button>
            </div>
            <div className="flex items-center gap-2.5 text-muted-foreground text-[11px]">
              <span className="w-3.5 h-1 bg-red-500 rounded-full inline-block"></span>
              <span>Streetcar Alignment</span>
            </div>
            <div className="flex items-center gap-2.5 text-muted-foreground text-[11px]">
              <span className="w-2.5 h-2.5 rounded-full bg-white border border-slate-900 inline-block"></span>
              <span>Stops ({corridor.stops.length})</span>
            </div>
            <div className="flex items-center gap-2.5 text-muted-foreground text-[11px]">
              <span className="w-2.5 h-2.5 rounded-sm bg-cyan-400 inline-block"></span>
              <span>Phase 1 Towers</span>
            </div>
            <div className="flex items-center gap-2.5 text-muted-foreground text-[11px]">
              <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block"></span>
              <span>Phase 2 Towers</span>
            </div>

            {/* Sunlight Impact Legend */}
            {isShadowsActive && (
              <div className="border-t border-border/40 pt-2 mt-1 flex flex-col gap-1.5 animate-fade-rise">
                <div className="text-[10px] uppercase tracking-wider text-amber-300 font-semibold">
                  Sunlight &amp; Shadows
                </div>
                <div className="flex items-center gap-2.5 text-muted-foreground text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-orange-500 inline-block opacity-85"></span>
                  <span>Sunlight Lost (Tower Shade)</span>
                </div>
                <div className="flex items-center gap-2.5 text-muted-foreground text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block opacity-85"></span>
                  <span>Sunlight Gained (Open Sky)</span>
                </div>
                <div className="flex items-center gap-2.5 text-muted-foreground text-[11px]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-slate-900 border border-slate-700 inline-block opacity-65"></span>
                  <span>Baseline Building Shade</span>
                </div>
              </div>
            )}
          </div>
        )
      )}
    </div>
  )
}

export default CorridorMap
