import type { FC } from 'react'
import type { Development, Stop } from '../lib/types'
import { getDevelopmentPhase } from '../map/MassingLayer'

export interface DevelopmentPanelProps {
  development: Development
  stops: Stop[]
  onClose: () => void
  onSelectStop?: (stop: Stop) => void
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
    lon: -79.3727167030444,
    lat: 43.657776590088,
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
}

export const DevelopmentPanel: FC<DevelopmentPanelProps> = ({
  development,
  stops,
  onClose,
  onSelectStop,
  isMinimized = false,
  onToggleMinimize,
  className = '',
}) => {
  const meta = REVIEWED_METADATA[development.dev_id]
  const phase = getDevelopmentPhase(development)
  const stopMap = new Map<string, Stop>(stops.map((s) => [s.stop_id, s]))

  const lon = meta?.lon ?? development.footprint?.coordinates[0]?.[0]?.[0] ?? -79.365
  const lat = meta?.lat ?? development.footprint?.coordinates[0]?.[0]?.[1] ?? 43.660

  const streetViewUrl = `https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${lat},${lon}`
  const aicUrl = meta?.applicationUrl ?? 'http://app.toronto.ca/AIC/'

  const isUnderReview = development.stage.toLowerCase().includes('review')

  if (isMinimized) {
    return (
      <div
        data-testid="development-panel"
        className={`liquid-glass rounded-full px-4 py-2 shadow-2xl animate-fade-rise flex items-center gap-3 border border-border/40 ${className}`}
      >
        <span
          className={`w-2.5 h-2.5 rounded-full ${
            phase === 1 ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]' : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
          } animate-pulse shrink-0`}
        />
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            {development.address}
          </span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            ({development.units.toLocaleString()}u)
          </span>
        </div>
        <div className="flex items-center gap-1 border-l border-border/40 pl-2 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Expand development details"
              aria-label="Expand development details"
            >
              ▾
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
            title="Close development panel"
            aria-label="Close development panel"
          >
            ✕
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="development-panel"
      className={`liquid-glass-panel rounded-2xl p-6 shadow-2xl animate-fade-rise flex flex-col gap-4 text-foreground w-[360px] max-h-[calc(100vh-12rem)] overflow-y-auto ${className}`}
    >
      {/* Top Meta Bar: Phase & Planning Stage Badges + Close Button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span
            data-testid="phase-badge"
            className={`phase-pill phase-pill-${phase}`}
          >
            Phase {phase} Proposal
          </span>
          <span
            data-testid="stage-badge"
            className={`status-chip ${
              isUnderReview ? 'status-chip-assumed' : 'status-chip-sourced'
            }`}
          >
            {development.stage}
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Minimize Development Panel"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 text-xs font-bold leading-none cursor-pointer"
              title="Minimize panel"
            >
              −
            </button>
          )}
          <button
            type="button"
            data-testid="close-panel-btn"
            onClick={onClose}
            aria-label="Close Development Panel"
            className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 cursor-pointer"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Main Title & Application Info */}
      <div>
        <h2
          data-testid="dev-address"
          className="text-2xl font-normal tracking-tight text-foreground"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          {development.address}
        </h2>
        <div className="text-xs text-muted-foreground mt-0.5 flex flex-col gap-0.5 font-mono">
          <span>Ref: {development.pipeline_ref || 'City Application'}</span>
          <span>Record Date: {development.record_date}</span>
        </div>
      </div>

      {/* Key Metric Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="liquid-glass rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] tracking-wider uppercase text-muted-foreground font-medium">
            PROPOSED HOMES
          </span>
          <div className="mt-1">
            <span
              data-testid="dev-units"
              className="text-2xl font-mono font-semibold text-foreground"
            >
              {development.units.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground ml-1">units</span>
          </div>
        </div>

        <div className="liquid-glass rounded-xl p-3 flex flex-col justify-between">
          <span className="text-[10px] tracking-wider uppercase text-muted-foreground font-medium">
            OCCUPANCY TARGET
          </span>
          <div className="mt-1">
            <span className="text-lg font-mono font-semibold text-amber-300">
              {phase === 1 ? '2027' : '2030'}
            </span>
            <span className="text-xs text-muted-foreground ml-1">
              ({phase === 1 ? 'P1' : 'P2'})
            </span>
          </div>
        </div>
      </div>

      {/* Walking Access to Stops (School of Cities core accessibility contract) */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
          <span>WALKING ACCESS TO STOPS</span>
          <span className="status-chip status-chip-sourced">OSMNX</span>
        </div>

        <div className="flex flex-col gap-1.5" data-testid="access-stops-list">
          {development.access.map((acc) => {
            const stop = stopMap.get(acc.stop_id)
            const walkMin = (acc.walk_m / 80).toFixed(1)

            return (
              <div
                key={acc.stop_id}
                className="liquid-glass rounded-xl p-2.5 flex items-center justify-between gap-2 text-xs hover:border-white/20 transition-all cursor-pointer group"
                onClick={() => stop && onSelectStop && onSelectStop(stop)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    stop && onSelectStop && onSelectStop(stop)
                  }
                }}
              >
                <div className="flex flex-col min-w-0">
                  <span className="font-medium text-foreground truncate group-hover:text-cyan-300 transition-colors">
                    {stop?.name || acc.stop_id}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {stop ? `Stop #${stop.gtfs_stop_id} · Inbound` : acc.stop_id}
                  </span>
                </div>

                <div className="text-right flex-shrink-0">
                  <div className="font-mono font-semibold text-cyan-300">
                    {Math.round(acc.walk_m)}m
                  </div>
                  <div className="text-[10px] text-muted-foreground font-mono">
                    ~{walkMin} min
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Action Links: Street View + Official AIC Record */}
      <div className="flex flex-col gap-2 pt-1 border-t border-border/30">
        {/* Step 4.4 Street View Real Photo verification link */}
        <a
          href={streetViewUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="street-view-link"
          className="liquid-glass rounded-xl px-3.5 py-2.5 text-xs text-foreground hover:scale-[1.02] transition-transform flex items-center justify-between font-medium group"
        >
          <div className="flex items-center gap-2">
            <span className="text-amber-400">📍</span>
            <span>See this spot today (Street View)</span>
          </div>
          <span className="text-muted-foreground group-hover:text-foreground transition-colors text-[10px]">
            ↗
          </span>
        </a>

        {/* City of Toronto AIC official planning record link */}
        <a
          href={aicUrl}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="aic-record-link"
          className="liquid-glass rounded-xl px-3.5 py-2.5 text-xs text-muted-foreground hover:text-foreground hover:scale-[1.02] transition-transform flex items-center justify-between group"
        >
          <div className="flex items-center gap-2 truncate">
            <span>🏛️</span>
            <span className="truncate">City Planning Record (AIC)</span>
          </div>
          <span className="text-muted-foreground group-hover:text-foreground transition-colors text-[10px]">
            ↗
          </span>
        </a>
      </div>

      {/* Review & Provenance Audit Note */}
      {meta?.reviewNote && (
        <div className="text-[11px] text-muted-foreground/80 bg-white/[0.02] rounded-xl p-2.5 border border-white/5">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
            Audit Review Note
          </div>
          <p className="italic font-mono leading-relaxed">
            &ldquo;{meta.reviewNote}&rdquo;
          </p>
        </div>
      )}
    </div>
  )
}
