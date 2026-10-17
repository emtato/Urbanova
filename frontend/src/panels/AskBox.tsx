import { useState, type FC } from 'react'
import type { Scenario } from '../lib/types'

export interface InterpretedField {
  key: string
  label: string
  originalValue: string | number
  interpretedValue: string | number
  unit: string
  description: string
}

export interface AskBoxProps {
  scenario?: Scenario
  onApplyChanges?: (fields: InterpretedField[]) => void
  onClose?: () => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

const PRESET_QUERIES = [
  {
    label: 'Double Streetcar Frequency',
    prompt: 'What happens if we double streetcar service frequency to 3.0 minute headway during morning peak?',
    fields: [
      {
        key: 'headway_s',
        label: 'Peak Scheduled Headway',
        originalValue: 360,
        interpretedValue: 180,
        unit: 'seconds (3.0 min)',
        description: 'Doubles transit capacity across Broadview to TMU corridor.',
      },
      {
        key: 'extra_vehicles',
        label: 'Fleet Requirement',
        originalValue: 1,
        interpretedValue: 3,
        unit: 'streetcars',
        description: 'Requires 2 additional streetcars allocated to Route 505.',
      },
    ],
  },
  {
    label: 'Higher Phase 1 Occupancy',
    prompt: 'Simulate high density scenario: Phase 1 reaches 85% occupancy with central transit share.',
    fields: [
      {
        key: 'occupied_share',
        label: 'Phase 1 Occupied Share',
        originalValue: 0.5,
        interpretedValue: 0.85,
        unit: 'share (85%)',
        description: 'Accelerates resident move-in rate by 2028.',
      },
      {
        key: 'demand_case',
        label: 'Demand Factor',
        originalValue: 'central',
        interpretedValue: 'high',
        unit: 'case',
        description: 'Elevates new morning commuter trips across all corridor stops.',
      },
    ],
  },
  {
    label: 'Budget Austerity Cap',
    prompt: 'What if City Council caps our annual operating mitigation budget at $800k/yr?',
    fields: [
      {
        key: 'annual_operating_budget_cad',
        label: 'Operating Budget Cap',
        originalValue: 1200000,
        interpretedValue: 800000,
        unit: 'CAD/year',
        description: 'Stricter operating ceiling test for package feasibility.',
      },
    ],
  },
]

export const AskBox: FC<AskBoxProps> = ({
  scenario,
  onApplyChanges,
  onClose,
  isMinimized = false,
  onToggleMinimize,
  className = '',
}) => {
  const [query, setQuery] = useState('')
  const [interpretedFields, setInterpretedFields] = useState<InterpretedField[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [isExecuting, setIsExecuting] = useState(false)
  const [isStale, setIsStale] = useState(false)
  const [executionMessage, setExecutionMessage] = useState<string | null>(null)

  const handleSelectPreset = (preset: typeof PRESET_QUERIES[0]) => {
    setQuery(preset.prompt)
    setInterpretedFields(preset.fields)
    setIsStale(true)
    setExecutionMessage(null)
  }

  const handleParseQuery = () => {
    if (!query.trim()) return
    setIsParsing(true)
    setExecutionMessage(null)

    // Simulate deterministic NLP parameter extraction
    setTimeout(() => {
      const lower = query.toLowerCase()
      const fields: InterpretedField[] = []

      if (lower.includes('headway') || lower.includes('frequency') || lower.includes('double') || lower.includes('minute')) {
        fields.push({
          key: 'headway_s',
          label: 'Peak Scheduled Headway',
          originalValue: 360,
          interpretedValue: 180,
          unit: 'seconds (~3.0m)',
          description: 'Interpreted from prompt: increase headway frequency.',
        })
      }

      if (lower.includes('occupan') || lower.includes('unit') || lower.includes('growth')) {
        fields.push({
          key: 'occupied_share',
          label: 'Occupied Share Target',
          originalValue: 0.5,
          interpretedValue: 0.8,
          unit: 'share (80%)',
          description: 'Interpreted from prompt: accelerate residential occupation.',
        })
      }

      if (lower.includes('budget') || lower.includes('cost') || lower.includes('cap')) {
        fields.push({
          key: 'annual_operating_budget_cad',
          label: 'Annual Operating Budget',
          originalValue: scenario?.annual_operating_budget_cad ?? 1200000,
          interpretedValue: 900000,
          unit: 'CAD/year',
          description: 'Interpreted from prompt: adjust annual budget constraint.',
        })
      }

      if (fields.length === 0) {
        fields.push({
          key: 'demand_case',
          label: 'Simulated Demand Cohort',
          originalValue: scenario?.demand_case ?? 'central',
          interpretedValue: 'high',
          unit: 'demand tier',
          description: 'Parsed general inquiry as high stress demand test.',
        })
      }

      setInterpretedFields(fields)
      setIsParsing(false)
      setIsStale(true)
    }, 300)
  }

  const handleFieldChange = (index: number, newValue: string) => {
    setInterpretedFields((prev) =>
      prev.map((f, i) => (i === index ? { ...f, interpretedValue: newValue } : f))
    )
    setIsStale(true)
  }

  const handleRunExperiment = () => {
    setIsExecuting(true)
    setTimeout(() => {
      setIsExecuting(false)
      setIsStale(false)
      setExecutionMessage('Experiment simulated successfully. Corridor metrics updated.')
      if (onApplyChanges) onApplyChanges(interpretedFields)
    }, 400)
  }

  if (isMinimized) {
    return (
      <div
        data-testid="ask-box"
        className={`liquid-glass rounded-full px-4 py-2 shadow-2xl animate-fade-rise flex items-center gap-3 border border-border/40 ${className}`}
      >
        <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse shrink-0" />
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="text-xs font-semibold text-foreground truncate">
            Ask Gemini Scenario Copilot
          </span>
          {isStale && (
            <span className="text-[10px] text-amber-300 font-mono shrink-0">
              [Stale Changes Pending]
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 border-l border-border/40 pl-2 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Expand AskBox"
              aria-label="Expand AskBox"
            >
              ▾
            </button>
          )}
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground text-xs p-1 transition-colors cursor-pointer"
              title="Close AskBox"
              aria-label="Close AskBox"
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
      data-testid="ask-box"
      className={`liquid-glass-panel rounded-2xl p-6 shadow-2xl animate-fade-rise flex flex-col gap-4 text-foreground w-[460px] max-h-[calc(100vh-10rem)] overflow-y-auto ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pb-1 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="status-chip status-chip-user font-mono text-[10px]">
            LANE D13 GEMINI COPILOT
          </span>
          <span className="status-chip status-chip-assumed font-mono text-[10px]">
            TRANSPARENT NLP
          </span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {onToggleMinimize && (
            <button
              type="button"
              onClick={onToggleMinimize}
              aria-label="Minimize AskBox"
              className="text-muted-foreground hover:text-foreground p-1 transition-colors rounded-full hover:bg-white/10 text-xs font-bold leading-none cursor-pointer"
              title="Minimize panel"
            >
              −
            </button>
          )}
          {onClose && (
            <button
              type="button"
              data-testid="close-ask-box-btn"
              onClick={onClose}
              aria-label="Close AskBox"
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
          Ask Gemini: Scenario Question Copilot
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5 font-mono">
          Ask questions in plain English. Interpreted parameters are shown and editable before running. Nothing changes without you seeing what changed.
        </p>
      </div>

      {/* Stale Results Marker (Required by D13) */}
      {isStale && (
        <div
          data-testid="stale-results-warning"
          className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3 flex items-start gap-2 text-xs text-amber-200"
        >
          <span className="text-amber-400 text-sm">⚠️</span>
          <div>
            <div className="font-semibold text-amber-300">
              STALE RESULTS — PARAMETERS ALTERED
            </div>
            <div className="text-[11px] text-amber-200/90 mt-0.5 font-mono">
              Interpreted scenario inputs differ from the current simulation. Click &ldquo;Run Experiment&rdquo; below to simulate and update results.
            </div>
          </div>
        </div>
      )}

      {/* Execution Feedback Message */}
      {executionMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-300 font-mono">
          ✓ {executionMessage}
        </div>
      )}

      {/* Query Input Box */}
      <div className="flex flex-col gap-2">
        <label htmlFor="gemini-query-input" className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          YOUR PLANNING QUESTION
        </label>
        <div className="flex gap-2">
          <input
            id="gemini-query-input"
            type="text"
            data-testid="gemini-query-input"
            placeholder="e.g. What if we double streetcar frequency to 3 min headway?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleParseQuery()
            }}
            className="flex-1 bg-black/30 border border-border/40 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400 font-mono"
          />
          <button
            type="button"
            data-testid="parse-query-btn"
            onClick={handleParseQuery}
            disabled={isParsing || !query.trim()}
            className="px-4 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-semibold text-xs transition-colors shrink-0 cursor-pointer"
          >
            {isParsing ? 'Parsing...' : 'Interpret'}
          </button>
        </div>
      </div>

      {/* Presets List */}
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
          QUICK SCENARIO PROMPTS
        </span>
        <div className="flex flex-wrap gap-1.5">
          {PRESET_QUERIES.map((p, i) => (
            <button
              key={i}
              type="button"
              data-testid={`preset-prompt-${i}`}
              onClick={() => handleSelectPreset(p)}
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground border border-white/10 transition-colors font-mono cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Interpreted Fields Table / Cards (Required by D13: "interpreted fields shown and editable") */}
      {interpretedFields.length > 0 && (
        <div className="flex flex-col gap-2 pt-2 border-t border-border/30" data-testid="interpreted-fields-section">
          <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
            <span>INTERPRETED PARAMETERS (EDITABLE)</span>
            <span className="status-chip status-chip-user font-mono text-[9px]">CONFIRM CHANGES</span>
          </div>

          <div className="flex flex-col gap-2">
            {interpretedFields.map((field, idx) => (
              <div
                key={field.key}
                data-testid={`interpreted-field-${field.key}`}
                className="liquid-glass rounded-xl p-3 flex flex-col gap-2 border border-border/40"
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-xs text-foreground">
                    {field.label}
                  </span>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    Unit: {field.unit}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 items-center text-xs font-mono">
                  <div className="bg-white/5 p-2 rounded-lg border border-white/10">
                    <div className="text-[9px] text-muted-foreground uppercase">Original</div>
                    <div className="font-semibold text-muted-foreground mt-0.5">
                      {String(field.originalValue)}
                    </div>
                  </div>

                  <div className="bg-cyan-500/10 p-2 rounded-lg border border-cyan-400/40">
                    <div className="text-[9px] text-cyan-300 uppercase font-semibold">Interpreted (Edit)</div>
                    <input
                      type="text"
                      data-testid={`edit-field-input-${field.key}`}
                      value={String(field.interpretedValue)}
                      onChange={(e) => handleFieldChange(idx, e.target.value)}
                      className="w-full bg-transparent font-semibold text-cyan-300 text-xs focus:outline-none mt-0.5"
                    />
                  </div>
                </div>

                <div className="text-[10px] text-muted-foreground font-mono leading-tight">
                  {field.description}
                </div>
              </div>
            ))}
          </div>

          {/* Run Action */}
          <button
            type="button"
            data-testid="run-experiment-btn"
            onClick={handleRunExperiment}
            disabled={isExecuting}
            className="w-full mt-2 py-2.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold text-xs shadow-[0_0_20px_rgba(6,182,212,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <span>{isExecuting ? 'Simulating Corridor...' : '⚡ Run Experiment (Apply Changes)'}</span>
          </button>
        </div>
      )}
    </div>
  )
}
export default AskBox
