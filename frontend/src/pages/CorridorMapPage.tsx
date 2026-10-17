import { useEffect, useMemo, useRef, useState } from 'react'
import { configurationSummary, mapComparison, setActiveSimulation, todayBaseline, useSimulationHistory } from '../lib/simulationHistory'
import { getSimulations } from '../lib/api'
import { SimulationPicker } from '../panels/SimulationPicker'
import type { Comparison, Scenario } from '../lib/types'
import {
  type CorridorStop,
  type CorridorDevelopment,
  normalizeStop,
  normalizeDevelopment,
} from '../map/types'
import { CorridorMap } from '../map/CorridorMap'
import { mapProposals } from '../map/proposals'
import { DevelopmentPanel } from '../panels/DevelopmentPanel'
import { StopPanel } from '../panels/StopPanel'
import { ScenarioEditor } from '../panels/ScenarioEditor'
import { ReplaySpine } from '../replay/ReplaySpine'
import { CaseCompare } from '../panels/CaseCompare'
import { PackageTable } from '../panels/PackageTable'
import { Sensitivity } from '../panels/Sensitivity'
import { Evidence } from '../panels/Evidence'
import { AskBox } from '../panels/AskBox'

interface CorridorMapPageProps {
  onNavigate?: (path: string) => void
}

type ActiveTool =
  | 'compare'
  | 'replay'
  | 'scenario'
  | 'packages'
  | 'sensitivity'
  | 'evidence'
  | 'ask'
  | null

