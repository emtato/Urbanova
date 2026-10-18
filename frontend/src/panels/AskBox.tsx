import { useEffect, useRef, useState, type FC } from 'react'
import { askCopilot, interpretedFields as proposalFields, runCopilotExperiment, investigateFromChat, type ChatInvestigation, type InterpretedField } from '../lib/copilot'
import { API_BASE_URL } from '../lib/api'
export type { InterpretedField } from '../lib/copilot'
import type { Scenario } from '../lib/types'

export interface AskBoxProps {
  stopId?: string
  scenario?: Scenario
  onApplyChanges?: (fields: InterpretedField[]) => void
  onClose?: () => void
  isMinimized?: boolean
  onToggleMinimize?: () => void
  className?: string
}

const PRESET_QUERIES = [
  {label:'Double Streetcar Frequency',prompt:'Double the streetcar frequency from the reviewed baseline headway.'},
  {label:'Higher Travel Demand',prompt:'Set trips per resident in the peak window to 0.6.'},
  {label:'Explain Current Inputs',prompt:'What headway and streetcar capacity does the model currently use?'},
  {label:'Investigate My Stop',prompt:'Why does my stop get worse?'},
]

export const AskBox: FC<AskBoxProps> = ({
  stopId,onApplyChanges, onClose, isMinimized=false, onToggleMinimize, className='',
}) => {
  const [query,setQuery]=useState('')
  const [interpretedFields,setInterpretedFields]=useState<InterpretedField[]>([])
  const [isParsing,setIsParsing]=useState(false)
  const [isExecuting,setIsExecuting]=useState(false)
  const [isStale,setIsStale]=useState(false)
  const [executionMessage,setExecutionMessage]=useState<string|null>(null)
  const [error,setError]=useState<string|null>(null)
  const [usedFallback,setUsedFallback]=useState(false)
  const [offerInvestigation,setOfferInvestigation]=useState(false)
  const [investigation,setInvestigation]=useState<ChatInvestigation|null>(null)
  const pending=useRef<AbortController|null>(null)
  useEffect(()=>()=>pending.current?.abort(),[])

  const handleParseQuery=async (text=query)=>{
    if(!text.trim()||isExecuting)return
    pending.current?.abort()
    const request=new AbortController();pending.current=request
    setQuery(text);setIsParsing(true);setError(null);setExecutionMessage(null)
    setInterpretedFields([]);setIsStale(false)
    setOfferInvestigation(false)
    try{
      const reply=await askCopilot(text,request.signal)
      if(request.signal.aborted)return
      const fields=proposalFields(reply)
      setInterpretedFields(fields);setUsedFallback(reply.fallback)
      setOfferInvestigation(Boolean(reply.investigate))
      setExecutionMessage(reply.answer);setIsStale(fields.length>0)
    }catch(e){if(!request.signal.aborted)setError(e instanceof Error?e.message:'Could not reach the chat backend.')}
    finally{if(!request.signal.aborted)setIsParsing(false)}
  }
  const handleSelectPreset=(preset:typeof PRESET_QUERIES[number])=>{void handleParseQuery(preset.prompt)}
  const handleFieldChange=(index:number,value:string)=>{
    setInterpretedFields(previous=>previous.map((field,i)=>i===index?{...field,interpretedValue:value}:field))
    setIsStale(true);setError(null)
  }
  const handleRunExperiment=async()=>{
    if(isExecuting||isParsing)return
    pending.current?.abort()
    const request=new AbortController();pending.current=request
    setIsExecuting(true);setError(null);setExecutionMessage('Running the actual B11 simulation and saving its result...')
    try{
      const result=await runCopilotExperiment(interpretedFields,request.signal)
      if(request.signal.aborted)return
      setIsStale(false);setExecutionMessage(`Simulation saved (${result.id}). It is now selected in map simulation history.`)
      onApplyChanges?.(interpretedFields)
    }catch(e){if(!request.signal.aborted){setExecutionMessage(null);setError(e instanceof Error?e.message:'Simulation failed. No successful result was returned.')}}
    finally{if(!request.signal.aborted)setIsExecuting(false)}
  }
  const handleInvestigation=async(continueExisting=false)=>{
    if(isExecuting||isParsing)return
    const request=new AbortController();pending.current?.abort();pending.current=request
    setIsExecuting(true);setError(null);setExecutionMessage('Running matched-seed experiments and reading research context…')
    try{
      const result=await investigateFromChat({...(continueExisting&&investigation?{id:investigation.id}:{}),stopId,signal:request.signal,onProgress:setInvestigation})
      if(request.signal.aborted)return
      setInvestigation(result);setOfferInvestigation(false)
      setExecutionMessage(result.finding?.resident_answer??`${result.finding?.premise??''} Prediction: ${result.finding?.classification??'not yet evaluated'}. ${result.status==='awaiting_human'?'Review the evidence and supply a service constraint below.':''}`)
    }catch(e){if(!request.signal.aborted){setExecutionMessage(null);setError(e instanceof Error?e.message:'Could not complete the investigation.')}}
    finally{if(!request.signal.aborted)setIsExecuting(false)}
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
            GEMINI COPILOT
          </span>
          <span className="status-chip status-chip-assumed font-mono text-[10px]">
            LIVE BACKEND
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
          Ask about reviewed baseline inputs or propose a new simulation. Saved map runs are not the chat baseline. Review changes before running.
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
      {error && <div role="alert" className="rounded-xl border border-red-400/40 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}
      {usedFallback && executionMessage && <p className="text-xs text-amber-200">Provider unavailable or response rejected; using a labelled server fallback.</p>}
      {executionMessage && (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-xl p-3 text-xs text-emerald-300 font-mono">
          {executionMessage}
        </div>
      )}

      {/* Query Input Box */}
      {offerInvestigation && <button type="button" disabled={isExecuting||isParsing} onClick={()=>void handleInvestigation()} className="rounded-xl bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50">Start measured investigation</button>}
      {investigation && <div className="rounded-xl border border-border/40 p-3 text-xs" aria-live="polite">
        <p>Investigation: {investigation.status}</p>
        <a href={`${API_BASE_URL}/investigations/${encodeURIComponent(investigation.id)}/replay`} target="_blank" rel="noreferrer" className="text-cyan-300 underline">Open saved evidence and research replay</a>
        {investigation.status==='awaiting_human' && <button type="button" disabled={isExecuting||isParsing} onClick={()=>void handleInvestigation(true)} className="mt-3 block rounded-lg bg-cyan-500 px-3 py-2 font-semibold text-slate-950 disabled:opacity-50">Keep current service; no extra vehicles. Continue.</button>}
      </div>}
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
            disabled={isExecuting || isParsing}
            onChange={(e) => {pending.current?.abort();setIsParsing(false);setQuery(e.target.value);setInterpretedFields([]);setIsStale(false);setExecutionMessage(null);setError(null);setOfferInvestigation(false)}}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !isParsing && !isExecuting) {e.preventDefault();void handleParseQuery()}
            }}
            className="flex-1 bg-black/30 border border-border/40 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-cyan-400 font-mono"
          />
          <button
            type="button"
            data-testid="parse-query-btn"
            onClick={() => void handleParseQuery()}
            disabled={isParsing || isExecuting || !query.trim()}
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
              disabled={isParsing || isExecuting}
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
                      disabled={isExecuting || isParsing}
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
            disabled={isExecuting || isParsing}
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
