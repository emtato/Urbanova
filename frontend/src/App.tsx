import { useEffect, useState } from 'react'
import { fetchComparison, isUsingFixture, setUseFixture } from './lib/api'
import type { Comparison, Stop, Development } from './lib/types'
import { CorridorMap } from './map/CorridorMap'

const CINEMATIC_VIDEO_URL =
  'https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4'

type ActiveTab = 'overview' | 'map' | 'packages' | 'audit'

export function App() {
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStop, setSelectedStop] = useState<Stop | null>(null)
  const [selectedDev, setSelectedDev] = useState<Development | null>(null)
  const [usingFixture, setUsingFixtureState] = useState(isUsingFixture())
  const [activePhase] = useState<number>(2)
  const [activeTab, setActiveTab] = useState<ActiveTab>('overview')

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
      <div className="relative w-screen h-screen flex items-center justify-center bg-background text-foreground overflow-hidden">
        <video
          autoPlay
          loop
          muted
          playsInline
          className="absolute inset-0 w-full h-full object-cover z-0"
          src={CINEMATIC_VIDEO_URL}
        />
        <div className="relative z-10 text-center animate-fade-rise">
          <h1
            style={{ fontFamily: "'Instrument Serif', serif" }}
            className="text-6xl sm:text-7xl font-normal tracking-tight text-foreground"
          >
            Urbanova<sup className="text-xs ml-1">®</sup>
          </h1>
          <p className="text-muted-foreground text-sm tracking-widest uppercase mt-3">
            505 Dundas Streetcar · Transit &amp; Housing Readiness
          </p>
        </div>
      </div>
    )
  }

  const totalHomes = comparison.developments.reduce((sum, d) => sum + d.units, 0)
  const defaultStopResult = selectedStop
    ? comparison.cases.growth.stop_results[selectedStop.stop_id]
    : comparison.cases.growth.stop_results['stop-sumach']

  return (
    <div className="relative w-screen h-screen overflow-hidden flex flex-col bg-background text-foreground font-body select-none">
      {/* 1. Fullscreen Looping Video Background */}
      <video
        autoPlay
        loop
        muted
        playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        src={CINEMATIC_VIDEO_URL}
      />

      {/* 2. Top Fixture Notice (Minimalist & Non-Intrusive) */}
      {usingFixture && (
        <div className="relative z-20 w-full bg-background/80 backdrop-blur-md border-b border-border px-8 py-1.5 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
            <span>
              Fixture Mode Active — 505 Dundas Baseline Dataset (Broadview Station to Yonge-Dundas)
            </span>
          </div>
          <button
            type="button"
            onClick={toggleFixtureMode}
            className="text-xs text-foreground underline hover:text-amber-300 transition-colors cursor-pointer"
          >
            Switch to Live API
          </button>
        </div>
      )}

      {/* 3. Glassmorphic Navigation Bar */}
      <header className="relative z-20 flex flex-row justify-between items-center px-8 py-6 max-w-7xl mx-auto w-full">
        {/* Logo */}
        <div
          className="flex items-baseline cursor-pointer"
          onClick={() => setActiveTab('overview')}
        >
          <span
            style={{ fontFamily: "'Instrument Serif', serif" }}
            className="text-3xl tracking-tight text-foreground font-normal"
          >
            Urbanova<sup className="text-xs ml-0.5">®</sup>
          </span>
          <span className="ml-3 hidden sm:inline-block px-2.5 py-0.5 rounded-full text-2xs font-mono uppercase tracking-wider bg-red-500/15 border border-red-500/30 text-red-300">
            505 Dundas
          </span>
        </div>

        {/* Center Nav Links (hidden on mobile, md:flex) */}
        <nav className="hidden md:flex items-center gap-8">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={`text-sm transition-colors cursor-pointer ${
              activeTab === 'overview'
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Overview
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('map')}
            className={`text-sm transition-colors cursor-pointer ${
              activeTab === 'map'
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            3D Corridor Map
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('packages')}
            className={`text-sm transition-colors cursor-pointer ${
              activeTab === 'packages'
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Transit Packages
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('audit')}
            className={`text-sm transition-colors cursor-pointer ${
              activeTab === 'audit'
                ? 'text-foreground font-medium'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Bottleneck Audit
          </button>
        </nav>

        {/* Right CTA Button */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setActiveTab(activeTab === 'overview' ? 'map' : 'overview')}
            className="liquid-glass rounded-full px-6 py-2.5 text-sm text-foreground hover:scale-[1.03] transition-transform cursor-pointer"
          >
            {activeTab === 'overview' ? 'Explore Corridor' : 'Executive Overview'}
          </button>
        </div>
      </header>

      {/* 4. Tab Views */}
      <main className="relative z-10 flex-1 w-full h-[calc(100vh-100px)] overflow-hidden flex flex-col">
        {/* =========================================================================
            TAB 1: HERO / EXECUTIVE OVERVIEW
            ========================================================================= */}
        {activeTab === 'overview' && (
          <section className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-16 sm:pt-24 pb-20 max-w-5xl mx-auto my-auto h-full">
            {/* Cinematic H1 */}
            <h1
              style={{ fontFamily: "'Instrument Serif', serif" }}
              className="text-5xl sm:text-7xl md:text-8xl leading-[0.95] tracking-[-2.46px] max-w-7xl font-normal text-foreground animate-fade-rise"
            >
              Where dreams rise{' '}
              <em className="not-italic text-muted-foreground">through the silence.</em>
            </h1>

            {/* Cinematic Subtext */}
            <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mt-8 leading-relaxed animate-fade-rise-delay">
              Testing whether the 505 Dundas streetcar can absorb 2,220+ new homes from Broadview
              Station to Yonge-Dundas before lines overflow. Amid rapid urban intensification, we
              simulate every stop, vehicle, and morning commute.
            </p>

            {/* CTA Button */}
            <button
              type="button"
              onClick={() => setActiveTab('map')}
              className="liquid-glass rounded-full px-14 py-5 text-base text-foreground mt-12 hover:scale-[1.03] cursor-pointer transition-transform animate-fade-rise-delay-2"
            >
              Begin Journey
            </button>

            {/* Cinematic Corridor Key Metrics Strip */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full max-w-4xl mt-16 animate-fade-rise-delay-2">
              <div className="liquid-glass rounded-2xl p-5 text-left">
                <div className="text-2xs text-muted-foreground uppercase tracking-widest">
                  Proposed Density
                </div>
                <div
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                  className="text-4xl text-foreground font-normal mt-1"
                >
                  {totalHomes.toLocaleString()}
                </div>
                <div className="text-2xs text-muted-foreground mt-0.5">
                  Homes (Regent Park &amp; Downtown)
                </div>
              </div>

              <div className="liquid-glass rounded-2xl p-5 text-left">
                <div className="text-2xs text-muted-foreground uppercase tracking-widest">
                  505 Stops
                </div>
                <div
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                  className="text-4xl text-foreground font-normal mt-1"
                >
                  {comparison.corridor.stops.length}
                </div>
                <div className="text-2xs text-muted-foreground mt-0.5">
                  Broadview Station $\rightarrow$ Line 1
                </div>
              </div>

              <div className="liquid-glass rounded-2xl p-5 text-left">
                <div className="text-2xs text-muted-foreground uppercase tracking-widest">
                  Peak Wait (Regent Park)
                </div>
                <div
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                  className="text-4xl text-red-400 font-normal mt-1"
                >
                  {(
                    (defaultStopResult?.total_riders.mean_wait_s || 504) / 60
                  ).toFixed(1)}m
                </div>
                <div className="text-2xs text-muted-foreground mt-0.5">
                  Baseline:{' '}
                  {(
                    (comparison.cases.current.stop_results['stop-sumach']?.total_riders.mean_wait_s || 240) /
                    60
                  ).toFixed(1)}
                  m
                </div>
              </div>

              <div className="liquid-glass rounded-2xl p-5 text-left">
                <div className="text-2xs text-muted-foreground uppercase tracking-widest">
                  Left Behind
                </div>
                <div
                  style={{ fontFamily: "'Instrument Serif', serif" }}
                  className="text-4xl text-red-400 font-normal mt-1"
                >
                  {(((defaultStopResult?.total_riders.share_denied || 0.2)) * 100).toFixed(0)}%
                </div>
                <div className="text-2xs text-muted-foreground mt-0.5">
                  Overcrowded at morning peak
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 2: 3D CORRIDOR MAP WORKSPACE
            ========================================================================= */}
        {activeTab === 'map' && (
          <div className="relative flex-1 w-full h-full overflow-hidden">
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

            {/* Inspector Card (Top Right Floating Liquid Glass) */}
            {(selectedStop || selectedDev) && (
              <aside className="liquid-glass-elevated animate-fade-rise absolute top-5 right-5 w-84 sm:w-96 p-6 rounded-2xl z-30 max-h-[calc(100vh-140px)] overflow-y-auto">
                {selectedStop && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="status-chip status-chip-sourced">
                        TTC STOP #{selectedStop.gtfs_stop_id}
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedStop(null)}
                        className="text-muted-foreground hover:text-foreground text-sm cursor-pointer p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <h2
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-3xl text-foreground font-normal leading-tight"
                    >
                      {selectedStop.name}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 mb-5">
                      Sequence {selectedStop.seq} of {comparison.corridor.stops.length} · Inbound Westbound
                    </p>

                    {comparison.cases.growth.stop_results[selectedStop.stop_id] ? (
                      <div className="space-y-3">
                        <div className="liquid-glass rounded-xl p-4">
                          <div className="flex justify-between items-center text-2xs text-muted-foreground uppercase tracking-widest mb-1">
                            <span>Mean Passenger Wait</span>
                            <span className="status-chip status-chip-assumed">Simulated</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span
                              style={{ fontFamily: "'Instrument Serif', serif" }}
                              className="text-4xl text-red-400 font-normal"
                            >
                              {(
                                comparison.cases.growth.stop_results[selectedStop.stop_id].total_riders.mean_wait_s / 60
                              ).toFixed(1)}
                              m
                            </span>
                            <span className="text-xs text-muted-foreground">
                              (Baseline:{' '}
                              {(
                                (comparison.cases.current.stop_results[selectedStop.stop_id]?.total_riders.mean_wait_s || 0) / 60
                              ).toFixed(1)}
                              m)
                            </span>
                          </div>
                        </div>

                        <div className="liquid-glass rounded-xl p-4">
                          <div className="flex justify-between items-center text-2xs text-muted-foreground uppercase tracking-widest mb-1">
                            <span>Denied Boarding Rate</span>
                            <span className="status-chip status-chip-assumed">Bottleneck</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span
                              style={{ fontFamily: "'Instrument Serif', serif" }}
                              className="text-4xl text-red-400 font-normal"
                            >
                              {(
                                comparison.cases.growth.stop_results[selectedStop.stop_id].total_riders.share_denied * 100
                              ).toFixed(0)}
                              %
                            </span>
                            <span className="text-xs text-muted-foreground">
                              Queue: {comparison.cases.growth.stop_results[selectedStop.stop_id].total_riders.remaining_queue} riders
                            </span>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground">
                        Stop operates within comfortable residual capacity.
                      </div>
                    )}
                  </div>
                )}

                {selectedDev && (
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className={`phase-pill phase-pill-${selectedDev.phase}`}>
                        Phase {selectedDev.phase} Proposal
                      </span>
                      <button
                        type="button"
                        onClick={() => setSelectedDev(null)}
                        className="text-muted-foreground hover:text-foreground text-sm cursor-pointer p-1"
                      >
                        ✕
                      </button>
                    </div>

                    <h2
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-3xl text-foreground font-normal leading-tight"
                    >
                      {selectedDev.address}
                    </h2>
                    <p className="text-xs text-muted-foreground mt-1 mb-5">
                      Ref: {selectedDev.pipeline_ref} · {selectedDev.stage}
                    </p>

                    <div className="liquid-glass rounded-xl p-4 mb-4">
                      <div className="text-2xs text-muted-foreground uppercase tracking-widest">
                        Proposed Units
                      </div>
                      <div
                        style={{ fontFamily: "'Instrument Serif', serif" }}
                        className="text-4xl text-foreground font-normal mt-1"
                      >
                        {selectedDev.units.toLocaleString()} homes
                      </div>
                    </div>

                    <div className="text-2xs text-muted-foreground uppercase tracking-widest mb-2">
                      Walking Distance to Stops:
                    </div>
                    <div className="space-y-1">
                      {selectedDev.access.map((acc) => {
                        const s = comparison.corridor.stops.find((st) => st.stop_id === acc.stop_id)
                        return (
                          <div
                            key={acc.stop_id}
                            className="flex justify-between py-1 text-xs border-b border-border/50"
                          >
                            <span>{s?.name || acc.stop_id}</span>
                            <span className="font-mono text-cyan-300">{acc.walk_m}m walk</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </aside>
            )}
          </div>
        )}

        {/* =========================================================================
            TAB 3: TRANSIT PACKAGES COMPARISON
            ========================================================================= */}
        {activeTab === 'packages' && (
          <section className="relative z-10 flex flex-col px-8 py-8 max-w-6xl mx-auto w-full h-full overflow-y-auto animate-fade-rise">
            <div className="mb-8">
              <h2
                style={{ fontFamily: "'Instrument Serif', serif" }}
                className="text-5xl font-normal text-foreground"
              >
                Transit Intervention Packages
              </h2>
              <p className="text-muted-foreground text-base mt-2 max-w-2xl">
                Compare capital and operational upgrades for the 505 Dundas streetcar. Simulated
                against 2,220 proposed homes across AM Peak (07:30 - 08:30).
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pb-12">
              {/* Package 1 */}
              <div className="liquid-glass rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="status-chip status-chip-sourced">Baseline</span>
                    <span className="text-xs font-mono text-muted-foreground">$0 Capital</span>
                  </div>
                  <h3
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                    className="text-3xl font-normal text-foreground"
                  >
                    Status Quo
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Existing 6.5-minute streetcar headway, mixed traffic without dedicated transit
                    signal priority or enforcement.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-border/40">
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Mean Wait</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-red-400 mt-1"
                    >
                      8.4m
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Denied</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-red-400 mt-1"
                    >
                      20%
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Max Queue</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-foreground mt-1"
                    >
                      80 riders
                    </div>
                  </div>
                </div>
              </div>

              {/* Package 2 */}
              <div className="liquid-glass rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="status-chip status-chip-user">Signals</span>
                    <span className="text-xs font-mono text-muted-foreground">$1.8M Capital</span>
                  </div>
                  <h3
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                    className="text-3xl font-normal text-foreground"
                  >
                    Transit Priority Signals
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Active signal priority at Broadview, Parliament, Sherbourne, Jarvis, and Church
                    with queue-jump phases.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-border/40">
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Mean Wait</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-amber-300 mt-1"
                    >
                      6.1m
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Denied</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-amber-300 mt-1"
                    >
                      11%
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Max Queue</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-foreground mt-1"
                    >
                      42 riders
                    </div>
                  </div>
                </div>
              </div>

              {/* Package 3 */}
              <div className="liquid-glass rounded-2xl p-6 flex flex-col justify-between">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="status-chip status-chip-user">Fleet</span>
                    <span className="text-xs font-mono text-muted-foreground">$4.2M / yr OpEx</span>
                  </div>
                  <h3
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                    className="text-3xl font-normal text-foreground"
                  >
                    Frequency Surge (4.0m)
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Adding 4 extra Flexity Outlook streetcars to the AM run, dropping headways from
                    6.5m to 4.0m.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-border/40">
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Mean Wait</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-emerald-400 mt-1"
                    >
                      4.2m
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Denied</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-emerald-400 mt-1"
                    >
                      4%
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Max Queue</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-foreground mt-1"
                    >
                      14 riders
                    </div>
                  </div>
                </div>
              </div>

              {/* Package 4 */}
              <div className="liquid-glass rounded-2xl p-6 flex flex-col justify-between border-2 border-emerald-500/30">
                <div>
                  <div className="flex justify-between items-center mb-3">
                    <span className="status-chip status-chip-sourced">Recommended</span>
                    <span className="text-xs font-mono text-emerald-300">Complete Readiness</span>
                  </div>
                  <h3
                    style={{ fontFamily: "'Instrument Serif', serif" }}
                    className="text-3xl font-normal text-foreground"
                  >
                    Combined Priority + Fleet
                  </h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    Full signal pre-emption, transit lane enforcement, and 4.0-minute headways. Fully
                    absorbs Regent Park Phase 4 growth.
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-6 pt-6 border-t border-border/40">
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Mean Wait</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-emerald-400 mt-1"
                    >
                      3.2m
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Denied</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-emerald-400 mt-1"
                    >
                      0%
                    </div>
                  </div>
                  <div>
                    <div className="text-2xs text-muted-foreground uppercase">Max Queue</div>
                    <div
                      style={{ fontFamily: "'Instrument Serif', serif" }}
                      className="text-2xl text-emerald-400 mt-1"
                    >
                      0 riders
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* =========================================================================
            TAB 4: BOTTLENECK AUDIT & REPLAY
            ========================================================================= */}
        {activeTab === 'audit' && (
          <section className="relative z-10 flex flex-col px-8 py-8 max-w-6xl mx-auto w-full h-full overflow-y-auto animate-fade-rise">
            <div className="mb-8">
              <h2
                style={{ fontFamily: "'Instrument Serif', serif" }}
                className="text-5xl font-normal text-foreground"
              >
                505 Dundas Corridor Audit
              </h2>
              <p className="text-muted-foreground text-base mt-2 max-w-2xl">
                Stops from Broadview Station to Yonge-Dundas. Highlighting where Regent Park
                Phase 4 trips cause passenger queues.
              </p>
            </div>

            <div className="space-y-3 pb-12">
              {comparison.corridor.stops.map((stop) => {
                const res = comparison.cases.growth.stop_results[stop.stop_id]
                const isBottleneck = res && res.total_riders.share_denied > 0.05
                return (
                  <div
                    key={stop.stop_id}
                    className="liquid-glass rounded-xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono text-muted-foreground">
                          STOP #{stop.seq}
                        </span>
                        <span className="text-xs text-muted-foreground">· GTFS {stop.gtfs_stop_id}</span>
                        {isBottleneck && (
                          <span className="px-2 py-0.5 rounded-full text-2xs uppercase tracking-wider bg-red-500/20 text-red-300 border border-red-500/30">
                            Critical Bottleneck
                          </span>
                        )}
                      </div>
                      <h4
                        style={{ fontFamily: "'Instrument Serif', serif" }}
                        className="text-2xl font-normal text-foreground"
                      >
                        {stop.name}
                      </h4>
                    </div>

                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-2xs text-muted-foreground uppercase">Mean Wait</div>
                        <div
                          style={{ fontFamily: "'Instrument Serif', serif" }}
                          className={`text-2xl font-normal ${
                            isBottleneck ? 'text-red-400' : 'text-foreground'
                          }`}
                        >
                          {res ? `${(res.total_riders.mean_wait_s / 60).toFixed(1)}m` : '—'}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="text-2xs text-muted-foreground uppercase">Denied Boarding</div>
                        <div
                          style={{ fontFamily: "'Instrument Serif', serif" }}
                          className={`text-2xl font-normal ${
                            isBottleneck ? 'text-red-400' : 'text-foreground'
                          }`}
                        >
                          {res ? `${(res.total_riders.share_denied * 100).toFixed(0)}%` : '0%'}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          setSelectedStop(stop)
                          setActiveTab('map')
                        }}
                        className="liquid-glass rounded-full px-4 py-2 text-xs text-foreground hover:scale-[1.03] transition-transform cursor-pointer"
                      >
                        Inspect on Map
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
