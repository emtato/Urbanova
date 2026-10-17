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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg-app)', color: 'var(--text-secondary)' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 'var(--text-xl)', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '0.5rem' }}>
            FutureProof
          </div>
          <div style={{ fontSize: 'var(--text-sm)' }}>Loading 505 Dundas Streetcar Corridor...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      {/* 1. Fixture Warning Banner (Contract Rule 1.16) */}
      {usingFixture && (
        <div className="fixture-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.9rem' }}>⚠️</span>
            <span>FIXTURE MODE ACTIVE — 505 Dundas Baseline Dataset (Broadview to Yonge)</span>
          </div>
          <button
            type="button"
            onClick={toggleFixtureMode}
            style={{
              background: 'rgba(0,0,0,0.25)',
              padding: '0.15rem 0.5rem',
              borderRadius: 'var(--radius-xs)',
              fontSize: 'var(--text-2xs)',
              border: '1px solid rgba(255,255,255,0.3)',
            }}
          >
            Switch to Live API
          </button>
        </div>
      )}

      {/* 2. Top Navigation Bar */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0.65rem 1.25rem',
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-subtle)',
          zIndex: 20,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div>
            <div style={{ fontSize: 'var(--text-lg)', fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span style={{ color: 'var(--color-ttc-red)' }}>●</span>
              <span>FutureProof</span>
            </div>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-secondary)' }}>
              Housing Growth &amp; Transit Readiness · School of Cities
            </div>
          </div>

          <div
            style={{
              padding: '0.2rem 0.6rem',
              borderRadius: 'var(--radius-sm)',
              background: 'rgba(218, 41, 28, 0.12)',
              border: '1px solid rgba(218, 41, 28, 0.35)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              color: '#f87171',
            }}
          >
            {comparison.corridor.name}
          </div>
        </div>

        {/* Top Right Quick Stats */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>AM PEAK WINDOW</div>
            <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
              {comparison.corridor.peak_window}
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>NEW HOMES (P1+P2)</div>
            <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', fontWeight: 600, color: 'var(--phase-2)' }}>
              {comparison.developments.reduce((sum, d) => sum + d.units, 0).toLocaleString()} units
            </div>
          </div>

          <button
            type="button"
            onClick={toggleFixtureMode}
            className="status-chip status-chip-sourced"
            title="Toggle between sample fixture and live backend API"
          >
            {usingFixture ? 'Fixture Active' : 'Live Connected'}
          </button>
        </div>
      </header>

      {/* 3. Main Workspace Area: 3D Map + Overlay Inspector */}
      <main style={{ position: 'relative', flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
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
          <div
            className="glass-panel"
            style={{
              position: 'absolute',
              top: '1rem',
              right: '1rem',
              width: '320px',
              padding: '1rem',
              zIndex: 30,
              maxHeight: 'calc(100vh - 8rem)',
              overflowY: 'auto',
            }}
          >
            {selectedStop && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <span className="status-chip status-chip-sourced">TTC STOP #{selectedStop.gtfs_stop_id}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedStop(null)}
                    style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: '0 0.25rem' }}
                  >
                    ✕
                  </button>
                </div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: '0.25rem' }}>
                  {selectedStop.name}
                </h3>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
                  Sequence {selectedStop.seq} of {comparison.corridor.stops.length} · Inbound Westbound
                </div>

                {/* Stop Metric Summary from Baseline vs Growth */}
                {comparison.cases.growth.stop_results[selectedStop.stop_id] ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                    <div className="metric-tile" style={{ padding: '0.4rem 0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                        <span>MEAN WAIT TIME</span>
                        <span className="status-chip status-chip-assumed">SIMULATED</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.1rem' }}>
                        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--metric-danger)' }}>
                          {(comparison.cases.growth.stop_results[selectedStop.stop_id].total_riders.mean_wait_s / 60).toFixed(1)}m
                        </span>
                        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-secondary)' }}>
                          (Baseline: {(comparison.cases.current.stop_results[selectedStop.stop_id]?.total_riders.mean_wait_s / 60).toFixed(1)}m)
                        </span>
                      </div>
                    </div>

                    <div className="metric-tile" style={{ padding: '0.4rem 0.6rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                        <span>SHARE LEFT BEHIND (DENIED)</span>
                        <span className="status-chip status-chip-assumed">INVARIANT</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem', marginTop: '0.1rem' }}>
                        <span style={{ fontSize: 'var(--text-lg)', fontWeight: 700, color: 'var(--metric-danger)' }}>
                          {(comparison.cases.growth.stop_results[selectedStop.stop_id].total_riders.share_denied * 100).toFixed(0)}%
                        </span>
                        <span style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-secondary)' }}>
                          Queue: {comparison.cases.growth.stop_results[selectedStop.stop_id].total_riders.remaining_queue} riders
                        </span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    Stop outside critical bottleneck cluster.
                  </div>
                )}
              </div>
            )}

            {selectedDev && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.4rem' }}>
                  <span className={`phase-pill phase-pill-${selectedDev.phase}`}>
                    Phase {selectedDev.phase} Proposal
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedDev(null)}
                    style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)', padding: '0 0.25rem' }}
                  >
                    ✕
                  </button>
                </div>
                <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600, marginBottom: '0.2rem' }}>
                  {selectedDev.address}
                </h3>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                  Pipeline Ref: {selectedDev.pipeline_ref} · {selectedDev.stage}
                </div>

                <div className="metric-tile" style={{ padding: '0.5rem', marginBottom: '0.5rem' }}>
                  <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>PROPOSED UNITS</div>
                  <div style={{ fontSize: 'var(--text-xl)', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {selectedDev.units} homes
                  </div>
                </div>

                <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', marginBottom: '0.3rem' }}>
                  WALKING ACCESS TO STOPS:
                </div>
                {selectedDev.access.map((acc) => {
                  const s = comparison.corridor.stops.find((stop) => stop.stop_id === acc.stop_id)
                  return (
                    <div
                      key={acc.stop_id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '0.25rem 0',
                        fontSize: 'var(--text-xs)',
                        borderBottom: '1px solid var(--border-subtle)',
                      }}
                    >
                      <span>{s?.name || acc.stop_id}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--color-brand-cyan)' }}>
                        {acc.walk_m}m walk
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  )
}

export default App
