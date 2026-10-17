import { useState, type FC } from 'react'
import type { Comparison, CaseResult } from '../lib/types'
import {
  type CorridorStop,
  type CorridorDevelopment,
  normalizeStop,
  normalizeDevelopment,
} from '../map/types'
import { getDevelopmentPhase } from '../map/MassingLayer'
import { StopPanel } from '../panels/StopPanel'
import { DevelopmentPanel } from '../panels/DevelopmentPanel'

export interface ListViewProps {
  comparison: Comparison
  onSwitchToMap?: () => void
  className?: string
}

function formatWait(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  return `${(seconds / 60).toFixed(1)}m`
}

export const ListView: FC<ListViewProps> = ({
  comparison,
  onSwitchToMap,
  className = '',
}) => {
  const [selectedTab, setSelectedTab] = useState<'stops' | 'developments' | 'summary'>('stops')
  const [selectedStop, setSelectedStop] = useState<CorridorStop | null>(null)
  const [selectedDev, setSelectedDev] = useState<CorridorDevelopment | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  const stops = (comparison.corridor?.stops ?? []).map(normalizeStop)
  const developments = (comparison.scenario?.developments ?? []).map(normalizeDevelopment)
  const totalUnits = developments.reduce((sum, d) => sum + d.units, 0)

  const currentCase = comparison.cases.find((c: CaseResult) => c.kind === 'current')
  const growthCase = comparison.cases.find((c: CaseResult) => c.kind === 'growth')
  const supportedCase = comparison.cases.find((c: CaseResult) => c.kind === 'supported_growth')

  // Filter stops / developments by search query
  const filteredStops = stops.filter(
    (s) =>
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.gtfs_stop_id.includes(searchQuery)
  )

  const filteredDevs = developments.filter(
    (d) =>
      d.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (d.pipeline_ref && d.pipeline_ref.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  return (
    <div
      data-testid="list-view"
      className={`flex flex-col w-full h-full min-h-screen bg-background text-foreground p-6 overflow-y-auto ${className}`}
    >
      {/* Top Header & Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-border/40">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="status-chip status-chip-sourced font-mono text-[10px]">
              2D ACCESSIBLE LIST VIEW
            </span>
            <span className="status-chip status-chip-user font-mono text-[10px]">
              ROUTE 505 DUNDAS
            </span>
          </div>
          <h1
            className="text-3xl font-normal tracking-tight text-foreground m-0"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Corridor Data Inventory &amp; 2D Fallback
          </h1>
          <p className="text-xs text-muted-foreground mt-1 max-w-2xl font-mono">
            Full corridor inspection without WebGL requirement. Essential data mirror for stops, pipeline proposals, and simulated passenger wait times.
          </p>
        </div>

        {onSwitchToMap && (
          <button
            type="button"
            data-testid="switch-to-map-btn"
            onClick={onSwitchToMap}
            className="px-4 py-2 rounded-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold text-xs shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center gap-2 shrink-0 self-start sm:self-auto"
          >
            <span>Switch to 3D Map</span>
            <span>↗</span>
          </button>
        )}
      </div>

      {/* Key Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 my-6">
        <div className="liquid-glass rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            CORRIDOR STOPS
          </span>
          <div className="mt-1">
            <span className="text-2xl font-mono font-semibold text-cyan-300">
              {stops.length}
            </span>
            <span className="text-xs text-muted-foreground ml-1">stops</span>
          </div>
        </div>

        <div className="liquid-glass rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            PROPOSED HOMES (P1+P2)
          </span>
          <div className="mt-1">
            <span className="text-2xl font-mono font-semibold text-amber-300">
              {totalUnits.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground ml-1">units</span>
          </div>
        </div>

        <div className="liquid-glass rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            PEAK WINDOW
          </span>
          <div className="mt-1">
            <span className="text-lg font-mono font-semibold text-foreground">
              07:00–09:00
            </span>
            <span className="text-xs text-muted-foreground ml-1">AM Peak</span>
          </div>
        </div>

        <div className="liquid-glass rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
            SCHEDULED HEADWAY
          </span>
          <div className="mt-1">
            <span className="text-2xl font-mono font-semibold text-emerald-400">
              6.0m
            </span>
            <span className="text-xs text-muted-foreground ml-1">streetcar</span>
          </div>
        </div>
      </div>

      {/* Main Viewport & Navigation Tabs */}
      <div className="flex flex-col lg:flex-row gap-6 items-start">
        {/* Main List Column */}
        <div className="flex-1 w-full flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white/5 p-2 rounded-xl border border-white/10">
            <div className="flex items-center gap-1">
              <button
                type="button"
                data-testid="tab-stops"
                onClick={() => setSelectedTab('stops')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedTab === 'stops'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                TTC Stops ({stops.length})
              </button>
              <button
                type="button"
                data-testid="tab-developments"
                onClick={() => setSelectedTab('developments')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedTab === 'developments'
                    ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Development Pipeline ({developments.length})
              </button>
              <button
                type="button"
                data-testid="tab-summary"
                onClick={() => setSelectedTab('summary')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  selectedTab === 'summary'
                    ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Corridor Diagnostics
              </button>
            </div>

            {/* Quick Search */}
            <input
              type="search"
              aria-label="Filter records"
              placeholder="Filter by name, address, or GTFS ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-black/30 border border-border/40 rounded-lg px-3 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400 w-full sm:w-64 font-mono"
            />
          </div>

          {/* TAB 1: STOPS LIST */}
          {selectedTab === 'stops' && (
            <div className="flex flex-col gap-2.5" data-testid="stops-list-container">
              {filteredStops.map((stop) => {
                const growthStops = growthCase?.stops.filter((s) => s.stop_id === stop.stop_id) ?? []
                const currentStops = currentCase?.stops.filter((s) => s.stop_id === stop.stop_id) ?? []

                const growthRemaining = growthStops.reduce((sum, s) => sum + (s.remaining_queue ?? 0), 0)
                const growthDeniedMax = Math.max(0, ...growthStops.map((s) => s.denied_at_least_once_share ?? 0))
                const growthWait = growthStops.find((s) => s.mean_wait_s != null)?.mean_wait_s ?? null
                const currentWait = currentStops.find((s) => s.mean_wait_s != null)?.mean_wait_s ?? null

                const connectedDevs = developments.filter((d) =>
                  d.access?.some((a) => a.stop_id === stop.stop_id)
                )
                const isSelected = selectedStop?.stop_id === stop.stop_id
                const hasBottleneck = growthRemaining > 0 || growthDeniedMax > 0.25

                return (
                  <div
                    key={stop.stop_id}
                    data-testid={`stop-row-${stop.gtfs_stop_id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedStop(stop)
                      setSelectedDev(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedStop(stop)
                        setSelectedDev(null)
                      }
                    }}
                    className={`liquid-glass rounded-xl p-4 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                      isSelected
                        ? 'border-cyan-400/80 shadow-[0_0_15px_rgba(6,182,212,0.25)]'
                        : hasBottleneck
                        ? 'border-rose-500/40 hover:border-rose-400'
                        : 'border-border/40 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center font-mono text-xs font-semibold text-cyan-300 shrink-0 mt-0.5">
                        {stop.seq + 1}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {stop.name}
                          </span>
                          <span className="status-chip status-chip-sourced font-mono text-[9px]">
                            #{stop.gtfs_stop_id}
                          </span>
                          {hasBottleneck && (
                            <span className="status-chip status-chip-assumed text-rose-300 border-rose-500/50 bg-rose-500/10 font-mono text-[9px]">
                              BOTTLENECK
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          {connectedDevs.length > 0 ? (
                            <span className="text-amber-300/90">
                              Fed by {connectedDevs.length} proposal{connectedDevs.length > 1 ? 's' : ''} ({connectedDevs.reduce((s, d) => s + d.units, 0).toLocaleString()} units)
                            </span>
                          ) : (
                            <span>Local neighborhood walk shed only</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Metrics snapshot */}
                    <div className="flex items-center gap-4 shrink-0 text-right font-mono">
                      <div>
                        <div className="text-[9px] uppercase text-muted-foreground">Growth Wait</div>
                        <div className={`text-xs font-semibold ${hasBottleneck ? 'text-rose-400' : 'text-foreground'}`}>
                          {formatWait(growthWait)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase text-muted-foreground">Baseline</div>
                        <div className="text-xs text-muted-foreground">
                          {formatWait(currentWait)}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase text-muted-foreground">Queue</div>
                        <div className={`text-xs font-semibold ${growthRemaining ? 'text-rose-400' : 'text-muted-foreground'}`}>
                          {growthRemaining}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* TAB 2: DEVELOPMENTS LIST */}
          {selectedTab === 'developments' && (
            <div className="flex flex-col gap-2.5" data-testid="devs-list-container">
              {filteredDevs.map((dev) => {
                const phase = getDevelopmentPhase(dev)
                const isSelected = selectedDev?.dev_id === dev.dev_id

                return (
                  <div
                    key={dev.dev_id}
                    data-testid={`dev-row-${dev.dev_id}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedDev(dev)
                      setSelectedStop(null)
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        setSelectedDev(dev)
                        setSelectedStop(null)
                      }
                    }}
                    className={`liquid-glass rounded-xl p-4 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 border ${
                      isSelected
                        ? 'border-amber-400/80 shadow-[0_0_15px_rgba(245,158,11,0.25)]'
                        : 'border-border/40 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className={`phase-pill phase-pill-${phase} shrink-0 mt-0.5`}>
                        Phase {phase}
                      </span>
                      <div className="flex flex-col min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-foreground truncate">
                            {dev.name || dev.address}
                          </span>
                          <span className="status-chip status-chip-sourced font-mono text-[9px]">
                            {dev.stage}
                          </span>
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 font-mono">
                          {dev.address} · Ref: {dev.pipeline_ref || 'City Application'} · Recorded {dev.record_date}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-4 shrink-0 text-right font-mono">
                      <div>
                        <div className="text-[9px] uppercase text-muted-foreground">Proposed Units</div>
                        <div className="text-sm font-semibold text-amber-300">
                          {dev.units.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="text-[9px] uppercase text-muted-foreground">Target Year</div>
                        <div className="text-xs text-foreground">
                          {phase === 1 ? '2027' : '2030'}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* TAB 3: DIAGNOSTICS & COMPARISON */}
          {selectedTab === 'summary' && (
            <div className="liquid-glass rounded-2xl p-6 flex flex-col gap-4" data-testid="diagnostics-container">
              <h3 className="text-xl font-normal tracking-tight text-foreground" style={{ fontFamily: "'Instrument Serif', serif" }}>
                Simulation Run Diagnostics &amp; Mass Conservation
              </h3>
              <p className="text-xs text-muted-foreground leading-relaxed font-mono">
                Across all corridor stops, passengers are tracked deterministically across arrival, queueing, boarding, and departure events.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="bg-white/5 rounded-xl p-3 border border-white/10">
                  <div className="text-[10px] text-muted-foreground uppercase font-mono">Current Baseline</div>
                  <div className="text-lg font-mono font-semibold text-foreground mt-1">
                    {currentCase?.unresolved_passengers ?? 0} unresolved
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 font-mono">
                    Mean wait: {formatWait(currentCase?.per_run_mean_wait_s?.[0])}
                  </div>
                </div>

                <div className="bg-rose-500/10 rounded-xl p-3 border border-rose-500/30">
                  <div className="text-[10px] text-rose-300 uppercase font-mono">Unmitigated Growth</div>
                  <div className="text-lg font-mono font-semibold text-rose-400 mt-1">
                    {growthCase?.unresolved_passengers ?? 0} unresolved riders
                  </div>
                  <div className="text-[11px] text-rose-300/80 mt-1 font-mono">
                    Denied share: {Math.round(((growthCase?.per_run_denied_share?.[0] ?? 0) * 100))}%
                  </div>
                </div>

                <div className="bg-emerald-500/10 rounded-xl p-3 border border-emerald-500/30">
                  <div className="text-[10px] text-emerald-300 uppercase font-mono">Supported Growth</div>
                  <div className="text-lg font-mono font-semibold text-emerald-400 mt-1">
                    {supportedCase?.unresolved_passengers ?? 0} unresolved (cleared)
                  </div>
                  <div className="text-[11px] text-emerald-300/80 mt-1 font-mono">
                    Mean wait: {formatWait(supportedCase?.per_run_mean_wait_s?.[0])}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Side Inspector Column for Selected Stop or Development */}
        <div className="w-full lg:w-[380px] shrink-0">
          {selectedStop && (
            <StopPanel
              stop={selectedStop}
              stops={stops}
              developments={developments}
              currentCase={currentCase}
              growthCase={growthCase}
              supportedCase={supportedCase}
              berths={comparison.corridor?.berths_per_stop?.[selectedStop.stop_id] ?? 1}
              onClose={() => setSelectedStop(null)}
              onSelectDevelopment={(dev) => {
                setSelectedDev(dev)
                setSelectedStop(null)
              }}
            />
          )}

          {selectedDev && (
            <DevelopmentPanel
              development={selectedDev}
              stops={stops}
              onClose={() => setSelectedDev(null)}
              onSelectStop={(stop) => {
                setSelectedStop(stop)
                setSelectedDev(null)
              }}
            />
          )}

          {!selectedStop && !selectedDev && (
            <div className="liquid-glass rounded-2xl p-6 text-center text-muted-foreground flex flex-col items-center justify-center min-h-[240px] border border-border/40">
              <span className="text-2xl mb-2">🔍</span>
              <div className="text-sm font-medium text-foreground">Select Any Row</div>
              <div className="text-xs text-muted-foreground mt-1 font-mono max-w-xs">
                Click on any TTC stop or development proposal in the list to inspect full details, demand cohorts, and walk times.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
export default ListView
