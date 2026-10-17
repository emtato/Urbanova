import { useState, type FC } from 'react'
import {
  type CorridorDevelopment,
  type CorridorStop,
  normalizeDevelopment,
  normalizeStop,
} from '../map/types'
import { getDevelopmentPhase } from '../map/MassingLayer'
import type { CaseResult, StopResult } from '../lib/types'

export interface StopPanelProps {
  stop: CorridorStop | any
  stops?: Array<CorridorStop | any>
  developments?: Array<CorridorDevelopment | any>
  currentCase?: CaseResult | any
  growthCase?: CaseResult | any
  supportedCase?: CaseResult | any
  berths?: number
  onClose: () => void
  onSelectDevelopment?: (dev: CorridorDevelopment) => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

function formatWait(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  const mins = (seconds / 60).toFixed(1)
  return `${mins}m`
}

function formatPercent(share: number | null | undefined): string {
  if (share == null) return '0%'
  return `${Math.round(share * 100)}%`
}

interface StopMetricsSummary {
  existing?: StopResult
  newCohort?: StopResult
  totalPassengers: number
  completedPassengers: number
  meanWaitS: number | null
  p95WaitS: number | null
  deniedShare: number | null
  remainingQueue: number
  headwayCv: number | null
}

function extractStopMetrics(caseResult: CaseResult | undefined, stopId: string): StopMetricsSummary {
  if (!caseResult?.stops) {
    return {
      totalPassengers: 0,
      completedPassengers: 0,
      meanWaitS: null,
      p95WaitS: null,
      deniedShare: null,
      remainingQueue: 0,
      headwayCv: null,
    }
  }

  const existing = caseResult.stops.find(
    (s) => s.stop_id === stopId && s.rider_group === 'existing'
  )
  const newCohort = caseResult.stops.find(
    (s) => s.stop_id === stopId && s.rider_group === 'new'
  )

  const existingPassengers = existing?.passengers ?? 0
  const newPassengers = newCohort?.passengers ?? 0
  const totalPassengers = existingPassengers + newPassengers

  const existingCompleted = existing?.completed_passengers ?? 0
  const newCompleted = newCohort?.completed_passengers ?? 0
  const completedPassengers = existingCompleted + newCompleted

  const remainingQueue = (existing?.remaining_queue ?? 0) + (newCohort?.remaining_queue ?? 0)

  // Compute composite mean wait
  let meanWaitS: number | null = null
  if (existing?.mean_wait_s != null && newCohort?.mean_wait_s != null) {
    const totalComp = existingCompleted + newCompleted
    if (totalComp > 0) {
      meanWaitS =
        (existing.mean_wait_s * existingCompleted +
          newCohort.mean_wait_s * newCompleted) /
        totalComp
    } else {
      meanWaitS = Math.max(existing.mean_wait_s, newCohort.mean_wait_s)
    }
  } else if (existing?.mean_wait_s != null) {
    meanWaitS = existing.mean_wait_s
  } else if (newCohort?.mean_wait_s != null) {
    meanWaitS = newCohort.mean_wait_s
  }

  // Worst p95 wait
  let p95WaitS: number | null = null
  if (existing?.p95_wait_s != null && newCohort?.p95_wait_s != null) {
    p95WaitS = Math.max(existing.p95_wait_s, newCohort.p95_wait_s)
  } else if (existing?.p95_wait_s != null) {
    p95WaitS = existing.p95_wait_s
  } else if (newCohort?.p95_wait_s != null) {
    p95WaitS = newCohort.p95_wait_s
  }

  // Denied boarding share
  let deniedShare: number | null = null
  if (existing?.denied_at_least_once_share != null && newCohort?.denied_at_least_once_share != null) {
    if (totalPassengers > 0) {
      deniedShare =
        (existing.denied_at_least_once_share * existingPassengers +
          newCohort.denied_at_least_once_share * newPassengers) /
        totalPassengers
    } else {
      deniedShare = Math.max(
        existing.denied_at_least_once_share,
        newCohort.denied_at_least_once_share
      )
    }
  } else if (existing?.denied_at_least_once_share != null) {
    deniedShare = existing.denied_at_least_once_share
  } else if (newCohort?.denied_at_least_once_share != null) {
    deniedShare = newCohort.denied_at_least_once_share
  }

  const headwayCv = existing?.headway_cv ?? newCohort?.headway_cv ?? null

  return {
    existing,
    newCohort,
    totalPassengers,
    completedPassengers,
    meanWaitS,
    p95WaitS,
    deniedShare,
    remainingQueue,
    headwayCv,
  }
}

export const StopPanel: FC<StopPanelProps> = ({
  stop: rawStop,
  stops: rawStops = [],
  developments: rawDevelopments = [],
  currentCase,
  growthCase,
  supportedCase,
  berths = 1,
  onClose,
  onSelectDevelopment,
  isMinimized = false,
  onToggleMinimize,
  className = '',
}) => {
  const [activeScenarioTab, setActiveScenarioTab] = useState<'all' | 'growth' | 'supported'>('all')

  const stop = normalizeStop(rawStop)
  const stops = rawStops.map(normalizeStop)
  const developments = rawDevelopments.map(normalizeDevelopment)

  // Connecting developments within walking access of this stop
  const connectedDevelopments = developments.filter((dev) =>
    dev.access?.some((acc) => acc.stop_id === stop.stop_id)
  )
  const totalFeedingUnits = connectedDevelopments.reduce((sum, d) => sum + d.units, 0)

  // Metrics for Current, Growth, and Supported Growth cases
  const currentMetrics = extractStopMetrics(currentCase, stop.stop_id)
  const growthMetrics = extractStopMetrics(growthCase, stop.stop_id)
  const supportedMetrics = extractStopMetrics(supportedCase, stop.stop_id)

  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${stop.lat},${stop.lon}`
  const totalStopsCount = stops.length > 0 ? stops.length : 7
  const stopIndex = stop.seq + 1

  // Headway regular status
  const regularityLabel =
    growthMetrics.headwayCv != null && growthMetrics.headwayCv > 0.25
      ? 'Irregular / Bunching'
      : 'Regular Service'

  const hasBottleneck =
    (growthMetrics.remainingQueue > 0 || (growthMetrics.deniedShare ?? 0) > 0.25)

  if (isMinimized) {
    return (
      <div
        data-testid="stop-panel"
        className={`liquid-glass rounded-full px-4 py-2 shadow-2xl animate-fade-rise flex items-center gap-3 border border-border/40 ${className}`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            hasBottleneck
              ? 'bg-rose-400 shadow-[0_0_8px_#f43f5e]'
              : 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
          } animate-pulse shrink-0`}
        />
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            {stop.name}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            #{stop.gtfs_stop_id}
          </span>
        </div>
        <div className="flex items-center gap-1 border-l border-border/40 pl-2 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Expand stop details"
              aria-label="Expand stop details"
            >
              ▾
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
            title="Close stop panel"
            aria-label="Close stop panel"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="stop-panel"
      className={`liquid-glass-panel rounded-2xl p-6 shadow-2xl animate-fade-rise flex flex-col gap-4 text-foreground w-[380px] max-h-[calc(100vh-12rem)] overflow-y-auto ${className}`}
    >
      {/* Top Header: Stop GTFS Chip + Route Chip + Minimize/Close */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            data-testid="stop-gtfs-badge"
            className="status-chip status-chip-sourced"
          >
            TTC STOP #{stop.gtfs_stop_id}
          </span>
          <span className="status-chip status-chip-user">
            505 DUNDAS
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Minimize Stop Panel"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 text-xs font-bold leading-none cursor-pointer"
              title="Minimize panel"
            >
              −
            </button>
          )}
          <button
            type="button"
            data-testid="close-panel-btn"
            onClick={onClose}
            aria-label="Close Stop Panel"
            className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stop Title & Corridor Sequence */}
      <div>
        <h2
          data-testid="stop-name"
          className="text-2xl font-normal tracking-tight text-foreground"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          {stop.name}
        </h2>
        <div className="text-xs text-muted-foreground mt-0.5 flex flex-col gap-0.5 font-mono">
          <span>Sequence {stopIndex} of {totalStopsCount} · Inbound Westbound</span>
          <span>Coordinates: {stop.lat.toFixed(4)}, {stop.lon.toFixed(4)}</span>
        </div>
      </div>

      {/* Street View Link */}
      <a
        href={streetViewUrl}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="street-view-link"
        className="liquid-glass rounded-xl px-3 py-2 text-xs text-foreground hover:scale-[1.01] transition-transform flex items-center justify-between font-medium group"
      >
        <div className="flex items-center gap-2">
          <span className="text-amber-400">📍</span>
          <span>See stop platform today (Street View)</span>
        </div>
        <span className="text-muted-foreground group-hover:text-foreground transition-colors text-[10px]">
          ↗
        </span>
      </a>

      {/* Bottleneck Warning Banner if Capacity Exceeded */}
      {hasBottleneck && (
        <div
          data-testid="bottleneck-warning"
          className="bg-rose-500/10 border border-rose-500/30 rounded-xl p-3 flex items-start gap-2 text-xs text-rose-200"
        >
          <span className="text-rose-400 text-sm mt-0.5">⚠️</span>
          <div>
            <div className="font-semibold text-rose-300">
              Capacity Bottleneck Under Growth
            </div>
            <div className="text-[11px] text-rose-200/90 mt-0.5 leading-relaxed">
              New riders experience denied boardings ({formatPercent(growthMetrics.deniedShare)} left behind) and queue backlogs.
            </div>
          </div>
        </div>
      )}

      {/* Section 1: Background Demand */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <span>BACKGROUND DEMAND (EXISTING RIDERS)</span>
          <span className="status-chip status-chip-sourced">GTFS BASELINE</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="liquid-glass rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase text-muted-foreground font-medium">
              BASELINE RIDERS
            </span>
            <div className="mt-1">
              <span
                data-testid="background-passengers"
                className="text-lg font-mono font-semibold text-foreground"
              >
                {currentMetrics.existing?.passengers ?? 0}
              </span>
              <span className="text-[11px] text-muted-foreground ml-1">riders</span>
            </div>
          </div>

          <div className="liquid-glass rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase text-muted-foreground font-medium">
              BASELINE MEAN WAIT
            </span>
            <div className="mt-1">
              <span
                data-testid="background-wait"
                className="text-lg font-mono font-semibold text-emerald-400"
              >
                {formatWait(currentMetrics.existing?.mean_wait_s)}
              </span>
              <span className="text-[10px] text-muted-foreground ml-1 font-mono">
                (p95: {formatWait(currentMetrics.existing?.p95_wait_s)})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 2: Added Development Demand */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <span>ADDED DEVELOPMENT DEMAND</span>
          <span className="status-chip status-chip-assumed">PIPELINE PIPELINE</span>
        </div>

        <div className="liquid-glass rounded-xl p-3 flex flex-col gap-2">
          <div className="flex items-baseline justify-between">
            <span className="text-xs text-muted-foreground">New Pipeline Homes Feeding Stop</span>
            <span
              data-testid="feeding-units-count"
              className="text-base font-mono font-semibold text-amber-300"
            >
              {totalFeedingUnits.toLocaleString()} units
            </span>
          </div>

          {connectedDevelopments.length > 0 ? (
            <div className="flex flex-col gap-1.5 pt-1 border-t border-border/30">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                WALKING PROPOSALS ({connectedDevelopments.length})
              </span>
              {connectedDevelopments.map((dev) => {
                const phase = getDevelopmentPhase(dev)
                const access = dev.access?.find((a) => a.stop_id === stop.stop_id)
                const walkM = access ? Math.round(access.walk_m) : 0
                const walkMin = access ? (access.walk_m / 80).toFixed(1) : '—'

                return (
                  <div
                    key={dev.dev_id}
                    data-testid={`connected-dev-${dev.dev_id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => onSelectDevelopment && onSelectDevelopment(dev)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        onSelectDevelopment && onSelectDevelopment(dev)
                      }
                    }}
                    className="liquid-glass rounded-lg p-2 flex items-center justify-between gap-2 text-xs hover:border-white/30 transition-all cursor-pointer group"
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`phase-pill phase-pill-${phase} text-[9px] py-0 px-1`}>
                          P{phase}
                        </span>
                        <span className="font-medium text-foreground truncate group-hover:text-cyan-300 transition-colors">
                          {dev.name || dev.address}
                        </span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {dev.address} · {dev.units.toLocaleString()} units
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="font-mono text-cyan-300 text-[11px]">
                        {walkM}m
                      </div>
                      <div className="text-[9px] text-muted-foreground font-mono">
                        ~{walkMin} min
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div
              data-testid="no-connected-devs"
              className="text-[11px] text-muted-foreground italic py-1"
            >
              No major pipeline development directly walks to this stop (served primarily by local background walk shed).
            </div>
          )}

          {/* New Riders Generated under Growth */}
          <div className="pt-2 border-t border-border/30 flex items-center justify-between text-xs">
            <span className="text-muted-foreground">New Rider Trips Generated:</span>
            <span
              data-testid="growth-new-passengers"
              className="font-mono font-semibold text-rose-300"
            >
              +{growthMetrics.newCohort?.passengers ?? 0} peak riders
            </span>
          </div>
        </div>
      </div>

      {/* Section 3: Service & Regularity */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <span>SERVICE & HEADWAY</span>
          <span className="status-chip status-chip-sourced">TTC GTFS</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="liquid-glass rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase text-muted-foreground font-medium">
              HEADWAY REGULARITY
            </span>
            <div className="mt-1">
              <span
                data-testid="headway-cv"
                className="text-base font-mono font-semibold text-foreground"
              >
                CV {growthMetrics.headwayCv != null ? growthMetrics.headwayCv.toFixed(2) : '0.00'}
              </span>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {regularityLabel}
              </div>
            </div>
          </div>

          <div className="liquid-glass rounded-xl p-2.5 flex flex-col justify-between">
            <span className="text-[10px] uppercase text-muted-foreground font-medium">
              PLATFORM BERTHS
            </span>
            <div className="mt-1">
              <span
                data-testid="stop-berths"
                className="text-base font-mono font-semibold text-foreground"
              >
                {berths}
              </span>
              <span className="text-[11px] text-muted-foreground ml-1">streetcar berth</span>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                ~6.0m scheduled peak
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 4: Multi-Scenario Results Comparison */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <span>SCENARIO RESULTS COMPARISON</span>
          {/* Quick tab toggle */}
          <div className="flex items-center gap-1 bg-white/5 rounded-lg p-0.5 border border-white/10">
            <button
              type="button"
              onClick={() => setActiveScenarioTab('all')}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                activeScenarioTab === 'all'
                  ? 'bg-white/20 text-foreground font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveScenarioTab('growth')}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                activeScenarioTab === 'growth'
                  ? 'bg-rose-500/20 text-rose-300 font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Growth
            </button>
            <button
              type="button"
              onClick={() => setActiveScenarioTab('supported')}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                activeScenarioTab === 'supported'
                  ? 'bg-emerald-500/20 text-emerald-300 font-semibold'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Supported
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2" data-testid="scenario-results-cards">
          {/* 1. Current / Baseline */}
          {(activeScenarioTab === 'all' || activeScenarioTab === 'growth') && (
            <div className="liquid-glass rounded-xl p-3 flex flex-col gap-2 border-l-2 border-l-slate-400">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-foreground">
                  1. Current (Baseline)
                </span>
                <span className="text-[10px] text-muted-foreground font-mono">
                  Today
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase">Mean Wait</div>
                  <div className="font-mono font-semibold text-foreground text-xs mt-0.5">
                    {formatWait(currentMetrics.meanWaitS)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase">Denied %</div>
                  <div className="font-mono font-semibold text-foreground text-xs mt-0.5">
                    {formatPercent(currentMetrics.deniedShare)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase">Remaining</div>
                  <div className="font-mono font-semibold text-foreground text-xs mt-0.5">
                    {currentMetrics.remainingQueue}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 2. Growth (Unmitigated) */}
          {(activeScenarioTab === 'all' || activeScenarioTab === 'growth') && (
            <div
              data-testid="growth-result-card"
              className={`liquid-glass rounded-xl p-3 flex flex-col gap-2 border-l-2 ${
                hasBottleneck ? 'border-l-rose-500 bg-rose-500/[0.04]' : 'border-l-amber-500'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-rose-300">
                  2. Growth (Unmitigated)
                </span>
                <span className="text-[10px] text-rose-300/80 font-mono">
                  Phase 1+2
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase">Mean Wait</div>
                  <div
                    data-testid="growth-mean-wait"
                    className="font-mono font-semibold text-rose-400 text-xs mt-0.5"
                  >
                    {formatWait(growthMetrics.meanWaitS)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase">Denied %</div>
                  <div
                    data-testid="growth-denied-share"
                    className="font-mono font-semibold text-rose-400 text-xs mt-0.5"
                  >
                    {formatPercent(growthMetrics.deniedShare)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase">Remaining</div>
                  <div
                    data-testid="growth-remaining-queue"
                    className="font-mono font-semibold text-rose-400 text-xs mt-0.5"
                  >
                    {growthMetrics.remainingQueue}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 3. Supported Growth (Mitigated) */}
          {(activeScenarioTab === 'all' || activeScenarioTab === 'supported') && (
            <div
              data-testid="supported-result-card"
              className="liquid-glass rounded-xl p-3 flex flex-col gap-2 border-l-2 border-l-emerald-400 bg-emerald-500/[0.04]"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-emerald-300">
                  3. Supported Growth (Mitigated)
                </span>
                <span className="text-[10px] text-emerald-300/80 font-mono">
                  +Interventions
                </span>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase">Mean Wait</div>
                  <div
                    data-testid="supported-mean-wait"
                    className="font-mono font-semibold text-emerald-400 text-xs mt-0.5"
                  >
                    {formatWait(supportedMetrics.meanWaitS)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase">Denied %</div>
                  <div
                    data-testid="supported-denied-share"
                    className="font-mono font-semibold text-emerald-400 text-xs mt-0.5"
                  >
                    {formatPercent(supportedMetrics.deniedShare)}
                  </div>
                </div>
                <div className="bg-white/5 rounded-lg p-1.5">
                  <div className="text-[9px] text-muted-foreground uppercase">Remaining</div>
                  <div
                    data-testid="supported-remaining-queue"
                    className="font-mono font-semibold text-emerald-400 text-xs mt-0.5"
                  >
                    {supportedMetrics.remainingQueue}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
