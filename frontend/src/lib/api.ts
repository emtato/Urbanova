import { sampleComparison } from './sampleComparison'
import type { Comparison, Corridor, ReplayEvent, Scenario } from './types'
import type { NativeBatch, NativeMetrics, NativeReplay, PackagePolicy, RunSimulationRequest, ScenarioPatch, AnalysisSummary } from './liveTypes'

let runtimeUseFixture = import.meta.env.VITE_USE_FIXTURE !== 'false'
export const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
let latestComparisonId: string | undefined
export const isUsingFixture = () => runtimeUseFixture
export const setUseFixture = (value: boolean) => { runtimeUseFixture = value }
const clone = <T,>(value: T): T => structuredClone(value)

export async function apiRequest<T>(path: string, body?: unknown, signal?: AbortSignal): Promise<T> {
  const timeoutMs = path === '/run/simulation' ? 120000 : 30000
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { Accept: 'application/json', ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body), signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(timeoutMs)]) : AbortSignal.timeout(timeoutMs),
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(`HTTP ${response.status}: ${error.error || error.message || error.detail || response.statusText}${error.details ? ` ${JSON.stringify(error.details)}` : ''}`)
  }
  return response.json() as Promise<T>
}

function nativeBatchResponse(batch: NativeBatch): NativeBatch {
  if (!batch || typeof batch.id !== 'string' || !batch.id || !batch.overall_results || !Array.isArray(batch.individual_results) || batch.individual_results.length !== batch.overall_results.run_count) {
    throw Error('Invalid native simulation batch')
  }
  return batch
}

export async function runSimulation(input: RunSimulationRequest = {}, signal?: AbortSignal): Promise<NativeBatch> {
  return nativeBatchResponse(await apiRequest<NativeBatch>('/run/simulation', input, signal))
}

export async function getSimulations(signal?: AbortSignal): Promise<NativeBatch[]> {
  const list = await apiRequest<NativeBatch[]>('/sim/fetch', undefined, signal)
  if (!Array.isArray(list)) throw Error('Invalid simulations list response')
  return list.map(nativeBatchResponse)
}

export async function deleteSimulation(id: string, signal?: AbortSignal): Promise<{ id: string; deleted: boolean }> {
  if (!id || typeof id !== 'string') throw Error('Simulation ID is required')
  return apiRequest<{ id: string; deleted: boolean }>('/sim/delete', { id }, signal)
}

function comparisonResponse(value: Comparison) {
  if (!['2.0.0', '3.0.0'].includes(value.contract_version) || typeof value.fixture !== 'boolean' || !Array.isArray(value.cases) || !value.scenario || !value.corridor) throw Error('Unsupported comparison response')
  if (value.contract_version === '3.0.0' && (value.fixture || value.cases.some(result => {
    const batch = result as import('./liveTypes').NativeCaseResult
    return !batch.overall_results || !Array.isArray(batch.individual_results) || batch.individual_results.length !== batch.overall_results.run_count
  }))) throw Error('Invalid native simulation batch')
  return value
}

export async function fetchComparison(comparisonId?: string): Promise<Comparison> {
  if (runtimeUseFixture) return clone(sampleComparison)
  const id = comparisonId ?? latestComparisonId
  if (!id) return runAnalysis({})
  return comparisonResponse(await apiRequest<Comparison>(`/results/${encodeURIComponent(id)}`))
}

export async function fetchCorridor(_corridorId?: string): Promise<Corridor> {
  return runtimeUseFixture ? clone(sampleComparison.corridor) : apiRequest<Corridor>('/corridor')
}

export async function fetchNativeReplay(comparisonId: string, signal?: AbortSignal): Promise<NativeReplay> {
  const replay = await apiRequest<NativeReplay>(`/replay/${encodeURIComponent(comparisonId)}`, undefined, signal)
  if (replay.format_version !== 'b11-events-v1' || replay.comparison_id !== comparisonId || !Array.isArray(replay.events) || !Array.isArray(replay.stops)) throw Error('Unsupported B11 replay response')
  return replay
}

export async function fetchNativeMetrics(comparisonId: string, signal?: AbortSignal): Promise<NativeMetrics> {
  const metrics = await apiRequest<NativeMetrics>(`/results/${encodeURIComponent(comparisonId)}/b11-metrics`, undefined, signal)
  if (metrics.format_version !== 'b11-metrics-v1' || metrics.comparison_id !== comparisonId || !Array.isArray(metrics.runs)) throw Error('Unsupported B11 metrics response')
  return metrics
}

