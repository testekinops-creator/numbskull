import { useState, useEffect, useRef } from 'react'
import { api } from '../../services/api.js'
import styles from './ChatPanel.module.css'

export default function ChatPanel({ open, onClose, messages, onSend }) {
  const [text, setText]         = useState('')
  const [roast, setRoast]       = useState('')
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

  async function generateRoast() {
    setGen(true)
    try {
      const data = await api.get('/game/roast')
      setRoast(data.roast)
    } catch {
      setRoast('My roast generator is broken. Kind of like your strategy.')
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

  function sendRoast() {
    if (!roast) return
    onSend(roast)
    setRoast('')
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
          {messages.map(m => (
            <div key={m.id} className={`${styles.bubble} ${m.mine ? styles.mine : styles.theirs}`}>
              {!m.mine && <span className={styles.bubbleName}>{m.fromName}</span>}
              <span className={styles.bubbleText}>{m.text}</span>
            </div>
          ))}
        </div>

        {/* AI roast generator */}
        <div className={styles.roastBox}>
          {roast ? (
            <div className={styles.roastPreview}>
              <span className={styles.roastText}>"{roast}"</span>
              <div className={styles.roastActions}>
                <button className={styles.roastRegen} onClick={generateRoast} disabled={generating}>
                  🎲
                </button>
                <button className={styles.roastSend} onClick={sendRoast}>Send roast →</button>
              </div>
            </div>
          ) : (
            <button className={styles.generateBtn} onClick={generateRoast} disabled={generating}>
              {generating ? '🤖 Generating…' : '🤖 Generate AI Roast'}
            </button>
          )}
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
