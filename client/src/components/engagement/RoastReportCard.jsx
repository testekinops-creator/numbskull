import SkullMascot from '../skull/SkullMascot.jsx'
import { CheckIcon, ShareIcon } from '../icons/Icons.jsx'
import styles from './RoastReportCard.module.css'

const GRADE_EXPRESSIONS = { S: 'impressed', A: 'grudging', B: 'neutral', C: 'annoyed', D: 'evil' }
const GRADE_COLORS = { S: 'var(--color-juice)', A: 'var(--color-success)', B: 'var(--color-text-primary)', C: 'var(--color-warning)', D: 'var(--color-pink)' }

export default function RoastReportCard({ report, won, onClose }) {
  if (!report) return null
  const { grade = 'C', comment, optimal, actual, optimalPath, mode, timeMs } = report
  const expression = GRADE_EXPRESSIONS[grade] || 'neutral'
  const gradeColor = GRADE_COLORS[grade]

  return (
    <div className={`card ${styles.card} anim-bounce-land`}>
      <div className={styles.top}>
        <SkullMascot expression={expression} size={72} glow={grade === 'S'} />
        <div className={styles.gradeWrap}>
          <span className={styles.grade} style={{ color: gradeColor }}>{grade}</span>
          <span className={styles.gradeLabel}>{report.efficiency?.label || 'Result'}</span>
        </div>
      </div>

      <p className={styles.comment}>"{comment}"</p>

      <div className={styles.stats}>
        <Stat label="Your guesses" value={actual} />
        <Stat label="Optimal" value={optimal} highlight={actual <= optimal} />
        {timeMs && <Stat label="Time" value={`${(timeMs / 1000).toFixed(1)}s`} />}
        {mode === 'GTN' && optimalPath && (
          <div className={styles.pathWrap}>
            <span className={styles.pathLabel}>Optimal path</span>
            <span className={styles.path}>{optimalPath.join(' → ')}</span>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <ShareButton report={report} won={won} />
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
      </div>
    </div>
  )
}

function Stat({ label, value, highlight }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statLabel}>{label}</span>
      <span className={`${styles.statValue} ${highlight ? styles.highlight : ''}`}>{value}</span>
    </div>
  )
}

function ShareButton({ report, won }) {
  const [copied, setCopied] = useState(false)

  function share() {
    const text = `${won ? '✅' : '❌'} Numbskull ${report.mode} — ${report.actual} guesses (optimal: ${report.optimal}). Grade: ${report.grade} 💀 Play at numbskull.app`
    if (navigator.share) {
      navigator.share({ title: 'Numbskull', text })
    } else {
      navigator.clipboard?.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <button className="btn btn-ghost btn-sm" onClick={share}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{copied ? <><CheckIcon size={14} /> Copied!</> : <><ShareIcon size={14} /> Share</>}</span>
    </button>
  )
}

import { useState } from 'react'
