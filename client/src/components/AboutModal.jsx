import { useEffect } from 'react'
import { useFocusTrap } from '../hooks/useFocusTrap.js'
import GameLogo from './GameLogo.jsx'
import { CloseIcon, SparkleIcon, MailIcon } from './icons/Icons.jsx'
import { VERSION_LINE, BUILD_DATE, COMMIT_MSG } from '../utils/buildInfo.js'
import styles from './AboutModal.module.css'

const SUPPORT_EMAIL = 'supportnumbskull@gmail.com'

// Premium "About Numbskull" modal: what the game is, the live build version, and
// the latest change shipped (auto-updates each deploy via buildInfo).
export default function AboutModal({ open, onClose }) {
  const trapRef = useFocusTrap(open)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [open, onClose])

  if (!open) return null

  return (
    <div className={styles.backdrop} onClick={onClose} role="presentation">
      <div ref={trapRef} className={`${styles.card} anim-bounce-land`} onClick={(e) => e.stopPropagation()}
        role="dialog" aria-modal="true" aria-label="About Numbskull">
        <button className={styles.close} onClick={onClose} aria-label="Close"><CloseIcon size={16} /></button>

        <GameLogo variant="static" size={72} />
        <h2 className={styles.title}>Numbskull</h2>
        <p className={styles.tagline}>The number game that roasts you.</p>

        <div className={styles.versionRow}>
          <span className={styles.versionBadge}>{VERSION_LINE}</span>
          {BUILD_DATE && <span className={styles.buildDate}>{BUILD_DATE}</span>}
        </div>

        {COMMIT_MSG && (
          <div className={styles.whatsNew}>
            <span className={styles.whatsNewLabel} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><SparkleIcon size={13} /> What’s new</span>
            <span className={styles.whatsNewText}>{COMMIT_MSG}</span>
          </div>
        )}

        <p className={styles.blurb}>
          A suite of quick head-to-head brain games — guess, race and bluff your way past friends
          (and a skull with a mean streak).
        </p>

        <a className={`btn btn-ghost btn-sm ${styles.contact}`} href={`mailto:${SUPPORT_EMAIL}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><MailIcon size={15} /> Contact support</a>
      </div>
    </div>
  )
}
