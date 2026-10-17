import { useState } from 'react'
import { sampleComparison } from './lib/sampleComparison'
import type { Comparison, DemandCase } from './lib/types'
import './App.css'

const comparison: Comparison = sampleComparison

function App() {
  const replay = comparison.replay
  const [time, setTime] = useState(0)
  const [demandCase, setDemandCase] = useState<DemandCase>(comparison.scenario.demand_case)
  const stopNames = new Map(comparison.corridor.stops.map(stop => [stop.id, stop.name]))
  const events = replay?.events.filter(event => event.t_s <= time) ?? []
  const vehicles = Object.keys(replay?.vehicle_capacity ?? {}).map(id => ({
    id, last: events.findLast(event => event.vehicle_id === id),
  }))
  const queues = replay?.initial_queues.map(queue => ({
    ...queue,
    remaining: queue.count - events.filter(event => event.kind === 'board' && event.stop_id === queue.stop_id && event.rider_group === queue.rider_group).reduce((total, event) => total + event.count, 0),
  })) ?? []

  return (
    <main className="contract-review">
      {comparison.fixture && <div className="fixture-banner" role="status">FIXTURE — synthetic demand, costs and results. Not a 505 forecast.</div>}
      <header>
        <p className="eyebrow">FutureProof · scenario experiment</p>
        <h1>505 · Broadview to TMU Station</h1>
        <p>{comparison.corridor.direction} on Dundas East · {comparison.corridor.stops.length} stops · {comparison.corridor.peak_window.service_date}, 07:00–09:00 Toronto time</p>
        <p>Contract {comparison.contract_version} · synthetic housing stays fixed across packages.</p>
      </header>
      <section aria-labelledby="cases-title">
        <h2 id="cases-title">Hand-worked comparison</h2>
        <label htmlFor="demand-case">Fixture demand case: </label>
        <select id="demand-case" value={demandCase} onChange={event => setDemandCase(event.target.value as DemandCase)}>
          <option value="low">Low</option><option value="central">Central</option><option value="high">High</option>
        </select>
        <p>Assumed new-rider arrivals: 3 / 5 / 7 passengers per fixture window. This selects a pre-authored example.</p>
        <div className="table-scroll"><table>
          <thead><tr><th>Case</th><th>Completed-rider mean wait</th><th>P95 wait</th><th>Denied at least once</th><th>Unresolved</th></tr></thead>
          <tbody>{comparison.cases.filter(result => result.demand_case === demandCase).map(result => <tr key={result.case_id}>
            <th scope="row">{result.kind.replaceAll('_', ' ')}</th>
            <td>{result.per_run_mean_wait_s[0]} s</td><td>{result.per_run_p95_wait_s[0]} s</td>
            <td>{Math.round((result.per_run_denied_share[0] ?? 0) * 100)}%</td><td>{result.unresolved_passengers}</td>
          </tr>)}</tbody>
        </table></div>
        <p>Waits describe completed riders only. In the central case, growth leaves two riders waiting; supported growth clears them. These are hand-authored integration examples.</p>
        <ul>{comparison.packages.flatMap(item => item.evaluations.filter(evaluation => evaluation.demand_case === demandCase).map(evaluation => <li key={`${item.package_id}-${evaluation.phase_id}`}>{item.label}: {evaluation.feasible ? 'within fixture budget and fleet limits' : 'infeasible'}; {evaluation.criterion_met ? 'passes fixture criterion' : 'fails fixture criterion'}.</li>))}</ul>
      </section>
      {replay && <section aria-labelledby="replay-title">
        <h2 id="replay-title">Two-streetcar fixture replay · central demand</h2>
        <label htmlFor="replay-time">Elapsed time: {time} s</label>
        <input id="replay-time" type="range" min="0" max={replay.horizon_s} step="1" value={time} onChange={event => setTime(Number(event.target.value))} />
        <ul>{vehicles.map(({ id, last }) => <li key={id}>{id}: {last ? `${last.kind} · ${stopNames.get(last.stop_id)} · ${last.load_after} onboard` : 'not dispatched'}</li>)}</ul>
        <ul>{queues.map(queue => <li key={`${queue.stop_id}-${queue.rider_group}`}>{stopNames.get(queue.stop_id)} · {queue.rider_group}: {queue.remaining} waiting</li>)}</ul>
        <details><summary>Event stream ({events.length} visible)</summary><ol>{events.map((event, index) => <li key={index}>{event.t_s} s · {event.vehicle_id} · {event.kind} · {stopNames.get(event.stop_id)} · count {event.count} · load {event.load_after}</li>)}</ol></details>
      </section>}
      <section aria-labelledby="inputs-title">
        <h2 id="inputs-title">Assumptions behind the fixture</h2>
        <div className="table-scroll"><table>
          <thead><tr><th>Input</th><th>Central</th><th>Low–high</th><th>Allowed range</th><th>Status and meaning</th></tr></thead>
          <tbody>{comparison.assumptions.map(item => <tr key={item.key}>
            <th scope="row">{item.key.replaceAll('_', ' ')}</th><td>{item.central} {item.unit}</td>
            <td>{item.low}–{item.high}</td><td>{item.allowed_range.low}–{item.allowed_range.high} {item.unit}</td>
            <td>{item.status} · {item.meaning}</td>
          </tr>)}</tbody>
        </table></div>
      </section>
      <section aria-labelledby="evidence-title">
        <h2 id="evidence-title">Evidence and limits</h2>
        <ul>{comparison.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul>
        <details><summary>Sources ({comparison.sources.length})</summary><ul>{comparison.sources.map(source => <li key={source.source_id}><a href={source.url} target="_blank" rel="noreferrer">{source.title}</a> · {source.publisher} · {source.version}</li>)}</ul></details>
      </section>
    </main>
  )
}

export default App
