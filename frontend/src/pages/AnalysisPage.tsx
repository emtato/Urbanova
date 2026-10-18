import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { ArrowLeft, Play, Settings2 } from 'lucide-react'
import { simulationTimes } from '../lib/analysisParameters'
import { apiRequest, checkBackendHealth, deleteSimulation, getSimulations, renameSimulation, runSimulation, setUseFixture } from '../lib/api'
import type { Scenario } from '../lib/types'
import type { NativeBatch, NativeReplay } from '../lib/liveTypes'
import { setActiveSimulation } from '../lib/simulationHistory'
import { NativeReplayPanel } from '../panels/NativeReplayPanel'
import { HeadwaySelector } from '../panels/HeadwaySelector'
import { ConfirmDialog } from '../panels/ConfirmDialog'
import { ServiceCostCard } from '../panels/ServiceCostCard'
import { HeadwayImpactCard, type ImpactPair } from '../panels/HeadwayImpactCard'
import { BASELINE_HEADWAY_S, DEFAULT_HEADWAY_S, isBaseline } from '../lib/serviceOptions'
import '../App.css'
import './AnalysisPage.css'

const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const seconds = (value: number | null | undefined) => value === null || value === undefined ? 'Unknown' : `${value.toFixed(1)} s`
const percent = (value: number | null | undefined) => value === null || value === undefined ? 'Unknown' : `${(value * 100).toFixed(1)}%`

function toReplay(batch: NativeBatch, runIndex: number): NativeReplay | null {
  const run = batch.individual_results[runIndex] ?? batch.individual_results[0]
  if (!run || !Array.isArray(run.inputs.stops)) return null
  const start = typeof run.inputs.start_time_s === 'number' ? run.inputs.start_time_s : 25200
  const end = typeof run.inputs.end_time_s === 'number' ? run.inputs.end_time_s : 32400
  return {
    format_version: 'b11-events-v1',
    comparison_id: batch.id,
    run_id: `${batch.id}:seed-${run.inputs.seed}`,
    scenario_id: '505-westbound-planning',
    model_version: 'b11',
    data_version: 'reviewed',
    source_ids: [],
    horizon_s: Math.max(1, end - start),
    stops: run.inputs.stops,
    events: run.sim_log,
  }
}

