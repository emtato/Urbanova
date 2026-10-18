import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import './ConfirmDialog.css'

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', danger = false, busy = false, onConfirm, onCancel }: {
  open: boolean; title: string; message: string; confirmLabel?: string; cancelLabel?: string
  danger?: boolean; busy?: boolean; onConfirm: () => void; onCancel: () => void
}) {
  const cancelButton = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  const messageId = useId()
  const latest = useRef({ busy, onCancel })
  useEffect(() => { latest.current = { busy, onCancel } })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    cancelButton.current?.focus()
    // Capture on window so Escape closes this dialog before any popup underneath sees it.
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault(); event.stopImmediatePropagation()
      if (!latest.current.busy) latest.current.onCancel()
    }
    window.addEventListener('keydown', escape, true)
    return () => { window.removeEventListener('keydown', escape, true); previous?.focus?.() }
  }, [open])

  if (!open) return null
  return createPortal(<div className="confirm-dialog-backdrop" data-confirm-dialog="" onPointerDown={event => { if (event.target === event.currentTarget && !busy) onCancel() }}>
    <div className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId}>
      <h2 id={titleId}>{title}</h2>
      <p id={messageId}>{message}</p>
      <div className="confirm-dialog-actions">
        <button ref={cancelButton} type="button" className="confirm-dialog-cancel" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
        <button type="button" className={`confirm-dialog-confirm${danger ? ' is-danger' : ''}`} disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
      </div>
    </div>
  </div>, document.body)
}
