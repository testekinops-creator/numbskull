import { useCallback } from 'react'

const MUSICAL_NOTES = [
  261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, 523.25, // C4..C5
]

const SOUND_KEY = 'ns_sound_enabled'

function isSoundEnabled() {
  const v = localStorage.getItem(SOUND_KEY)
  return v === null ? true : v === 'true'
}

// ── Single shared AudioContext, unlocked on the first user gesture ──────────
// Browsers block audio created/resumed outside a user gesture. Because we play
// tones from async callbacks (after the server responds), we MUST prime the
// context up-front on the first tap/key/touch, then reuse it.
let audioCtx = null
let unlocked = false

function ensureCtx() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext
    if (!AC) return null
    audioCtx = new AC()
  }
  return audioCtx
}

function unlockAudio() {
  const ctx = ensureCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  // Play a 1-sample silent buffer to fully unlock on iOS/Safari
  try {
    const buffer = ctx.createBuffer(1, 1, 22050)
    const src = ctx.createBufferSource()
    src.buffer = buffer
    src.connect(ctx.destination)
    src.start(0)
  } catch {}
  unlocked = true
}

// Attach one-time gesture listeners as soon as this module loads.
if (typeof window !== 'undefined') {
  const onFirstGesture = () => {
    unlockAudio()
    window.removeEventListener('pointerdown', onFirstGesture)
    window.removeEventListener('keydown', onFirstGesture)
    window.removeEventListener('touchstart', onFirstGesture)
  }
  window.addEventListener('pointerdown', onFirstGesture, { once: false })
  window.addEventListener('keydown', onFirstGesture, { once: false })
  window.addEventListener('touchstart', onFirstGesture, { once: false })
}

function proximityToFrequency(proximity) {
  const idx = Math.round(proximity * (MUSICAL_NOTES.length - 1))
  return MUSICAL_NOTES[Math.max(0, Math.min(idx, MUSICAL_NOTES.length - 1))]
}

function tone(ctx, freq, startOffset = 0, dur = 0.4, type = 'sine', vol = 0.25) {
  const osc  = ctx.createOscillator()
  const gain = ctx.createGain()
  const t    = ctx.currentTime + startOffset
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  gain.gain.setValueAtTime(vol, t)
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(t)
  osc.stop(t + dur)
}

export function useSound() {
  // Call this from a real gesture handler (e.g. the Guess button) as a safety
  // net in case the global listener hasn't fired yet.
  const unlock = useCallback(() => {
    if (!unlocked) unlockAudio()
    else if (audioCtx?.state === 'suspended') audioCtx.resume().catch(() => {})
  }, [])

  const playTone = useCallback((proximity = 0) => {
    if (!isSoundEnabled()) return
    const ctx = ensureCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    try {
      const freq = proximityToFrequency(proximity)
      tone(ctx, freq, 0, 0.4, proximity >= 0.9 ? 'triangle' : 'sine', 0.28)
    } catch {}
  }, [])

  const playWin = useCallback(() => {
    if (!isSoundEnabled()) return
    const ctx = ensureCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    try {
      // little victory arpeggio
      ;[523.25, 659.25, 783.99, 1046.5].forEach((f, i) =>
        tone(ctx, f, i * 0.12, 0.5, 'triangle', 0.3)
      )
    } catch {}
  }, [])

  const playLose = useCallback(() => {
    if (!isSoundEnabled()) return
    const ctx = ensureCtx()
    if (!ctx) return
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})
    try {
      ;[392.0, 329.63, 261.63].forEach((f, i) =>
        tone(ctx, f, i * 0.14, 0.45, 'sawtooth', 0.18)
      )
    } catch {}
  }, [])

  return { playTone, playWin, playLose, unlock }
}
