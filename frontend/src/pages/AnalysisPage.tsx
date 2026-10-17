import { useEffect, useRef, useState } from 'react'
import { apiRequest, checkBackendHealth, fetchNativeMetrics, fetchNativeReplay, fetchSummary, runAnalysis, setUseFixture } from '../lib/api'
import type { Comparison, Scenario } from '../lib/types'
import type { AnalysisSummary, NativeMetrics, NativeReplay, PackagePolicy } from '../lib/liveTypes'
import { NativeReplayPanel } from '../panels/NativeReplayPanel'
import '../App.css'

const illustrativePolicy = (): PackagePolicy => ({ cycle_s: 3600, lane_cycle_s: 3000, baseline_headway_s: 600, service_headway_s: 300, peak_hours: 2, service_days: 250, cost_per_hour: { low: 100, central: 120, high: 150 }, lane_capital: { low: 10000, central: 15000, high: 20000 }, lane_operating: { low: 0, central: 0, high: 0 }, price_year: 2026, earliest_phase: 'phase-1', source_ids: [], assumption_label: 'User-selected illustrative scenario assumptions; not TTC observations or cost quotes.' })
const message = (error: unknown) => error instanceof Error ? error.message : String(error)
const money = (value: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value)
const seconds = (value: number | null) => value === null ? 'Unknown' : `${value.toFixed(1)} s`

