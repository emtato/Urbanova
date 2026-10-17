import { useEffect, useState } from 'react'
import { fetchComparison, isUsingFixture, setUseFixture } from '../lib/api'
import type { Comparison, Scenario } from '../lib/types'
import {
  type CorridorStop,
  type CorridorDevelopment,
  normalizeStop,
  normalizeDevelopment,
} from '../map/types'
import { CorridorMap } from '../map/CorridorMap'
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
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedStop, setSelectedStop] = useState<CorridorStop | null>(null)
  const [selectedDev, setSelectedDev] = useState<CorridorDevelopment | null>(null)
  const [usingFixture, setUsingFixtureState] = useState(isUsingFixture())
  const [activePhase] = useState<number>(2)
  const [showDrawer, setShowDrawer] = useState(false)
  const [showFixturePopup, setShowFixturePopup] = useState(true)
  const [shadowsEnabled, setShadowsEnabled] = useState(false)
  const [hideAllPopups, setHideAllPopups] = useState(false)
  const [isStopMinimized, setIsStopMinimized] = useState(false)
  const [isDevMinimized, setIsDevMinimized] = useState(false)
  const [activeTool, setActiveTool] = useState<ActiveTool>(null)
  const [isToolMinimized, setIsToolMinimized] = useState(false)
  const [scenarioNotice, setScenarioNotice] = useState<string | null>(null)

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
    loadData()
  }, [])

  const loadData = async () => {
    try {
      setLoading(true)
      const data = await fetchComparison()
      setComparison(data)
      if (data.corridor.stops.length > 0) {
        setSelectedStop(normalizeStop(data.corridor.stops[4])) // Default to Sumach / Regent Park
      }
    } catch (err) {
      console.error('Failed to load comparison data:', err)
    } finally {
      setLoading(false)
    }
  }

  const toggleFixtureMode = () => {
    const nextState = !usingFixture
    setUseFixture(nextState)
    setUsingFixtureState(nextState)
    loadData()
  }

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

  const developments = (comparison.scenario?.developments ?? []).map(normalizeDevelopment)
  const stops = (comparison.corridor?.stops ?? []).map(normalizeStop)
  const totalNewUnits = developments.reduce((sum, d) => sum + d.units, 0)
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
      className={`flex flex-col w-screen h-screen overflow-hidden ${
        shadowsEnabled ? 'theme-sunlight bg-amber-50/20 text-slate-900' : 'bg-background text-foreground'
      } font-body transition-colors duration-500`}
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

      {/* Floating Fixture Mode Alert Popup */}
      {usingFixture && showFixturePopup && !hideAllPopups && (
        <div
          role="status"
          className="fixed bottom-6 right-6 z-50 max-w-md animate-fade-rise bg-amber-950/90 text-amber-100 border border-amber-500/60 rounded-2xl p-4 shadow-2xl backdrop-blur-md flex flex-col sm:flex-row sm:items-center justify-between gap-3"
        >
          <div className="flex items-start gap-3">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse mt-1 shrink-0 shadow-[0_0_8px_#fbbf24]" />
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-amber-300">
                Fixture Mode Active
              </div>
              <div className="text-xs text-amber-100/90 mt-0.5 font-normal">
                505 Dundas Baseline Dataset (Broadview to Yonge)
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
            <button
              type="button"
              onClick={toggleFixtureMode}
              className="liquid-glass rounded-full px-3 py-1.5 text-xs text-foreground hover:scale-[1.03] transition-transform font-medium cursor-pointer"
            >
              Switch to Live API
            </button>
            <button
              type="button"
              onClick={() => setShowFixturePopup(false)}
              className="p-1 rounded-full text-amber-300/80 hover:text-white hover:bg-amber-800/40 transition-colors cursor-pointer text-sm"
              title="Dismiss popup"
              aria-label="Dismiss popup"
            >
              ✕
            </button>
          </div>
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
              <button
                type="button"
                onClick={() => setShowFixturePopup(true)}
                className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25 transition-all cursor-pointer"
                title="Fixture mode is active. Click to view alert."
              >
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                <span>FIXTURE</span>
              </button>
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
              Housing Growth &amp; Transit Readiness · Broadview Station to Yonge-Dundas
            </p>
          </div>

          {/* Right: Toggle Button for 3D Towers & Stats */}
          <div className="flex items-center justify-end min-w-[140px]">
            <button
              type="button"
              onClick={() => setShowDrawer((prev) => !prev)}
              className="liquid-glass rounded-full px-3.5 py-1.5 text-xs text-foreground/90 hover:text-foreground flex items-center gap-2 hover:scale-[1.02] transition-all cursor-pointer shadow-sm"
              aria-expanded={showDrawer}
              aria-label="Toggle corridor details and 3D towers"
            >
              <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_6px_#22d3ee]" />
              <span className="font-medium">
                {showDrawer ? 'Hide Details' : '3D Towers & Data'}
              </span>
              <svg
                className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-300 ${
                  showDrawer ? 'rotate-180' : ''
                }`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Animated Collapsible Drawer for 3D Towers & Corridor Data */}
        <div
          className={`overflow-hidden transition-all duration-300 ease-in-out border-t ${
            showDrawer
              ? 'max-h-40 opacity-100 border-border/30 bg-background/60 py-2.5'
              : 'max-h-0 opacity-0 border-transparent py-0 pointer-events-none'
          }`}
        >
          <div className="px-6 flex flex-col lg:flex-row items-center justify-between gap-4">
            {/* 3D Towers Selector */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground mr-1 font-medium">
                3D Towers:
              </span>
              {developments.map((dev) => {
                const isSelected = selectedDev?.dev_id === dev.dev_id
                const isP1 = dev.dev_id === 'toronto-app-22-124214-ste-13-oz'
                return (
                  <button
                    key={dev.dev_id}
                    type="button"
                    onClick={() => {
                      setSelectedDev(dev)
                      setSelectedStop(null)
                      setIsDevMinimized(false)
                    }}
                    className={`liquid-glass rounded-full px-3.5 py-1.5 text-xs transition-all flex items-center gap-2 cursor-pointer ${
                      isSelected
                        ? isP1
                          ? 'bg-cyan-500/30 text-cyan-200 border border-cyan-400/60 shadow-lg scale-105 font-medium'
                          : 'bg-amber-500/30 text-amber-200 border border-amber-400/60 shadow-lg scale-105 font-medium'
                        : 'hover:scale-[1.02] text-foreground/90'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isP1
                          ? 'bg-cyan-400 shadow-[0_0_8px_#22d3ee]'
                          : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                      }`}
                    />
                    <span>{dev.address.replace(' DUNDAS ST E', ' Dundas')}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({dev.units.toLocaleString()}u)
                    </span>
                  </button>
                )
              })}
            </div>

            {/* Corridor Metrics Pills */}
            <div className="flex items-center gap-6 text-xs border-t lg:border-t-0 lg:border-l border-border/40 pt-2 lg:pt-0 lg:pl-6">
              <div>
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
                  Peak Window
                </div>
                <div className="font-mono font-medium text-foreground">07:00–09:00</div>
              </div>
              <div className="border-l border-border/40 pl-6">
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
                  New Homes (P1+P2)
                </div>
                <div className="font-mono font-medium text-amber-300">
                  {totalNewUnits.toLocaleString()} units
                </div>
              </div>
              <div className="border-l border-border/40 pl-6">
                <div className="text-[10px] tracking-wider uppercase text-muted-foreground">
                  Corridor Reach
                </div>
                <div className="font-mono font-medium text-foreground">
                  {comparison.corridor.stops.length} stops
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Workspace Area: 3D Map + Overlay Inspector */}
      <main className="relative flex-1 min-h-0 w-full overflow-hidden">
        <CorridorMap
          corridor={comparison.corridor}
          developments={developments}
          selectedStopId={selectedStop?.stop_id}
          selectedDevId={selectedDev?.dev_id}
          activePhase={activePhase}
          shadowsEnabled={shadowsEnabled}
          onToggleShadows={setShadowsEnabled}
          hideAllPopups={hideAllPopups}
          onToggleHideAllPopups={() => setHideAllPopups((prev) => !prev)}
          onSelectStop={(stop) => {
            setSelectedStop(normalizeStop(stop))
            setSelectedDev(null)
            setIsStopMinimized(false)
          }}
          onSelectDevelopment={(dev) => {
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
              stops={stops}
              isMinimized={isDevMinimized}
              onToggleMinimize={() => setIsDevMinimized((prev) => !prev)}
              onClose={() => setSelectedDev(null)}
              onSelectStop={(stop) => {
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
              stops={stops}
              developments={developments}
              currentCase={currentCase}
              growthCase={growthCase}
              supportedCase={supportedCase}
              berths={comparison.corridor?.berths_per_stop?.[selectedStop.stop_id] ?? 1}
              isMinimized={isStopMinimized}
              onToggleMinimize={() => setIsStopMinimized((prev) => !prev)}
              onClose={() => setSelectedStop(null)}
              onSelectDevelopment={(dev) => {
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
