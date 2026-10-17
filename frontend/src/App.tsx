import { useEffect, useState } from 'react'
import { fetchComparison, isUsingFixture, setUseFixture } from './lib/api'
import type { Comparison, Stop, Development } from './lib/types'
import { CorridorMap } from './map/CorridorMap'
import { DevelopmentPanel } from './panels/DevelopmentPanel'

export function App() {
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [selectedDev, setSelectedDev] = useState<Development | null>(null)
  const [usingFixture, setUsingFixtureState] = useState(isUsingFixture())
  const [activePhase] = useState<number>(2)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await fetchComparison()
      setComparison(data)
      if (data.corridor.stops.length > 0) {
        setSelectedStop(data.corridor.stops[4]) // Default to Sumach / Regent Park
      }
    } catch (err) {
      console.error('Failed to load comparison data:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleFixtureMode = () => {
    const nextState = !usingFixture
    setUseFixture(nextState)
    setUsingFixtureState(nextState)
    loadData()
  }

  if (loading || !comparison) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background text-muted-foreground">
        <div className="text-center">
          <div
            className="text-4xl text-foreground mb-2"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Urbanova<sup className="text-xs">®</sup>
          </div>
          <div className="text-sm font-body text-muted-foreground">
            Loading corridor simulation workspace...
          </div>
        </div>
      </div>
    )
  }

  const developments = comparison.scenario?.developments ?? []
  const totalNewUnits = developments.reduce((sum, d) => sum + d.units, 0)
  const currentCase = comparison.cases.find((c) => c.kind === 'current')
  const growthCase = comparison.cases.find((c) => c.kind === 'growth')

  const [showDrawer, setShowDrawer] = useState(false)
  const [showFixturePopup, setShowFixturePopup] = useState(true)

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-background text-foreground font-body">
      {/* Floating Fixture Mode Alert Popup */}
      {usingFixture && showFixturePopup && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 max-w-md animate-fade-rise bg-amber-950/90 text-amber-100 border border-amber-500/60 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0 shadow-[0_0_8px_#fbbf24]" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                Fixture Mode Active
              </div>
              <div className="text-xs text-amber-100/90 mt-0.5 font-normal">
                505 Dundas Baseline Dataset (Broadview to Yonge)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={toggleFixtureMode}
              className="liquid-glass rounded-full px-3 py-1.5 text-xs text-foreground hover:scale-[1.03] transition-transform font-medium cursor-pointer"
            >
              Switch to Live API
            </button>
            <button
              type="button"
              onClick={() => setShowFixturePopup(false)}
              className="p-1 rounded-full text-amber-300/80 hover:text-white hover:bg-amber-800/40 transition-colors cursor-pointer text-sm"
              title="Dismiss popup"
              aria-label="Dismiss popup"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Slim Header: Urbanova (Left), 505 Dundas Corridor (Center), Toggle (Right) */}
      <header className="relative z-20 w-full bg-background/80 backdrop-blur-md border-b border-border/40 shrink-0">
        <div className="flex items-center justify-between px-6 py-2.5 w-full">
          {/* Left: Urbanova Logo + Fixture Status Pill */}
          <div className="flex items-center gap-3 min-w-[140px]">
            <span
              className="text-2xl md:text-3xl tracking-tight text-foreground select-none cursor-pointer"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Urbanova<sup className="text-xs">®</sup>
            </span>
            {usingFixture && (
              <button
                type="button"
                onClick={() => setShowFixturePopup(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer"
                title="Fixture mode is active. Click to view alert."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>FIXTURE</span>
              </button>
            )}
          </div>

          {/* Center: 505 Dundas Streetcar Corridor */}
          <div className="text-center flex-1 px-4">
            <h1
              className="text-xl md:text-2xl lg:text-3xl text-foreground font-normal tracking-tight leading-tight"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              505 Dundas Streetcar Corridor
            </h1>
            <p className="text-[11px] text-muted-foreground hidden md:block">
              Housing Growth &amp; Transit Readiness · Broadview Station to Yonge-Dundas
            </p>
          </div>

          {/* Right: Toggle Button for 3D Towers & Stats */}
          <div className="flex items-center justify-end min-w-[140px]">
            <button
              type="button"
              onClick={() => setShowDrawer((prev) => !prev)}
              className="liquid-glass rounded-full px-3.5 py-1.5 text-xs text-foreground/90 hover:text-foreground flex items-center gap-2 hover:scale-[1.02] transition-all cursor-pointer shadow-sm"
              aria-expanded={showDrawer}
              aria-label="Toggle corridor details and 3D towers"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
              <span className="font-medium">
                {showDrawer ? 'Hide Details' : '3D Towers & Data'}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${
                  showDrawer ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Animated Collapsible Drawer for 3D Towers & Corridor Data */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out border-t ${
            showDrawer
              ? 'max-h-40 opacity-100 border-border/30 bg-background/60 py-2.5'
              : 'max-h-0 opacity-0 border-transparent py-0 pointer-events-none'
          }`}
        >
          <div className="px-6 flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* 3D Towers Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1 font-medium">
                3D Towers:
              </span>
              {developments.map((dev) => {
                const isSelected = selectedDev?.dev_id === dev.dev_id
                const isP1 = dev.dev_id === 'toronto-app-22-124214-ste-13-oz'
                return (
                  <button
                    key={dev.dev_id}
                    type="button"
                    onClick={() => {
                      setSelectedDev(dev)
                      setSelectedStop(null)
                    }}
                    className={`liquid-glass rounded-full px-3.5 py-1.5 text-xs transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? isP1
                          ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60 shadow-lg scale-105 font-medium'
                          : 'bg-amber-500/30 text-amber-200 border border-amber-400/60 shadow-lg scale-105 font-medium'
                        : 'hover:scale-[1.02] text-foreground/90'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isP1
                          ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                          : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                      }`}
                    />
                    <span>{dev.address.replace(' DUNDAS ST E', ' Dundas')}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({dev.units.toLocaleString()}u)
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Corridor Metrics Pills */}
            <div className="flex items-center gap-6 text-xs border-t lg:border-t-0 lg:border-l border-border/40 pt-2 lg:pt-0 lg:pl-6">
              <div>
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
                  Peak Window
                </div>
                <div className="font-mono font-medium text-foreground">07:00–09:00</div>
              </div>
              <div className="border-l border-border/40 pl-6">
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
                  New Homes (P1+P2)
                </div>
                <div className="font-mono font-medium text-amber-300">
                  {totalNewUnits.toLocaleString()} units
                </div>
              </div>
              <div className="border-l border-border/40 pl-6">
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
                  Corridor Reach
                </div>
                <div className="font-mono font-medium text-foreground">
                  {comparison.corridor.stops.length} stops
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Area: 3D Map + Overlay Inspector */}
      <main className="relative flex-1 min-h-0 w-full overflow-hidden">
        <CorridorMap
          corridor={comparison.corridor}
          developments={developments}
          selectedStopId={selectedStop?.stop_id}
          selectedDevId={selectedDev?.dev_id}
          activePhase={activePhase}
          onSelectStop={(stop) => {
            setSelectedStop(stop)
            setSelectedDev(null)
          }}
          onSelectDevelopment={(dev) => {
            setSelectedDev(dev)
            setSelectedStop(null)
          }}
        />

        {/* Selected Development Panel (Lane D4) */}
        {selectedDev && (
          <div className="!absolute top-6 right-6 z-30">
            <DevelopmentPanel
              development={selectedDev}
              stops={comparison.corridor.stops}
              onClose={() => setSelectedDev(null)}
              onSelectStop={(stop) => {
                setSelectedStop(stop)
                setSelectedDev(null)
              }}
            />
          </div>
        )}

        {/* Selected Stop Inspector Panel (Floating Top Right) */}
        {selectedStop && !selectedDev && (() => {
          const currentStopResult = currentCase?.stops.find((s) => s.stop_id === selectedStop.stop_id)
          const growthStopResult = growthCase?.stops.find((s) => s.stop_id === selectedStop.stop_id)

          return (
            <div className="!absolute top-6 right-6 w-[360px] z-30 max-h-[calc(100vh-14rem)] overflow-y-auto animate-fade-rise liquid-glass-panel rounded-2xl p-6 shadow-2xl">
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className="status-chip status-chip-sourced">
                    TTC STOP #{selectedStop.gtfs_stop_id}
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedStop(null)}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <h3
                  className="text-2xl text-foreground font-normal tracking-tight mb-1"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  {selectedStop.name}
                </h3>
                <div className="text-xs text-muted-foreground mb-4">
                  Sequence {selectedStop.seq} of {comparison.corridor.stops.length} · Inbound Westbound
                </div>

                {/* Stop Metric Summary from Baseline vs Growth */}
                {growthStopResult ? (
                  <div className="flex flex-col gap-2.5">
                    <div className="liquid-glass rounded-xl p-3.5">
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground mb-1">
                        <span>MEAN WAIT TIME</span>
                        <span className="status-chip status-chip-assumed">SIMULATED</span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-2xl font-mono font-semibold text-rose-400">
                          {growthStopResult.mean_wait_s != null
                            ? `${(growthStopResult.mean_wait_s / 60).toFixed(1)}m`
                            : '—'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (Baseline:{' '}
                          {currentStopResult?.mean_wait_s != null
                            ? `${(currentStopResult.mean_wait_s / 60).toFixed(1)}m`
                            : '—'}
                          )
                        </span>
                      </div>
                    </div>

                    <div className="liquid-glass rounded-xl p-3.5">
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground mb-1">
                        <span>SHARE LEFT BEHIND (DENIED)</span>
                        <span className="status-chip status-chip-assumed">INVARIANT</span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-2xl font-mono font-semibold text-rose-400">
                          {growthStopResult.denied_at_least_once_share != null
                            ? `${(growthStopResult.denied_at_least_once_share * 100).toFixed(0)}%`
                            : '0%'}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Queue: {growthStopResult.remaining_queue} riders
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground/80 py-2">
                    Stop outside critical bottleneck cluster.
                  </div>
                )}
              </div>
            </div>
          )
        })()}
      </main>
    </div>
  )
}

export default App
