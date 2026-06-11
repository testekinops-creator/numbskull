import { useEffect, useRef, useState } from 'react'
import TurnTimer from '../game/TurnTimer.jsx'
import { useSound } from '../../hooks/useSound.js'
import { useHaptic } from '../../hooks/useHaptic.js'
import { celebrateWin, celebrateChit } from '../../utils/celebrate.js'
import rajaCard   from '../../assets/rmcs/raja.jpg'
import mantriCard from '../../assets/rmcs/mantri.jpg'
import sipahiCard from '../../assets/rmcs/sipahi.jpg'
import chorCard   from '../../assets/rmcs/chor.jpg'
import styles from './RmcsMatch.module.css'

export const ROLE_META = {
  RAJA:   { emoji: '👑', label: 'Raja',   points: 1000, card: rajaCard },
  MANTRI: { emoji: '🧠', label: 'Mantri', points: 800,  card: mantriCard },
  CHOR:   { emoji: '🥷', label: 'Chor',   points: 0,    card: chorCard },
  SIPAHI: { emoji: '👮', label: 'Sipahi', points: 500,  card: sipahiCard },
}

const GUESS_SECS = 60
const REVEAL_SECS = 30

// Raja Mantri Chor Sipahi (4-player hidden roles). Stages mirror the server:
// REVEAL (everyone taps their chit) → GUESS (Mantri picks the Chor from the two
// unannounced players, table talk open) → RESULT (full reveal + scores; the
// host deals the next round or ends the session).
export default function RmcsMatch({ match, you, players = [], hostId, onReveal, onGuess, onNext, onEnd }) {
  const { playTone, playWin, playLose, unlock } = useSound()
  const { buzz } = useHaptic()

  const stage = match.stage
  const myRole = match.myRole
  const iRevealed = !!match.revealed?.[you]
  const isHost = hostId === you
  const amMantri = match.mantriId === you
  const nameOf = (id) => (id === you ? 'You' : players.find(p => p.id === id)?.name || '???')

  const [confirming, setConfirming] = useState(null)   // suspectId pending confirmation
  const [submitted, setSubmitted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  // ── Stage countdown (server-deadline driven; re-synced on reconnect) ──────
  // REVEAL: 30s before unrevealed chits auto-flip. GUESS: 60s for the Mantri.
  const [secondsLeft, setSecondsLeft] = useState(GUESS_SECS)
  useEffect(() => {
    if (stage !== 'GUESS' && stage !== 'REVEAL') return
    const ms = stage === 'GUESS'
      ? (match.guessCountdownMs ?? GUESS_SECS * 1000)
      : (match.revealCountdownMs ?? REVEAL_SECS * 1000)
    const deadline = Date.now() + ms
    setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000)))
    const id = setInterval(() => setSecondsLeft(Math.max(0, Math.ceil((deadline - Date.now()) / 1000))), 300)
    return () => clearInterval(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage, match.round])

  // New round → clear transient guess state.
  useEffect(() => { setConfirming(null); setSubmitted(false); setErr('') }, [match.round])

  // Preload all four card faces once so the flip (and the result grid) never
  // pops in half-loaded.
  useEffect(() => {
    Object.values(ROLE_META).forEach(m => { const i = new Image(); i.src = m.card })
  }, [])

  // Golden burst + thunk right where the chit lands face-up.
  const chitRef = useRef(null)
  const burstedRef = useRef(false)
  useEffect(() => {
    if (!iRevealed) { burstedRef.current = false; return }
    if (burstedRef.current) return
    burstedRef.current = true
    const t = setTimeout(() => {
      const r = chitRef.current?.getBoundingClientRect()
      if (r) celebrateChit({ x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight })
      buzz('correct')
    }, 380)   // sync with the flip landing
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [iRevealed])

  // Stage stings: announce moment + result juice.
  const prevStage = useRef(stage)
  useEffect(() => {
    if (prevStage.current === stage) return
    prevStage.current = stage
    if (stage === 'GUESS') { playTone(0.8); buzz('tap') }
    if (stage === 'RESULT' && match.lastRound) {
      const gained = match.lastRound.gained?.[you] ?? 0
      if (gained >= 800) celebrateWin()
      gained >= 500 ? playWin() : playLose()
      buzz(gained >= 500 ? 'correct' : 'wrong')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage])

  async function tapChit() {
    if (iRevealed || busy) return
    unlock(); buzz('tap'); setBusy(true)
    const r = await onReveal?.()
    if (!r?.ok) setErr(r?.error || '')
    setBusy(false)
  }

  async function confirmGuess() {
    if (!confirming || submitted) return
    setSubmitted(true)
    const r = await onGuess?.(confirming)
    if (!r?.ok) { setErr(r?.error || 'Could not submit'); setSubmitted(false) }
    setConfirming(null)
  }

  const last = match.lastRound
  const roleChip = (id) => {
    if (stage === 'RESULT' && last?.roles) {
      const meta = ROLE_META[last.roles[id]]
      return meta ? `${meta.emoji} ${meta.label}` : ''
    }
    if (stage !== 'REVEAL') {
      if (id === match.rajaId) return '👑 Raja'
      if (id === match.mantriId) return '🧠 Mantri'
      return '❓'
    }
    return match.revealed?.[id] ? '✓ revealed' : '…'
  }

  const meta = myRole ? ROLE_META[myRole] : null
  const correct = last?.correct
  const chorId = last ? Object.keys(last.roles).find(id => last.roles[id] === 'CHOR') : null

  return (
    <div className={`${styles.wrap} ${stage === 'RESULT' && correct ? 'anim-screen-shake' : ''}`}>
      {/* Round + running totals roster */}
      <div className={styles.roster}>
        <div className={styles.roundLabel}>Round {match.round}</div>
        {players.map(p => (
          <div key={p.id} className={`${styles.rosterItem} ${p.id === you ? styles.rosterYou : ''}`}>
            <span className={styles.rosterName}>{p.id === hostId ? '⭐ ' : ''}{nameOf(p.id)}</span>
            <span className={styles.rosterRole}>{roleChip(p.id)}</span>
            <span className={styles.rosterScore}>{match.totals?.[p.id] ?? 0}</span>
          </div>
        ))}
      </div>

      {/* ── REVEAL: tap your chit ── */}
      {stage === 'REVEAL' && (
        <div className={styles.stageArea}>
          <TurnTimer active seconds={secondsLeft} total={REVEAL_SECS} />
          <div ref={chitRef} className={`${styles.chit} ${iRevealed ? styles.chitFlipped : ''}`} onClick={tapChit}
            role="button" tabIndex={0} aria-label={iRevealed ? `Your role: ${meta?.label}` : 'Tap to reveal your role'}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') tapChit() }}>
            <div className={styles.chitInner}>
              <div className={styles.chitFront}>
                <span className={styles.chitQ}>?</span>
                <span className={styles.chitHint}>Tap to Reveal</span>
              </div>
              <div className={styles.chitBack}>
                {meta && <img className={styles.chitImg} src={meta.card} alt={`${meta.label} — ${meta.points} points`} draggable="false" />}
                <span className={styles.chitShine} aria-hidden="true" />
              </div>
            </div>
          </div>
          <p className={styles.stageHint}>
            {iRevealed
              ? `🤫 You are the ${meta?.label} — waiting for the others… (${Object.keys(match.revealed || {}).length}/4)`
              : 'Your secret chit. Tap it — and keep a straight face. (It flips itself when the bar runs out.)'}
          </p>
        </div>
      )}

      {/* ── GUESS: announce + the Mantri hunts ── */}
      {stage === 'GUESS' && (
        <div className={styles.stageArea}>
          <div className={`${styles.announce} anim-msg`}>👑 Raja is <b>{nameOf(match.rajaId)}</b></div>
          <div className={`${styles.announce} ${styles.announce2} anim-msg`}>🧠 Mantri is <b>{nameOf(match.mantriId)}</b></div>

          <TurnTimer active seconds={secondsLeft} total={GUESS_SECS} />

          {amMantri ? (
            <>
              <p className={styles.stageHint}>🕵️ One of these two is the <b>Chor</b>. Read them. Choose.</p>
              <div className={styles.suspects}>
                {(match.suspects || []).map(id => (
                  <button key={id} className={styles.suspectCard} disabled={submitted}
                    onClick={() => { unlock(); buzz('tap'); setConfirming(id) }}>
                    <span className={styles.suspectEmoji}>🎭</span>
                    <span className={styles.suspectName}>{nameOf(id)}</span>
                    <span className={styles.suspectSub}>Chor… or Sipahi?</span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              <p className={`${styles.hunting} anim-msg`}>
                🧠 <b>{nameOf(match.mantriId)}</b> is hunting the Chor…
              </p>
              <p className={styles.stageHint}>
                {match.suspects?.includes(you)
                  ? (myRole === 'CHOR' ? '🥷 That includes YOU. Bluff like your points depend on it (they do).' : '👮 Stay calm — you have nothing to hide.')
                  : '🍿 Sit back and enjoy the interrogation. Trash talk encouraged.'}
              </p>
            </>
          )}

          {/* Confirm popup (single, irreversible pick) */}
          {confirming && (
            <div className={styles.confirmBackdrop} onClick={() => setConfirming(null)}>
              <div className={`${styles.confirmCard} anim-bounce-land`} onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
                <p className={styles.confirmText}>Accuse <b>{nameOf(confirming)}</b> of being the Chor?</p>
                <p className={styles.confirmSub}>No take-backs. Wrong pick = the Chor escapes with your 800.</p>
                <div className={styles.confirmRow}>
                  <button className="btn btn-juice" onClick={confirmGuess} disabled={submitted}>🥷 Accuse</button>
                  <button className="btn btn-ghost" onClick={() => setConfirming(null)}>Cancel</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── RESULT: full reveal + deltas + host controls ── */}
      {stage === 'RESULT' && last && (
        <div className={styles.stageArea}>
          <div className={`${styles.resultBanner} ${correct ? styles.resultGood : styles.resultBad} anim-bounce-land`}>
            {last.timeout && <span className={styles.timeoutTag}>⏰ Time up — auto-pick! </span>}
            {correct
              ? <>🎯 <b>{nameOf(match.mantriId)}</b> caught the Chor!</>
              : <>🥷 <b>{nameOf(chorId)}</b> ESCAPED with 800!</>}
          </div>

          <div className={styles.revealGrid}>
            {players.map((p, i) => {
              const role = last.roles[p.id]
              const m = ROLE_META[role] || {}
              const gained = last.gained?.[p.id] ?? 0
              return (
                <div key={p.id} className={`${styles.revealCard} ${p.id === you ? styles.revealYou : ''}`}
                  style={{ animationDelay: `${i * 0.12}s` }}>
                  {m.card && <img className={styles.revealImg} src={m.card} alt={m.label} draggable="false" />}
                  <span className={styles.revealName}>{nameOf(p.id)}</span>
                  <span className={`${styles.revealPts} ${gained > 0 ? styles.ptsPos : styles.ptsZero}`}>+{gained}</span>
                </div>
              )
            })}
          </div>

          {isHost ? (
            <div className={styles.hostRow}>
              <button className="btn btn-juice btn-lg" disabled={busy} onClick={async () => {
                setBusy(true); const r = await onNext?.(); if (!r?.ok) setErr(r?.error || ''); setBusy(false)
              }}>
                🔄 Next Round
              </button>
              <button className="btn btn-ghost" disabled={busy} onClick={async () => {
                setBusy(true); const r = await onEnd?.(); if (!r?.ok) { setErr(r?.error || ''); setBusy(false) }
              }}>
                🏁 End Game
              </button>
            </div>
          ) : (
            <p className={styles.stageHint}>⭐ Waiting for {nameOf(hostId)} to deal the next round…</p>
          )}
        </div>
      )}

      {err && <p className={styles.err} role="alert">{err}</p>}
    </div>
  )
}
