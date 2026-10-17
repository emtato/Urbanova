import type { NativeBatch } from '../lib/liveTypes'

export interface ImpactPair {
  before: NativeBatch
  after: NativeBatch
  before_headway_s: number
  after_headway_s: number
}

type Kind = 'seconds' | 'share' | 'count'
const METRICS: { key: string; label: string; kind: Kind }[] = [
  { key: 'mean_wait_s', label: 'Mean wait', kind: 'seconds' },
  { key: 'p95_wait_s', label: 'P95 wait (bad mornings)', kind: 'seconds' },
  { key: 'denied_boarding_share', label: 'Riders left behind at least once', kind: 'share' },
  { key: 'unresolved_passengers', label: 'Still waiting at cutoff', kind: 'count' },
]

const show = (value: number | null | undefined, kind: Kind) => {
  if (value === null || value === undefined) return 'Unknown'
  if (kind === 'seconds') return `${value.toFixed(1)} s`
  if (kind === 'share') return `${(value * 100).toFixed(1)}%`
  return value.toFixed(1)
}

const change = (before: number | null | undefined, after: number | null | undefined, kind: Kind) => {
  if (before === null || before === undefined || after === null || after === undefined) return { text: '—', tone: '' }
  const diff = after - before
  if (Math.abs(diff) < 1e-9) return { text: 'no change', tone: '' }
  const sign = diff > 0 ? '+' : '−'
  const amount = kind === 'share' ? `${(Math.abs(diff) * 100).toFixed(1)} pts` : kind === 'seconds' ? `${Math.abs(diff).toFixed(1)} s` : Math.abs(diff).toFixed(1)
  const pct = before !== 0 ? ` (${sign}${Math.abs((diff / before) * 100).toFixed(0)}%)` : ''
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
      Today's {Math.round(pair.before_headway_s)} s vs {Math.round(pair.after_headway_s)} s, same buildings and seeds
      ({after.seeds.join(', ')}), averaged over {after.run_count} {after.run_count === 1 ? 'run' : 'runs'}. Westbound AM peak, one simulated corridor.
    </p>
    <div className="table-scroll">
      <table>
        <thead><tr><th>Measure</th><th>Today ({Math.round(pair.before_headway_s)} s)</th><th>With {Math.round(pair.after_headway_s)} s</th><th>Change</th></tr></thead>
        <tbody>
          {METRICS.map(({ key, label, kind }) => {
            const b = before.metrics[key]?.mean
            const a = after.metrics[key]?.mean
            const delta = change(b, a, kind)
            return <tr key={key}>
              <th>{label}</th>
              <td>{show(b, kind)}</td>
              <td>{show(a, kind)}</td>
              <td className={delta.tone}>{delta.text}</td>
            </tr>
          })}
        </tbody>
      </table>
    </div>
  </section>
}
