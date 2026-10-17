import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { configurationSummary, type SavedSimulation } from '../lib/simulationHistory'
import { deleteSimulation, renameSimulation } from '../lib/api'
import './SimulationPicker.css'

export function SimulationPicker({ label, history, onSelect, disabled = false, reason, onToday, loading = false, error = '' }: {
  label: string; history: SavedSimulation[]; onSelect: (simulation: SavedSimulation) => void
  disabled?: boolean; reason?: (simulation: SavedSimulation) => string | null; onToday?: () => void
  loading?: boolean; error?: string
}) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0, width: 340 })
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [renameError, setRenameError] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState('')
  const trigger = useRef<HTMLButtonElement>(null)
  const popup = useRef<HTMLDivElement>(null)
  const id = useId()
  const close = () => { setOpen(false); setEditing(null); setActionError(''); trigger.current?.focus() }

  const handleDelete = async (simulation: SavedSimulation) => {
    if (deletingId) return
    if (!window.confirm(`Delete simulation "${simulation.name}"? This cannot be undone.`)) return
    setDeletingId(simulation.id)
    setActionError('')
    try {
      await deleteSimulation(simulation.id)
      if (editing === simulation.id) setEditing(null)
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Could not delete simulation.')
    } finally {
      setDeletingId(null)
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
      if (!popup.current?.contains(event.target as Node) && !trigger.current?.contains(event.target as Node)) setOpen(false)
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
  return <>
    <button ref={trigger} type="button" className="simulation-picker-trigger" disabled={disabled} aria-haspopup="dialog" aria-expanded={open} aria-controls={open ? id : undefined} onClick={() => setOpen(value => !value)}>{label}<span aria-hidden="true">⌄</span></button>
    {open && createPortal(<div id={id} ref={popup} tabIndex={-1} role="dialog" aria-label={label} className="simulation-picker-popup" style={position}>
      <div className="simulation-picker-heading"><strong>{label === 'Past sims' ? 'Load a saved simulation' : 'Compare a saved simulation'}</strong><button type="button" aria-label="Close saved simulations" onClick={close}>✕</button></div>
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
              <button className="simulation-picker-option" type="button" disabled={!!unavailable} onClick={() => { onSelect(simulation); close() }}>
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
                  disabled={deletingId === simulation.id}
                  aria-label={`Delete ${simulation.name}`}
                  onClick={() => void handleDelete(simulation)}
                >
                  {deletingId === simulation.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </>}
          </li>
        })}
      </ul>}
      <p className="simulation-picker-storage">Saved in this browser &amp; synced with database. All times: Toronto.</p>
    </div>, document.body)}
  </>
}
