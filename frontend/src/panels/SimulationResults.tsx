import type { NativeBatch } from '../lib/liveTypes'

export const readableTime = (value: number | null | undefined): string => {
  if (value == null || !Number.isFinite(value)) return 'Not available'
  const rounded = Math.round(value)
  if (rounded < 60) return `${Number(value.toFixed(1))} sec`
  const remainder = rounded % 60
  return `${Math.floor(rounded / 60)} min${remainder ? ` ${remainder} sec` : ''}`
}
const share = (value: number | null | undefined) => value == null ? 'Not available' : `${(value * 100).toFixed(1)}%`
const people = (value: number | null | undefined) => value == null ? 'Not available' : value.toLocaleString(undefined, { maximumFractionDigits: 1 })

type MetricKey = 'mean_wait_s' | 'p95_wait_s' | 'denied_boarding_share' | 'unresolved_passengers' | 'in_progress_at_cutoff_passengers'
const metrics: { key: MetricKey; label: string; help: string; format: typeof readableTime }[] = [
  { key: 'mean_wait_s', label: 'Average wait', help: 'Time spent waiting by riders who boarded a streetcar.', format: readableTime },
  { key: 'p95_wait_s', label: 'Longer waits', help: '95% of riders who boarded waited this long or less in each run (95th percentile).', format: readableTime },
  { key: 'denied_boarding_share', label: 'Left behind at least once', help: 'Among riders who encountered a streetcar, the share unable to board a full one at least once.', format: share },
  { key: 'unresolved_passengers', label: 'Still waiting after a full streetcar', help: 'Riders left at a stop after being unable to board, when the simulation ended.', format: people },
  { key: 'in_progress_at_cutoff_passengers', label: 'Trips still in progress', help: 'Riders still onboard or waiting for their first streetcar when the simulation ended. These are separate from riders left behind.', format: people },
]

export function SimulationResults({ batch, selectedRunIndex, onSelectRun }: {
  batch: NativeBatch; selectedRunIndex: number; onSelectRun: (index: number) => void
}) {
  const overall = batch.overall_results
  const multiple = overall.run_count > 1
  const run = batch.individual_results[selectedRunIndex] ?? batch.individual_results[0]
  return <>
    <section className="analysis-results-card" aria-labelledby="simulation-results-title">
      <div className="analysis-results-heading">
        <div><p className="analysis-eyebrow">Selected simulation</p><h2 id="simulation-results-title">{batch.name || 'Your results'}</h2></div>
        <span className="analysis-result-badge">{overall.run_count} {multiple ? 'runs' : 'run'} · computed in {readableTime(overall.runtime.total_s)}</span>
      </div>
      <p className="analysis-help">{multiple
        ? 'Each value is an average across runs, including the longer-wait measure. Repeated runs show how outcomes vary under the same settings.'
        : 'Results from one run. Repeat the simulation with more runs to explore how outcomes vary.'}</p>
      <dl className="analysis-metric-grid">
        {metrics.map(({ key, label, help, format }) => <div key={key} className="analysis-metric">
          <dt>{label}</dt><dd>{format(overall.metrics[key]?.mean)}</dd><p>{help}</p>
        </div>)}
      </dl>
      {multiple && <p className="analysis-help">Passenger counts are averages per run, so they may include decimals. Wait times describe riders who boarded; they exclude people still waiting.</p>}
      <details className="analysis-result-details">
        <summary>{multiple ? 'Detailed statistics and run information' : 'Run information'}</summary>
        <dl className="analysis-run-info"><div><dt>Simulation ID</dt><dd>{batch.id}</dd></div><div><dt>Random seeds</dt><dd>{overall.seeds.join(', ')}</dd></div></dl>
        {multiple && <>
          <p className="analysis-help">These statistics compare the values from individual runs. The longer-wait average is an average of each run’s 95th percentile, not a percentile of all riders combined. Standard deviation describes variation between runs; it is not a confidence interval.</p>
          <div className="table-scroll"><table>
            <caption className="analysis-sr-only">Variation between simulation runs</caption>
            <thead><tr><th scope="col">Measure</th><th scope="col">Average</th><th scope="col">Median</th><th scope="col">Lowest–highest</th><th scope="col">Standard deviation</th><th scope="col">Runs with data</th></tr></thead>
            <tbody>{metrics.map(({ key, label, format }) => {
              const stat = overall.metrics[key]
              return <tr key={key}><th scope="row">{label}</th><td>{format(stat?.mean)}</td><td>{format(stat?.median)}</td><td>{format(stat?.min)} – {format(stat?.max)}</td><td>{format(stat?.stddev)}</td><td>{stat?.valid_run_count ?? 0} / {overall.run_count}</td></tr>
            })}</tbody>
          </table></div>
        </>}
      </details>
    </section>
    {run && <section className="analysis-results-card" aria-labelledby="replay-run-title">
      <h2 id="replay-run-title">{multiple ? 'Choose a run to replay' : 'Replay this run'}</h2>
      {multiple ? <>
        <div className="analysis-run-select"><label htmlFor="replay-run">Replay run</label>
          <select id="replay-run" value={selectedRunIndex} onChange={event => onSelectRun(Number(event.target.value))}>
            {batch.individual_results.map((item, index) => <option key={`${index}-${item.inputs.seed}`} value={index}>Run {index + 1} · average wait {readableTime(item.summary.overview.mean_wait_s)}</option>)}
          </select>
        </div>
        <dl className="analysis-run-measures">{metrics.map(({ key, label, format }) => <div key={key}><dt>{label}</dt><dd>{format(run.summary.overview[key])}</dd></div>)}</dl>
        <p className="analysis-help">These values and the replay below belong to run {selectedRunIndex + 1}, rather than the average above.</p>
      </> : <p className="analysis-help">The replay below follows the same run as the results above. Use Play or the timeline to explore it.</p>}
    </section>}
  </>
}
