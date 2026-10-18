import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { configurationSummary, type SavedSimulation } from '../lib/simulationHistory'
import { deleteSimulation, renameSimulation } from '../lib/api'
import { ConfirmDialog } from './ConfirmDialog'
import { ChevronDown } from 'lucide-react'
import './SimulationPicker.css'

export function SimulationPicker({ label, history, onSelect, disabled = false, reason, onToday, loading = false, error = '', initialOpen = false, initialBatchMode = false, initialSelectedIds }: {
  label: string; history: SavedSimulation[]; onSelect: (simulation: SavedSimulation) => void
  disabled?: boolean; reason?: (simulation: SavedSimulation) => string | null; onToday?: () => void
  loading?: boolean; error?: string; initialOpen?: boolean; initialBatchMode?: boolean; initialSelectedIds?: string[]
}) {
  const [open, setOpen] = useState(initialOpen)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 340 })
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [renameError, setRenameError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<SavedSimulation | null>(null)
  const [isBatchMode, setIsBatchMode] = useState(initialBatchMode)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(initialSelectedIds ?? []))
  const [isDeletingBatch, setIsDeletingBatch] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = () => {
    setOpen(false)
    setEditing(null)
    setActionError('')
    setIsBatchMode(false)
    setSelectedIds(new Set())
    trigger.current?.focus()
  }

  const toggleSelect = (simId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(simId)) next.delete(simId)
      else next.add(simId)
      return next
    })
  }

  const handleBatchDelete = async () => {
    if (isDeletingBatch || selectedIds.size === 0) return
    setIsDeletingBatch(true)
    setActionError('')
    try {
      const idsToDelete = Array.from(selectedIds)
      const results = await Promise.allSettled(idsToDelete.map(id => deleteSimulation(id)))
      const rejected = results.filter(r => r.status === 'rejected')
      if (rejected.length > 0) {
        setActionError(`Could not delete ${rejected.length} of ${idsToDelete.length} simulations.`)
      }
      setSelectedIds(new Set())
      setIsBatchMode(false)
      if (editing && idsToDelete.includes(editing)) setEditing(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete simulations.')
    } finally {
      setIsDeletingBatch(false)
    }
  }

  const handleBatchDeleteClick = () => {
    if (!isBatchMode) {
      setIsBatchMode(true)
      setSelectedIds(new Set())
      return
    }
    if (selectedIds.size > 0) {
      void handleBatchDelete()
    } else {
      setIsBatchMode(false)
    }
  }

  const handleDelete = async (simulation: SavedSimulation) => {
    if (deletingId) return
    setDeletingId(simulation.id)
    setActionError('')
    try {
      await deleteSimulation(simulation.id)
      if (editing === simulation.id) setEditing(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete simulation.')
    } finally {
      setDeletingId(null)
      setPendingDelete(null)
    }
  }

  useEffect(() => {
    if (!open) return
    const place = () => {
      const rect = trigger.current!.getBoundingClientRect()
      const width = Math.min(340, window.innerWidth - 24)
      const height = Math.min(380, window.innerHeight - 24)
      setPosition({ width, left: Math.max(12, Math.min(rect.right - width, window.innerWidth - width - 12)),
        top: rect.bottom + height + 8 < window.innerHeight ? rect.bottom + 8 : Math.max(12, rect.top - height - 8) })
    }
    const outside = (event: PointerEvent) => {
      const target = event.target as Node | null
      if (!target || !target.isConnected) return
      if (target instanceof Element && target.closest('[data-confirm-dialog]')) return
      if (!popup.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false)
    }
    const escape = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); close() } }
    place()
    popup.current?.focus()
    document.addEventListener('pointerdown', outside)
    document.addEventListener('keydown', escape)
    window.addEventListener('resize', place)
    window.addEventListener('scroll', place, true)
    return () => {
      document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape)
      window.removeEventListener('resize', place); window.removeEventListener('scroll', place, true)
    }
  }, [open])
  const popupContent = (
    <div id={id} ref={popup} tabIndex={-1} role="dialog" aria-label={label} className="simulation-picker-popup" style={position}>
      <div className="simulation-picker-heading">
        <strong>{label === 'Past sims' ? 'Load a saved simulation' : label === 'Add comparison' ? 'Compare a saved simulation' : 'Saved simulations'}</strong>
        <div className="simulation-picker-heading-actions">
          {history.length > 0 && (
            <>
              {isBatchMode && (
                <button
                  type="button"
                  className="simulation-picker-rename"
                  onClick={() => { setIsBatchMode(false); setSelectedIds(new Set()) }}
                >
                  Cancel
                </button>
              )}
              <button
                type="button"
                className="simulation-picker-delete"
                disabled={isDeletingBatch}
                onClick={handleBatchDeleteClick}
              >
                {selectedIds.size > 0 ? (isDeletingBatch ? 'Deleting…' : 'confirm delete') : 'Batch delete'}
              </button>
            </>
          )}
          <button type="button" aria-label="Close saved simulations" onClick={close}>✕</button>
        </div>
      </div>
      {onToday && <button className="simulation-picker-today" type="button" onClick={() => { onToday(); close() }}>Today baseline <span>Bundled reference</span></button>}
      {actionError && <p role="alert" className="simulation-picker-error">{actionError}</p>}
      {loading ? <p className="simulation-picker-empty">Loading saved simulations…</p> : error ? <p role="alert" className="simulation-picker-empty">{error}</p> : !history.length ? <div className="simulation-picker-empty"><strong>No past simulations yet</strong><p>Completed runs will appear here by name and timestamp.</p></div> : <ul>
        {history.map(simulation => {
          const unavailable = reason?.(simulation)
          return <li key={simulation.id}>
            {editing === simulation.id ? <form onSubmit={event => {
              event.preventDefault()
              setRenameError('')
              void renameSimulation(simulation.id, name)
                .then(() => setEditing(null))
                .catch(value => setRenameError(value instanceof Error ? value.message : String(value)))
            }}><label>Simulation name<input autoFocus maxLength={80} required value={name} onChange={event => setName(event.target.value)} /></label><div><button type="submit">Save name</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div>{renameError && <p role="alert">{renameError}</p>}</form> : <>
              <button
                className={`simulation-picker-option ${selectedIds.has(simulation.id) ? 'simulation-picker-option-selected' : ''}`}
                type="button"
                disabled={!isBatchMode && !!unavailable}
                onClick={() => {
                  if (isBatchMode) {
                    toggleSelect(simulation.id)
                  } else {
                    onSelect(simulation)
                    close()
                  }
                }}
              >
                <strong>{simulation.name}</strong>
                <time dateTime={simulation.createdAt ?? undefined}>{simulation.createdAt ? new Date(simulation.createdAt).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' }) : 'Timestamp not recorded'}</time>
                <small>{configurationSummary(simulation.batch)}</small>{unavailable && <small>{unavailable}</small>}
              </button>
              <div className="simulation-picker-actions">
                <button
                  className="simulation-picker-rename"
                  type="button"
                  aria-label={`Rename ${simulation.name}`}
                  onClick={() => { setEditing(simulation.id); setName(simulation.name); setRenameError(''); setActionError('') }}
                >
                  Rename
                </button>
                <button
                  className="simulation-picker-delete"
                  type="button"
                  disabled={deletingId === simulation.id || isDeletingBatch}
                  aria-label={`Delete ${simulation.name}`}
                  onClick={() => { setActionError(''); setPendingDelete(simulation) }}
                >
                  {deletingId === simulation.id ? 'Deleting…' : 'Delete'}
                </button>
                {isBatchMode && (
                  <label
                    className="simulation-picker-checkbox-wrapper"
                    onClick={event => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      className="simulation-picker-checkbox"
                      checked={selectedIds.has(simulation.id)}
                      onChange={() => toggleSelect(simulation.id)}
                      aria-label={`Select ${simulation.name} for deletion`}
                    />
                  </label>
                )}
              </div>
            </>}
          </li>
        })}
      </ul>}
      <p className="simulation-picker-storage">Saved in the database. All times: Toronto.</p>
    </div>
  )

  return <>
    <button ref={trigger} type="button" className="simulation-picker-trigger max-w-[240px]" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>
      <span className="truncate">{label}</span>
      <ChevronDown size={13} aria-hidden="true" className="shrink-0 opacity-80" />
    </button>
    {open && (typeof document !== 'undefined' && document.body ? createPortal(popupContent, document.body) : popupContent)}
    <ConfirmDialog
      open={!!pendingDelete}
      title="Delete simulation?"
      message={pendingDelete ? `"${pendingDelete.name}" will be permanently deleted. This cannot be undone.` : ''}
      confirmLabel={deletingId ? 'Deleting…' : 'Delete'}
      danger
      busy={!!deletingId}
      onConfirm={() => { if (pendingDelete) void handleDelete(pendingDelete) }}
      onCancel={() => setPendingDelete(null)}
    />
  </>
}