export function CorridorMapPage({ onNavigate }: CorridorMapPageProps) {
  const saved = useSimulationHistory()
  const loadedBatchId = useRef<string | null>(null)
  const [comparison, setComparison] = useState<Comparison | null>(() => mapComparison(todayBaseline))
  const loading = false
  const [buildingViewRequest, setBuildingViewRequest] = useState<{ devId: string; requestId: number } | null>(null)
  const [platformViewRequest, setPlatformViewRequest] = useState<{ stopId: string; requestId: number } | null>(null)
  const [selectedStop, setSelectedStop] = useState<CorridorStop | null>(null)
  const [visibleProposalIds, setVisibleProposalIds] = useState<string[]>([])
  const [selectedDev, setSelectedDev] = useState<CorridorDevelopment | null>(null)
  const usingFixture = false
  const [activePhase] = useState<number>(2)
  const [shadowsEnabled, setShadowsEnabled] = useState(true)
  const [hideAllPopups] = useState(false)
  const [isStopMinimized, setIsStopMinimized] = useState(false)
  const [isDevMinimized, setIsDevMinimized] = useState(false)
  const [activeTool, setActiveTool] = useState<ActiveTool>(null)
  const [isToolMinimized, setIsToolMinimized] = useState(false)
  const [scenarioNotice, setScenarioNotice] = useState<string | null>(null)

  // Preserve map data identity when only page controls change.
  const developments = useMemo(
    () => (comparison?.scenario?.developments ?? []).map(normalizeDevelopment),
    [comparison?.scenario?.developments],
  )

  // Visual choices stay available even when a saved simulation includes no proposals.
  const proposalOptions = useMemo(() => mapProposals(developments), [developments])

  const handleScenarioChange = (updated: Scenario) => {
    setComparison((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        scenario: updated,
      }
    })
    setScenarioNotice(
      `Scenario updated: ${updated.demand_case.toUpperCase()} demand tier (${
        updated.demand_case === 'low' ? '3/win' : updated.demand_case === 'central' ? '5/win' : '7/win'
      })`
    )
    setTimeout(() => {
      setScenarioNotice(null)
    }, 4000)
  }

  useEffect(() => {
    void getSimulations().catch(() => {})
  }, [])

  useEffect(() => {
    if (saved.loading) return
    const selected = saved.history.find(value => value.id === saved.activeId)
    const batch = selected?.batch ?? todayBaseline
    if (loadedBatchId.current === batch.id) return
    loadedBatchId.current = batch.id
    const data = mapComparison(batch)
    setComparison(data)
    setBuildingViewRequest(null)
    setPlatformViewRequest(null)
    setVisibleProposalIds(data.scenario.developments.map(dev => dev.id))
    setSelectedStop(previous => {
      const retained = data.corridor.stops.find(value => normalizeStop(value).stop_id === previous?.stop_id)
      return normalizeStop(retained ?? data.corridor.stops[4] ?? data.corridor.stops[0])
    })
    setSelectedDev(null)
  }, [saved.activeId, saved.history, saved.loading])

  if (loading || !comparison) {
    return (
      <div className="flex items-center justify-center h-screen w-screen bg-background text-muted-foreground">
        <div className="text-center">
          <div
            className="text-4xl text-foreground mb-2"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            Urbanova<sup className="text-xs">®</sup>
          </div>
          <div className="text-sm font-body text-muted-foreground">
            Loading corridor simulation workspace...
          </div>
        </div>
      </div>
    )
  }

  const stops = (comparison.corridor?.stops ?? []).map(normalizeStop)
  const activeDemandCase = comparison.scenario?.demand_case ?? 'central'
  const currentCase =
    comparison.cases.find((c) => c.kind === 'current' && c.demand_case === activeDemandCase) ??
    comparison.cases.find((c) => c.kind === 'current')
  const growthCase =
    comparison.cases.find((c) => c.kind === 'growth' && c.demand_case === activeDemandCase) ??
    comparison.cases.find((c) => c.kind === 'growth')
  const supportedCase =
    comparison.cases.find((c) => c.kind === 'supported_growth' && c.demand_case === activeDemandCase) ??
    comparison.cases.find((c) => c.kind === 'supported_growth')

  return (
    <div
      className="flex flex-col w-screen h-screen overflow-hidden bg-background text-foreground font-body transition-colors duration-500"
    >
      {/* Dynamic Scenario Change Notification */}
      {scenarioNotice && (
        <div
          role="status"
          className="fixed top-20 left-1/2 -translate-x-1/2 z-50 animate-fade-rise bg-purple-950/90 text-purple-100 border border-purple-500/60 rounded-full px-5 py-2 shadow-2xl backdrop-blur-md flex items-center gap-2.5 text-xs font-mono"
        >
          <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse shadow-[0_0_8px_#c084fc]" />
          <span>{scenarioNotice}</span>
          <button
            type="button"
            onClick={() => setScenarioNotice(null)}
            className="ml-2 text-purple-300 hover:text-white"
          >
            ✕
          </button>
        </div>
      )}

      {/* Slim Header: Urbanova (Left), 505 Dundas Corridor (Center), Toggle (Right) */}
      <header className="relative z-20 w-full bg-background/80 backdrop-blur-md border-b border-border/40 shrink-0">
        <div className="flex items-center justify-between px-6 py-2.5 w-full">
          {/* Left: Back to Policy Briefing + Urbanova Logo */}
          <div className="flex items-center gap-3 min-w-[200px]">
            {onNavigate && (
              <button
                type="button"
                onClick={() => onNavigate('/')}
                className="liquid-glass rounded-full px-3 py-1 text-xs text-muted-foreground hover:text-foreground flex items-center gap-1.5 hover:scale-[1.02] transition-all cursor-pointer mr-1"
                title="Return to Contract & Policy Briefing"
              >
                <span>←</span>
                <span>Policy Briefing</span>
              </button>
            )}
            <span
              className="text-2xl md:text-3xl tracking-tight text-foreground select-none cursor-pointer"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              Urbanova<sup className="text-xs">®</sup>
            </span>
            {usingFixture && (
              <span
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30"
                title="Fixture mode is active."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>FIXTURE</span>
              </span>
            )}
          </div>

          {/* Center: 505 Dundas Streetcar Corridor */}
          <div className="text-center flex-1 px-4">
            <h1
              className="text-xl md:text-2xl lg:text-3xl text-foreground font-normal tracking-tight leading-tight"
              style={{ fontFamily: "'Instrument Serif', serif" }}
            >
              505 Dundas Streetcar Corridor
            </h1>
            <p className="text-[11px] text-muted-foreground hidden md:block">
              {saved.history.find(value => value.id === saved.activeId)?.name ?? 'Today baseline'} · {configurationSummary(saved.history.find(value => value.id === saved.activeId)?.batch ?? todayBaseline)}
            </p>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center justify-end gap-2 min-w-[140px]">
            <SimulationPicker label="Past sims" history={saved.history} loading={saved.loading} error={saved.error}
              onToday={() => setActiveSimulation(null)} onSelect={simulation => setActiveSimulation(simulation.id)} />
            <button
              type="button"
              onClick={() => onNavigate?.('/analysis')}
              className="liquid-glass rounded-full px-3.5 py-1.5 text-xs text-foreground/90 hover:text-foreground flex items-center gap-1.5 hover:scale-[1.02] transition-all cursor-pointer shadow-sm"
            >
              <span>Run simulation</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace Area: 3D Map + Overlay Inspector */}
      <main className="relative flex-1 min-h-0 w-full overflow-hidden">
        <CorridorMap
          corridor={comparison.corridor}
          developments={proposalOptions}
          visibleDevIds={visibleProposalIds}
          onToggleDevelopment={id => setVisibleProposalIds(previous => previous.includes(id)
            ? previous.filter(value => value !== id) : [...previous, id])}
          selectedStopId={selectedStop?.stop_id}
          platformViewRequest={platformViewRequest}
          buildingViewRequest={buildingViewRequest}
          selectedDevId={selectedDev?.dev_id}
          activePhase={activePhase}
          shadowsEnabled={shadowsEnabled}
          onToggleShadows={setShadowsEnabled}
          hideAllPopups={hideAllPopups}
          onSelectStop={(stop) => {
                setBuildingViewRequest(null)
                setPlatformViewRequest(null)
            setSelectedStop(normalizeStop(stop))
            setSelectedDev(null)
            setIsStopMinimized(false)
          }}
          onSelectDevelopment={(dev) => {
            setBuildingViewRequest(null)
            setPlatformViewRequest(null)
            setSelectedDev(normalizeDevelopment(dev))
            setSelectedStop(null)
            setIsDevMinimized(false)
          }}
        />

        {/* Lane D Active Tool Panel (Top Left, Floating Non-overlapping) */}
        {activeTool && !hideAllPopups && (
          <div className="!absolute top-6 left-6 z-30 max-w-[calc(100vw-3rem)]">
            {activeTool === 'compare' && (
              <CaseCompare
                comparison={comparison}
                selectedDemandCase={activeDemandCase}
                onDemandCaseChange={(dc) => {
                  handleScenarioChange({
                    ...comparison.scenario,
                    demand_case: dc,
                  })
                }}
                isMinimized={isToolMinimized}
                onToggleMinimize={() => setIsToolMinimized((p) => !p)}
                onClose={() => setActiveTool(null)}
              />
            )}
            {activeTool === 'replay' && (
              <ReplaySpine
                replay={comparison.replay}
                stops={stops}
                isMinimized={isToolMinimized}
                onToggleMinimize={() => setIsToolMinimized((p) => !p)}
                onClose={() => setActiveTool(null)}
                onSelectStop={(id) => {
                  const s = stops.find((st) => st.stop_id === id)
                  if (s) {
                    setSelectedStop(s)
                    setSelectedDev(null)
                  }
                }}
              />
            )}
            {activeTool === 'scenario' && (
              <ScenarioEditor
                scenario={comparison.scenario}
                assumptions={comparison.assumptions}
                onScenarioChange={handleScenarioChange}
                isMinimized={isToolMinimized}
                onToggleMinimize={() => setIsToolMinimized((p) => !p)}
                onClose={() => setActiveTool(null)}
              />
            )}
            {activeTool === 'packages' && (
              <PackageTable
                comparison={comparison}
                selectedDemandCase={activeDemandCase}
                isMinimized={isToolMinimized}
                onToggleMinimize={() => setIsToolMinimized((p) => !p)}
                onClose={() => setActiveTool(null)}
              />
            )}
            {activeTool === 'sensitivity' && (
              <Sensitivity
                comparison={comparison}
                isMinimized={isToolMinimized}
                onToggleMinimize={() => setIsToolMinimized((p) => !p)}
                onClose={() => setActiveTool(null)}
                onSelectStop={(id) => {
                  const s = stops.find((st) => st.stop_id === id)
                  if (s) {
                    setSelectedStop(s)
                    setSelectedDev(null)
                  }
                }}
              />
            )}
            {activeTool === 'evidence' && (
              <Evidence
                comparison={comparison}
                isMinimized={isToolMinimized}
                onToggleMinimize={() => setIsToolMinimized((p) => !p)}
                onClose={() => setActiveTool(null)}
              />
            )}
            {activeTool === 'ask' && (
              <AskBox
                scenario={comparison.scenario}
                isMinimized={isToolMinimized}
                onToggleMinimize={() => setIsToolMinimized((p) => !p)}
                onClose={() => setActiveTool(null)}
              />
            )}
          </div>
        )}

        {/* Selected Development Panel (Lane D4 - Top Right) */}
        {selectedDev && !hideAllPopups && (
          <div className="!absolute top-6 right-6 z-30">
            <DevelopmentPanel
              development={selectedDev}
              onViewBuilding={() => {
                setPlatformViewRequest(null)
                setBuildingViewRequest(previous => ({ devId: selectedDev.dev_id, requestId: (previous?.requestId ?? 0) + 1 }))
              }}
              stops={stops}
              isMinimized={isDevMinimized}
              onToggleMinimize={() => setIsDevMinimized((prev) => !prev)}
              onClose={() => setSelectedDev(null)}
              onSelectStop={(stop) => {
                setBuildingViewRequest(null)
                setPlatformViewRequest(null)
                setSelectedStop(normalizeStop(stop))
                setSelectedDev(null)
                setIsStopMinimized(false)
              }}
            />
          </div>
        )}

        {/* Selected Stop Panel (Lane D5 - Top Right) */}
        {selectedStop && !selectedDev && !hideAllPopups && (
          <div className="!absolute top-6 right-6 z-30">
            <StopPanel
              stop={selectedStop}
              onViewPlatform={() => {
                setBuildingViewRequest(null)
                setPlatformViewRequest(previous => ({ stopId: selectedStop.stop_id, requestId: (previous?.requestId ?? 0) + 1 }))
              }}
              stops={stops}
              developments={developments}
              currentCase={currentCase}
              growthCase={growthCase}
              supportedCase={supportedCase}
              comparison={comparison}
              isMinimized={isStopMinimized}
              onToggleMinimize={() => setIsStopMinimized((prev) => !prev)}
              onClose={() => setSelectedStop(null)}
              onSelectDevelopment={(dev) => {
                setBuildingViewRequest(null)
                setPlatformViewRequest(null)
                setSelectedDev(normalizeDevelopment(dev))
                setSelectedStop(null)
                setIsDevMinimized(false)
              }}
            />
          </div>
        )}

        {/* Lane D Integrated Tools Dock (Bottom Center) */}
        {!hideAllPopups && (
          <nav
            aria-label="Corridor Workspace Tools"
            className="!absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 liquid-glass rounded-full px-3 py-1.5 shadow-2xl border border-border/40 backdrop-blur-md"
          >
            <button
              type="button"
              data-testid="tool-btn-compare"
              onClick={() => {
                setActiveTool(activeTool === 'compare' ? null : 'compare')
                setIsToolMinimized(false)
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTool === 'compare'
                  ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60 font-semibold'
                  : 'text-foreground/90 hover:bg-white/10'
              }`}
            >
              <span>📊</span>
              <span className="hidden sm:inline">Compare</span>
            </button>

            <button
              type="button"
              data-testid="tool-btn-replay"
              onClick={() => {
                setActiveTool(activeTool === 'replay' ? null : 'replay')
                setIsToolMinimized(false)
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTool === 'replay'
                  ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60 font-semibold'
                  : 'text-foreground/90 hover:bg-white/10'
              }`}
            >
              <span>⏱️</span>
              <span className="hidden sm:inline">Replay</span>
            </button>

            <button
              type="button"
              data-testid="tool-btn-scenario"
              onClick={() => {
                setActiveTool(activeTool === 'scenario' ? null : 'scenario')
                setIsToolMinimized(false)
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTool === 'scenario'
                  ? 'bg-purple-500/30 text-purple-200 border border-purple-400/60 font-semibold'
                  : 'text-foreground/90 hover:bg-white/10'
              }`}
            >
              <span>⚙️</span>
              <span className="hidden sm:inline">Scenario</span>
            </button>

            <button
              type="button"
              data-testid="tool-btn-packages"
              onClick={() => {
                setActiveTool(activeTool === 'packages' ? null : 'packages')
                setIsToolMinimized(false)
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTool === 'packages'
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/60 font-semibold'
                  : 'text-foreground/90 hover:bg-white/10'
              }`}
            >
              <span>📦</span>
              <span className="hidden sm:inline">Packages</span>
            </button>

            <button
              type="button"
              data-testid="tool-btn-sensitivity"
              onClick={() => {
                setActiveTool(activeTool === 'sensitivity' ? null : 'sensitivity')
                setIsToolMinimized(false)
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTool === 'sensitivity'
                  ? 'bg-amber-500/30 text-amber-200 border border-amber-400/60 font-semibold'
                  : 'text-foreground/90 hover:bg-white/10'
              }`}
            >
              <span>📈</span>
              <span className="hidden sm:inline">Sensitivity</span>
            </button>

            <button
              type="button"
              data-testid="tool-btn-evidence"
              onClick={() => {
                setActiveTool(activeTool === 'evidence' ? null : 'evidence')
                setIsToolMinimized(false)
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTool === 'evidence'
                  ? 'bg-emerald-500/30 text-emerald-200 border border-emerald-400/60 font-semibold'
                  : 'text-foreground/90 hover:bg-white/10'
              }`}
            >
              <span>🏛️</span>
              <span className="hidden sm:inline">Evidence</span>
            </button>

            <button
              type="button"
              data-testid="tool-btn-ask"
              onClick={() => {
                setActiveTool(activeTool === 'ask' ? null : 'ask')
                setIsToolMinimized(false)
              }}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTool === 'ask'
                  ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60 font-semibold'
                  : 'text-foreground/90 hover:bg-white/10'
              }`}
            >
              <span>🤖</span>
              <span className="hidden sm:inline">Copilot</span>
            </button>

            <button
              type="button"
              data-testid="tool-btn-list"
              onClick={() => (onNavigate ? onNavigate('/list') : (window.location.pathname = '/list'))}
              className="px-2.5 py-1 rounded-full text-xs font-medium text-foreground/90 hover:bg-white/10 transition-all flex items-center gap-1.5 cursor-pointer border-l border-border/40 pl-2.5"
              title="Switch to accessible 2D List view alternative"
            >
              <span>📋</span>
              <span className="hidden sm:inline">2D List</span>
            </button>
          </nav>
        )}
      </main>
    </div>
  )
}
export default CorridorMapPage
