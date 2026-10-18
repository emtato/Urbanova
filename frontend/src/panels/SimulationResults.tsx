import type { NativeBatch } from '../lib/liveTypes'

import { useMemo } from 'react'
import { readableTime, ANALYSIS_METRICS, analysisStatistics, analysisMetricValue, formatAnalysisMetric } from '../lib/analysisMetrics'
export { readableTime } from '../lib/analysisMetrics'

export function SimulationResults({ batch, selectedRunIndex, onSelectRun }: {
  batch: NativeBatch; selectedRunIndex: number; onSelectRun: (index: number) => void
}) {
  const overall = batch.overall_results
  const statistics = useMemo(() => analysisStatistics(batch), [batch])
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
        {ANALYSIS_METRICS.map(({ key, label, help, kind }) => <div key={key} className="analysis-metric">
          <dt>{label}</dt><dd>{formatAnalysisMetric(statistics[key].mean, kind)}</dd><p>{help}</p>
        </div>)}
      </dl>
      <p className="analysis-help">Crowding and reliability use recorded departures, stop arrivals and queue history. Averages can hide busier stops; missing history is shown as unavailable. Spacing scores are averaged across runs.</p>
      {multiple && <p className="analysis-help">Passenger counts are averages per run, so they may include decimals. Wait times describe riders who boarded; they exclude people still waiting.</p>}
      <details className="analysis-result-details">
        <summary>{multiple ? 'Detailed statistics and run information' : 'Run information'}</summary>
        <dl className="analysis-run-info"><div><dt>Simulation ID</dt><dd>{batch.id}</dd></div><div><dt>Random seeds</dt><dd>{overall.seeds.join(', ')}</dd></div></dl>
        {multiple && <>
          <p className="analysis-help">These statistics compare the values from individual runs. The longer-wait average is an average of each run’s 95th percentile, not a percentile of all riders combined. Standard deviation describes variation between runs; it is not a confidence interval.</p>
          <div className="table-scroll"><table>
            <caption className="analysis-sr-only">Variation between simulation runs</caption>
            <thead><tr><th scope="col">Measure</th><th scope="col">Average</th><th scope="col">Median</th><th scope="col">Lowest–highest</th><th scope="col">Standard deviation</th><th scope="col">Runs with data</th></tr></thead>
            <tbody>{ANALYSIS_METRICS.map(({ key, label, kind }) => {
              const stat = statistics[key]
              return <tr key={key}><th scope="row">{label}</th><td>{formatAnalysisMetric(stat?.mean, kind)}</td><td>{formatAnalysisMetric(stat?.median, kind)}</td><td>{formatAnalysisMetric(stat?.min, kind)} – {formatAnalysisMetric(stat?.max, kind)}</td><td>{formatAnalysisMetric(stat?.stddev, kind)}</td><td>{stat?.valid_run_count ?? 0} / {overall.run_count}</td></tr>
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
        <dl className="analysis-run-measures">{ANALYSIS_METRICS.map(({ key, label, kind }) => <div key={key}><dt>{label}</dt><dd>{formatAnalysisMetric(analysisMetricValue(run, key), kind)}</dd></div>)}</dl>
        <p className="analysis-help">These values and the replay below belong to run {selectedRunIndex + 1}, rather than the average above.</p>
      </> : <p className="analysis-help">The replay below follows the same run as the results above. Use Play or the timeline to explore it.</p>}
    </section>}
  </>
}
