/**
 * FutureProof Frontend API Client (Lane D1)
 *
 * Implements "Fixture first, real base URL behind VITE_USE_FIXTURE".
 * Default mode returns sample_comparison fixture. Flipping VITE_USE_FIXTURE=false
 * routes calls to the backend on /api.
 */

import { sampleComparison } from './sampleComparison'
import type { Comparison, Corridor, ReplayEvent, Scenario } from './types'

// Check environment variable; defaults to true if not explicitly set to 'false'
const ENV_USE_FIXTURE = import.meta.env.VITE_USE_FIXTURE !== 'false'
let runtimeUseFixture: boolean = ENV_USE_FIXTURE

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

/**
 * Returns whether the application is currently reading from the fixture
 */
export function isUsingFixture(): boolean {
  return runtimeUseFixture
}

/**
 * Allows toggling fixture mode at runtime (e.g. for demo mode toggle)
 */
export function setUseFixture(useFixture: boolean): void {
  runtimeUseFixture = useFixture
}

/**
 * Helper to produce deep clones of fixture objects so consumers cannot mutate cached fixtures
 */
function cloneFixture<T>(data: T): T {
  return JSON.parse(JSON.stringify(data)) as T
}

/**
 * Fetches the active comparison analysis (scenario, corridor, packages, results, sensitivity)
 */
export async function fetchComparison(scenarioId?: string): Promise<Comparison> {
  if (runtimeUseFixture) {
    const fixtureData = cloneFixture(sampleComparison as unknown as Comparison)
    return {
      ...fixtureData,
      fixture: true,
    }
  }

  const endpoint = scenarioId
    ? `${API_BASE_URL}/scenarios/${encodeURIComponent(scenarioId)}/comparison`
    : `${API_BASE_URL}/results/comparison`

  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch comparison from backend: ${response.status} ${response.statusText}`
    )
  }

  const data = (await response.json()) as Comparison
  return {
    ...data,
    fixture: false,
  }
}

/**
 * Fetches corridor metadata (stops, links, geometry, berths)
 */
export async function fetchCorridor(corridorId?: string): Promise<Corridor> {
  if (runtimeUseFixture) {
    return cloneFixture((sampleComparison as unknown as Comparison).corridor)
  }

  const endpoint = corridorId
    ? `${API_BASE_URL}/corridor/${encodeURIComponent(corridorId)}`
    : `${API_BASE_URL}/corridor`

  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch corridor from backend: ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<Corridor>
}

/**
 * Fetches the discrete event replay stream for moving vehicles and stop queues
 */
export async function fetchReplayStream(runId?: string): Promise<ReplayEvent[]> {
  if (runtimeUseFixture) {
    return cloneFixture((sampleComparison as unknown as Comparison).replay?.events || [])
  }

  const endpoint = runId
    ? `${API_BASE_URL}/replay?run_id=${encodeURIComponent(runId)}`
    : `${API_BASE_URL}/replay`

  const response = await fetch(endpoint, {
    headers: { Accept: 'application/json' },
  })

  if (!response.ok) {
    throw new Error(
      `Failed to fetch replay events from backend: ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<ReplayEvent[]>
}

/**
 * Submits scenario modifications for simulation
 */
export async function runScenario(scenarioPatch: Partial<Scenario>): Promise<Comparison> {
  if (runtimeUseFixture) {
    // In fixture mode, return fixture with applied overlay for immediate interactive testing
    const base = cloneFixture(sampleComparison as unknown as Comparison)
    return {
      ...base,
      fixture: true,
      scenario: {
        ...base.scenario,
        ...scenarioPatch,
      },
    }
  }

  const response = await fetch(`${API_BASE_URL}/scenarios/run`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(scenarioPatch),
  })

  if (!response.ok) {
    throw new Error(
      `Failed to run scenario on backend: ${response.status} ${response.statusText}`
    )
  }

  return response.json() as Promise<Comparison>
}

/**
 * Pings backend health endpoint
 */
export async function checkBackendHealth(): Promise<{ ok: boolean; status?: string; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      signal: AbortSignal.timeout(3000),
    })
    if (!response.ok) {
      return { ok: false, status: `HTTP ${response.status}` }
    }
    const data = await response.json()
    return { ok: true, status: data.status || 'ok' }
  } catch (err: unknown) {
    return {
      ok: false,
      message: err instanceof Error ? err.message : 'Backend unreachable',
    }
  }
}
