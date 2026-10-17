import { useEffect, useState } from 'react'
import { fetchComparison, isUsingFixture, setUseFixture } from './lib/api'
import type { Comparison, Stop, Development } from './lib/types'
import { CorridorMap } from './map/CorridorMap'

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

  const totalNewUnits = comparison.developments.reduce((sum, d) => sum + d.units, 0)

  return (
    <div className="flex flex-col w-screen h-screen overflow-hidden bg-background text-foreground font-body">
      {/* Fixture Mode Warning Banner (Contract Rule 1.16) */}
      {usingFixture && (
        <div className="fixture-banner">
          <div className="flex items-center gap-2">
            <span className="text-amber-300">●</span>
            <span className="tracking-wider">
              FIXTURE MODE ACTIVE — 505 Dundas Baseline Dataset (Broadview to Yonge)
            </span>
          </div>
          <button
            type="button"
            onClick={toggleFixtureMode}
            className="liquid-glass rounded-full px-3 py-1 text-[11px] text-foreground hover:scale-[1.03] transition-transform"
          >
            Switch to Live API
          </button>
        </div>
      )}

      {/* Glassmorphic Navigation Bar */}
      <nav className="relative z-10 flex row justify-between items-center px-8 py-6 max-w-7xl mx-auto w-full">
        {/* Logo: "Urbanova®" (® as <sup className="text-xs">), text-3xl tracking-tight, Instrument Serif font, text-foreground */}
        <div
          className="text-3xl tracking-tight text-foreground select-none cursor-pointer"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Urbanova<sup className="text-xs">®</sup>
        </div>

        {/* Nav links (hidden on mobile, md:flex): Home (active, text-foreground), Studio, About, Journal, Reach Us — all text-sm text-muted-foreground with hover:text-foreground transition-colors */}
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#home"
            className="text-sm text-foreground transition-colors"
          >
            Home
          </a>
          <a
            href="#studio"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Studio
          </a>
          <a
            href="#about"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            About
          </a>
          <a
            href="#journal"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Journal
          </a>
          <a
            href="#reach-us"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Reach Us
          </a>
        </div>

        {/* CTA button, liquid-glass rounded-full px-6 py-2.5 text-sm text-foreground, hover:scale-[1.03] */}
        <button
          type="button"
          onClick={toggleFixtureMode}
          className="liquid-glass rounded-full px-6 py-2.5 text-sm text-foreground hover:scale-[1.03] transition-transform"
        >
          {usingFixture ? 'Fixture Mode Active' : 'Live Connected'}
        </button>
      </nav>

      {/* Cinematic Sub-Header / Corridor Context Toolbar */}
      <div className="relative z-10 px-8 pb-4 max-w-7xl mx-auto w-full">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <h1
              className="animate-fade-rise text-3xl md:text-5xl text-foreground font-normal tracking-tight"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              505 Dundas Streetcar Corridor
            </h1>
            <p className="animate-fade-rise-delay text-sm text-muted-foreground mt-1">
              Housing Growth &amp; Transit Readiness · Broadview Station to Yonge-Dundas
            </p>
          </div>

          {/* Quick Metrics Pills */}
          <div className="animate-fade-rise-delay-2 flex items-center gap-6 text-xs pb-1">
            <div>
              <div className="text-[10px] tracking-wider uppercase text-muted-foreground">Peak Window</div>
              <div className="font-mono font-medium text-foreground">{comparison.corridor.peak_window}</div>
            </div>
            <div className="border-l border-border/40 pl-6">
              <div className="text-[10px] tracking-wider uppercase text-muted-foreground">New Homes (P1+P2)</div>
              <div className="font-mono font-medium text-amber-300">{totalNewUnits.toLocaleString()} units</div>
            </div>
            <div className="border-l border-border/40 pl-6">
              <div className="text-[10px] tracking-wider uppercase text-muted-foreground">Corridor Reach</div>
              <div className="font-mono font-medium text-foreground">{comparison.corridor.stops.length} stops · 10 links</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Workspace Area: 3D Map + Overlay Inspector */}
      <main className="relative flex-1 w-full h-full overflow-hidden">
        <CorridorMap
          corridor={comparison.corridor}
          developments={comparison.developments}
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

        {/* Selected Entity Inspector Panel (Floating Top Right) */}
        {(selectedStop || selectedDev) && (
          <div className="liquid-glass-panel rounded-2xl p-6 absolute top-6 right-6 w-[340px] z-30 max-h-[calc(100vh-14rem)] overflow-y-auto animate-fade-rise">
            {selectedStop && (
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
                {comparison.cases.growth.stop_results[selectedStop.stop_id] ? (
                  <div className="flex flex-col gap-2.5">
                    <div className="liquid-glass rounded-xl p-3.5">
                      <div className="flex justify-between items-center text-[11px] text-muted-foreground mb-1">
                        <span>MEAN WAIT TIME</span>
                        <span className="status-chip status-chip-assumed">SIMULATED</span>
                      </div>
                      <div className="flex items-baseline gap-2 mt-0.5">
                        <span className="text-2xl font-mono font-semibold text-rose-400">
                          {(
                            comparison.cases.growth.stop_results[selectedStop.stop_id].total_riders.mean_wait_s / 60
                          ).toFixed(1)}m
                        </span>
                        <span className="text-xs text-muted-foreground">
                          (Baseline:{' '}
                          {(
                            comparison.cases.current.stop_results[selectedStop.stop_id]?.total_riders.mean_wait_s / 60
                          ).toFixed(1)}m)
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
                          {(
                            comparison.cases.growth.stop_results[selectedStop.stop_id].total_riders.share_denied * 100
                          ).toFixed(0)}%
                        </span>
                        <span className="text-xs text-muted-foreground">
                          Queue: {comparison.cases.growth.stop_results[selectedStop.stop_id].total_riders.remaining_queue} riders
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
            )}

            {selectedDev && (
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span className={`phase-pill phase-pill-${selectedDev.phase}`}>
                    Phase {selectedDev.phase} Proposal
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDev(null)}
                    className="text-muted-foreground hover:text-foreground text-sm transition-colors"
                  >
                    ✕
                  </button>
                </div>

                <h3
                  className="text-2xl text-foreground font-normal tracking-tight mb-1"
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                >
                  {selectedDev.address}
                </h3>
                <div className="text-xs text-muted-foreground mb-3">
                  Pipeline Ref: {selectedDev.pipeline_ref} · {selectedDev.stage}
                </div>

                <div className="liquid-glass rounded-xl p-3.5 mb-3">
                  <div className="text-[11px] text-muted-foreground mb-1">PROPOSED UNITS</div>
                  <div className="text-2xl font-mono font-semibold text-foreground">
                    {selectedDev.units.toLocaleString()} homes
                  </div>
                </div>

                <div className="text-[11px] tracking-wider uppercase text-muted-foreground mb-2">
                  Walking Access to Stops
                </div>
                <div className="flex flex-col gap-1.5">
                  {selectedDev.access.map((acc) => {
                    const s = comparison.corridor.stops.find((stop) => stop.stop_id === acc.stop_id)
                    return (
                      <div
                        key={acc.stop_id}
                        className="flex justify-between items-center py-1.5 border-b border-border/20 text-xs"
                      >
                        <span className="text-foreground">{s?.name || acc.stop_id}</span>
                        <span className="font-mono text-cyan-300">{acc.walk_m}m walk</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
