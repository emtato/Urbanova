import { useMemo } from 'react'
import type { NativeBatch } from '../lib/liveTypes'
import { ANALYSIS_METRICS, analysisStatistics, formatAnalysisMetric, readableTime, type AnalysisMetric } from '../lib/analysisMetrics'

export interface ImpactPair {
  before: NativeBatch
  after: NativeBatch
  before_headway_s: number
  after_headway_s: number
  kind?: 'housing' | 'service'
}

const change = (before: number | null | undefined, after: number | null | undefined, metric: AnalysisMetric) => {
  if (before == null || after == null) return { text: '—', tone: '' }
  const diff = after - before
  if (Math.abs(diff) < 1e-9) return { text: 'no change', tone: '' }
  const sign = diff > 0 ? '+' : '−'
  const amount = metric.kind === 'share' ? `${(Math.abs(diff) * 100).toFixed(1)} percentage points`
    : metric.kind === 'seconds' ? `${Math.abs(diff).toFixed(1)} s`
    : metric.kind === 'score' ? `${Math.abs(diff).toFixed(1)} points` : Math.abs(diff).toFixed(1)
  const pct = before !== 0 && metric.kind !== 'share' && metric.kind !== 'score' ? ` (${sign}${Math.abs((diff / before) * 100).toFixed(0)}%)` : ''
  const better = metric.higherIsBetter ? diff > 0 : diff < 0
  return { text: `${sign}${amount}${pct}`, tone: better ? 'is-better' : 'is-worse' }
}

export function HeadwayImpactCard({ pair }: { pair: ImpactPair | null }) {
  const before = useMemo(() => pair ? analysisStatistics(pair.before) : null, [pair?.before])
  const after = useMemo(() => pair ? analysisStatistics(pair.after) : null, [pair?.after])
  if (!pair || !before || !after) return <section className="service-card" aria-labelledby="impact-title">
    <h2 id="impact-title">Before and after for riders</h2>
    <p>Select developments or change the streetcar interval, then run a simulation to compare impacts.</p>
  </section>
  const housing = pair.kind === 'housing'
  return <section className="service-card" aria-labelledby="impact-title">
    <h2 id="impact-title">Before and after for riders</h2>
    <p className="service-note">{housing
      ? `Impact of new homes: existing housing compared with the selected developments added. Service stays at a streetcar every ${readableTime(pair.before_headway_s)}.`
      : `Impact of service: current service every ${readableTime(pair.before_headway_s)} compared with your chosen interval of ${readableTime(pair.after_headway_s)}. Housing stays the same.`}
      {' '}Other settings and random seeds match. Values are averages across {pair.after.overall_results.run_count} {pair.after.overall_results.run_count === 1 ? 'run' : 'runs'} per scenario.
    </p>
    <div className="analysis-impact-list">
      {ANALYSIS_METRICS.filter(metric => metric.key !== 'in_progress_at_cutoff_passengers').map(metric => {
        const b = before[metric.key].mean
        const a = after[metric.key].mean
        const delta = change(b, a, metric)
        return <div key={metric.key} className="analysis-impact-item">
          <h3>{metric.label}</h3>
          <p className="analysis-help">{metric.help}</p>
          <dl>
            <div><dt>{housing ? 'Existing homes' : 'Current service'}</dt><dd>{formatAnalysisMetric(b, metric.kind)}</dd></div>
            <div><dt>{housing ? 'With new homes' : 'Chosen service'}</dt><dd>{formatAnalysisMetric(a, metric.kind)}</dd></div>
            <div><dt>Change</dt><dd className={delta.tone}>{delta.text}</dd></div>
          </dl>
        </div>
      })}
    </div>
  </section>
}
