import type { RunSimulationRequest } from './liveTypes'
import { BASELINE_HEADWAY_S, isBaseline } from './serviceOptions'

export type AnalysisCaseRole = 'baseline' | 'growth' | 'selected'
export interface AnalysisCase { role: AnalysisCaseRole; label: string; request: RunSimulationRequest }

/** Isolate housing growth first, then isolate any service change with housing fixed. */
export function planAnalysisCases(request: RunSimulationRequest & { headway_s: number; development_ids: string[] }): AnalysisCase[] {
  const cases: AnalysisCase[] = [{
    role: 'baseline', label: 'Existing homes · current service',
    request: { ...request, development_ids: [], headway_s: BASELINE_HEADWAY_S },
  }]
  if (request.development_ids.length) cases.push({
    role: 'growth', label: 'New homes · current service',
    request: { ...request, headway_s: BASELINE_HEADWAY_S },
  })
  if (!isBaseline(request.headway_s)) cases.push({
    role: 'selected', label: `${request.development_ids.length ? 'New' : 'Existing'} homes · chosen service`, request: { ...request },
  })
  return cases
}
