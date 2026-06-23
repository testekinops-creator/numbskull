import { useEffect } from 'react'
import { SHORTCUTS } from '../hooks/useKeyboardShortcuts.js'
import { CloseIcon } from './icons/Icons.jsx'
import styles from './KeyboardShortcutsModal.module.css'

export default function KeyboardShortcutsModal({ onClose }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className={styles.backdrop} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={onClose}>
      <div className={`card ${styles.modal}`} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h2>Keyboard Shortcuts</h2>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><CloseIcon size={15} /></button>
        </div>
        <ul className={styles.list}>
          {SHORTCUTS.map(s => (
            <li key={s.key} className={styles.item}>
              <kbd className={styles.kbd}>{s.key}</kbd>
              <span className={styles.desc}>{s.description}</span>
            </li>
          ))}
          <li className={styles.item}>
            <kbd className={styles.kbd}>Esc</kbd>
            <span className={styles.desc}>Close dialogs</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
