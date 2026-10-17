import { useState, useEffect, type FC } from 'react'
import type { ReplayStream, ReplayEvent } from '../lib/types'
import type { CorridorStop } from '../map/types'
import { normalizeStop } from '../map/types'

export interface ReplaySpineProps {
  replay: ReplayStream | null
  stops: Array<CorridorStop | any>
  onSelectStop?: (stopId: string) => void
  onClose?: () => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

export const ReplaySpine: FC<ReplaySpineProps> = ({
  replay,
  stops: rawStops = [],
  onSelectStop,
  onClose,
  isMinimized = false,
  onToggleMinimize,
  className = '',
}) => {
  const [currentTime, setCurrentTime] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(false)
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1)
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null)

  const stops = rawStops.map(normalizeStop)
  const stopMap = new Map<string, string>(stops.map((s) => [s.stop_id, s.name]))

  const horizon = replay?.horizon_s ?? 7200

  // Playback timer tick
  useEffect(() => {
    if (!isPlaying) return
    const interval = setInterval(() => {
      setCurrentTime((prev) => {
        const next = prev + 10 * playbackSpeed
        if (next >= horizon) {
          setIsPlaying(false)
          return horizon
        }
        return next
      })
    }, 100)
    return () => clearInterval(interval)
  }, [isPlaying, playbackSpeed, horizon])

  if (!replay) {
    return (
      <div className={`liquid-glass rounded-2xl p-4 text-xs text-muted-foreground ${className}`}>
        No replay event stream available for this run.
      </div>
    )
  }

  // Active events up to current time
  const visibleEvents = replay.events.filter((e) => e.t_s <= currentTime)

  // Vehicles status
  const vehicles = Object.entries(replay.vehicle_capacity).map(([vehId, capacity]) => {
    const vehEvents = visibleEvents.filter((e) => e.vehicle_id === vehId)
    const lastEvent = vehEvents[vehEvents.length - 1] as ReplayEvent | undefined
    const load = lastEvent ? lastEvent.load_after : 0
    return {
      id: vehId,
      capacity,
      load,
      lastEvent,
      isDispatched: Boolean(lastEvent),
    }
  })

  // Queues status per stop
  const stopQueues = stops.map((stop) => {
    const initialForStop = replay.initial_queues
      .filter((q) => q.stop_id === stop.stop_id)
      .reduce((sum, q) => sum + q.count, 0)

    const boardedAtStop = visibleEvents
      .filter((e) => e.stop_id === stop.stop_id && e.kind === 'board')
      .reduce((sum, e) => sum + e.count, 0)

    const deniedAtStop = visibleEvents
      .filter((e) => e.stop_id === stop.stop_id && e.kind === 'deny')
      .reduce((sum, e) => sum + e.count, 0)

    const remaining = Math.max(0, initialForStop - boardedAtStop)
    return {
      stop,
      initial: initialForStop,
      boarded: boardedAtStop,
      denied: deniedAtStop,
      remaining,
    }
  })

  if (isMinimized) {
    return (
      <div
        data-testid="replay-spine"
        className={`liquid-glass rounded-full px-4 py-2 shadow-2xl animate-fade-rise flex items-center gap-3 border border-border/40 ${className}`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse shrink-0" />
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            Replay: {Math.floor(currentTime / 60)}m {currentTime % 60}s
          </span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            ({isPlaying ? `${playbackSpeed}x` : 'Paused'})
          </span>
        </div>
        <div className="flex items-center gap-1 border-l border-border/40 pl-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsPlaying((prev) => !prev)}
            className="text-xs text-foreground p-1 hover:text-cyan-300 transition-colors cursor-pointer"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Expand Replay"
              aria-label="Expand Replay"
            >
              ▾
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Close Replay"
              aria-label="Close Replay"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="replay-spine"
      className={`liquid-glass-panel rounded-2xl p-6 shadow-2xl animate-fade-rise flex flex-col gap-4 text-foreground w-[400px] max-h-[calc(100vh-10rem)] overflow-y-auto ${className}`}
    >
      {/* Top Header: Labeled "one illustrative run" (Required by D8) */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span
            data-testid="illustrative-run-badge"
            className="status-chip status-chip-assumed font-mono text-[9px]"
          >
            one illustrative run
          </span>
          <span className="status-chip status-chip-sourced font-mono text-[9px]">
            REPLAY EVENTS
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Minimize Replay Panel"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 text-xs font-bold leading-none cursor-pointer"
              title="Minimize panel"
            >
              −
            </button>
          )}
          {onClose && (
            <button
              type="button"
              data-testid="close-replay-spine-btn"
              onClick={onClose}
              aria-label="Close Replay Panel"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Title */}
      <div>
        <h2
          className="text-2xl font-normal tracking-tight text-foreground m-0"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Corridor Replay Spine
        </h2>
        <div className="text-xs text-muted-foreground mt-0.5 font-mono">
          Run ID: {replay.run_id} · Two-streetcar event stream
        </div>
      </div>

      {/* Scrubber Controls */}
      <div className="liquid-glass rounded-xl p-3 flex flex-col gap-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-cyan-300 font-semibold">
            T +{currentTime}s ({Math.floor(currentTime / 60)}m {currentTime % 60}s)
          </span>
          <span className="text-muted-foreground">Horizon: {horizon}s</span>
        </div>

        <input
          type="range"
          data-testid="replay-scrubber"
          min="0"
          max={horizon}
          step="5"
          value={currentTime}
          onChange={(e) => setCurrentTime(parseInt(e.target.value, 10))}
          className="w-full accent-cyan-400 cursor-pointer"
          aria-label="Replay time scrubber"
        />

        {/* Play / Pause & Speed Controls */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              data-testid="play-pause-btn"
              onClick={() => setIsPlaying((p) => !p)}
              className="px-3 py-1 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
            >
              <span>{isPlaying ? '⏸' : '▶'}</span>
              <span>{isPlaying ? 'Pause' : 'Play'}</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentTime(0)}
              className="px-2 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-foreground font-mono transition-colors cursor-pointer"
              title="Reset to 0s"
            >
              ↺ Reset
            </button>
          </div>

          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/10 font-mono text-[10px]">
            {[1, 2, 5, 10].map((spd) => (
              <button
                key={spd}
                type="button"
                data-testid={`speed-btn-${spd}`}
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-white/20 text-foreground font-bold'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Inspect Vehicles (Capacity, Aboard, Recent Events) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <span>STREETCAR VEHICLES ({vehicles.length})</span>
          <span className="status-chip status-chip-sourced">ACTIVE</span>
        </div>

        <div className="grid grid-cols-2 gap-2" data-testid="vehicles-container">
          {vehicles.map((v) => {
            const isSelected = selectedVehicleId === v.id
            const loadPercent = Math.min(100, Math.round((v.load / v.capacity) * 100))

            return (
              <div
                key={v.id}
                data-testid={`vehicle-card-${v.id}`}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedVehicleId(isSelected ? null : v.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setSelectedVehicleId(isSelected ? null : v.id)
                  }
                }}
                className={`liquid-glass rounded-xl p-3 flex flex-col gap-2 cursor-pointer transition-all border ${
                  isSelected ? 'border-cyan-400 bg-cyan-500/10' : 'border-border/40 hover:border-white/30'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono font-semibold text-xs text-foreground truncate">
                    {v.id}
                  </span>
                  <span className={`text-[10px] font-mono ${v.isDispatched ? 'text-emerald-400' : 'text-muted-foreground'}`}>
                    {v.isDispatched ? 'In Service' : 'Depot'}
                  </span>
                </div>

                <div>
                  <div className="flex justify-between text-[10px] font-mono text-muted-foreground mb-1">
                    <span>Aboard: {v.load} riders</span>
                    <span>Cap: {v.capacity}</span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-cyan-400 h-full rounded-full transition-all duration-300"
                      style={{ width: `${loadPercent}%` }}
                    />
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground font-mono truncate">
                  {v.lastEvent
                    ? `${v.lastEvent.kind} @ ${stopMap.get(v.lastEvent.stop_id) || v.lastEvent.stop_id}`
                    : 'Awaiting dispatch'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Stop Queues & Boarding Dynamics */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <span>STOP QUEUES &amp; DENIALS</span>
          <span className="status-chip status-chip-assumed">LIVE PLATFORM</span>
        </div>

        <div className="flex flex-col gap-1.5" data-testid="stop-queues-list">
          {stopQueues.map(({ stop, remaining, denied, boarded }) => {
            const hasDenial = denied > 0

            return (
              <div
                key={stop.stop_id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectStop && onSelectStop(stop.stop_id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    onSelectStop && onSelectStop(stop.stop_id)
                  }
                }}
                className={`liquid-glass rounded-lg p-2.5 flex items-center justify-between gap-2 text-xs transition-all cursor-pointer border ${
                  hasDenial ? 'border-rose-500/40 bg-rose-500/5' : 'border-border/30 hover:border-white/20'
                }`}
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground truncate">
                    {stop.name}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    #{stop.gtfs_stop_id} · Boarded: {boarded} riders
                  </span>
                </div>

                <div className="text-right shrink-0 font-mono">
                  <div className={`font-semibold ${remaining > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {remaining} waiting
                  </div>
                  {denied > 0 && (
                    <div className="text-[9px] text-rose-300">
                      {denied} denied
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
export default ReplaySpine
