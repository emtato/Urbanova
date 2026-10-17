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
  getDevelopmentCoordinates,
  LAYER_STOPS_CIRCLE,
  LAYER_DEVELOPMENTS_EXTRUSION,
} from './MassingLayer'

export interface CorridorMapProps {
  corridor: Corridor
  developments: Development[]
  selectedStopId?: string | null
  selectedDevId?: string | null
  activePhase?: number // 0 = Today, 1 = Phase 1, 2 = Phase 2
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
  onSelectStop,
  onSelectDevelopment,
  className = '',
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapboxMap | null>(null)
  const [is3D, setIs3D] = useState(true)
  const [currentPhase, setCurrentPhase] = useState(activePhase)
  const [statusMessage, setStatusMessage] = useState<string>('Initializing Mapbox Standard 3D Scene...')

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
        {/* Phase Toggle Controls */}
        <div className="liquid-glass rounded-full px-4 py-1.5 flex items-center gap-2 text-xs">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium mr-1">
            Phase:
          </span>
          <button
            type="button"
            className={`px-3 py-1 rounded-full text-xs transition-all ${
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
            className={`px-3 py-1 rounded-full text-xs transition-all ${
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
            className={`px-3 py-1 rounded-full text-xs transition-all ${
              currentPhase === 2
                ? 'bg-amber-500/25 text-amber-300 font-medium border border-amber-500/50 shadow-sm'
                : 'text-muted-foreground hover:text-amber-300'
            }`}
            onClick={() => handlePhaseChange(2)}
          >
            Phase 2
          </button>
        </div>

        {/* Camera Perspective Controls */}
        <div className="liquid-glass rounded-full px-3 py-1 flex items-center gap-2 self-start text-xs">
          <button
            type="button"
            onClick={togglePitch}
            className={`px-2.5 py-1 rounded-full transition-colors ${
              is3D ? 'text-rose-400 font-medium' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {is3D ? '3D View (55°)' : '2D Plan'}
          </button>
          <span className="text-white/20">|</span>
          <button
            type="button"
            onClick={() => mapRef.current && fitToCorridor(mapRef.current, corridor.stops)}
            className="px-2.5 py-1 rounded-full text-muted-foreground hover:text-foreground transition-colors"
          >
            Fit Corridor
          </button>
          <span className="text-white/20">|</span>
          <button
            type="button"
            onClick={() => setShowTokenPrompt(true)}
            className="px-2.5 py-1 rounded-full text-muted-foreground hover:text-cyan-300 transition-colors"
            title="Configure Mapbox Token"
          >
            Token
          </button>
        </div>
      </div>

      {/* Legend Badge Bottom Left */}
      <div className="!absolute bottom-6 left-6 z-20 min-w-[200px] liquid-glass rounded-2xl p-4 text-xs flex flex-col gap-2">
        <div
          className="text-sm tracking-tight text-foreground flex items-center justify-between"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          <span>505 Dundas Streetcar</span>
          <span className="text-[10px] text-cyan-300 font-mono tracking-normal">Mapbox Standard</span>
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
      </div>
    </div>
  )
}

export default CorridorMap