export function AnalysisPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [defaults, setDefaults] = useState<Scenario | null>(null)
  const [health, setHealth] = useState('Checking API and database…')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [includedDevs, setIncludedDevs] = useState<Record<string, boolean>>({})
  const [runCount, setRunCount] = useState(1)
  const [seed, setSeed] = useState(42)
  const [headwayS, setHeadwayS] = useState(DEFAULT_HEADWAY_S)
  const [headwayValid, setHeadwayValid] = useState(true)
  const [progress, setProgress] = useState('')
  const [impactPair, setImpactPair] = useState<ImpactPair | null>(null)
  const [impactInputs, setImpactInputs] = useState('')
  const [headwayRandomnessS, setHeadwayRandomnessS] = useState(0)
  const [linkVariationShare, setLinkVariationShare] = useState(0)
  const [startHours, setStartHours] = useState('7')
  const [endHours, setEndHours] = useState('9')
  const [rushHours, setRushHours] = useState('2')
  const [simulations, setSimulations] = useState<NativeBatch[]>([])
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null)
  const [selectedRunIndex, setSelectedRunIndex] = useState(0)
  const controller = useRef<AbortController | null>(null)

  useEffect(() => {
    const abort = new AbortController()
    void checkBackendHealth().then(value => {
      if (!abort.signal.aborted) setHealth(value.ok ? 'API and database connected' : value.message || value.status || 'API unavailable')
    })
    void apiRequest<Scenario>('/scenarios/default', undefined, abort.signal).then(value => {
      setDefaults(value)
      setIncludedDevs(Object.fromEntries(value.developments.map(d => [d.id, false])))
    }).catch(reason => { if (!abort.signal.aborted) setError(message(reason)) })
    void getSimulations(abort.signal).then(list => {
      if (!abort.signal.aborted) {
        setSimulations(list)
        if (list.length > 0) setSelectedBatchId(current => current ?? list[0].id)
      }
    }).catch(() => {})
    return () => { abort.abort(); controller.current?.abort() }
  }, [])

  const inputsKey = JSON.stringify([includedDevs, runCount, seed, headwayS, headwayRandomnessS, linkVariationShare, startHours, endHours, rushHours])
  const times = simulationTimes(startHours, endHours, rushHours)
  const canRun = headwayValid && runCount > 0 && times.values !== null && headwayRandomnessS < headwayS
  const includedCount = Object.values(includedDevs).filter(Boolean).length
  const includedUnits = defaults?.developments.filter(d => includedDevs[d.id]).reduce((total, d) => total + d.net_added_units, 0) ?? 0
  const impactStale = impactPair !== null && impactInputs !== inputsKey

  const currentBatch = simulations.find(item => item.id === selectedBatchId) ?? simulations[0] ?? null
  const replay = currentBatch ? toReplay(currentBatch, selectedRunIndex) : null

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!defaults || busy || !canRun || !times.values) return
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    setError('')
    try {
      const development_ids = defaults.developments.filter(d => includedDevs[d.id]).map(d => d.id)
      const request = (headway_s: number) => runSimulation({
        run_count: runCount,
        seed,
        development_ids,
        headway_s,
        headway_randomness_s: headwayRandomnessS,
        link_travel_time_variation_share: linkVariationShare,
        ...times.values,
      }, abort.signal)
      // A non-current headway also runs today's service with the same buildings and seeds, for a fair before/after.
      const compare = !isBaseline(headwayS)
      setProgress(compare ? `Running today's service (${Math.round(BASELINE_HEADWAY_S)} s)…` : 'Running simulation…')
      const before = compare ? await request(BASELINE_HEADWAY_S) : null
      if (abort.signal.aborted) return
      if (compare) setProgress(`Running ${Math.round(headwayS)} s headway…`)
      const batch = await request(headwayS)
      if (abort.signal.aborted) return
      const added = before ? [batch, before] : [batch]
      setSimulations(prev => [...added, ...prev.filter(item => !added.some(a => a.id === item.id))])
      setSelectedBatchId(batch.id)
      setSelectedRunIndex(0)
      setImpactPair(before ? { before, after: batch, before_headway_s: BASELINE_HEADWAY_S, after_headway_s: headwayS } : null)
      setImpactInputs(inputsKey)
    } catch (reason) {
      if (!abort.signal.aborted) setError(message(reason))
    } finally {
      if (!abort.signal.aborted) { setBusy(false); setProgress('') }
    }
  }

  async function handleRename(id: string, currentName: string) {
    const promptFn = typeof window !== 'undefined' && typeof window.prompt === 'function' ? window.prompt : null
    const newName = promptFn ? promptFn('Enter new name for simulation:', currentName) : null
    if (newName === null) return
    const trimmed = newName.trim()
    if (!trimmed || trimmed.length > 80) {
      setError('Use a name between 1 and 80 characters.')
      return
    }
    setError('')
    try {
      await renameSimulation(id, trimmed)
      setSimulations(prev => prev.map(item => item.id === id ? { ...item, name: trimmed } : item))
    } catch (reason) {
      setError(message(reason))
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true)
    setError('')
    try {
      await deleteSimulation(id)
      setSimulations(prev => prev.filter(item => item.id !== id))
      if (selectedBatchId === id) {
        setSelectedBatchId(simulations.filter(item => item.id !== id)[0]?.id ?? null)
        setSelectedRunIndex(0)
      }
    } catch (reason) {
      setError(message(reason))
    } finally {
      setDeleting(false)
      setPendingDeleteId(null)
    }
  }

  return <main className="contract-review analysis-workspace analysis-studio">
    <div className="analysis-shell">
    <nav className="analysis-nav" aria-label="Simulation navigation">
      <button onClick={() => { setActiveSimulation(currentBatch?.id ?? null); setUseFixture(false); onNavigate('/map') }}><ArrowLeft size={15} /> Back to map</button>
    </nav>
    <header className="analysis-hero">
      <div>
        <h1>Run simulation</h1>
        <p className="analysis-intro">505 Dundas westbound · Broadview → TMU / Yonge</p>
      </div>
      <p className={`analysis-health${health === 'API and database connected' ? ' is-connected' : ''}`} role="status"><span />{health}</p>
    </header>
    {error && <p role="alert" className="analysis-error">{error}</p>}
    <form onSubmit={submit} className="analysis-form" aria-label="Simulation configuration">
      <fieldset disabled={busy || !defaults}>
        <legend className="analysis-sr-only">Proposed developments and simulation parameters</legend>
        <div className="analysis-configuration">
          <section className="analysis-card analysis-developments" aria-labelledby="developments-title">
            <div className="analysis-card-heading"><h2 id="developments-title">Proposed developments</h2></div>
            <div className="analysis-building-list">
              {defaults?.developments.map(d => <label key={d.id} className={`analysis-building${includedDevs[d.id] ? ' is-included' : ''}`}>
                <input type="checkbox" checked={Boolean(includedDevs[d.id])} onChange={e => setIncludedDevs({ ...includedDevs, [d.id]: e.target.checked })} />
                <span className="analysis-building-copy"><strong>{d.name}</strong><span><b>+{d.net_added_units.toLocaleString()}</b> net-added homes</span></span>
              </label>)}
              {!defaults && <p className="analysis-help">Loading proposed buildings…</p>}
            </div>
            <div className="analysis-selection-summary"><span>{includedCount} of {defaults?.developments.length ?? 3} buildings selected</span><strong>+{includedUnits.toLocaleString()} <small>homes</small></strong></div>
          </section>
          <section className="analysis-card analysis-service" aria-labelledby="service-title">
            <div className="analysis-card-heading"><h2 id="service-title">Simulation settings</h2></div>
            <HeadwaySelector value={headwayS} onChange={setHeadwayS} onValidityChange={setHeadwayValid} disabled={busy || !defaults} />
            <div className="analysis-runs-control">
              <div className="analysis-control-heading"><div><label htmlFor="simulation-runs">Number of runs</label><p className="analysis-help">Repeat with a different seed for each trial</p></div><output htmlFor="simulation-runs" className="analysis-value">{runCount}<small> / 25</small></output></div>
              <input id="simulation-runs" type="range" min={0} max={25} step={1} value={runCount} onChange={e => setRunCount(Number(e.target.value))} aria-describedby="run-count-help" style={{ '--range-progress': `${runCount / 25 * 100}%` } as CSSProperties} />
              <div className="analysis-range-labels"><span>0</span><span>25 trials</span></div>
              <p id="run-count-help" className={runCount === 0 ? 'analysis-field-error' : 'analysis-help'}>{runCount === 0 ? 'Choose at least one run to start a simulation.' : isBaseline(headwayS) ? `${runCount} seeded ${runCount === 1 ? 'trial' : 'trials'} at today’s service level.` : `${runCount} ${runCount === 1 ? 'trial' : 'trials'} per service level, plus today’s service for comparison.`}</p>
            </div>
          </section>
          <section className="analysis-card analysis-timing" aria-labelledby="timing-title">
            <div className="analysis-card-heading"><h2 id="timing-title">Time window</h2></div>
            <div className="analysis-time-grid">
              <label htmlFor="start-hours">Start time (hours)<div className="analysis-unit-input"><input id="start-hours" required type="number" min={0} max={24} step="any" value={startHours} onChange={e => setStartHours(e.target.value)} aria-describedby="time-input-help" /><span>h</span></div></label>
              <label htmlFor="end-hours">End time (hours)<div className="analysis-unit-input"><input id="end-hours" required type="number" min={0} max={48} step="any" value={endHours} onChange={e => setEndHours(e.target.value)} aria-describedby="time-input-help" /><span>h</span></div></label>
              <label htmlFor="rush-hours">Rush-hour duration (hours)<div className="analysis-unit-input"><input id="rush-hours" required type="number" min={1 / 3600} max={24} step="any" value={rushHours} onChange={e => setRushHours(e.target.value)} aria-describedby="time-input-help" /><span>h</span></div></label>
            </div>
            <p id="time-input-help" className="analysis-help">Use 24-hour time: 7 = 07:00, 7.5 = 07:30. Duration is in hours.</p>
            {times.error && <p className="analysis-field-error" role="alert">{times.error}</p>}
            <details className="analysis-advanced">
              <summary><Settings2 size={15} /> Randomness &amp; seed</summary>
              <div className="analysis-advanced-grid">
                <label htmlFor="simulation-seed">Starting seed<input id="simulation-seed" required type="number" min={0} max={2147483647} step={1} value={seed} onChange={e => setSeed(Number(e.target.value))} /></label>
                <label htmlFor="headway-randomness">Headway randomness (s)<input id="headway-randomness" required type="number" min={0} max={headwayS} step="any" value={headwayRandomnessS} onChange={e => setHeadwayRandomnessS(Number(e.target.value))} /></label>
                <label htmlFor="link-variation">Link variation share<input id="link-variation" required type="number" min={0} max={0.99} step="any" value={linkVariationShare} onChange={e => setLinkVariationShare(Number(e.target.value))} /></label>
              </div>
              <p className="analysis-help">The same seed reproduces the same scenario. Link variation ranges from 0 to 0.99.</p>
            </details>
            {headwayRandomnessS >= headwayS && <p className="analysis-field-error" role="alert">Headway randomness must be less than the headway.</p>}
          </section>
        </div>
        <div className="analysis-launch">
          <button className="analysis-run-button" type="submit" disabled={!canRun}><Play size={17} fill="currentColor" />{busy ? progress || 'Running simulation…' : 'Run simulation'}</button>
        </div>
      </fieldset>
    </form>

    <div className="service-cards">
      <ServiceCostCard headway_s={headwayS} />
      <div>
        {impactStale && <p className="service-stale" role="status">Inputs changed since this comparison ran; run again to update it.</p>}
        <HeadwayImpactCard pair={impactPair} />
      </div>
    </div>

    {simulations.length > 0 && (
      <section className="analysis-results-card" aria-label="Saved simulation batches">
        <h2>Saved simulation batches ({simulations.length})</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Simulation</th>
                <th>Buildings included</th>
                <th>Headway</th>
                <th>Runs (seeds)</th>
                <th>Mean wait (avg)</th>
                <th>P95 wait (avg)</th>
                <th>Denied share (avg)</th>
                <th>Runtime</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {simulations.map(batch => {
                const devs = batch.individual_results[0]?.inputs.developments ?? []
                const metrics = batch.overall_results.metrics
                const isSelected = currentBatch?.id === batch.id
                return (
                  <tr key={batch.id} className={isSelected ? 'is-active-row' : undefined}>
                    <th className="analysis-id" title={batch.id}>
                      {batch.name ? <span><strong>{batch.name}</strong> <small style={{ opacity: 0.6 }}>({batch.id.slice(0, 8)}…)</small></span> : `${batch.id.slice(0, 8)}…`}
                    </th>
                    <td>{devs.length ? devs.map(d => d.name).join(', ') : 'None (baseline only)'}</td>
                    <td>{typeof batch.individual_results[0]?.inputs.headway_s === 'number' ? `${Math.round(batch.individual_results[0].inputs.headway_s)} s` : 'Unknown'}</td>
                    <td>{batch.overall_results.run_count} ({batch.overall_results.seeds.join(', ')})</td>
                    <td>{seconds(metrics.mean_wait_s?.mean)}</td>
                    <td>{seconds(metrics.p95_wait_s?.mean)}</td>
                    <td>{percent(metrics.denied_boarding_share?.mean)}</td>
                    <td>{seconds(batch.overall_results.runtime.total_s)}</td>
                    <td>
                      <button type="button" onClick={() => { setSelectedBatchId(batch.id); setSelectedRunIndex(0) }}>
                        {isSelected ? 'Viewing' : 'View'}
                      </button>{' '}
                      <button type="button" onClick={() => void handleRename(batch.id, batch.name || '')}>Rename</button>{' '}
                      <button type="button" onClick={() => setPendingDeleteId(batch.id)}>Delete</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    )}

    {currentBatch && (
      <>
        <section className="analysis-results-card">
          <h2>Overall batch summary</h2>
          <p className="analysis-id">Batch {currentBatch.id} · {currentBatch.overall_results.run_count} {currentBatch.overall_results.run_count === 1 ? 'run' : 'runs'} · total runtime {seconds(currentBatch.overall_results.runtime.total_s)}</p>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Metric</th><th>Mean</th><th>Median</th><th>Min</th><th>Max</th><th>Std Dev</th></tr>
              </thead>
              <tbody>
                {(['mean_wait_s', 'p95_wait_s', 'denied_boarding_share', 'unresolved_passengers', 'in_progress_at_cutoff_passengers'] as const).map(key => {
                  const stat = currentBatch.overall_results.metrics[key]
                  if (!stat) return null
                  const fmt = key.endsWith('_s') ? seconds : key.endsWith('_share') ? percent : (v: number | null) => v === null ? 'Unknown' : v.toFixed(1)
                  return (
                    <tr key={key}>
                      <th>{key}</th>
                      <td>{fmt(stat.mean)}</td>
                      <td>{fmt(stat.median)}</td>
                      <td>{fmt(stat.min)}</td>
                      <td>{fmt(stat.max)}</td>
                      <td>{fmt(stat.stddev)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="analysis-results-card">
          <h2>Individual runs in batch</h2>
          <div className="table-scroll">
            <table>
              <thead>
                <tr><th>Run #</th><th>Seed</th><th>Mean wait</th><th>P95 wait</th><th>Denied</th><th>Stranded</th><th>In progress at cutoff</th><th>Replay</th></tr>
              </thead>
              <tbody>
                {currentBatch.individual_results.map((run, idx) => {
                  const m = run.summary.overview
                  return (
                    <tr key={run.inputs.seed}>
                      <th>#{idx + 1}</th>
                      <td>{run.inputs.seed}</td>
                      <td>{seconds(m.mean_wait_s)}</td>
                      <td>{seconds(m.p95_wait_s)}</td>
                      <td>{percent(m.denied_boarding_share)}</td>
                      <td>{m.unresolved_passengers}</td>
                      <td>{m.in_progress_at_cutoff_passengers}</td>
                      <td>
                        <button type="button" onClick={() => setSelectedRunIndex(idx)}>
                          {selectedRunIndex === idx ? 'Selected' : 'Show replay'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        {replay && <NativeReplayPanel key={replay.run_id} replay={replay} />}
      </>
    )}
    </div>
    <ConfirmDialog
      open={!!pendingDeleteId}
      title="Delete simulation?"
      message={(() => {
        const target = simulations.find(item => item.id === pendingDeleteId)
        return `${target?.name ? `"${target.name}"` : 'This simulation'} will be permanently deleted. This cannot be undone.`
      })()}
      confirmLabel={deleting ? 'Deleting…' : 'Delete'}
      danger
      busy={deleting}
      onConfirm={() => { if (pendingDeleteId) void handleDelete(pendingDeleteId) }}
      onCancel={() => setPendingDeleteId(null)}
    />
  </main>
}
