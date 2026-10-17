import { useEffect, useRef, useState } from 'react'
import { apiRequest, checkBackendHealth, deleteSimulation, getSimulations, runSimulation, setUseFixture } from '../lib/api'
import type { Scenario } from '../lib/types'
import type { NativeBatch, NativeReplay } from '../lib/liveTypes'
import { NativeReplayPanel } from '../panels/NativeReplayPanel'
import '../App.css'

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
  const [headwayS, setHeadwayS] = useState(419.8125)
  const [headwayRandomnessS, setHeadwayRandomnessS] = useState(0)
  const [linkVariationShare, setLinkVariationShare] = useState(0)
  const [startTimeS, setStartTimeS] = useState(25200)
  const [endTimeS, setEndTimeS] = useState(32400)
  const [rushHourDurationS, setRushHourDurationS] = useState(7200)
  const [simulations, setSimulations] = useState<NativeBatch[]>([])
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
      setIncludedDevs(Object.fromEntries(value.developments.map(d => [d.id, true])))
    }).catch(reason => { if (!abort.signal.aborted) setError(message(reason)) })
    void getSimulations(abort.signal).then(list => {
      if (!abort.signal.aborted) {
        setSimulations(list)
        if (list.length > 0) setSelectedBatchId(current => current ?? list[0].id)
      }
    }).catch(() => {})
    return () => { abort.abort(); controller.current?.abort() }
  }, [])

  const currentBatch = simulations.find(item => item.id === selectedBatchId) ?? simulations[0] ?? null
  const replay = currentBatch ? toReplay(currentBatch, selectedRunIndex) : null

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!defaults || busy) return
    controller.current?.abort()
    const abort = new AbortController()
    controller.current = abort
    setBusy(true)
    setError('')
    try {
      const development_ids = defaults.developments.filter(d => includedDevs[d.id]).map(d => d.id)
      const batch = await runSimulation({
        run_count: runCount,
        seed,
        development_ids,
        headway_s: headwayS,
        headway_randomness_s: headwayRandomnessS,
        link_travel_time_variation_share: linkVariationShare,
        start_time_s: startTimeS,
        end_time_s: endTimeS,
        rush_hour_duration_s: rushHourDurationS,
      }, abort.signal)
      if (abort.signal.aborted) return
      setSimulations(prev => [batch, ...prev.filter(item => item.id !== batch.id)])
      setSelectedBatchId(batch.id)
      setSelectedRunIndex(0)
    } catch (reason) {
      if (!abort.signal.aborted) setError(message(reason))
    } finally {
      if (!abort.signal.aborted) setBusy(false)
    }
  }

  async function handleDelete(id: string) {
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
    }
  }

  return <main className="contract-review analysis-workspace">
    <nav><button onClick={() => onNavigate('/')}>Policy briefing</button>{' '}<button onClick={() => { setUseFixture(false); onNavigate('/map') }}>View map</button></nav>
    <header><p className="eyebrow">FutureProof · live scenario experiment</p><h1>Run westbound 505 simulation</h1><p>Broadview at Dundas → TMU / Yonge. Check which proposed buildings to include and run one or more seeded trials.</p><p role="status">{health}</p></header>
    {error && <p role="alert" className="analysis-error">{error}</p>}
    <form onSubmit={submit}>
      <fieldset disabled={busy || !defaults}>
        <legend>Proposed developments &amp; simulation parameters</legend>
        <div>
          <p>Include proposed buildings in simulation:</p>
          {defaults?.developments.map(d => (
            <label key={d.id} style={{ display: 'block', marginBottom: '0.35rem' }}>
              <input
                type="checkbox"
                checked={ Boolean(includedDevs[d.id]) }
                onChange={e => setIncludedDevs({ ...includedDevs, [d.id]: e.target.checked })}
              />{' '}
              {d.name} ({d.net_added_units} net-added units)
            </label>
          ))}
        </div>
        <div className="analysis-grid">
          <label>Number of runs<input required type="number" min={1} max={25} step={1} value={runCount} onChange={e => setRunCount(Number(e.target.value))} /></label>
          <label>Seed<input required type="number" min={0} max={2147483647} step={1} value={seed} onChange={e => setSeed(Number(e.target.value))} /></label>
          <label>Headway (s)<input required type="number" min={1} max={86400} step="any" value={headwayS} onChange={e => setHeadwayS(Number(e.target.value))} /></label>
          <label>Headway randomness (s)<input required type="number" min={0} max={86400} step="any" value={headwayRandomnessS} onChange={e => setHeadwayRandomnessS(Number(e.target.value))} /></label>
          <label>Link variation share (0–0.99)<input required type="number" min={0} max={0.99} step="any" value={linkVariationShare} onChange={e => setLinkVariationShare(Number(e.target.value))} /></label>
          <label>Start time (s)<input required type="number" min={0} max={86400} step={1} value={startTimeS} onChange={e => setStartTimeS(Number(e.target.value))} /></label>
          <label>End time (s)<input required type="number" min={1} max={172800} step={1} value={endTimeS} onChange={e => setEndTimeS(Number(e.target.value))} /></label>
          <label>Rush-hour duration (s)<input required type="number" min={1} max={86400} step="any" value={rushHourDurationS} onChange={e => setRushHourDurationS(Number(e.target.value))} /></label>
        </div>
        <button type="submit">{busy ? 'Running simulation…' : `Run simulation (${runCount} ${runCount === 1 ? 'trial' : 'trials'})`}</button>
      </fieldset>
    </form>

    {simulations.length > 0 && (
      <section aria-label="Saved simulation batches">
        <h2>Saved simulation batches ({simulations.length})</h2>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Batch ID</th>
                <th>Buildings included</th>
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
                  <tr key={batch.id} style={isSelected ? { fontWeight: 600 } : undefined}>
                    <th className="analysis-id">{batch.id.slice(0, 8)}…</th>
                    <td>{devs.length ? devs.map(d => d.name).join(', ') : 'None (baseline only)'}</td>
                    <td>{batch.overall_results.run_count} ({batch.overall_results.seeds.join(', ')})</td>
                    <td>{seconds(metrics.mean_wait_s?.mean)}</td>
                    <td>{seconds(metrics.p95_wait_s?.mean)}</td>
                    <td>{percent(metrics.denied_boarding_share?.mean)}</td>
                    <td>{seconds(batch.overall_results.runtime.total_s)}</td>
                    <td>
                      <button type="button" onClick={() => { setSelectedBatchId(batch.id); setSelectedRunIndex(0) }}>
                        {isSelected ? 'Viewing' : 'View'}
                      </button>{' '}
                      <button type="button" onClick={() => void handleDelete(batch.id)}>Delete</button>
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
        <section>
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

        <section>
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
  </main>
}
