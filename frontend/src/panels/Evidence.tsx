import { useState, type FC } from 'react'
import type { Comparison, Assumption, SourceRef, Status } from '../lib/types'

export interface EvidenceProps {
  comparison: Comparison
  onClose?: () => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

export const Evidence: FC<EvidenceProps> = ({
  comparison,
  onClose,
  isMinimized = false,
  onToggleMinimize,
  className = '',
}) => {
  const [filterStatus, setFilterStatus] = useState<'all' | Status>('all')
  const [searchQuery, setSearchQuery] = useState('')

  const assumptions: Assumption[] = comparison.assumptions ?? []
  const sources: SourceRef[] = comparison.sources ?? []
  const sourceMap = new Map<string, SourceRef>(sources.map((s) => [s.source_id, s]))

  const filteredAssumptions = assumptions.filter((a) => {
    const matchesStatus = filterStatus === 'all' || a.status === filterStatus
    const matchesSearch =
      a.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.meaning.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const sourcedCount = assumptions.filter((a) => a.status === 'sourced').length
  const assumedCount = assumptions.filter((a) => a.status === 'assumed').length
  const userCount = assumptions.filter((a) => a.status === 'user_selected').length

  if (isMinimized) {
    return (
      <div
        data-testid="evidence-panel"
        className={`liquid-glass rounded-full px-4 py-2 shadow-2xl animate-fade-rise flex items-center gap-3 border border-border/40 ${className}`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#34d399] animate-pulse shrink-0" />
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            Evidence &amp; Traceability
          </span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            ({sources.length} sources)
          </span>
        </div>
        <div className="flex items-center gap-1 border-l border-border/40 pl-2 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Expand Evidence"
              aria-label="Expand Evidence"
            >
              ▾
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Close Evidence"
              aria-label="Close Evidence"
            >
              ✕
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      data-testid="evidence-panel"
      className={`liquid-glass-panel rounded-2xl p-6 shadow-2xl animate-fade-rise flex flex-col gap-4 text-foreground w-[460px] max-h-[calc(100vh-10rem)] overflow-y-auto ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="status-chip status-chip-sourced font-mono text-[10px]">
            LANE D12 EVIDENCE
          </span>
          <span className="status-chip status-chip-user font-mono text-[10px]">
            TRACEABILITY AUDIT
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Minimize Evidence"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 text-xs font-bold leading-none cursor-pointer"
              title="Minimize panel"
            >
              −
            </button>
          )}
          {onClose && (
            <button
              type="button"
              data-testid="close-evidence-btn"
              onClick={onClose}
              aria-label="Close Evidence"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Main Title */}
      <div>
        <h2
          className="text-2xl font-normal tracking-tight text-foreground m-0"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Evidence &amp; Provenance Registry
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          Every number links to the inputs behind it: explicit assumption status, meaning, and live City or TTC open data source links.
        </p>
      </div>

      {/* Provenance Stat Badges */}
      <div className="grid grid-cols-3 gap-2">
        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'sourced' ? 'all' : 'sourced')}
          className={`liquid-glass rounded-xl p-2.5 text-left border transition-all cursor-pointer ${
            filterStatus === 'sourced' ? 'border-emerald-400 bg-emerald-500/10' : 'border-border/40'
          }`}
        >
          <div className="text-[9px] uppercase text-emerald-400 font-mono font-semibold">Sourced</div>
          <div className="text-lg font-mono font-semibold text-foreground mt-0.5">
            {sourcedCount}
          </div>
          <div className="text-[9px] text-muted-foreground">City/TTC Ground Truth</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'assumed' ? 'all' : 'assumed')}
          className={`liquid-glass rounded-xl p-2.5 text-left border transition-all cursor-pointer ${
            filterStatus === 'assumed' ? 'border-purple-400 bg-purple-500/10' : 'border-border/40'
          }`}
        >
          <div className="text-[9px] uppercase text-purple-400 font-mono font-semibold">Assumed</div>
          <div className="text-lg font-mono font-semibold text-foreground mt-0.5">
            {assumedCount}
          </div>
          <div className="text-[9px] text-muted-foreground">Explicit Bounds</div>
        </button>

        <button
          type="button"
          onClick={() => setFilterStatus(filterStatus === 'user_selected' ? 'all' : 'user_selected')}
          className={`liquid-glass rounded-xl p-2.5 text-left border transition-all cursor-pointer ${
            filterStatus === 'user_selected' ? 'border-cyan-400 bg-cyan-500/10' : 'border-border/40'
          }`}
        >
          <div className="text-[9px] uppercase text-cyan-400 font-mono font-semibold">User</div>
          <div className="text-lg font-mono font-semibold text-foreground mt-0.5">
            {userCount}
          </div>
          <div className="text-[9px] text-muted-foreground">Scenario Targets</div>
        </button>
      </div>

      {/* Search Input */}
      <input
        type="search"
        aria-label="Search assumptions"
        placeholder="Filter assumptions by key or meaning..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        className="bg-black/30 border border-border/40 rounded-xl px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400 font-mono"
      />

      {/* Assumptions Cards List */}
      <div className="flex flex-col gap-2.5" data-testid="assumptions-list">
        {filteredAssumptions.map((a) => {
          const linkedSources = a.source_ids.map((id) => sourceMap.get(id)).filter(Boolean) as SourceRef[]

          return (
            <div
              key={a.key}
              data-testid={`assumption-card-${a.key}`}
              className="liquid-glass rounded-xl p-3.5 flex flex-col gap-2 border border-border/40 hover:border-white/20 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-mono font-semibold text-xs text-foreground m-0">
                    {a.key.replaceAll('_', ' ')}
                  </h3>
                  <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                    Central: <span className="text-cyan-300 font-semibold">{a.central} {a.unit}</span> · Bounds: {a.low}–{a.high} {a.unit}
                  </div>
                </div>

                <span
                  className={`status-chip text-[9px] uppercase font-mono px-2 py-0.5 ${
                    a.status === 'sourced'
                      ? 'status-chip-sourced'
                      : a.status === 'assumed'
                      ? 'status-chip-assumed'
                      : 'status-chip-user'
                  }`}
                >
                  {a.status}
                </span>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed m-0 font-mono">
                {a.meaning}
              </p>

              {linkedSources.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1.5 border-t border-border/30">
                  {linkedSources.map((s) => (
                    <a
                      key={s.source_id}
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[10px] text-cyan-300 hover:underline font-mono"
                    >
                      {s.title} ↗
                    </a>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Primary Sources Ground Truth Section (Required by D12) */}
      <div className="flex flex-col gap-2 pt-2 border-t border-border/30">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          <span>PRIMARY DATA SOURCES ({sources.length})</span>
          <span className="status-chip status-chip-sourced">GROUND TRUTH</span>
        </div>

        <div className="flex flex-col gap-1.5" data-testid="sources-list">
          {sources.map((s) => (
            <a
              key={s.source_id}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`source-link-${s.source_id}`}
              className="liquid-glass rounded-xl px-3 py-2 flex items-center justify-between text-xs text-foreground hover:scale-[1.01] transition-transform group border border-border/40 hover:border-white/30"
            >
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-amber-400">🏛️</span>
                <div className="flex flex-col min-w-0">
                  <span className="font-medium truncate group-hover:text-cyan-300 transition-colors">
                    {s.title}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono truncate">
                    {s.publisher} · Ver: {s.version}
                  </span>
                </div>
              </div>
              <span className="text-muted-foreground group-hover:text-foreground transition-colors text-xs ml-2 shrink-0">
                ↗
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  )
}
export default Evidence
