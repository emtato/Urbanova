import { useEffect, useId, useState, type FC, type ReactNode } from 'react'
import { type CorridorDevelopment, type CorridorStop, normalizeStop } from '../map/types'
import type { CaseResult, Comparison } from '../lib/types'
import type { NativeBatch } from '../lib/liveTypes'
import { spacingScore, transitMetrics, type TransitMetrics } from './transitMetrics'
import { addComparison, batchCase, comparisonProblem, configurationName, configurationSummary, todayBaseline, todayDate, useSimulationHistory } from '../lib/simulationHistory'
import { SimulationPicker } from './SimulationPicker'
import './StopPanel.css'

export interface StopPanelProps {
  stop: CorridorStop | any
  stops?: Array<CorridorStop | any>
  developments?: Array<CorridorDevelopment | any>
  currentCase?: CaseResult
  growthCase?: CaseResult
  supportedCase?: CaseResult
  comparison?: Comparison
  onClose: () => void
  onViewPlatform?: () => void
  onSelectDevelopment?: (dev: CorridorDevelopment) => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}
const count = (value: number | null | undefined) => value == null ? '—' : value.toLocaleString(undefined, { maximumFractionDigits: 1 })
const wait = (value: number | null | undefined) => value == null ? '—' : value < 60 ? `${Math.round(value)}s` : `${(value / 60).toFixed(1)} min`
const percent = (value: number | null | undefined) => value == null ? '—' : `${Math.round(value * 100)}%`
const deltaWait = (value: number | null | undefined, base: number | null | undefined) => value == null || base == null ? '—' : `${value > base ? '+' : value < base ? '−' : ''}${wait(Math.abs(value - base))}`
const clock = (seconds: number) => `${String(Math.floor(seconds / 3600) % 24).padStart(2, '0')}:${String(Math.floor(seconds % 3600 / 60)).padStart(2, '0')}`
interface Column { id: string; name: string; batch: NativeBatch; metrics: TransitMetrics; comparable: boolean }

