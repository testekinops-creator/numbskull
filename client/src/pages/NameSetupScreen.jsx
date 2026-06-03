import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import { usePlayer } from '../contexts/PlayerContext.jsx'
import styles from './NameSetupScreen.module.css'

const NAME_KEY = 'ns_name_set'

export default function NameSetupScreen() {
  const navigate = useNavigate()
  const { playerName, setName } = usePlayer()
  const [value, setValue] = useState(playerName)
  const [ready, setReady] = useState(false)

  function handleSubmit(e) {
    e.preventDefault()
    const trimmed = value.trim()
    if (!trimmed) return
    setName(trimmed)
    localStorage.setItem(NAME_KEY, '1')
    setReady(true)
    setTimeout(() => navigate('/lobby'), 180)
  }

  function handleSkip() {
    localStorage.setItem(NAME_KEY, '1')
    navigate('/lobby')
  }

  return (
    <div className={styles.screen}>
      <div className={`${styles.card} anim-slide-up`}>
        {/* Skull — judging expression, you haven't proved yourself yet */}
        <SkullMascot expression="judging" size={100} glow />

        <div className={styles.copy}>
          <h1 className={styles.title}>What do I call you?</h1>
          <p className={styles.subtitle}>I'll use it to mock you.</p>
        </div>

        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={`input ${styles.nameInput}`}
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            maxLength={20}
            autoFocus
            autoComplete="off"
            autoCapitalize="words"
            placeholder="Your name"
            aria-label="Your display name"
          />

          <button
            type="submit"
            className={`btn btn-juice btn-lg ${styles.goBtn} ${ready ? styles.pressed : ''}`}
            disabled={!value.trim()}
          >
            LET'S GO →
          </button>
        </form>

        <button className={styles.skip} onClick={handleSkip} type="button">
          Skip
        </button>
      </div>
    </div>
  )
}
