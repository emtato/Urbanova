import type { NativeBatch } from '../lib/liveTypes'
import { readableTime } from './SimulationResults'

export interface ImpactPair {
  before: NativeBatch
  after: NativeBatch
  before_headway_s: number
  after_headway_s: number
}

type Kind = 'seconds' | 'share' | 'count'
const METRICS: { key: string; label: string; kind: Kind }[] = [
  { key: 'mean_wait_s', label: 'Average wait', kind: 'seconds' },
  { key: 'p95_wait_s', label: 'Longer waits (95th percentile)', kind: 'seconds' },
  { key: 'denied_boarding_share', label: 'Riders left behind at least once', kind: 'share' },
  { key: 'unresolved_passengers', label: 'Still waiting after a full streetcar', kind: 'count' },
]

const show = (value: number | null | undefined, kind: Kind) => {
  if (value === null || value === undefined) return 'Not available'
  if (kind === 'seconds') return readableTime(value)
  if (kind === 'share') return `${(value * 100).toFixed(1)}%`
  return value.toFixed(1)
}

const change = (before: number | null | undefined, after: number | null | undefined, kind: Kind) => {
  if (before === null || before === undefined || after === null || after === undefined) return { text: '—', tone: '' }
  const diff = after - before
  if (Math.abs(diff) < 1e-9) return { text: 'no change', tone: '' }
  const sign = diff > 0 ? '+' : '−'
  const amount = kind === 'share' ? `${(Math.abs(diff) * 100).toFixed(1)} percentage points` : kind === 'seconds' ? `${Math.abs(diff).toFixed(1)} s` : Math.abs(diff).toFixed(1)
  const pct = before !== 0 && kind !== 'share' ? ` (${sign}${Math.abs((diff / before) * 100).toFixed(0)}%)` : ''
  // Lower is better for every metric shown.
  return { text: `${sign}${amount}${pct}`, tone: diff < 0 ? 'is-better' : 'is-worse' }
}

/** Same buildings, seeds and settings; only the headway differs. Averages across the batch's runs. */
export function HeadwayImpactCard({ pair }: { pair: ImpactPair | null }) {
  if (!pair) return <section className="service-card" aria-labelledby="impact-title">
    <h2 id="impact-title">Before and after for riders</h2>
    <p>Run a simulation with a headway other than today's to compare rider waits against today's service.</p>
  </section>
  const before = pair.before.overall_results
  const after = pair.after.overall_results
  return <section className="service-card" aria-labelledby="impact-title">
    <h2 id="impact-title">Before and after for riders</h2>
    <p className="service-note">
      Today: a streetcar every {readableTime(pair.before_headway_s)}. Your service: every {readableTime(pair.after_headway_s)}.
      {' '}Same buildings, settings and random seeds; only the service interval changes. Values are averages across {after.run_count} {after.run_count === 1 ? 'run' : 'runs'} per service level.
    </p>
    <div className="analysis-impact-list">
      {METRICS.map(({ key, label, kind }) => {
        const b = before.metrics[key]?.mean
        const a = after.metrics[key]?.mean
        const delta = change(b, a, kind)
        return <div key={key} className="analysis-impact-item">
          <h3>{label}</h3>
          <dl>
            <div><dt>Today</dt><dd>{show(b, kind)}</dd></div>
            <div><dt>Your service</dt><dd>{show(a, kind)}</dd></div>
            <div><dt>Change</dt><dd className={delta.tone}>{delta.text}</dd></div>
          </dl>
        </div>
      })}
    </div>
  </section>
}