function MetricTable({ columns, rows }: { columns: Column[]; rows: { label: string; render: (column: Column) => ReactNode }[] }) {
  return <div className="transit-comparison-columns" style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))` }} data-count={columns.length}>
    {columns.map((column, index) => <section key={column.id} aria-label={column.name} className={`transit-comparison-column transit-run-${index}`}>
      <h4 title={column.name}>{column.name}</h4>
      <div className="transit-run-metrics">{rows.map(row => <div key={row.label} className="transit-metric inspector-stat-card">
        <span>{row.label}</span><strong>{column.comparable ? row.render(column) : '—'}</strong>
      </div>)}</div>
    </section>)}
  </div>
}

export const StopPanel: FC<StopPanelProps> = ({ stop: rawStop, stops: rawStops = [], onClose, onViewPlatform,
  isMinimized = false, onToggleMinimize, className = '' }) => {
  const [scope, setScope] = useState<'station' | 'line'>('station')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const saved = useSimulationHistory()
  const tabId = useId()
  const stop = normalizeStop(rawStop)
  const stops = rawStops.map(normalizeStop)
  const active = saved.history.find(value => value.id === saved.activeId)
  useEffect(() => {
    if (active) setSelectedIds(previous => addComparison(previous, active.id, true))
  }, [active?.id])
  useEffect(() => {
    if (!saved.loading) setSelectedIds(previous => previous.filter(id => saved.history.some(value => value.id === id)))
  }, [saved.history, saved.loading])
  const incompatibleActive = active ? comparisonProblem(active.batch) : null
  const selected = selectedIds.filter(id => !incompatibleActive || id === active?.id).map(id => saved.history.find(value => value.id === id)).filter(value => value != null).slice(0, 2)
  const station = scope === 'station'
  const stopId = station ? stop.stop_id : undefined
  const columns: Column[] = [{ id: 'today', name: 'Today', batch: todayBaseline,
    metrics: transitMetrics(batchCase(todayBaseline), stopId), comparable: !incompatibleActive },
    ...selected.map(value => ({ id: value.id, name: value.name, batch: value.batch,
      metrics: transitMetrics(batchCase(value.batch), stopId), comparable: true }))]
  const reference = incompatibleActive ? null : columns[0].metrics
  const visibleBatch = active?.batch ?? todayBaseline
  const inputs = visibleBatch.individual_results[0].inputs
  const windowLabel = `${clock(inputs.start_time_s ?? 25200)}–${clock(inputs.end_time_s ?? 32400)}`
  const title = station ? stop.name : '505 Dundas'
  const homes = (column: Column) => (column.batch.individual_results[0].inputs.developments ?? [])
    .filter(dev => !station || dev.accessible_stop_ids.includes(stop.stop_id)).reduce((sum, dev) => sum + dev.net_added_units, 0)
  const controls = <div className="transit-window-controls">
    {onToggleMinimize && <button type="button" onClick={onToggleMinimize} aria-label={isMinimized ? 'Expand stop details' : 'Minimize panel'}>{isMinimized ? '▾' : '−'}</button>}
    <button type="button" onClick={onClose} aria-label="Close stop panel">✕</button>
  </div>
  if (isMinimized) return <div data-testid="stop-panel" className={`liquid-glass transit-inspector-minimized ${className}`}><span>{title}</span>{controls}</div>

  return <aside data-testid="stop-panel" aria-label="Transit statistics" className={`liquid-glass-panel map-glass-panel transit-inspector ${className}`}>
    <header className="transit-inspector-header"><div className="transit-scope-tabs" role="tablist" aria-label="Statistics scope">
      {(['station', 'line'] as const).map(value => <button key={value} type="button" role="tab" id={`${tabId}-${value}`} aria-selected={scope === value} aria-controls={`${tabId}-content`} onClick={() => setScope(value)}>{value === 'station' ? 'Station' : 'Line'}</button>)}
    </div>{controls}</header>
    <div role="tabpanel" id={`${tabId}-content`} aria-labelledby={`${tabId}-${scope}`} className="transit-inspector-content">
      <div className="transit-identity"><span className="transit-eyebrow">{station ? `TTC STOP #${stop.gtfs_stop_id}` : 'MODELED CORRIDOR'}</span><h2 data-testid="stop-name">{title}</h2>
        <div className="transit-stop-summary-row"><div className="transit-stop-summary-text"><p>{station ? `Sequence ${stop.seq + 1} of ${stops.length || '—'} · Westbound` : 'Westbound · Broadview to Yonge / TMU'}</p><p>{windowLabel} · {todayDate}</p></div>
          {station && onViewPlatform && <button type="button" onClick={onViewPlatform} className="transit-platform-button">📍 View stop in 3D</button>}
        </div>
      </div>

      <section className="transit-section" aria-label="Selected comparisons">
        <div className="transit-section-heading"><h3>Compare simulations</h3><SimulationPicker label="Add comparison" history={saved.history} loading={saved.loading} error={saved.error}
          disabled={selected.length >= 2 || !!incompatibleActive} reason={value => selectedIds.includes(value.id) ? 'Already comparing' : comparisonProblem(value.batch)}
          onSelect={value => setSelectedIds(previous => addComparison(previous, value.id))} /></div>
        <div className="transit-selected-runs"><div className="transit-selected-run transit-run-0"><strong>Today</strong><small>Bundled baseline · {todayDate} · {todayBaseline.overall_results.run_count} trials</small><small>{configurationSummary(todayBaseline)}</small></div>
          {selected.map((value, index) => <div key={value.id} className={`transit-selected-run transit-run-${index + 1}`}><div><strong>{value.name}</strong><button type="button" aria-label={`Remove ${value.name} comparison`} onClick={() => setSelectedIds(previous => previous.filter(id => id !== value.id))}>✕</button></div><small>{configurationSummary(value.batch)}</small><small>{configurationName(value.batch)} · {value.batch.overall_results.run_count} trials</small></div>)}
        </div>
        {!selected.length && <p>Add up to two saved simulations to compare their exact settings against Today.</p>}
        {incompatibleActive && <p role="status">Loaded simulation: {active?.name}. {incompatibleActive}; Today values and changes are hidden because they are not comparable.</p>}
      </section>

      <section className="transit-section" aria-label="Existing demand"><h3>Existing demand</h3><p>Existing-housing rider arrivals {station ? 'at this stop' : 'along this corridor'} over each simulation’s modeled window.</p>
        <MetricTable columns={columns} rows={[
          { label: 'Existing rider arrivals', render: value => count(value.metrics.existing) },
          { label: 'Average wait to board', render: value => wait(value.metrics.existingWait ?? (!station ? value.metrics.wait : null)) },
        ]} />
      </section>

      <section className="transit-section" aria-label="Added housing demand"><h3>Housing & configuration effects</h3>
        <MetricTable columns={columns} rows={[
          { label: station ? 'Proposed homes connected here' : 'Proposed homes in configuration', render: value => count(homes(value)) },
          { label: 'New-housing rider arrivals', render: value => count(value.metrics.added) },
          { label: 'Wait change from Today', render: value => value.id === 'today' ? 'Reference' : deltaWait(value.metrics.wait, reference?.wait) },
        ]} />
        <p>Wait changes reflect all settings changed in a configuration, including service—not housing alone.</p>
      </section>

      {station ? <section className="transit-section" aria-label="Service reliability"><h3>Service reliability</h3>
        <MetricTable columns={columns} rows={[
          { label: 'Spacing score / 10', render: value => { const score = spacingScore(value.metrics.cv); return score == null ? '—' : score.toFixed(1) } },
          { label: 'Average gap between cars', render: value => wait(value.metrics.gap) },
        ]} />
        <details className="transit-method"><summary>How the score works</summary><p>Equal gaps score 10; variation of 25% scores 8, 50% scores 5, and 100% scores 2. Custom formula: 10 / (1 + (CV / 0.5)²). CV is the standard deviation divided by the average gap. Higher means more consistent spacing, not more frequent service. This is not a TTC rating.</p></details>
      </section> : <section className="transit-section" aria-label="Corridor operations"><h3>Corridor operations</h3>
        <MetricTable columns={columns} rows={[
          { label: 'Average journey time', render: value => wait(value.metrics.journey) },
          { label: 'Departures at capacity', render: value => percent(value.metrics.fullDepartures) },
          { label: 'Streetcars dispatched', render: value => count(value.metrics.vehicles) },
          { label: 'In progress at cutoff', render: value => count(value.metrics.inProgress) },
        ]} />
      </section>}

      <section className="transit-section" aria-label="Simulation comparison"><h3>Simulation comparison</h3>
        <MetricTable columns={columns} rows={[
          { label: 'Average wait to board', render: value => wait(value.metrics.wait) },
          { label: 'Change from Today', render: value => value.id === 'today' ? 'Reference' : deltaWait(value.metrics.wait, reference?.wait) },
          { label: 'Denied boarding', render: value => percent(value.metrics.denied) },
          { label: 'Change in denied share', render: value => value.id === 'today' ? 'Reference' : value.metrics.denied == null || reference?.denied == null ? '—' : `${value.metrics.denied - reference.denied > 0 ? '+' : ''}${((value.metrics.denied - reference.denied) * 100).toFixed(1)} pp` },
          { label: 'Still waiting at cutoff', render: value => count(value.metrics.waiting) },
        ]} />
        <details className="transit-method"><summary>What these results mean</summary><div className="transit-footnotes">
          <p>Denied boarding counts riders unable to board a full car at least once, among riders who encountered a car.</p>
          <p>Still waiting means the physical queue at simulation end, not a live count or just riders stranded after denial.</p>
          <p>Waits include riders who boarded; unfinished waits are reported separately. Counts and metrics are averages across trials, not pooled passenger percentiles. — means unavailable or no qualifying riders.</p>
          <p>Today is a modeled reference, not observed live ridership. Matching settings can produce different results with different seeds. Baseline seeds: {todayBaseline.overall_results.seeds.join(', ')}.</p>
          {selected.map(value => <p key={value.id}>{value.name}: seeds {value.batch.overall_results.seeds.join(', ')}. {JSON.stringify(value.batch.overall_results.seeds) !== JSON.stringify(todayBaseline.overall_results.seeds) ? 'Seeds differ from Today; variation may also reflect random draws.' : 'Seeds match Today.'}</p>)}
          <p>The current saved-batch API does not provide model/data version identifiers; historical version compatibility cannot yet be verified.</p>
        </div></details>
      </section>
    </div>
  </aside>
}

export default StopPanel