export async function fetchReplayStream(comparisonId?: string): Promise<ReplayEvent[]> {
  if (runtimeUseFixture) return clone(sampleComparison.replay?.events ?? [])
  if (!comparisonId) throw Error('A comparison ID is required to load replay')
  const replay = await apiRequest<{ format_version?: string; events: ReplayEvent[] }>(`/replay/${encodeURIComponent(comparisonId)}`)
  if (replay.format_version) throw Error('Use the B11 replay viewer for native replay events')
  return replay.events
}

export interface RunOptions {
  policy?: PackagePolicy; seed_ids?: number[]; draws_id?: string; retain_replay?: boolean
  signal?: AbortSignal; onProgress?: (status: string) => void
}

export async function runAnalysis(patch: ScenarioPatch, options: RunOptions = {}): Promise<Comparison> {
  const { signal, onProgress } = options
  onProgress?.('Saving scenario')
  let scenario = await apiRequest<Scenario>('/scenarios', { scenario_id: `web-${crypto.randomUUID()}` }, signal)
  if (Object.keys(patch).length) scenario = await apiRequest<Scenario>(`/scenarios/${scenario.scenario_id}/patch`, { version: scenario.version, patch }, signal)
  let job = await apiRequest<{ job_id: string; status: string; comparison_id: string | null; error: string | null; stale: boolean }>('/jobs', {
    scenario_id: scenario.scenario_id, version: scenario.version,
    random: { seed_ids: options.seed_ids ?? [42], draws_id: options.draws_id ?? 'web-paired-v1' },
    retain_replay: options.retain_replay ?? true, evaluator: 'b11', ...(options.policy ? { policy: options.policy } : {}),
  }, signal)
  const deadline = Date.now() + 11 * 60 * 1000
  while (job.status === 'queued' || job.status === 'running') {
    onProgress?.(job.status === 'queued' ? 'Queued' : 'Running B11 packages and delay sensitivity')
    if (Date.now() > deadline) throw Error(`Polling timed out. Job ${job.job_id} may still finish on the server.`)
    await new Promise<void>((resolve, reject) => {
      if (signal?.aborted) { reject(signal.reason); return }
      const abort = () => { clearTimeout(timer); reject(signal?.reason) }
      const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 1000)
      signal?.addEventListener('abort', abort, { once: true })
    })
    job = await apiRequest<typeof job>(`/jobs/${job.job_id}`, undefined, signal)
  }
  if (job.status !== 'completed' || !job.comparison_id) throw Error(job.error || 'Simulation did not complete')
  if (job.stale) throw Error('Result became stale while running; submit the scenario again')
  const result = comparisonResponse(await apiRequest<Comparison>(`/results/${job.comparison_id}`, undefined, signal))
  if (result.fixture) throw Error('The server returned a fixture for a real simulation request')
  latestComparisonId = job.comparison_id
  onProgress?.('Completed')
  return result
}

export async function runScenario(patch: Partial<Scenario>): Promise<Comparison> {
  if (runtimeUseFixture) { const base = clone(sampleComparison); return { ...base, fixture: true, scenario: { ...base.scenario, ...patch } } }
  const allowed = ['demand_case', 'capital_budget_cad', 'annual_operating_budget_cad', 'fleet_allowance', 'planning_criterion']
  if (Object.keys(patch).some(key => !allowed.includes(key))) throw Error('Use reviewed phase/site patch IDs to change housing or phase years')
  return runAnalysis(patch as ScenarioPatch)
}

export const fetchSummary = (id: string, signal?: AbortSignal) => apiRequest<AnalysisSummary>(`/results/${encodeURIComponent(id)}/summary`, undefined, signal)
export async function checkBackendHealth(): Promise<{ ok: boolean; status?: string; message?: string }> {
  try { const health = await apiRequest<{ status: string; database?: string }>('/health', undefined, AbortSignal.timeout(5000)); return health.status === 'ok' && health.database === 'ok' ? { ok: true, status: health.status } : { ok: false, message: 'Current Express API and database readiness have not been confirmed.' } }
  catch (error) { return { ok: false, message: error instanceof Error ? error.message : 'Backend unreachable' } }
}
