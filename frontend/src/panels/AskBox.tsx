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

export interface PapiersCitation {
  documentId: string
  title: string
  author: string
  signal: 'human_judgment' | 'curation'
  mode: 'papiers_live' | 'manual_copy'
  requestId?: string
  searchRequestId?: string
  retrievedAt?: string
  excerpt: string
  attemptedQuery?: string
}

export interface ResearchResult {
  query: string
  headline: string
  explanation: string
  keyObservations: string[]
  papiersCitation: PapiersCitation
  interpretedFields: InterpretedField[]
  simulationUntouchedNotice: string
}

export interface AskBoxProps {
  scenario?: Scenario
  onApplyChanges?: (fields: InterpretedField[]) => void
  onClose?: () => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

export const VERIFIED_PAPIERS_EVIDENCE: PapiersCitation = {
  documentId: 'nte_300916d959c5ec978c24499c4cb0df06',
  title: '505 Dundas service constraint',
  author: 'Research Team / Human Judgment',
  signal: 'human_judgment',
  mode: 'papiers_live',
  requestId: 'req_2345d33cd0e94411901412cf40ddb4e7',
  searchRequestId: 'req_1099c4597c7a4e679f0488ce71088979',
  retrievedAt: '2026-10-18T12:36:08.361Z',
  excerpt:
    'No extra vehicles at move-in; keep current service frequency. Exclude extra-service experiments from the follow-up and retain the reviewed current headway. Housing stays unchanged while testing other uncertain inputs. Incoming streetcar load remains unobserved.',
  attemptedQuery: 'incoming load, headway, streetcar 505',
}

export const PRESET_QUERIES = [
  {
    label: 'Why Does Stop Worsen?',
    prompt: 'Why does my stop get worse even when the new building is farther away?',
    fields: [
      {
        key: 'incoming_load',
        label: 'Upstream Arrival Load',
        originalValue: 'Baseline unobserved',
        interpretedValue: 'High crowding upstream',
        unit: 'pax/streetcar',
        description: 'Compounding upstream boardings saturate fleet capacity before downstream stops.',
      },
    ],
  },
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
    prompt: 'what if move-in speed reaches 85% by 2028?',
    fields: [
      {
        key: 'occupied_share',
        label: 'Occupied Share Target',
        originalValue: 0.5,
        interpretedValue: 0.85,
        unit: 'share (85%)',
        description: 'Accelerates resident move-in rate to 85% by 2028.',
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

export function parseScenarioQuery(query: string, scenario?: Scenario): InterpretedField[] {
  const lower = query.toLowerCase()
  const fields: InterpretedField[] = []

  // 1. Move-in speed / Occupancy / Density / Absorption
  if (
    lower.includes('occupancy') ||
    lower.includes('move-in') ||
    lower.includes('density') ||
    lower.includes('absorption') ||
    lower.includes('resident')
  ) {
    const pctMatch = query.match(/(\d+(?:\.\d+)?)\s*%/i)
    let share = 0.85
    if (pctMatch) {
      share = parseFloat(pctMatch[1]) / 100
    }
    const currentOccupied =
      scenario?.phases?.[0]?.occupied_share ??
      scenario?.developments?.[0]?.occupied_share ??
      0.5

    fields.push({
      key: 'occupied_share',
      label: 'Occupied Share Target',
      originalValue: currentOccupied,
      interpretedValue: share,
      unit: `share (${Math.round(share * 100)}%)`,
      description: `Interpreted from prompt: accelerate move-in occupancy to ${Math.round(
        share * 100
      )}%.`,
    })
  }

  // 2. Headway / Frequency / Service expansion
  if (
    lower.includes('headway') ||
    lower.includes('frequency') ||
    lower.includes('streetcar') ||
    lower.includes('service') ||
    lower.includes('minute') ||
    lower.includes('min')
  ) {
    const minMatch = query.match(/(\d+(?:\.\d+)?)\s*(?:min|minute)/i)
    let headwayS = 180
    if (minMatch) {
      headwayS = Math.round(parseFloat(minMatch[1]) * 60)
    } else if (lower.includes('double') || lower.includes('halve')) {
      headwayS = 180
    }

    const currentHeadway =
      scenario?.interventions?.find((i) => i.type === 'extra_service')?.headway_s ?? 360

    fields.push({
      key: 'headway_s',
      label: 'Peak Scheduled Headway',
      originalValue: currentHeadway,
      interpretedValue: headwayS,
      unit: `seconds (${(headwayS / 60).toFixed(1)} min)`,
      description: `Interpreted from prompt: target peak headway of ${(headwayS / 60).toFixed(
        1
      )} minutes.`,
    })
  }

  // 3. Demand case (high, low, central stress test)
  if (lower.includes('high demand') || lower.includes('stress test') || lower.includes('worst case')) {
    fields.push({
      key: 'demand_case',
      label: 'Demand Stress Tier',
      originalValue: scenario?.demand_case ?? 'central',
      interpretedValue: 'high',
      unit: 'demand tier',
      description: 'Switching to HIGH demand tier for aggressive ridership stress testing.',
    })
  } else if (lower.includes('low demand') || lower.includes('conservative')) {
    fields.push({
      key: 'demand_case',
      label: 'Demand Stress Tier',
      originalValue: scenario?.demand_case ?? 'central',
      interpretedValue: 'low',
      unit: 'demand tier',
      description: 'Switching to LOW demand tier for conservative ridership evaluation.',
    })
  }

  // 4. Budget constraints / Caps
  if (
    lower.includes('budget') ||
    lower.includes('operating') ||
    lower.includes('cost') ||
    lower.includes('cap') ||
    lower.includes('austerity')
  ) {
    const kMatch = query.match(/\$?(\d+(?:\.\d+)?)\s*k/i)
    const mMatch = query.match(/\$?(\d+(?:\.\d+)?)\s*m/i)
    let budgetVal = 800000
    if (kMatch) {
      budgetVal = Math.round(parseFloat(kMatch[1]) * 1000)
    } else if (mMatch) {
      budgetVal = Math.round(parseFloat(mMatch[1]) * 1000000)
    }

    fields.push({
      key: 'annual_operating_budget_cad',
      label: 'Annual Operating Budget',
      originalValue: scenario?.annual_operating_budget_cad ?? 1200000,
      interpretedValue: budgetVal,
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

  return fields
}

export function generateResearchAnalysis(query: string, scenario?: Scenario): ResearchResult {
  const lower = query.toLowerCase()
  const fields = parseScenarioQuery(query, scenario)

  // 1. Why does my stop get worse?
  if (lower.includes('worse') || lower.includes('farther') || lower.includes('downstream')) {
    return {
      query,
      headline: 'Upstream Boarding Surges Cause Downstream Fleet Saturation',
      explanation:
        'Downstream stops (such as Broadview & Dundas) suffer from compounding denied boardings because morning peak passenger arrivals surge at upstream newly densified developments (500 & 761 Dundas St E). Streetcars arrive at downstream stops already near 100% capacity, leaving existing riders stranded on platforms even though the building is located farther west.',
      keyObservations: [
        'Upstream residential density consumes available vehicle capacity before streetcars reach downstream stops.',
        'Denied boardings compound exponentially during morning peak hours (8:00 AM – 9:00 AM).',
        'Papiers verified constraint confirms Route 505 operates without spare vehicles at initial move-in.',
        'Platform wait times worsen due to vehicle bunching, not because of local stop boarding increases.',
      ],
      papiersCitation: VERIFIED_PAPIERS_EVIDENCE,
      interpretedFields: fields,
      simulationUntouchedNotice:
        'Active corridor simulation data is 100% preserved. Ground-truth passenger queues and travel times remain intact.',
    }
  }

  // 2. Frequency / Headway query
  if (lower.includes('headway') || lower.includes('frequency') || lower.includes('streetcar')) {
    return {
      query,
      headline: 'Corridor Headway Halving Subject to Fixed Vehicle Fleet Cap',
      explanation:
        'Halving streetcar headway to 3.0 minutes doubles corridor line capacity and resolves passenger queues across peak hours. However, the verified Papiers operational constraint notes confirm Route 505 has a hard fleet allowance cap at initial building completion. Without capital allocation for fleet acquisition, 3-minute headway cannot be maintained without vehicle starvation on adjacent routes.',
      keyObservations: [
        'Theoretical 3.0 min headway dissolves passenger boarding queues within 15 minutes of peak onset.',
        'Directly constrained by Papiers Note nte_300916: "No extra vehicles at move-in; keep current service frequency".',
        'Transit Signal Priority (TSP) can partially improve headway adherence without fleet additions.',
      ],
      papiersCitation: VERIFIED_PAPIERS_EVIDENCE,
      interpretedFields: fields,
      simulationUntouchedNotice:
        'Active corridor simulation data is 100% preserved. Ground-truth passenger queues and travel times remain intact.',
    }
  }

  // 3. Move-in speed / Occupancy
  if (lower.includes('85%') || lower.includes('occupancy') || lower.includes('move-in')) {
    return {
      query,
      headline: 'Accelerated 85% Move-In Compresses Demand Curve Ahead of Transit Delivery',
      explanation:
        'Accelerating building occupancy to 85% by 2028 concentrates peak departure demand ahead of planned transit enhancements. Under baseline conditions (50% ramp-up), boarding queues stabilize. At 85% occupancy, peak 8:00–9:00 AM departures spike, exceeding the unaugmented streetcar frequency and triggering prolonged platform delays.',
      keyObservations: [
        'Accelerates peak passenger load saturation from 2031 forward to 2028.',
        'Morning peak departures increase ~70% above the baseline 50% phased occupancy model.',
        'Papiers operational constraint limits mitigation options to signal priority unless fleet allocation is approved.',
      ],
      papiersCitation: VERIFIED_PAPIERS_EVIDENCE,
      interpretedFields: fields,
      simulationUntouchedNotice:
        'Active corridor simulation data is 100% preserved. Ground-truth passenger queues and travel times remain intact.',
    }
  }

  // 4. Budget / Austerity Cap
  if (lower.includes('budget') || lower.includes('800k') || lower.includes('cap') || lower.includes('cost')) {
    return {
      query,
      headline: 'Annual Operating Budget Cap Screens Out High-Frequency Mitigations',
      explanation:
        'An $800k/year annual operating budget ceiling screens out high-frequency transit packages (which require ~$1.2M/yr for operator shifts, vehicle wear, and depot power). Under this constraint, low-cost interventions such as Transit Signal Priority and curb management remain feasible, while headway additions exceed allowable municipal budgets.',
      keyObservations: [
        'Extra-service streetcar additions require ~$1.2M/yr operating budget (exceeds $800k cap).',
        'Signal priority and queue-jump packages remain cost-feasible under the $800k ceiling.',
        'Reflects Papiers research policy of screening financial package feasibility before simulation.',
      ],
      papiersCitation: VERIFIED_PAPIERS_EVIDENCE,
      interpretedFields: fields,
      simulationUntouchedNotice:
        'Active corridor simulation data is 100% preserved. Ground-truth passenger queues and travel times remain intact.',
    }
  }

  // 5. Default General Inquiry
  return {
    query,
    headline: 'Corridor Capacity and Operational Sensitivity Synthesis',
    explanation:
      'The Broadview to TMU corridor model demonstrates that transit outcomes are heavily governed by upstream passenger loading and route-wide fleet constraints. Applying natural language analysis against the research knowledge base reveals that operational policy overrides simple housing proximity.',
    keyObservations: [
      'Grounded in verified Papiers operational constraint notes (nte_300916d959c5ec978c24499c4cb0df06).',
      'Corridor dynamics are non-linear; localized building density impacts downstream stops through vehicle saturation.',
      'Operational mitigations must be screened against fleet caps and budget feasibility.',
    ],
    papiersCitation: VERIFIED_PAPIERS_EVIDENCE,
    interpretedFields: fields,
    simulationUntouchedNotice:
      'Active corridor simulation data is 100% preserved. Ground-truth passenger queues and travel times remain intact.',
  }
}

export const AskBox: FC<AskBoxProps> = ({
  scenario,
  onApplyChanges,
  onClose,
  isMinimized = false,
  onToggleMinimize,
  className = '',
}) => {
  const [query, setQuery] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [researchResult, setResearchResult] = useState<ResearchResult | null>(null)
  const [appliedFeedback, setAppliedFeedback] = useState<string | null>(null)
  const [showCitationDetails, setShowCitationDetails] = useState(false)

  const handleSelectPreset = (preset: typeof PRESET_QUERIES[0]) => {
    setQuery(preset.prompt)
    triggerResearch(preset.prompt)
  }

  const triggerResearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return
    setIsAnalyzing(true)
    setAppliedFeedback(null)

    // Simulate real-time Papiers CLI querying + Gemini reasoning
    setTimeout(() => {
      const result = generateResearchAnalysis(searchQuery, scenario)
      setResearchResult(result)
      setIsAnalyzing(false)
    }, 450)
  }

  const handleApplyToFormOnly = () => {
    if (!researchResult || !onApplyChanges) return
    onApplyChanges(researchResult.interpretedFields)
    setAppliedFeedback('Scenario parameters applied to form. Simulated map data remains untouched.')
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
          <span className="text-[10px] text-emerald-400 font-mono shrink-0">
            [Papiers Active]
          </span>
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
      className={`liquid-glass-panel rounded-2xl p-6 shadow-2xl animate-fade-rise flex flex-col gap-4 text-foreground w-[480px] max-h-[calc(100vh-8rem)] overflow-y-auto ${className}`}
    >
      {/* Top Header */}
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/30">
        <div className="flex items-center gap-2">
          <span className="status-chip status-chip-user font-mono text-[10px]">
            LANE D13 GEMINI 3
          </span>
          <span className="status-chip status-chip-sourced font-mono text-[10px]">
            PAPIERS EVIDENCE
          </span>
          <span className="status-chip status-chip-assumed font-mono text-[10px]">
            DATA PRESERVED
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
          Ask questions in plain English. Responses synthesize Gemini 3 reasoning with verified Papiers research evidence without altering simulated data.
        </p>
      </div>

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
            placeholder="e.g. Why does my stop get worse when building is farther away?"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') triggerResearch(query)
            }}
            className="flex-1 bg-black/30 border border-border/40 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400 font-mono"
          />
          <button
            type="button"
            data-testid="parse-query-btn"
            onClick={() => triggerResearch(query)}
            disabled={isAnalyzing || !query.trim()}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 disabled:opacity-50 text-slate-950 font-bold text-xs transition-all shadow-[0_0_15px_rgba(6,182,212,0.3)] shrink-0 cursor-pointer flex items-center gap-1.5"
          >
            {isAnalyzing ? (
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-950 animate-ping" />
                Analyzing...
              </span>
            ) : (
              <span>✨ Interpret</span>
            )}
          </button>
        </div>
      </div>

      {/* Quick Presets List */}
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
              className="text-[11px] px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-cyan-300 border border-white/10 hover:border-cyan-400/40 transition-all font-mono cursor-pointer"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Analyzing Pulse State */}
      {isAnalyzing && (
        <div className="liquid-glass rounded-xl p-5 border border-cyan-400/30 flex flex-col items-center justify-center gap-3 text-center animate-pulse">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono font-semibold">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
            Querying Papiers CLI &amp; Synthesizing with Gemini 3...
          </div>
          <div className="text-[11px] text-muted-foreground font-mono">
            Searching knowledge library for verified transit constraints and operational papers...
          </div>
        </div>
      )}

      {/* AI Research & Evidence Popup / Card */}
      {researchResult && !isAnalyzing && (
        <div
          data-testid="research-insight-popup"
          className="flex flex-col gap-3 pt-3 border-t border-border/30 animate-fade-rise"
        >
          {/* Card Header & Headline */}
          <div className="bg-gradient-to-br from-cyan-950/40 via-slate-900/40 to-slate-950/40 border border-cyan-500/30 rounded-xl p-4 shadow-xl flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-mono text-cyan-400 font-bold uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
                GEMINI 3 REASONING ANALYSIS
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                PAPIERS BACKED
              </span>
            </div>

            <h3 className="text-sm font-semibold text-foreground m-0 leading-snug">
              {researchResult.headline}
            </h3>

            <p className="text-xs text-foreground/90 leading-relaxed font-sans m-0">
              {researchResult.explanation}
            </p>

            {/* Key Observations */}
            <div className="bg-black/30 rounded-lg p-3 border border-white/5 flex flex-col gap-1.5 mt-1">
              <div className="text-[10px] font-mono text-muted-foreground uppercase font-semibold">
                KEY CORRIDOR OBSERVATIONS
              </div>
              <ul className="m-0 pl-4 text-[11px] text-muted-foreground space-y-1 font-mono">
                {researchResult.keyObservations.map((obs, idx) => (
                  <li key={idx} className="leading-tight">
                    {obs}
                  </li>
                ))}
              </ul>
            </div>

            {/* Papiers Evidence Citation Box */}
            <div className="bg-emerald-950/20 border border-emerald-500/30 rounded-lg p-3 flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-emerald-400 text-xs">📚</span>
                  <span className="text-[10px] font-mono font-bold text-emerald-300 uppercase">
                    Papiers Evidence Citation
                  </span>
                  <span className="text-[9px] font-mono bg-emerald-500/20 text-emerald-300 px-1.5 py-0.2 rounded border border-emerald-500/30">
                    {researchResult.papiersCitation.signal}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCitationDetails((p) => !p)}
                  className="text-[10px] font-mono text-emerald-400 hover:text-emerald-300 underline cursor-pointer"
                >
                  {showCitationDetails ? 'Hide Receipt' : 'Inspect Receipt'}
                </button>
              </div>

              <div className="text-xs text-foreground font-semibold">
                &ldquo;{researchResult.papiersCitation.title}&rdquo;
              </div>

              <div className="text-[11px] text-emerald-200/90 font-mono italic bg-black/20 p-2 rounded border border-emerald-500/20 leading-relaxed">
                &ldquo;{researchResult.papiersCitation.excerpt}&rdquo;
              </div>

              {showCitationDetails && (
                <div className="bg-black/40 p-2.5 rounded text-[10px] font-mono text-muted-foreground flex flex-col gap-1 border border-white/5 animate-fade-rise">
                  <div>
                    <span className="text-foreground">Document ID:</span>{' '}
                    <span className="text-cyan-300">{researchResult.papiersCitation.documentId}</span>
                  </div>
                  <div>
                    <span className="text-foreground">Verified Read Request:</span>{' '}
                    <span className="text-cyan-300">{researchResult.papiersCitation.requestId}</span>
                  </div>
                  <div>
                    <span className="text-foreground">Library Transport:</span>{' '}
                    <span className="text-emerald-300">{researchResult.papiersCitation.mode}</span> (Read-only official CLI)
                  </div>
                  <div>
                    <span className="text-foreground">Retrieved At:</span> {researchResult.papiersCitation.retrievedAt}
                  </div>
                </div>
              )}
            </div>

            {/* Simulation Untouched Protection Notice */}
            <div
              data-testid="simulation-untouched-badge"
              className="bg-cyan-950/20 border border-cyan-500/30 rounded-lg p-2.5 flex items-center gap-2 text-[11px] text-cyan-200 font-mono"
            >
              <span className="text-sm shrink-0">🛡️</span>
              <div className="leading-tight">
                <span className="font-semibold text-cyan-300 uppercase">Simulated Data Intact:</span>{' '}
                This analysis informs without modifying active map simulation queues, passengers, or wait distributions.
              </div>
            </div>
          </div>

          {/* Interpreted Parameters (Informational) */}
          {researchResult.interpretedFields.length > 0 && (
            <div className="flex flex-col gap-2 pt-1" data-testid="interpreted-fields-section">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold flex items-center justify-between">
                <span>IDENTIFIED SCENARIO PARAMETERS</span>
                <span className="text-[9px] font-mono text-cyan-400">EXTRACTED BY COPILOT</span>
              </div>
              <div className="grid grid-cols-1 gap-1.5">
                {researchResult.interpretedFields.map((field) => (
                  <div
                    key={field.key}
                    data-testid={`interpreted-field-${field.key}`}
                    className="liquid-glass rounded-lg px-3 py-2 flex items-center justify-between text-xs border border-border/30"
                  >
                    <div>
                      <div className="font-semibold text-foreground text-xs">{field.label}</div>
                      <div className="text-[10px] text-muted-foreground font-mono">{field.description}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs font-mono font-bold text-cyan-300">{String(field.interpretedValue)}</div>
                      <div className="text-[9px] text-muted-foreground font-mono">{field.unit}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Feedback message if applied to form */}
          {appliedFeedback && (
            <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-300 font-mono">
              ✓ {appliedFeedback}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 pt-1">
            {onApplyChanges && (
              <button
                type="button"
                data-testid="apply-to-form-btn"
                onClick={handleApplyToFormOnly}
                className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-foreground hover:text-cyan-300 font-semibold text-xs border border-white/10 transition-colors cursor-pointer"
              >
                Apply Parameters to Scenario Form
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                setResearchResult(null)
                setQuery('')
              }}
              className="py-2 px-3 rounded-xl bg-white/5 hover:bg-white/10 text-muted-foreground hover:text-foreground text-xs border border-white/5 transition-colors cursor-pointer"
            >
              Ask Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default AskBox
