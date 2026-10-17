import { useState, useEffect, type FC } from 'react'
import type { Comparison, CaseResult, DemandCase } from '../lib/types'

export interface CaseCompareProps {
  comparison: Comparison
  selectedDemandCase?: DemandCase
  onDemandCaseChange?: (demandCase: DemandCase) => void
  onClose?: () => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

function formatWait(seconds: number | null | undefined): string {
  if (seconds == null) return '—'
  if (seconds < 60) return `${Math.round(seconds)}s`
  return `${(seconds / 60).toFixed(1)}m`
}

function formatPercent(share: number | null | undefined): string {
  if (share == null) return '0%'
  return `${Math.round(share * 100)}%`
}

function formatCurrency(amount: number): string {
  if (amount === 0) return '$0'
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(1)}M`
  if (amount >= 1_000) return `$${Math.round(amount / 1_000)}k`
  return `$${amount}`
}

export const CaseCompare: FC<CaseCompareProps> = ({
  comparison,
  selectedDemandCase,
  onDemandCaseChange,
  onClose,
  isMinimized = false,
  onToggleMinimize,
  className = '',
}) => {
  const [demandCase, setDemandCase] = useState<DemandCase>(
    selectedDemandCase ?? comparison.scenario?.demand_case ?? 'central'
  )
  const [showRiderSplit, setShowRiderSplit] = useState<boolean>(true)

  useEffect(() => {
    if (selectedDemandCase) {
      setDemandCase(selectedDemandCase)
    } else if (comparison.scenario?.demand_case) {
      setDemandCase(comparison.scenario.demand_case)
    }
  }, [selectedDemandCase, comparison.scenario?.demand_case])

  const handleDemandCaseChange = (dc: DemandCase) => {
    setDemandCase(dc)
    if (onDemandCaseChange) onDemandCaseChange(dc)
  }

  // Filter cases for the chosen demand case
  const casesForDemand = comparison.cases.filter((c) => c.demand_case === demandCase)
  const currentCase = casesForDemand.find((c) => c.kind === 'current') ?? comparison.cases.find((c) => c.kind === 'current')
  const growthCase = casesForDemand.find((c) => c.kind === 'growth') ?? comparison.cases.find((c) => c.kind === 'growth')
  const supportedCase = casesForDemand.find((c) => c.kind === 'supported_growth') ?? comparison.cases.find((c) => c.kind === 'supported_growth')

  // Cost and vehicle package lookup
  const getPackageCosts = (packageId?: string) => {
    if (!packageId || packageId === 'baseline') {
      return { capital: 0, operating: 0, vehicles: 0, label: 'Baseline (Zero New Cost)' }
    }
    const pkg = comparison.packages.find((p) => p.package_id === packageId)
    const interventions = comparison.scenario.interventions.filter((i) =>
      pkg?.intervention_ids.includes(i.id)
    )
    const capital = interventions.reduce((sum, i) => sum + i.capital_cost.central, 0)
    const operating = interventions.reduce((sum, i) => sum + i.operating_cost.central, 0)
    const vehicles = interventions.reduce((sum, i) => sum + i.extra_vehicles, 0)
    return {
      capital,
      operating,
      vehicles,
      label: pkg?.label ?? packageId,
    }
  }

  // Helper to extract existing vs new breakdown for a case
  const getCohortMetrics = (c?: CaseResult) => {
    if (!c?.stops) return null
    const existingStops = c.stops.filter((s) => s.rider_group === 'existing')
    const newStops = c.stops.filter((s) => s.rider_group === 'new')

    const existingWait = existingStops.find((s) => s.mean_wait_s != null)?.mean_wait_s ?? null
    const newWait = newStops.find((s) => s.mean_wait_s != null)?.mean_wait_s ?? null

    const existingDenied = Math.max(0, ...existingStops.map((s) => s.denied_at_least_once_share ?? 0))
    const newDenied = Math.max(0, ...newStops.map((s) => s.denied_at_least_once_share ?? 0))

    const existingQueue = existingStops.reduce((sum, s) => sum + s.remaining_queue, 0)
    const newQueue = newStops.reduce((sum, s) => sum + s.remaining_queue, 0)

    return {
      existing: { wait: existingWait, denied: existingDenied, queue: existingQueue },
      newRiders: { wait: newWait, denied: newDenied, queue: newQueue },
    }
  }

  const columns = [
    {
      title: 'Current (Baseline)',
      subtitle: 'Existing Commuters Only',
      badgeColor: 'border-slate-500/50 bg-slate-500/10 text-slate-300',
      caseResult: currentCase,
      pkg: getPackageCosts(currentCase?.package_id),
      isBottleneck: false,
    },
    {
      title: 'Growth (Unmitigated)',
      subtitle: 'Phase 1+2 Added Demand',
      badgeColor: 'border-rose-500/50 bg-rose-500/10 text-rose-300',
      caseResult: growthCase,
      pkg: getPackageCosts(growthCase?.package_id),
      isBottleneck: (growthCase?.unresolved_passengers ?? 0) > 0,
    },
    {
      title: 'Supported Growth',
      subtitle: 'With Mitigations & Extra Service',
      badgeColor: 'border-emerald-500/50 bg-emerald-500/10 text-emerald-300',
      caseResult: supportedCase,
      pkg: getPackageCosts(supportedCase?.package_id),
      isBottleneck: false,
    },
  ]

  if (isMinimized) {
    return (
      <div
        data-testid="case-compare"
        className={`liquid-glass rounded-full px-4 py-2 shadow-2xl animate-fade-rise flex items-center gap-3 border border-border/40 ${className}`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse shrink-0" />
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            Case Comparison: Current vs Growth vs Supported
          </span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            ({demandCase})
          </span>
        </div>
        <div className="flex items-center gap-1 border-l border-border/40 pl-2 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Expand Case Comparison"
              aria-label="Expand Case Comparison"
            >
              ▾
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Close Case Comparison"
              aria-label="Close Case Comparison"
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
      data-testid="case-compare"
      className={`liquid-glass-panel rounded-2xl p-6 shadow-2xl animate-fade-rise flex flex-col gap-4 text-foreground w-[460px] max-h-[calc(100vh-10rem)] overflow-y-auto ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="status-chip status-chip-sourced font-mono text-[10px]">
            LANE D9 COMPARISON
          </span>
          <span className="status-chip status-chip-user font-mono text-[10px]">
            3 CASES
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Minimize Case Compare"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 text-xs font-bold leading-none cursor-pointer"
              title="Minimize panel"
            >
              −
            </button>
          )}
          {onClose && (
            <button
              type="button"
              data-testid="close-case-compare-btn"
              onClick={onClose}
              aria-label="Close Case Compare"
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
          Case Comparison: Current vs Growth vs Supported
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          Side-by-side performance evaluation: wait times, denied boardings, remaining queues, existing vs new rider split, and capital &amp; operating costs.
        </p>
      </div>

      {/* Demand Case Selector & Rider Split Toggle */}
      <div className="flex items-center justify-between gap-2 bg-white/5 p-2 rounded-xl border border-white/10 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-[10px] uppercase font-mono text-muted-foreground mr-1">Demand:</span>
          {(['low', 'central', 'high'] as DemandCase[]).map((dc) => (
            <button
              key={dc}
              type="button"
              data-testid={`case-demand-${dc}`}
              onClick={() => handleDemandCaseChange(dc)}
              className={`px-2 py-0.5 rounded font-mono text-xs transition-colors capitalize ${
                demandCase === dc
                  ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/40'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {dc}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => setShowRiderSplit((prev) => !prev)}
          className="text-[10px] text-cyan-300 hover:underline font-mono cursor-pointer"
        >
          {showRiderSplit ? 'Hide Rider Split' : 'Show Rider Split'}
        </button>
      </div>

      {/* 3-Column Comparative Cards */}
      <div className="grid grid-cols-3 gap-2" data-testid="comparison-columns">
        {columns.map((col, idx) => {
          const res = col.caseResult
          const meanWait = res?.per_run_mean_wait_s?.[0]
          const p95Wait = res?.per_run_p95_wait_s?.[0]
          const denied = res?.per_run_denied_share?.[0]
          const unresolved = res?.unresolved_passengers ?? 0
          const cohorts = getCohortMetrics(res)

          return (
            <div
              key={idx}
              data-testid={`compare-card-${idx}`}
              className={`liquid-glass rounded-xl p-3 flex flex-col justify-between gap-3 border ${
                col.isBottleneck
                  ? 'border-rose-500/50 bg-rose-500/[0.04]'
                  : 'border-border/40'
              }`}
            >
              {/* Column Header */}
              <div>
                <span className={`status-chip font-mono text-[8px] uppercase ${col.badgeColor}`}>
                  {col.title}
                </span>
                <div className="text-[10px] text-muted-foreground font-mono mt-1 leading-tight">
                  {col.subtitle}
                </div>
              </div>

              {/* Core Wait Time & Denial Metrics */}
              <div className="flex flex-col gap-1.5 pt-2 border-t border-border/30">
                <div>
                  <div className="text-[9px] uppercase text-muted-foreground font-mono">Mean Wait</div>
                  <div className={`text-base font-mono font-semibold ${col.isBottleneck ? 'text-rose-400' : 'text-foreground'}`}>
                    {formatWait(meanWait)}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase text-muted-foreground font-mono">P95 Wait</div>
                  <div className="text-xs font-mono font-semibold text-foreground">
                    {formatWait(p95Wait)}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase text-muted-foreground font-mono">Denied Boardings</div>
                  <div className={`text-xs font-mono font-semibold ${col.isBottleneck ? 'text-rose-400' : 'text-foreground'}`}>
                    {formatPercent(denied)}
                  </div>
                </div>

                <div>
                  <div className="text-[9px] uppercase text-muted-foreground font-mono">Remaining Queue</div>
                  <div className={`text-xs font-mono font-semibold ${unresolved > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {unresolved} riders
                  </div>
                </div>
              </div>

              {/* Split by Existing vs New Riders (Required by D9) */}
              {showRiderSplit && cohorts && (
                <div className="flex flex-col gap-1 pt-2 border-t border-border/30 text-[10px] font-mono bg-white/[0.02] p-1.5 rounded-lg">
                  <div className="text-[9px] uppercase text-muted-foreground font-semibold">
                    Cohort Breakdown
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Existing:</span>
                    <span>{formatWait(cohorts.existing.wait)} ({formatPercent(cohorts.existing.denied)})</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>New Riders:</span>
                    <span className={cohorts.newRiders.queue > 0 ? 'text-rose-300 font-semibold' : ''}>
                      {formatWait(cohorts.newRiders.wait)} ({formatPercent(cohorts.newRiders.denied)})
                    </span>
                  </div>
                </div>
              )}

              {/* Resource & Cost Metrics Beside / Below (Required by D9) */}
              <div className="flex flex-col gap-1 pt-2 border-t border-border/30 text-[10px] font-mono">
                <div className="flex justify-between text-muted-foreground">
                  <span>Cap Cost:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(col.pkg.capital)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Op Cost:</span>
                  <span className="font-semibold text-foreground">{formatCurrency(col.pkg.operating)}/yr</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Extra Veh:</span>
                  <span className="font-semibold text-cyan-300">+{col.pkg.vehicles} cars</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
export default CaseCompare
