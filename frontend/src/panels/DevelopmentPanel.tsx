import type { FC } from 'react'
import {
  type CorridorDevelopment,
  type CorridorStop,
  normalizeDevelopment,
  normalizeStop,
  toShortAddress,
} from '../map/types'
import { getDevelopmentPhase } from '../map/MassingLayer'
import './StopPanel.css'

export interface DevelopmentPanelProps {
  development: CorridorDevelopment | any
  stops: Array<CorridorStop | any>
  onClose: () => void
  onViewBuilding?: () => void
  onSelectStop?: (stop: any) => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

interface SourcedDevelopmentMeta {
  applicationUrl: string
  lon: number
  lat: number
  reviewNote: string
  pipelineRowId: number
  applicationReceived: string
  datasetUpdatedAt: string
}

/**
 * Reviewed development metadata from City of Toronto Development Pipeline
 * (data/reviewed/developments.csv).
 */
export const REVIEWED_METADATA: Record<string, SourcedDevelopmentMeta> = {
  'toronto-app-22-124214-ste-13-oz': {
    applicationUrl: 'http://app.toronto.ca/AIC/index.do?folderRsn=pIdDarxWXh5kap0IoXhw0Q%3D%3D',
    lon: -79.372685,
    lat: 43.658009,
    reviewNote: 'West end; numeric units agree with the current description.',
    pipelineRowId: 927,
    applicationReceived: '2022-03-18',
    datasetUpdatedAt: '2026-10-08',
  },
  'fixture-development-1': {
    applicationUrl: 'http://app.toronto.ca/AIC/index.do?folderRsn=pIdDarxWXh5kap0IoXhw0Q%3D%3D',
    lon: -79.372685,
    lat: 43.658009,
    reviewNote: 'West end; numeric units agree with the current description.',
    pipelineRowId: 927,
    applicationReceived: '2022-03-18',
    datasetUpdatedAt: '2026-10-08',
  },
  'toronto-app-26-122451-ste-13-oz': {
    applicationUrl: 'http://app.toronto.ca/AIC/index.do?folderRsn=9OeVhFuD5G0FTMkwBab0Ig%3D%3D',
    lon: -79.3642039444762,
    lat: 43.6600907352172,
    reviewNote: 'Middle of corridor; recent under-review residential proposal.',
    pipelineRowId: 2375,
    applicationReceived: '2026-02-27',
    datasetUpdatedAt: '2026-10-08',
  },
  'toronto-app-25-236949-ste-13-oz': {
    applicationUrl: 'http://app.toronto.ca/AIC/index.do?folderRsn=pQXQdd9xsAyXtIdMbT%2BI5Q%3D%3D',
    lon: -79.356394637334,
    lat: 43.6612907741496,
    reviewNote: 'East end; numeric units agree with the current description.',
    pipelineRowId: 1844,
    applicationReceived: '2025-10-08',
    datasetUpdatedAt: '2026-10-08',
  },

  'fixture-development-2': {
    applicationUrl: 'http://app.toronto.ca/AIC/index.do?folderRsn=9OeVhFuD5G0FTMkwBab0Ig%3D%3D',
    lon: -79.3642039444762,
    lat: 43.6600907352172,
    reviewNote: 'Middle of corridor; recent under-review residential proposal.',
    pipelineRowId: 2375,
    applicationReceived: '2026-02-27',
    datasetUpdatedAt: '2026-10-08',
  },
  'fixture-development-3': {
    applicationUrl: 'http://app.toronto.ca/AIC/index.do?folderRsn=pQXQdd9xsAyXtIdMbT%2BI5Q%3D%3D',
    lon: -79.356394637334,
    lat: 43.6612907741496,
    reviewNote: 'East end; numeric units agree with the current description.',
    pipelineRowId: 1844,
    applicationReceived: '2025-10-08',
    datasetUpdatedAt: '2026-10-08',
  },
}

export const DevelopmentPanel: FC<DevelopmentPanelProps> = ({
  development: rawDev, stops: rawStops, onClose, onSelectStop, onViewBuilding,
  isMinimized = false, onToggleMinimize, className = '',
}) => {
  const development = normalizeDevelopment(rawDev)
  const stops = rawStops.map(normalizeStop)
  const meta = REVIEWED_METADATA[development.dev_id]
  const phase = getDevelopmentPhase(development)
  const stopMap = new Map(stops.map(stop => [stop.stop_id, stop]))
  const title = development.name || toShortAddress(development.address)
  const controls = <div className="transit-window-controls">
    {onToggleMinimize && <button type="button" onClick={onToggleMinimize} aria-label={isMinimized ? 'Expand development details' : 'Minimize development panel'}>{isMinimized ? '▾' : '−'}</button>}
    <button type="button" onClick={onClose} aria-label="Close development panel">✕</button>
  </div>
  if (isMinimized) return <div data-testid="development-panel" className={`liquid-glass transit-inspector-minimized ${className}`}><span>{title}</span>{controls}</div>

  return <aside data-testid="development-panel" aria-label="Building details" className={`liquid-glass-panel map-glass-panel transit-inspector ${className}`}>
    <header className="transit-inspector-header"><span className="transit-eyebrow" data-testid="phase-badge">Phase {phase} Proposal</span>{controls}</header>
    <div className="transit-inspector-content">
      <div className="transit-identity"><span className="transit-eyebrow">PROPOSED HOUSING</span><h2 data-testid="dev-address">{title}</h2>
        <div className="transit-stop-summary-row"><div className="transit-stop-summary-text"><p>{development.address}</p><p data-testid="stage-badge">{development.stage || 'Planning status unavailable'}</p></div>
          {onViewBuilding && <button type="button" className="transit-platform-button" onClick={onViewBuilding}>📍 View building in 3D</button>}
        </div>
      </div>

      <section className="transit-section" aria-label="Proposal overview"><h3>Proposal overview</h3><div className="building-stat-grid">
        <div className="transit-metric inspector-stat-card"><span>Homes in model</span><strong data-testid="dev-units">{development.units.toLocaleString()}</strong><small>Housing configuration</small></div>
        <div className="transit-metric inspector-stat-card"><span>Planning status</span><strong style={{ fontFamily: 'inherit', fontSize: 16 }}>{development.stage || '—'}</strong><small>Completion date not confirmed</small></div>
      </div><p>Building massing is illustrative. Showing a proposal on the map does not change a saved simulation’s settings.</p></section>

      <section className="transit-section" aria-label="Walking access"><h3>Walking access to stops</h3><div data-testid="access-stops-list" className="transit-development-list">
        {(development.access ?? []).map(access => {
          const stop = stopMap.get(access.stop_id)
          return <button key={access.stop_id} type="button" className="inspector-stat-card building-stop-button" disabled={!stop || !onSelectStop} onClick={() => stop && onSelectStop?.(stop)}>
            <span>{stop?.name || access.stop_id}<small>{stop ? `Stop #${stop.gtfs_stop_id} · Westbound` : 'Stop details unavailable'}</small></span>
            <strong>{Math.round(access.walk_m)}m<small>~{(access.walk_m / 80).toFixed(1)} min</small></strong>
          </button>
        })}
        {!development.access?.length && <p>Walking connections are not available for this proposal.</p>}
      </div><p>Walking distances and times are estimates; route review may be pending.</p></section>

      <section className="transit-section" aria-label="Planning record"><h3>Planning record</h3>
        <a href={meta?.applicationUrl ?? 'http://app.toronto.ca/AIC/'} target="_blank" rel="noopener noreferrer" data-testid="aic-record-link" className="building-record-link"><span>City planning application</span><span aria-hidden="true">↗</span></a>
        <details className="transit-method"><summary>Application details &amp; sources</summary><dl className="building-record-list">
          <div><dt>Application reference</dt><dd>{development.pipeline_ref || 'Not available'}</dd></div>
          <div><dt>Application received</dt><dd>{meta?.applicationReceived || 'Not available'}</dd></div>
          <div><dt>Record updated</dt><dd>{development.record_date || meta?.datasetUpdatedAt || 'Not available'}</dd></div>
          {meta?.reviewNote && <div><dt>Review note</dt><dd>{meta.reviewNote}</dd></div>}
        </dl></details>
      </section>
    </div>
  </aside>
}

export default DevelopmentPanel
