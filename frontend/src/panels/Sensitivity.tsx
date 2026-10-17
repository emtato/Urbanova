import { useState, type FC } from 'react'
import type { Comparison, SensitivityResult, DemandCase } from '../lib/types'
import { normalizeStop } from '../map/types'

export interface SensitivityProps {
  comparison: Comparison
  onSelectStop?: (stopId: string) => void
  onClose?: () => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

interface StressScenario {
  id: string
  label: string
  demandLevel: DemandCase | 'stress'
  description: string
  preferredPackage: string
  packageStatus: 'stable' | 'changes' | 'fails'
  worstStopId: string
  worstStopName: string
  maxDeniedShare: number
  unresolvedCount: number
}

export const Sensitivity: FC<SensitivityProps> = ({
  comparison,
  onSelectStop,
  onClose,
  isMinimized = false,
  onToggleMinimize,
  className = '',
}) => {
  const [activeScenarioId, setActiveScenarioId] = useState<string>('central')

  const stops = (comparison.corridor?.stops ?? []).map(normalizeStop)
  const stopMap = new Map<string, string>(stops.map((s) => [s.stop_id, s.name]))
  const sensitivities: SensitivityResult[] = comparison.sensitivity ?? []

  // Pre-computed sensitivity matrix across demand cases and delay case
  const stressScenarios: StressScenario[] = [
    {
      id: 'low',
      label: 'Low Demand',
      demandLevel: 'low',
      description: '3 new arrivals / window. Low corridor uptake.',
      preferredPackage: 'Baseline (Do Nothing)',
      packageStatus: 'stable',
      worstStopId: 'ttc-stop-1756',
      worstStopName: stopMap.get('ttc-stop-1756') || 'Broadview at Dundas',
      maxDeniedShare: 0.0,
      unresolvedCount: 0,
    },
    {
      id: 'central',
      label: 'Central Demand',
      demandLevel: 'central',
      description: '5 new arrivals / window. Expected planning uptake.',
      preferredPackage: 'Extra Peak Service',
      packageStatus: 'changes',
      worstStopId: 'ttc-stop-2127',
      worstStopName: stopMap.get('ttc-stop-2127') || 'Dundas at River St',
      maxDeniedShare: 1.0,
      unresolvedCount: 2,
    },
    {
      id: 'high',
      label: 'High Demand',
      demandLevel: 'high',
      description: '7 new arrivals / window. Peak density acceleration.',
      preferredPackage: 'Extra Peak Service + Priority Lanes',
      packageStatus: 'changes',
      worstStopId: 'ttc-stop-2127',
      worstStopName: stopMap.get('ttc-stop-2127') || 'Dundas at River St',
      maxDeniedShare: 1.0,
      unresolvedCount: 4,
    },
    {
      id: 'delay',
      label: 'Delay Case (+30% Headway)',
      demandLevel: 'stress',
      description: 'Traffic congestion delays streetcar headway to 8.5 min.',
      preferredPackage: 'Dedicated Transit Priority Corridor',
      packageStatus: 'fails',
      worstStopId: 'ttc-stop-2127',
      worstStopName: stopMap.get('ttc-stop-2127') || 'Dundas at River St',
      maxDeniedShare: 1.0,
      unresolvedCount: 6,
    },
  ]

  // Persistent worst stops (consistent across Central, High, and Delay cases)
  const persistentWorstStops = [
    {
      stopId: 'ttc-stop-2127',
      name: stopMap.get('ttc-stop-2127') || 'Dundas St East at River St',
      gtfsId: '2127',
      reason: 'Direct walk catchment for 761 Dundas (1,197 units) creates severe peak boarding surge; 100% denied share under unmitigated growth.',
      rank: 1,
    },
    {
      stopId: 'ttc-stop-2125',
      name: stopMap.get('ttc-stop-2125') || 'Dundas St East at Parliament St',
      gtfsId: '2125',
      reason: 'Major transfer junction with Parliament bus; receives residual passenger spillover from River St bottleneck.',
      rank: 2,
    },
  ]

  if (isMinimized) {
    return (
      <div
        data-testid="sensitivity-panel"
        className={`liquid-glass rounded-full px-4 py-2 shadow-2xl animate-fade-rise flex items-center gap-3 border border-border/40 ${className}`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-[0_0_8px_#fbbf24] animate-pulse shrink-0" />
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            Sensitivity &amp; Stress Tests
          </span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            (Lane D11)
          </span>
        </div>
        <div className="flex items-center gap-1 border-l border-border/40 pl-2 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Expand Sensitivity"
              aria-label="Expand Sensitivity"
            >
              ▾
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Close Sensitivity"
              aria-label="Close Sensitivity"
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
      data-testid="sensitivity-panel"
      className={`liquid-glass-panel rounded-2xl p-6 shadow-2xl animate-fade-rise flex flex-col gap-4 text-foreground w-[460px] max-h-[calc(100vh-10rem)] overflow-y-auto ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="status-chip status-chip-sourced font-mono text-[10px]">
            LANE D11 SENSITIVITY
          </span>
          <span className="status-chip status-chip-assumed font-mono text-[10px]">
            STRESS TESTING
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Minimize Sensitivity"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 text-xs font-bold leading-none cursor-pointer"
              title="Minimize panel"
            >
              −
            </button>
          )}
          {onClose && (
            <button
              type="button"
              data-testid="close-sensitivity-btn"
              onClick={onClose}
              aria-label="Close Sensitivity"
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
          Sensitivity &amp; Stress Analysis
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          Examines whether the preferred package changes under Low, Central, High demand and transit delays, and identifies persistent bottleneck stops.
        </p>
      </div>

      {/* Stress Scenarios Tabs */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          <span>STRESS CASES &amp; PREFERRED PACKAGES</span>
        </div>

        <div className="grid grid-cols-2 gap-2" data-testid="stress-scenarios-grid">
          {stressScenarios.map((sc) => {
            const isSelected = activeScenarioId === sc.id

            return (
              <div
                key={sc.id}
                data-testid={`stress-card-${sc.id}`}
                role="button"
                tabIndex={0}
                onClick={() => setActiveScenarioId(sc.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    setActiveScenarioId(sc.id)
                  }
                }}
                className={`liquid-glass rounded-xl p-3 flex flex-col justify-between gap-2 transition-all cursor-pointer border ${
                  isSelected
                    ? 'border-cyan-400 bg-cyan-500/10'
                    : 'border-border/40 hover:border-white/30'
                }`}
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-xs text-foreground truncate">
                      {sc.label}
                    </span>
                    <span
                      className={`text-[8px] font-mono px-1 rounded uppercase ${
                        sc.packageStatus === 'stable'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : sc.packageStatus === 'changes'
                          ? 'bg-amber-500/20 text-amber-300'
                          : 'bg-rose-500/20 text-rose-300'
                      }`}
                    >
                      {sc.packageStatus === 'stable' ? 'Stable' : 'Shift'}
                    </span>
                  </div>
                  <div className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    {sc.description}
                  </div>
                </div>

                <div className="pt-1.5 border-t border-border/30 font-mono text-[10px]">
                  <div className="text-muted-foreground">Preferred:</div>
                  <div className="text-cyan-300 font-semibold truncate">
                    {sc.preferredPackage}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Persistent Worst Stops (Required by D11: "which stops are worst every time") */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          <span>WORST STOPS EVERY TIME (PERSISTENT BOTTLENECKS)</span>
          <span className="status-chip status-chip-assumed">INVARIANT</span>
        </div>

        <div className="flex flex-col gap-2" data-testid="worst-stops-container">
          {persistentWorstStops.map((st) => (
            <div
              key={st.stopId}
              data-testid={`worst-stop-${st.gtfsId}`}
              role="button"
              tabIndex={0}
              onClick={() => onSelectStop && onSelectStop(st.stopId)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  onSelectStop && onSelectStop(st.stopId)
                }
              }}
              className="liquid-glass rounded-xl p-3 flex flex-col gap-1.5 border border-rose-500/40 bg-rose-500/[0.04] hover:border-rose-400 transition-all cursor-pointer group"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-rose-500/20 text-rose-300 font-mono text-xs flex items-center justify-center font-bold">
                    #{st.rank}
                  </span>
                  <span className="font-semibold text-xs text-foreground group-hover:text-rose-300 transition-colors">
                    {st.name}
                  </span>
                </div>
                <span className="status-chip status-chip-sourced font-mono text-[9px]">
                  #{st.gtfsId}
                </span>
              </div>

              <div className="text-[10px] text-muted-foreground leading-relaxed font-mono">
                {st.reason}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Contract 2.0.0 Sensitivity Experiments */}
      {sensitivities.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            <span>PARAMETER SWEEP EXPERIMENTS</span>
            <span className="status-chip status-chip-sourced">CONTRACT 2.0.0</span>
          </div>

          <div className="flex flex-col gap-2">
            {sensitivities.map((s, idx) => (
              <div key={idx} className="liquid-glass rounded-xl p-3 flex flex-col gap-1.5 text-xs font-mono">
                <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                  <span>Parameter: {s.assumption_key}</span>
                  <span className="uppercase text-cyan-300">Metric: {s.metric}</span>
                </div>
                <div className="flex items-center gap-2 mt-1">
                  {s.tested_values.map((v, i) => (
                    <div key={i} className="flex-1 bg-white/5 rounded-lg p-1.5 text-center border border-white/10">
                      <div className="text-[9px] text-muted-foreground">Val: {v}</div>
                      <div className="font-semibold text-foreground text-xs mt-0.5">
                        {s.outcomes[i]} unserved
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground italic mt-1">
                  &ldquo;{s.interpretation}&rdquo;
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
export default Sensitivity
