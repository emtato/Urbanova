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
      attribution: 'Esri, © OpenStreetMap contributors, and the GIS user community',
    },
    'esri-dark-reference': {
      type: 'raster',
      tiles: [
        'https://services.arcgisonline.com/arcgis/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}',
      ],
      tileSize: 256,
    },
  },
  layers: [
    {
      id: 'esri-dark-base-tiles',
      type: 'raster',
      source: 'esri-dark-base',
      minzoom: 0,
      maxzoom: 20,
      paint: {
        'raster-opacity': 0.88,
      },
    },
    {
      id: 'esri-dark-reference-tiles',
      type: 'raster',
      source: 'esri-dark-reference',
      minzoom: 0,
      maxzoom: 20,
      paint: {
        'raster-opacity': 0.95,
      },
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
    if (mapRef.current) return

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

      map.addControl(new NavigationControl({ showCompass: true }), 'top-right')

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
      mapRef.current.flyTo({
        center: [dev.coordinates[0], dev.coordinates[1]],
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
    map.fitBounds(bounds, { padding: 80, maxZoom: 15.5, duration: 800 })
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
        backgroundColor: 'transparent',
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

      {/* Status banner */}
      {statusMessage && (
        <div
          className="liquid-glass animate-fade-rise"
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            padding: '1.25rem 2rem',
            borderRadius: 'var(--radius-lg)',
            color: 'var(--text-secondary)',
            fontSize: 'var(--text-sm)',
            zIndex: 100,
            textAlign: 'center',
          }}
        >
          {statusMessage}
        </div>
      )}

      {/* Floating Map Controls Overlay (Liquid Glass) */}
      <div
        className="animate-fade-rise"
        style={{
          position: 'absolute',
          top: '1.25rem',
          left: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem',
          zIndex: 10,
        }}
      >
        {/* Phase Toggle Controls */}
        <div
          className="liquid-glass"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.65rem',
            borderRadius: 'var(--radius-full)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-2xs)',
              color: 'var(--text-muted)',
              marginRight: '0.25rem',
              fontWeight: 600,
              letterSpacing: '0.05em',
            }}
          >
            PHASE:
          </span>
          <button
            type="button"
            className={`phase-pill liquid-glass-button ${currentPhase === 0 ? 'phase-pill-today' : ''}`}
            style={{ opacity: currentPhase === 0 ? 1 : 0.65 }}
            onClick={() => handlePhaseChange(0)}
          >
            Today
          </button>
          <button
            type="button"
            className={`phase-pill liquid-glass-button ${currentPhase === 1 ? 'phase-pill-1' : ''}`}
            style={{ opacity: currentPhase === 1 ? 1 : 0.65 }}
            onClick={() => handlePhaseChange(1)}
          >
            Phase 1
          </button>
          <button
            type="button"
            className={`phase-pill liquid-glass-button ${currentPhase === 2 ? 'phase-pill-2' : ''}`}
            style={{ opacity: currentPhase === 2 ? 1 : 0.65 }}
            onClick={() => handlePhaseChange(2)}
          >
            Phase 2
          </button>
        </div>

        {/* Camera Perspective Controls */}
        <div
          className="liquid-glass"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            padding: '0.3rem 0.5rem',
            borderRadius: 'var(--radius-full)',
            alignSelf: 'flex-start',
          }}
        >
          <button
            type="button"
            className="liquid-glass-button"
            onClick={togglePitch}
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 500,
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              background: is3D ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.06)',
              color: is3D ? '#f87171' : 'var(--text-secondary)',
            }}
          >
            {is3D ? '3D View (55°)' : '2D Plan'}
          </button>

          <button
            type="button"
            className="liquid-glass-button"
            onClick={() => mapRef.current && fitToCorridor(mapRef.current, corridor.stops)}
            style={{
              fontSize: 'var(--text-xs)',
              padding: '0.25rem 0.75rem',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-secondary)',
            }}
          >
            Fit 505 Corridor
          </button>
        </div>
      </div>

      {/* Legend Badge Bottom Left */}
      <div
        className="liquid-glass animate-fade-rise-delay-2"
        style={{
          position: 'absolute',
          bottom: '1.25rem',
          left: '1.25rem',
          padding: '0.75rem 1rem',
          fontSize: 'var(--text-2xs)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          borderRadius: 'var(--radius-md)',
          zIndex: 10,
        }}
      >
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-sm)',
            letterSpacing: '0.02em',
            color: 'var(--text-primary)',
            marginBottom: '0.2rem',
          }}
        >
          505 Dundas Streetcar
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-block', width: 14, height: 3, background: '#ef4444', borderRadius: 1 }}></span>
          <span>Streetcar Alignment</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fff', border: '2px solid #0f172a' }}></span>
          <span>Stops ({corridor.stops.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--phase-1)', borderRadius: 2 }}></span>
          <span>Phase 1 Towers (Cyan)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--phase-2)', borderRadius: 2 }}></span>
          <span>Phase 2 Towers (Amber)</span>
        </div>
      </div>
    </div>
  )
}
