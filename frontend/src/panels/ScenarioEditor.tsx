import { useState, useEffect, type FC } from 'react'
import type { Scenario, Assumption, DemandCase } from '../lib/types'

export interface ScenarioEditorProps {
  scenario: Scenario
  assumptions?: Assumption[]
  onScenarioChange?: (updated: Scenario) => void
  onClose?: () => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

export const ScenarioEditor: FC<ScenarioEditorProps> = ({
  scenario: initialScenario,
  assumptions = [],
  onScenarioChange,
  onClose,
  isMinimized = false,
  onToggleMinimize,
  className = '',
}) => {
  const [scenario, setScenario] = useState<Scenario>(initialScenario)

  useEffect(() => {
    setScenario(initialScenario)
  }, [initialScenario])

  const [selectedPhaseId, setSelectedPhaseId] = useState<string>(
    scenario.phases[0]?.phase_id ?? 'phase-1'
  )
  const [activeTab, setActiveTab] = useState<'timeline' | 'demand' | 'budgets' | 'criteria'>('timeline')

  const updateScenario = (updater: (prev: Scenario) => Scenario) => {
    setScenario((prev) => {
      const next = updater(prev)
      if (onScenarioChange) onScenarioChange(next)
      return next
    })
  }

  const currentPhase = scenario.phases.find((p) => p.phase_id === selectedPhaseId) ?? scenario.phases[0]

  if (isMinimized) {
    return (
      <div
        data-testid="scenario-editor"
        className={`liquid-glass rounded-full px-4 py-2 shadow-2xl animate-fade-rise flex items-center gap-3 border border-border/40 ${className}`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-[0_0_8px_#c084fc] animate-pulse shrink-0" />
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            Scenario Parameters
          </span>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            ({scenario.demand_case} · P{currentPhase ? currentPhase.year : '2030'})
          </span>
        </div>
        <div className="flex items-center gap-1 border-l border-border/40 pl-2 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Expand Scenario Editor"
              aria-label="Expand Scenario Editor"
            >
              ▾
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Close Scenario Editor"
              aria-label="Close Scenario Editor"
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
      data-testid="scenario-editor"
      className={`liquid-glass-panel rounded-2xl p-6 shadow-2xl animate-fade-rise flex flex-col gap-4 text-foreground w-[400px] max-h-[calc(100vh-10rem)] overflow-y-auto ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="status-chip status-chip-user font-mono text-[10px]">
            SCENARIO EXPERIMENT v{scenario.version}
          </span>
          <span className="status-chip status-chip-assumed font-mono text-[10px]">
            {scenario.demand_case.toUpperCase()} DEMAND
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Minimize Scenario Editor"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 text-xs font-bold leading-none cursor-pointer"
              title="Minimize panel"
            >
              −
            </button>
          )}
          {onClose && (
            <button
              type="button"
              data-testid="close-scenario-editor-btn"
              onClick={onClose}
              aria-label="Close Scenario Editor"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 cursor-pointer"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Title */}
      <div>
        <h2
          className="text-2xl font-normal tracking-tight text-foreground m-0"
          style={{ fontFamily: "'Instrument Serif', serif" }}
        >
          Corridor Scenario Controls
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          Adjust planning horizons, occupied shares, budgets and criteria. Every control exposes status, bounds, and units.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-white/5 p-1 rounded-xl border border-white/10">
        <button
          type="button"
          data-testid="tab-timeline"
          onClick={() => setActiveTab('timeline')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all text-center ${
            activeTab === 'timeline'
              ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Timeline
        </button>
        <button
          type="button"
          data-testid="tab-demand"
          onClick={() => setActiveTab('demand')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all text-center ${
            activeTab === 'demand'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Demand
        </button>
        <button
          type="button"
          data-testid="tab-budgets"
          onClick={() => setActiveTab('budgets')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all text-center ${
            activeTab === 'budgets'
              ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Budgets
        </button>
        <button
          type="button"
          data-testid="tab-criteria"
          onClick={() => setActiveTab('criteria')}
          className={`flex-1 py-1.5 rounded-lg text-xs font-medium transition-all text-center ${
            activeTab === 'criteria'
              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Criteria
        </button>
      </div>

      {/* TAB 1: PLANNING-PHASE TIMELINE & SEPARATE SIMULATION CLOCK */}
      {activeTab === 'timeline' && (
        <div className="flex flex-col gap-3" data-testid="section-timeline">
          {/* Distinct Simulation Clock Control (Separated from Planning Horizon) */}
          <div className="liquid-glass rounded-xl p-3 flex flex-col gap-1.5 border border-white/10">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                SIMULATION CLOCK (OPERATING HORIZON)
              </span>
              <span className="status-chip status-chip-sourced">GTFS PEAK</span>
            </div>
            <div className="flex items-baseline justify-between mt-1">
              <span className="text-lg font-mono font-semibold text-cyan-300">
                07:00 – 09:00 AM
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                7,200s window (America/Toronto)
              </span>
            </div>
            <div className="text-[10px] text-muted-foreground leading-relaxed italic">
              Simulation clock runs deterministically during peak corridor commuting hours.
            </div>
          </div>

          {/* Planning Horizon / Phase Selector */}
          <div className="liquid-glass rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                PLANNING-PHASE TIMELINE
              </span>
              <span className="status-chip status-chip-user">HORIZON</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              {scenario.phases.map((p) => {
                const isSelected = p.phase_id === selectedPhaseId
                return (
                  <button
                    key={p.phase_id}
                    type="button"
                    data-testid={`phase-btn-${p.phase_id}`}
                    onClick={() => setSelectedPhaseId(p.phase_id)}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-purple-500/20 border-purple-400 text-purple-200'
                        : 'bg-white/5 border-border/40 text-muted-foreground hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-semibold uppercase">{p.phase_id}</div>
                    <div className="text-base font-mono font-semibold text-foreground mt-0.5">
                      Year {p.year}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-0.5">
                      {p.development_ids.length} developments
                    </div>
                  </button>
                )
              })}
            </div>

            {/* Occupied Share Slider */}
            {currentPhase && (
              <div className="pt-2 border-t border-border/30 flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Target Occupied Share:</span>
                  <span className="font-mono font-semibold text-amber-300" data-testid="occupied-share-label">
                    {Math.round(currentPhase.occupied_share * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  aria-label="Target Occupied Share"
                  min="0"
                  max="1"
                  step="0.05"
                  value={currentPhase.occupied_share}
                  onChange={(e) => {
                    const nextVal = parseFloat(e.target.value)
                    updateScenario((prev) => ({
                      ...prev,
                      phases: prev.phases.map((p) =>
                        p.phase_id === currentPhase.phase_id ? { ...p, occupied_share: nextVal } : p
                      ),
                    }))
                  }}
                  className="w-full accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                  <span>0% (Empty)</span>
                  <span>Unit: share [0.0–1.0]</span>
                  <span>100% (Full)</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DEMAND CASE & FACTORS */}
      {activeTab === 'demand' && (
        <div className="flex flex-col gap-3" data-testid="section-demand">
          <div className="liquid-glass rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                DEMAND CASE SELECTION
              </span>
              <span className="status-chip status-chip-assumed">ASSUMPTION</span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {(['low', 'central', 'high'] as DemandCase[]).map((dc) => {
                const isSelected = scenario.demand_case === dc
                return (
                  <button
                    key={dc}
                    type="button"
                    data-testid={`demand-case-btn-${dc}`}
                    onClick={() => updateScenario((prev) => ({ ...prev, demand_case: dc }))}
                    className={`p-2 rounded-xl text-center border capitalize transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200'
                        : 'bg-white/5 border-border/40 text-muted-foreground hover:border-white/20'
                    }`}
                  >
                    <div className="text-xs font-semibold">{dc}</div>
                    <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                      {dc === 'low' ? '3/win' : dc === 'central' ? '5/win' : '7/win'}
                    </div>
                  </button>
                )
              })}
            </div>

            <div className="text-[11px] text-muted-foreground leading-relaxed pt-2 border-t border-border/30">
              <span className="font-semibold text-foreground">Meaning: </span>
              Selects synthetic new-rider arrivals per fixture window across the pipeline developments.
            </div>
          </div>

          {/* Advanced Assumptions in an Expandable Panel (D14 Accessibility) */}
          {assumptions.length > 0 && (
            <details className="liquid-glass rounded-xl p-3 border border-border/40 text-xs font-mono">
              <summary className="cursor-pointer text-muted-foreground hover:text-foreground font-semibold flex items-center justify-between">
                <span>Advanced Corridor Assumptions ({assumptions.length})</span>
                <span className="text-[10px]">▾</span>
              </summary>
              <div className="flex flex-col gap-1.5 mt-2 pt-2 border-t border-border/30">
                {assumptions.map((a) => (
                  <div key={a.key} className="flex justify-between items-baseline text-[11px]">
                    <span className="text-muted-foreground">{a.key.replaceAll('_', ' ')}:</span>
                    <span className="font-semibold text-foreground">{a.central} {a.unit}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* TAB 3: BUDGETS & VEHICLE LIMITS */}
      {activeTab === 'budgets' && (
        <div className="flex flex-col gap-3" data-testid="section-budgets">
          {/* Capital Budget */}
          <div className="liquid-glass rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                CAPITAL BUDGET
              </span>
              <span className="status-chip status-chip-user">USER TARGET</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-mono font-semibold text-cyan-300">
                ${(scenario.capital_budget_cad / 1_000_000).toFixed(1)}M CAD
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Range: $0–$50M CAD
              </span>
            </div>
            <input
              type="range"
              aria-label="Capital Budget CAD"
              min="0"
              max="50000000"
              step="1000000"
              value={scenario.capital_budget_cad}
              onChange={(e) => {
                const nextVal = parseInt(e.target.value, 10)
                updateScenario((prev) => ({ ...prev, capital_budget_cad: nextVal }))
              }}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* Operating Budget */}
          <div className="liquid-glass rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                ANNUAL OPERATING BUDGET
              </span>
              <span className="status-chip status-chip-user">USER TARGET</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-mono font-semibold text-cyan-300">
                ${(scenario.annual_operating_budget_cad / 1_000_000).toFixed(2)}M / yr
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Range: $0–$5M CAD/yr
              </span>
            </div>
            <input
              type="range"
              aria-label="Operating Budget CAD per year"
              min="0"
              max="5000000"
              step="100000"
              value={scenario.annual_operating_budget_cad}
              onChange={(e) => {
                const nextVal = parseInt(e.target.value, 10)
                updateScenario((prev) => ({ ...prev, annual_operating_budget_cad: nextVal }))
              }}
              className="w-full accent-cyan-400"
            />
          </div>

          {/* Fleet Allowance */}
          <div className="liquid-glass rounded-xl p-3 flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                FLEET ALLOWANCE (EXTRA VEHICLES)
              </span>
              <span className="status-chip status-chip-user">LIMIT</span>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-mono font-semibold text-foreground">
                +{scenario.fleet_allowance} streetcars
              </span>
              <span className="text-[10px] text-muted-foreground font-mono">
                Range: 0–10 vehicles
              </span>
            </div>
            <input
              type="range"
              aria-label="Fleet allowance"
              min="0"
              max="10"
              step="1"
              value={scenario.fleet_allowance}
              onChange={(e) => {
                const nextVal = parseInt(e.target.value, 10)
                updateScenario((prev) => ({ ...prev, fleet_allowance: nextVal }))
              }}
              className="w-full accent-foreground"
            />
          </div>
        </div>
      )}

      {/* TAB 4: PLANNING CRITERIA */}
      {activeTab === 'criteria' && (
        <div className="flex flex-col gap-3" data-testid="section-criteria">
          <div className="liquid-glass rounded-xl p-3 flex flex-col gap-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                PASS / FAIL CRITERIA
              </span>
              <span className="status-chip status-chip-assumed">CRITERION</span>
            </div>

            <div className="flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Max P95 Wait:</span>
                <span className="font-mono font-semibold text-foreground">
                  {scenario.planning_criterion.max_p95_wait_s}s (~{(scenario.planning_criterion.max_p95_wait_s / 60).toFixed(1)}m)
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Max Denied Boardings:</span>
                <span className="font-mono font-semibold text-foreground">
                  {Math.round(scenario.planning_criterion.max_denied_share * 100)}%
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-muted-foreground">Max Unresolved Passengers:</span>
                <span className="font-mono font-semibold text-foreground">
                  {scenario.planning_criterion.max_unresolved_passengers} riders
                </span>
              </div>
            </div>

            <div className="text-[11px] text-muted-foreground italic pt-2 border-t border-border/30">
              &ldquo;{scenario.planning_criterion.meaning}&rdquo;
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default ScenarioEditor
