import { useRef, useCallback } from 'react'

const MUSICAL_NOTES = [
  261.63, // C4
  293.66, // D4
  329.63, // E4
  349.23, // F4
  392.00, // G4
  440.00, // A4
  493.88, // B4
  523.25, // C5
]

const SOUND_KEY = 'ns_sound_enabled'

function isSoundEnabled() {
  const v = localStorage.getItem(SOUND_KEY)
  return v === null ? true : v === 'true'
}

function proximityToFrequency(proximity) {
  const idx = Math.round(proximity * (MUSICAL_NOTES.length - 1))
  return MUSICAL_NOTES[Math.max(0, Math.min(idx, MUSICAL_NOTES.length - 1))]
}

export function useSound() {
  const ctxRef = useRef(null)

  async function getCtx() {
    if (!ctxRef.current) {
      ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
    }
    // Must await resume — it's async and audio won't play until resolved
    if (ctxRef.current.state === 'suspended') {
      await ctxRef.current.resume()
    }
    return ctxRef.current
  }

  const playTone = useCallback(async (proximity = 0) => {
    if (!isSoundEnabled()) return
    try {
      const ctx = await getCtx()
      const freq = proximityToFrequency(proximity)
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()

      osc.type = proximity >= 0.9 ? 'triangle' : 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime)
      gain.gain.setValueAtTime(0.25, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)

      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.4)
    } catch {
      // Blocked by browser policy — ignore
    }
  }, [])

  const playWin = useCallback(async () => {
    if (!isSoundEnabled()) return
    try {
      const ctx = await getCtx()
      const freqs = [523.25, 659.25, 783.99]
      freqs.forEach((freq, i) => {
        const osc   = ctx.createOscillator()
        const gain  = ctx.createGain()
        const start = ctx.currentTime + i * 0.12
        osc.frequency.setValueAtTime(freq, start)
        osc.type = 'triangle'
        gain.gain.setValueAtTime(0.3, start)
        gain.gain.exponentialRampToValueAtTime(0.001, start + 0.5)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(start)
        osc.stop(start + 0.5)
      })
    } catch {
      // ignore
    }
  }, [])

  return { playTone, playWin }
}
