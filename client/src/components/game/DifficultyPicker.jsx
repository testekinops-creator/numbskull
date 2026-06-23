import { DIFFICULTY } from '../icons/difficulty.js'
import styles from './DifficultyPicker.module.css'

const OPTS = {
  GTN: [
    { id: 'easy',   label: 'Easy',   hint: '1 – 100',    desc: 'A warm-up. ~7 guesses optimal.' },
    { id: 'medium', label: 'Medium', hint: '1 – 1,000',  desc: 'The classic. ~10 guesses optimal.' },
    { id: 'hard',   label: 'Hard',   hint: '1 – 10,000', desc: 'Needle in a haystack. ~14 optimal.' },
  ],
  BC: [
    { id: 'easy',   label: 'Easy',   hint: '14 guesses', desc: '6-digit code — more room for error.' },
    { id: 'medium', label: 'Medium', hint: '11 guesses', desc: '6-digit code — standard pressure.' },
    { id: 'hard',   label: 'Hard',   hint: '8 guesses',  desc: '6-digit code — no mistakes.' },
  ],
}

export default function DifficultyPicker({ mode, onSelect }) {
  const opts = OPTS[mode] || OPTS.GTN
  return (
    <div className={styles.wrap}>
      <h2 className={styles.title}>Choose your difficulty</h2>
      <div className={`${styles.grid} stagger`}>
        {opts.map(o => (
          <button
            key={o.id}
            className={`${styles.card} ${styles[o.id]} anim-slide-up`}
            onClick={() => onSelect(o.id)}
          >
            <span className={styles.icon}>{(() => { const { Icon, color } = DIFFICULTY[o.id]; return <Icon size={22} style={{ color }} /> })()}</span>
            <span className={styles.label}>{o.label}</span>
            <span className={styles.hint}>{o.hint}</span>
            <span className={styles.desc}>{o.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
