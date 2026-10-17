import { useEffect, useRef, useState, type FC } from 'react'
import {
  Map as MapLibreMap,
  NavigationControl,
  LngLatBounds,
  type MapLayerMouseEvent,
  type StyleSpecification,
} from 'maplibre-gl'
import type { Corridor, Development, Stop } from '../lib/types'
import {
  setupCorridorMapLayers,
  updateDevelopmentsPhase,
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

// 100% Free, NO-API-KEY Esri World Dark Gray Canvas with official MapLibre demo glyphs
// maxzoom: 16 ensures MapLibre smoothly overscales tiles when zooming in, preventing "Map data is unavailable"
const DARK_RASTER_STYLE: StyleSpecification = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    'esri-dark-base': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 16,
      attribution: 'Esri, © OpenStreetMap contributors, and the GIS user community',
    },
    'esri-dark-reference': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
      maxzoom: 16,
    },
  },
  layers: [
    {
      id: 'esri-dark-base-tiles',
      type: 'raster',
      source: 'esri-dark-base',
      minzoom: 0,
      maxzoom: 22,
    },
    {
      id: 'esri-dark-reference-tiles',
      type: 'raster',
      source: 'esri-dark-reference',
      minzoom: 0,
      maxzoom: 22,
    },
  ],
}

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
  const mapRef = useRef<MapLibreMap | null>(null)
  const [is3D, setIs3D] = useState(true)
  const [currentPhase, setCurrentPhase] = useState(activePhase)
  const [statusMessage, setStatusMessage] = useState<string>('Initializing 3D Map...')

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current) return
    if (mapRef.current) return // Prevent multiple instances

    const defaultCenter: [number, number] = [-79.367, 43.661]

    try {
      const map = new MapLibreMap({
        container: mapContainerRef.current,
        style: DARK_RASTER_STYLE,
        center: defaultCenter,
        zoom: 14.2,
        pitch: 55,
        bearing: -25,
      })

      map.addControl(new NavigationControl({ showCompass: true }), 'bottom-right')

      map.on('error', (e) => {
        console.warn('MapLibre event:', e)
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

      // Resize observer to ensure canvas matches container bounding box
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
      console.error('MapLibre creation error:', err)
      setStatusMessage(`WebGL / Map error: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [corridor, developments])

  // React to phase changes
  useEffect(() => {
    if (mapRef.current && mapRef.current.isStyleLoaded()) {
      updateDevelopmentsPhase(mapRef.current, activePhase)
      setCurrentPhase(activePhase)
    }
  }, [activePhase])

  // Center camera when selected stop changes
  useEffect(() => {
    if (!mapRef.current || !selectedStopId) return
    const stop = corridor.stops.find((s) => s.stop_id === selectedStopId)
    if (stop) {
      mapRef.current.flyTo({
        center: [stop.lon, stop.lat],
        zoom: 15.5,
        speed: 1.2,
      })
    }
  }, [selectedStopId, corridor.stops])

  // Center camera when selected development changes
  useEffect(() => {
    if (!mapRef.current || !selectedDevId) return
    const dev = developments.find((d) => d.dev_id === selectedDevId)
    if (dev) {
      const coords = getDevelopmentCoordinates(dev)
      mapRef.current.flyTo({
        center: [coords[0], coords[1]],
        zoom: 16,
        speed: 1.2,
      })
    }
  }, [selectedDevId, developments])

  // Fit bounds helper
  const fitToCorridor = (map: MapLibreMap, stops: Stop[]) => {
    if (stops.length === 0) return
    const bounds = new LngLatBounds()
    stops.forEach((s) => bounds.extend([s.lon, s.lat]))
    map.fitBounds(bounds, { padding: 70, maxZoom: 15.5, duration: 800 })
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
      {/* MapLibre Canvas Container */}
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

      {/* Status or Error Banner if map is initializing */}
      {statusMessage && (
        <div
          className="liquid-glass rounded-xl px-5 py-3 text-sm text-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 shadow-2xl"
        >
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
        </div>
      </div>

      {/* Legend Badge Bottom Left */}
      <div className="!absolute bottom-6 left-6 z-20 min-w-[200px] liquid-glass rounded-2xl p-4 text-xs flex flex-col gap-2">
        <div
          className="text-sm tracking-tight text-foreground"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          505 Dundas Streetcar
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