export function AnalysisPage({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [defaults, setDefaults] = useState<Scenario | null>(null), [health, setHealth] = useState('Checking API and database…')
  const [error, setError] = useState(''), [status, setStatus] = useState(''), [busy, setBusy] = useState(false)
  const [policy, setPolicy] = useState(illustrativePolicy), [upgrades, setUpgrades] = useState(false), [accepted, setAccepted] = useState(false)
  const [capital, setCapital] = useState(1000000), [operating, setOperating] = useState(1000000), [fleet, setFleet] = useState(20)
  const [year, setYear] = useState(2030), [seed, setSeed] = useState(42), [units, setUnits] = useState<Record<string, number>>({})
  const [result, setResult] = useState<Comparison | null>(null), [summary, setSummary] = useState<AnalysisSummary | null>(null)
  const [native, setNative] = useState<NativeMetrics | null>(null), [replay, setReplay] = useState<NativeReplay | null>(null), [edited, setEdited] = useState(false)
  const [supplementError, setSupplementError] = useState('')
  const controller = useRef<AbortController | null>(null)
  useEffect(() => {
    const abort = new AbortController()
    void checkBackendHealth().then(value => { if (!abort.signal.aborted) setHealth(value.ok ? 'API and database connected' : value.message || value.status || 'API unavailable') })
    void apiRequest<Scenario>('/scenarios/default', undefined, abort.signal).then(value => {
      setDefaults(value); setYear(value.phases[0].year); setUnits(Object.fromEntries(value.developments.map(d => [d.id, d.net_added_units])))
      setPolicy(p => ({ ...p, price_year: value.budget_price_year, earliest_phase: value.phases[0].phase_id }))
    }).catch(reason => { if (!abort.signal.aborted) setError(message(reason)) })
    return () => { abort.abort(); controller.current?.abort() }
  }, [])
  const edit = () => { setEdited(true); setAccepted(false) }
  const scalar = (key: 'cycle_s' | 'lane_cycle_s' | 'baseline_headway_s' | 'service_headway_s' | 'peak_hours' | 'service_days', label: string) => <label key={key}>{label}<input required type="number" min={key === 'peak_hours' || key === 'service_days' ? 0 : 1} max={key === 'peak_hours' ? 24 : key === 'service_days' ? 366 : 86400} step={key === 'service_days' ? 1 : 'any'} value={policy[key]} onChange={event => { edit(); setPolicy({ ...policy, [key]: Number(event.target.value) }) }} /></label>
  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!defaults || busy) return
    if (upgrades && !accepted) { setError('Confirm the editable values as your scenario assumptions before comparing upgrades.'); return }
    controller.current?.abort(); const abort = new AbortController(); controller.current = abort
    setBusy(true); setError(''); setSupplementError(''); setResult(null); setSummary(null); setNative(null); setReplay(null)
    try {
      const comparison = await runAnalysis({ capital_budget_cad: capital, annual_operating_budget_cad: operating, fleet_allowance: fleet, phase_years: [{ phase_id: defaults.phases[0].phase_id, year }], development_units: defaults.developments.map(d => ({ development_id: d.id, net_added_units: units[d.id] })) }, { policy: upgrades ? policy : undefined, seed_ids: [seed], retain_replay: true, signal: abort.signal, onProgress: setStatus })
      setResult(comparison); setEdited(false)
      const supplements = await Promise.allSettled([fetchSummary(comparison.comparison_id, abort.signal), fetchNativeMetrics(comparison.comparison_id, abort.signal), fetchNativeReplay(comparison.comparison_id, abort.signal)])
      if (abort.signal.aborted) return
      if (supplements[0].status === 'fulfilled') setSummary(supplements[0].value)
      if (supplements[1].status === 'fulfilled') setNative(supplements[1].value)
      if (supplements[2].status === 'fulfilled') setReplay(supplements[2].value)
      setSupplementError(supplements.filter(item => item.status === 'rejected').map(item => item.status === 'rejected' ? message(item.reason) : '').join('; '))
    } catch (reason) { if (!abort.signal.aborted) setError(message(reason)) }
    finally { if (!abort.signal.aborted) setBusy(false) }
  }
  return <main className="contract-review analysis-workspace">
    <nav><button onClick={() => onNavigate('/')}>Policy briefing</button>{' '}<button onClick={() => { setUseFixture(false); onNavigate('/map') }}>View map</button></nav>
    <header><p className="eyebrow">FutureProof · live scenario experiment</p><h1>Compare westbound 505 options</h1><p>Broadview at Dundas → TMU / Yonge. Computed results use reviewed housing and explicit model assumptions.</p><p role="status">{health}</p></header>
    {error && <p role="alert" className="analysis-error">{error}</p>}
    <form onSubmit={submit} onChange={() => setEdited(true)}>
      <fieldset disabled={busy || !defaults}>
        <legend>Housing and budgets</legend>
        <div className="analysis-grid">
          <label>Phase year<input required type="number" min={2026} max={2100} value={year} onChange={e => setYear(Number(e.target.value))} /></label>
          <label>Capital budget (CAD)<input required type="number" min={0} max={1e9} value={capital} onChange={e => setCapital(Number(e.target.value))} /></label>
          <label>Annual operating budget (CAD/year)<input required type="number" min={0} max={1e9} value={operating} onChange={e => setOperating(Number(e.target.value))} /></label>
          <label>Extra fleet allowance<input required type="number" min={0} max={100} value={fleet} onChange={e => setFleet(Number(e.target.value))} /></label>
          <label>Seed ID<input required type="number" min={0} max={2147483647} value={seed} onChange={e => setSeed(Number(e.target.value))} /></label>
          {defaults?.developments.map(d => <label key={d.id}>{d.name}: net-added homes<input required type="number" min={0} max={10000} value={units[d.id] ?? 0} onChange={e => setUnits({ ...units, [d.id]: Number(e.target.value) })} /></label>)}
        </div>
        <label><input type="checkbox" checked={upgrades} onChange={e => { edit(); setUpgrades(e.target.checked) }} /> Compare lane, extra service and both</label>
        {upgrades && <section aria-label="Upgrade assumptions">
          <h2>Editable assumptions</h2><p>These starting values are illustrative, not sourced TTC costs or measured lane effects. Review or replace them and confirm before running. Existing service uses the baseline headway below. Budgets and prices use {policy.price_year} CAD.</p>
          <div className="analysis-grid">{scalar('cycle_s', 'Baseline cycle (seconds)')}{scalar('lane_cycle_s', 'Cycle with lane (seconds)')}{scalar('baseline_headway_s', 'Baseline headway (seconds)')}{scalar('service_headway_s', 'Extra-service headway (seconds)')}{scalar('peak_hours', 'Service hours per day')}{scalar('service_days', 'Service days per year')}</div>
          <div className="table-scroll"><table><thead><tr><th>Cost assumption</th><th>Low</th><th>Central</th><th>High</th></tr></thead><tbody>
            {(['cost_per_hour', 'lane_capital', 'lane_operating'] as const).map(key => <tr key={key}><th>{key === 'cost_per_hour' ? 'Vehicle operation CAD/hour' : key === 'lane_capital' ? 'Lane capital CAD' : 'Lane operation CAD/year'}</th>{(['low', 'central', 'high'] as const).map(bound => <td key={bound}><input aria-label={`${key} ${bound}`} required type="number" min={0} max={1e9} value={policy[key][bound]} onChange={e => { edit(); setPolicy({ ...policy, [key]: { ...policy[key], [bound]: Number(e.target.value) } }) }} /></td>)}</tr>)}
          </tbody></table></div>
          <label>Assumption note<input required maxLength={2000} value={policy.assumption_label} onChange={e => { edit(); setPolicy({ ...policy, assumption_label: e.target.value }) }} /></label>
          <label><input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} /> Use these values as my scenario assumptions.</label>
        </section>}
        <button type="submit">Run {upgrades ? 'tested packages' : 'existing service'} · low / central / high</button>
      </fieldset>
    </form>
    {busy && <p role="status">{status}. You can leave this page; the server job continues.</p>}
    {edited && result && <p role="status">Inputs changed. The results below belong to the previous inputs; run again to update.</p>}
    {result && <>
      <section><h2>Computed comparison</h2><p className="analysis-id">Comparison {result.comparison_id}</p>
        <p>{summary?.decision.wording} {summary && (summary.decision.preferred_package_id ? `Preferred: ${summary.decision.preferred_package_id}.` : 'No tested package meets every selected criterion.')}</p>
        <p>Decision criteria retain the frozen contract definition: unresolved includes everyone still waiting or onboard. The native B11 table below separately treats cutoff-in-progress riders as neutral.</p>
        {summary && <><p>{summary.decision.cost_order}</p><div className="table-scroll"><table><thead><tr><th>Package</th><th>Capital, high</th><th>Annual operation, high</th><th>Feasible</th><th>Criterion met</th><th>Dominated</th></tr></thead><tbody>{summary.decision.alternatives.map(p => <tr key={p.package_id}><th>{p.package_id}</th><td>{money(p.capital)}</td><td>{money(p.operating)}</td><td>{String(p.feasible)}</td><td>{String(p.meets)}</td><td>{String(p.dominated)}</td></tr>)}</tbody></table></div><p>One-year upgrade delay: {summary.sensitivity.upgrade_delay.status}. Preferred package {summary.sensitivity.upgrade_delay.preferred_changes ? 'changes' : 'unchanged'}: {summary.sensitivity.upgrade_delay.preferred_package_id ?? 'none'}.</p></>}
        {supplementError && <p role="alert">Some result details could not load: {supplementError}</p>}
      </section>
      {native && <section><h2>B11 outcomes with neutral cutoff riders</h2><p>Denied share is among riders who encountered a streetcar. Stranded means denied and still waiting. Neutral means onboard or awaiting a first car at cutoff; these riders are not failures. Waits describe completed journeys only.</p><div className="table-scroll"><table><thead><tr><th>Run / case</th><th>Mean wait</th><th>P95 wait</th><th>Denied</th><th>Stranded</th><th>Neutral at cutoff</th></tr></thead><tbody>{native.runs.map(run => { const metrics = run.summary.contract.case_metrics; return <tr key={run.run_id}><th className="analysis-id">{run.run_id}</th><td>{seconds(metrics.mean_wait_s)}</td><td>{seconds(metrics.p95_wait_s)}</td><td>{metrics.denied_share === null ? 'Unknown' : `${(metrics.denied_share * 100).toFixed(1)}%`}</td><td>{metrics.unresolved_passengers}</td><td>{run.summary.contract.diagnostics.in_progress_at_cutoff_excluded}</td></tr> })}</tbody></table></div></section>}
      {replay && <NativeReplayPanel key={replay.run_id} replay={replay} />}
      <section><h2>Evidence and limits</h2><ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul><details><summary>Sources and versions</summary><p className="analysis-id">Model {result.cases[0]?.runs[0]?.model_version} · data {result.cases[0]?.runs[0]?.data_version} · seed {result.cases[0]?.runs[0]?.seed_ids.join(', ')}</p><ul>{result.sources.map(source => <li key={source.source_id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · {source.version}</li>)}</ul></details></section>
    </>}
  </main>
}
