import { useEffect, useRef, useState, type FC } from 'react'
import { Map as MapLibreMap, NavigationControl, LngLatBounds, type MapLayerMouseEvent } from 'maplibre-gl'
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

  // Map initialization
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return

    // Center coordinates for Dundas East / Regent Park area
    const defaultCenter: [number, number] = [-79.367, 43.661]

    const map = new MapLibreMap({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: defaultCenter,
      zoom: 14.2,
      pitch: 58,
      bearing: -25,
    })

    map.addControl(new NavigationControl({ showCompass: true }), 'top-right')

    map.on('load', () => {
      setupCorridorMapLayers(map, corridor, developments)
      updateDevelopmentsPhase(map, currentPhase)

      // Fit bounds to corridor stops
      fitToCorridor(map, corridor.stops)
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

    // Change cursor on hover
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

    return () => {
      map.remove()
      mapRef.current = null
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
    map.fitBounds(bounds, { padding: 60, maxZoom: 15.5, duration: 1000 })
  }

  // Toggle 2D / 3D tilt
  const togglePitch = () => {
    if (!mapRef.current) return
    const next3D = !is3D
    setIs3D(next3D)
    mapRef.current.easeTo({
      pitch: next3D ? 58 : 0,
      bearing: next3D ? -25 : 0,
      duration: 800,
    })
  }

  const handlePhaseChange = (phase: number) => {
    setCurrentPhase(phase)
    if (mapRef.current) {
      updateDevelopmentsPhase(mapRef.current, phase)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%' }} className={className}>
      {/* MapLibre DOM Target */}
      <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />

      {/* Floating Map Controls Overlay */}
      <div
        style={{
          position: 'absolute',
          top: '1rem',
          left: '1rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
          zIndex: 10,
        }}
      >
        {/* Phase Toggle Controls */}
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            padding: '0.35rem 0.5rem',
          }}
        >
          <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginRight: '0.25rem', fontWeight: 600 }}>
            HOUSING PHASE:
          </span>
          <button
            type="button"
            className={`phase-pill ${currentPhase === 0 ? 'phase-pill-today' : ''}`}
            style={{ opacity: currentPhase === 0 ? 1 : 0.6 }}
            onClick={() => handlePhaseChange(0)}
          >
            Today
          </button>
          <button
            type="button"
            className={`phase-pill ${currentPhase === 1 ? 'phase-pill-1' : ''}`}
            style={{ opacity: currentPhase === 1 ? 1 : 0.6 }}
            onClick={() => handlePhaseChange(1)}
          >
            Phase 1
          </button>
          <button
            type="button"
            className={`phase-pill ${currentPhase === 2 ? 'phase-pill-2' : ''}`}
            style={{ opacity: currentPhase === 2 ? 1 : 0.6 }}
            onClick={() => handlePhaseChange(2)}
          >
            Phase 2
          </button>
        </div>

        {/* Camera Perspective Controls */}
        <div
          className="glass-panel"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            padding: '0.35rem 0.5rem',
            alignSelf: 'flex-start',
          }}
        >
          <button
            type="button"
            onClick={togglePitch}
            style={{
              fontSize: 'var(--text-xs)',
              fontWeight: 'var(--font-medium)',
              padding: '0.2rem 0.5rem',
              borderRadius: 'var(--radius-xs)',
              background: is3D ? 'var(--color-ttc-red-muted)' : 'rgba(255,255,255,0.08)',
              color: is3D ? '#f87171' : 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            {is3D ? '3D View (58°)' : '2D Plan'}
          </button>

          <button
            type="button"
            onClick={() => mapRef.current && fitToCorridor(mapRef.current, corridor.stops)}
            style={{
              fontSize: 'var(--text-xs)',
              padding: '0.2rem 0.5rem',
              borderRadius: 'var(--radius-xs)',
              background: 'rgba(255,255,255,0.05)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            Fit 505 Corridor
          </button>
        </div>
      </div>

      {/* Legend Badge Bottom Left */}
      <div
        className="glass-panel"
        style={{
          position: 'absolute',
          bottom: '1.25rem',
          left: '1rem',
          padding: '0.5rem 0.75rem',
          fontSize: 'var(--text-2xs)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.3rem',
          zIndex: 10,
        }}
      >
        <div style={{ fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '0.1rem' }}>
          505 DUNDAS STREETCAR
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ display: 'inline-block', width: 14, height: 3, background: '#ef4444', borderRadius: 1 }}></span>
          <span>Streetcar Alignment</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#fff', border: '2px solid #0f172a' }}></span>
          <span>Stops ({corridor.stops.length})</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, background: '#06b6d4', borderRadius: 2 }}></span>
          <span>Phase 1 Towers (Cyan)</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <span style={{ display: 'inline-block', width: 8, height: 8, background: '#f59e0b', borderRadius: 2 }}></span>
          <span>Phase 2 Towers (Amber)</span>
        </div>
      </div>
    </div>
  )
}
