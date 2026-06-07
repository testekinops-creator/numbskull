import { useState, useEffect, useRef } from 'react'
import { useAutoAnimate } from '@formkit/auto-animate/react'
import { api } from '../../services/api.js'
import styles from './ChatPanel.module.css'

export default function ChatPanel({ open, onClose, messages, onSend }) {
  const [listRef] = useAutoAnimate()
  const [text, setText]         = useState('')
  const [generating, setGen]    = useState(false)
  const logRef = useRef(null)

  // Auto-scroll to newest message
  useEffect(() => {
    if (open && logRef.current) {
      logRef.current.scrollTop = logRef.current.scrollHeight
    }
  }, [messages, open])

  // Close on Escape
  useEffect(() => {
    if (!open) return
    const h = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])

  // AI roast generates AND sends instantly — no preview/Send step.
  // (Manually typed messages still use the Send button below.)
  async function roastAndSend() {
    if (generating) return
    setGen(true)
    try {
      const data = await api.get('/game/roast')
      onSend(data.roast || 'My roast generator is broken. Kind of like your strategy.')
    } catch {
      onSend('My roast generator is broken. Kind of like your strategy.')
    } finally {
      setGen(false)
    }
  }

  function sendText() {
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }

  return (
    <>
      <div
        className={`${styles.backdrop} ${open ? styles.backdropVisible : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <div className={`${styles.sheet} ${open ? styles.sheetOpen : ''}`} role="dialog" aria-label="Chat">
        <div className={styles.handle} />

        <div className={styles.header}>
          <h3 className={styles.title}>💬 Trash Talk</h3>
          <button className={styles.closeBtn} onClick={onClose} aria-label="Close">✕</button>
        </div>

        {/* Message log */}
        <div className={styles.log} ref={logRef}>
          {messages.length === 0 && (
            <p className={styles.empty}>No messages yet. Start the mind games. 😈</p>
          )}
          <div ref={listRef}>
            {messages.map(m => (
              <div key={m.id} className={`${styles.bubble} ${m.mine ? styles.mine : styles.theirs}`}>
                {!m.mine && <span className={styles.bubbleName}>{m.fromName}</span>}
                <span className={styles.bubbleText}>{m.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* AI roast — generates and fires instantly */}
        <div className={styles.roastBox}>
          <button className={styles.generateBtn} onClick={roastAndSend} disabled={generating}>
            {generating ? '🤖 Roasting…' : '🤖 Roast them (instant AI)'}
          </button>
        </div>

        {/* Free text input */}
        <form className={styles.inputRow} onSubmit={e => { e.preventDefault(); sendText() }}>
          <input
            className={styles.input}
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type a message…"
            maxLength={200}
            aria-label="Chat message"
          />
          <button type="submit" className={styles.sendBtn} disabled={!text.trim()}>Send</button>
        </form>
      </div>
    </>
  )
}
