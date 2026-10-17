import { useEffect, useState } from 'react'
import type { NativeBatch, NativeCaseResult } from './liveTypes'
import type { Comparison } from './types'
import { sampleComparison } from './sampleComparison'
import baselineData from '../data/today_baseline.json'
export interface SavedSimulation {
  id: string
  name: string
  createdAt: string | null
  batch: NativeBatch
}
export const todayBaseline = baselineData.batch as unknown as NativeBatch
export const todayDate = baselineData.serviceDate
const listeners = new Set<() => void>()
const notify = () => listeners.forEach(listener => listener())
let database: Promise<IDBDatabase> | undefined
function db() {
  database ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open('urbanova-simulation-history', 1)
    request.onupgradeneeded = () => request.result.createObjectStore('simulations', { keyPath: 'id' })
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(new Error('Could not open saved simulations.'))
  })
  return database
}
async function transaction<T>(mode: IDBTransactionMode, action: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const database = await db()
  return new Promise((resolve, reject) => {
    const tx = database.transaction('simulations', mode)
    const request = action(tx.objectStore('simulations'))
    tx.oncomplete = () => resolve(request.result)
    tx.onerror = () => reject(tx.error ?? new Error('Could not save simulation history.'))
    tx.onabort = () => reject(tx.error ?? new Error('Simulation storage was interrupted.'))
  })
}
export async function readHistory(): Promise<SavedSimulation[]> {
  if (typeof indexedDB === 'undefined') return []
  try {
    const records = await transaction<SavedSimulation[]>('readonly', store => store.getAll())
    return records.sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))
  } catch {
    return []
  }
}
export function effectiveConfiguration(batch: NativeBatch): string {
  // Seeds and mutable queues are outcomes/repetition controls, not a housing/service configuration.
  const ignored = new Set(['seed', 'waiting_passenger_ids', 'serving_streetcar_id'])
  const canonical = (value: unknown): unknown => Array.isArray(value) ? value.map(canonical)
    : value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).filter(([key]) => !ignored.has(key)).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)])) : value
  return JSON.stringify(canonical(batch.individual_results[0]?.inputs))
}
export function configurationName(batch: NativeBatch) {
  return effectiveConfiguration(batch) === effectiveConfiguration(todayBaseline) ? 'Today configuration' : 'Custom configuration'
}
export function configurationSummary(batch: NativeBatch) {
  const inputs = batch.individual_results[0]?.inputs
  return `${inputs?.developments?.length ?? 0} developments · ${typeof inputs?.headway_s === 'number' ? (inputs.headway_s / 60).toFixed(1) + '-minute service' : 'frequency unknown'} · ${inputs?.headway_randomness_s ?? 0}s arrival variation`
}
export async function rememberSimulation(batch: NativeBatch, createdAt: string | null = new Date().toISOString()) {
  if (typeof indexedDB === 'undefined') return
  const existing = await transaction<SavedSimulation | undefined>('readonly', store => store.get(batch.id))
  if (existing) return
  // Keep native inputs and summaries. Full replay logs remain stored by the API.
  const compact = { ...batch, individual_results: batch.individual_results.map(run => ({ ...run, streetcars: [], passengers: [], sim_log: [] })) }
  await transaction('readwrite', store => store.put({ id: batch.id, name: configurationName(batch), createdAt, batch: compact } satisfies SavedSimulation))
  notify()
}
export async function renameSimulation(id: string, name: string) {
  const value = await transaction<SavedSimulation | undefined>('readonly', store => store.get(id))
  if (!value) throw new Error('This saved simulation is no longer available.')
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80) throw new Error('Use a name between 1 and 80 characters.')
  await transaction('readwrite', store => store.put({ ...value, name: trimmed }))
  notify()
}
export async function forgetSimulation(id: string) {
  if (typeof indexedDB === 'undefined') return
  await transaction('readwrite', store => store.delete(id))
  if (activeSimulationId() === id) setActiveSimulation(null)
  notify()
}
export function activeSimulationId() { return typeof window === 'undefined' ? null : window.localStorage.getItem('urbanova-active-simulation') }
export function setActiveSimulation(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) localStorage.setItem('urbanova-active-simulation', id)
  else localStorage.removeItem('urbanova-active-simulation')
  notify()
}
export function useSimulationHistory() {
  const [history, setHistory] = useState<SavedSimulation[]>([])
  const [activeId, setActiveId] = useState<string | null>(activeSimulationId)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    let disposed = false
    const refresh = () => {
      setActiveId(activeSimulationId())
      void readHistory().then(value => { if (!disposed) { setHistory(value); setError('') } })
        .catch(reason => { if (!disposed) setError(reason instanceof Error ? reason.message : 'Saved simulations unavailable.') })
        .finally(() => { if (!disposed) setLoading(false) })
    }
    listeners.add(refresh)
    refresh()
    return () => { disposed = true; listeners.delete(refresh) }
  }, [])
  return { history, activeId, error, loading }
}
export function batchCase(batch: NativeBatch): NativeCaseResult {
  return { ...batch, case_id: batch.id, kind: 'current', package_id: 'saved-configuration', phase_id: 'saved-configuration', demand_case: 'central', stops: [],
    runs: [], run_count: batch.overall_results.run_count,
    per_run_mean_wait_s: batch.individual_results.map(run => run.summary.overview.mean_wait_s),
    per_run_p95_wait_s: batch.individual_results.map(run => run.summary.overview.p95_wait_s),
    per_run_denied_share: batch.individual_results.map(run => run.summary.overview.denied_boarding_share),
    per_run_unresolved_passengers: batch.individual_results.map(run => run.summary.overview.unresolved_passengers),
    unresolved_passengers: batch.overall_results.metrics.unresolved_passengers?.mean ?? 0,
  }
}
export function mapComparison(batch: NativeBatch): Comparison {
  const inputs = batch.individual_results[0].inputs
  // Reuse only the map's corridor geometry/route metadata; never its fixture results.
  return { ...sampleComparison, comparison_id: batch.id, contract_version: '3.0.0', fixture: false,
    corridor: { ...sampleComparison.corridor, stops: inputs.stops ?? [], peak_window: { ...sampleComparison.corridor.peak_window,
      start_s: inputs.start_time_s ?? 25200, end_s: inputs.end_time_s ?? 32400, service_date: todayDate } },
    scenario: { ...sampleComparison.scenario, developments: inputs.developments ?? [], interventions: [], capital_budget_cad: 0, annual_operating_budget_cad: 0 },
    cases: [batchCase(batch)], packages: [], assumptions: [], sensitivity: [], warnings: [], replay: null,
  }
}
export function addComparison(ids: string[], id: string, prioritize = false) {
  const distinct = prioritize ? [id, ...ids.filter(value => value !== id)] : [...new Set([...ids, id])]
  return distinct.slice(0, 2)
}
export function comparisonProblem(batch: NativeBatch): string | null {
  const a = batch.individual_results[0]?.inputs
  const b = todayBaseline.individual_results[0].inputs
  if (!a || a.start_time_s !== b.start_time_s || a.end_time_s !== b.end_time_s) return 'Different modeled time window'
  if (JSON.stringify(a.stops?.map(stop => stop.id)) !== JSON.stringify(b.stops?.map(stop => stop.id))) return 'Different corridor or direction'
  return null
}
