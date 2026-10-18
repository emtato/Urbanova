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
// Only database responses and acknowledged mutations populate the visible list.
// IndexedDB is a cache, never an additional source of saved simulations.
let history: SavedSimulation[] = []
let loading = true
let error = ''
export const currentSimulations = () => history.map(item => item.batch)
export function beginSimulationRefresh() { loading = true; error = ''; notify() }
export function failSimulationRefresh(reason: unknown) {
  loading = false
  error = reason instanceof Error ? reason.message : 'Saved simulations unavailable.'
  notify()
}
function historyRecord(batch: NativeBatch, createdAt: string | null = batch.provenance?.recorded_at ?? null): SavedSimulation {
  return { id: batch.id, name: batch.name || formatSimulationTimestamp(createdAt ? new Date(createdAt) : new Date()), createdAt, batch }
}
function compactRecord(record: SavedSimulation): SavedSimulation {
  return { ...record, batch: { ...record.batch, individual_results: record.batch.individual_results.map(run => ({ ...run, streetcars: [], passengers: [], sim_log: [] })) } }
}
async function cacheWrite<T>(action: (store: IDBObjectStore) => IDBRequest<T>) {
  if (typeof indexedDB === 'undefined') return
  try { await transaction('readwrite', action) } catch { /* Database-backed views remain usable if browser storage fails. */ }
}
export async function syncSimulationHistory(batches: NativeBatch[]) {
  history = batches.map(batch => historyRecord(batch))
  loading = false
  error = ''
  const activeId = activeSimulationId()
  if (activeId && !batches.some(batch => batch.id === activeId)) setActiveSimulation(null)
  else notify()
  const records = history.map(compactRecord)
  // Replace atomically, including an empty response, to evict stale cached IDs.
  await cacheWrite(store => {
    const clear = store.clear()
    for (const record of records) store.put(record)
    return clear
  })
}
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
export function formatSimulationTimestamp(date: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
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
  const record = historyRecord(batch, batch.provenance?.recorded_at ?? createdAt)
  history = [record, ...history.filter(item => item.id !== batch.id)]
  loading = false
  error = ''
  notify()
  await cacheWrite(store => store.put(compactRecord(record)))
}
export async function updateLocalSimulationName(id: string, name: string) {
  const trimmed = name.trim()
  if (!trimmed || trimmed.length > 80) throw new Error('Use a name between 1 and 80 characters.')
  history = history.map(value => value.id === id ? { ...value, name: trimmed, batch: { ...value.batch, name: trimmed } } : value)
  loading = false
  error = ''
  notify()
  const record = history.find(value => value.id === id)
  if (record) await cacheWrite(store => store.put(compactRecord(record)))
}
export async function renameSimulation(id: string, name: string) {
  await updateLocalSimulationName(id, name)
}
export async function forgetSimulation(id: string) {
  history = history.filter(value => value.id !== id)
  loading = false
  error = ''
  if (activeSimulationId() === id) setActiveSimulation(null)
  else notify()
  await cacheWrite(store => store.delete(id))
}
export function activeSimulationId() { return typeof window === 'undefined' ? null : window.localStorage.getItem('urbanova-active-simulation') }
export function setActiveSimulation(id: string | null) {
  if (typeof window === 'undefined') return
  if (id) localStorage.setItem('urbanova-active-simulation', id)
  else localStorage.removeItem('urbanova-active-simulation')
  notify()
}
export function useSimulationHistory() {
  const [savedHistory, setHistory] = useState(history)
  const [activeId, setActiveId] = useState<string | null>(activeSimulationId)
  const [savedError, setError] = useState(error)
  const [savedLoading, setLoading] = useState(loading)
  useEffect(() => {
    const refresh = () => {
      setActiveId(activeSimulationId())
      setHistory(history)
      setError(error)
      setLoading(loading)
    }
    listeners.add(refresh)
    refresh()
    return () => { listeners.delete(refresh) }
  }, [])
  return { history: savedHistory, activeId, error: savedError, loading: savedLoading }
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
