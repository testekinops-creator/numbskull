import { useEffect } from 'react'
import { useFocusTrap } from '../../hooks/useFocusTrap.js'
import styles from './ConfirmDialog.module.css'

// Premium confirmation modal. Backdrop-blur + glowing gradient card. Escape or a
// backdrop click cancels; focus is trapped and lands on Cancel first (so a stray
// Enter never fires a destructive action). `tone='danger'` tints the confirm CTA.
export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  icon = '⚠️',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'danger',          // 'danger' | 'default'
  onConfirm,
  onCancel,
}) {
  const trapRef = useFocusTrap(open)

  // Escape cancels; lock background scroll while open.
  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onCancel?.() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onCancel} role="presentation">
      <div
        ref={trapRef}
        className={`${styles.card} anim-bounce-land`}
        onClick={(e) => e.stopPropagation()}
        role="alertdialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className={styles.icon} aria-hidden="true">{icon}</div>
        <h2 className={styles.title}>{title}</h2>
        {message && <p className={styles.message}>{message}</p>}
        <div className={styles.actions}>
          <button type="button" className="btn btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            className={`btn ${tone === 'danger' ? styles.confirmDanger : 'btn-juice'}`}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
