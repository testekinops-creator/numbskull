import { useState, useEffect } from 'react'

// ── Premium background music, synthesised live with the Web Audio API ───────
// No audio files are shipped (and no copyrighted tracks): each game gets its own
// procedurally-generated loop — a slow chord pad + arpeggio + soft bass over a
// 4-chord progression, lowpass-filtered with a touch of delay for space. Themes
// differ by key, tempo, timbre and progression so every game feels distinct.

const ENABLED_KEY = 'ns_music_enabled'   // 'true' | 'false' (default ON)
const MUSIC_LEVEL = 0.5                   // overall loudness — sits behind SFX

export function isMusicEnabled() {
  return localStorage.getItem(ENABLED_KEY) !== 'false'
}

// Pub/sub so the toggle button and the player controller stay in lockstep.
const listeners = new Set()
export function setMusicEnabled(on) {
  localStorage.setItem(ENABLED_KEY, on ? 'true' : 'false')
  listeners.forEach(fn => { try { fn(on) } catch {} })
}

export function useMusicEnabled() {
  const [on, setOn] = useState(isMusicEnabled)
  useEffect(() => { listeners.add(setOn); return () => listeners.delete(setOn) }, [])
  return [on, setMusicEnabled]
}

// Which game's music a route wants (null = none / silence).
export function modeForRoute(pathname, roomMode) {
  if (pathname.startsWith('/play/')) {
    const seg = pathname.split('/')[2]
    return seg ? seg.toUpperCase() : null
  }
  if (pathname.startsWith('/room/')) return roomMode || null
  return null
}

// ── Themes ──────────────────────────────────────────────────────────────
// Progressions = chords as semitone offsets from the theme root.
const PROG = {
  A: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],   // i–VI–III–VII  (cool / minor)
  B: [[0, 4, 7], [7, 11, 14], [9, 12, 16], [5, 9, 12]], // I–V–vi–IV     (uplifting / major)
  C: [[0, 3, 7], [-2, 2, 5], [-4, 0, 3], [-2, 2, 5]],   // i–VII–VI–VII  (hypnotic)
}
const THEMES = {
  GTN:     { root: 220.00, bpm: 72,  wave: 'sine',     cutoff: 1400, prog: 'A' }, // mysterious
  SUDOKU:  { root: 174.61, bpm: 66,  wave: 'sine',     cutoff: 1200, prog: 'A' }, // calm
  SPIN:    { root: 261.63, bpm: 92,  wave: 'triangle', cutoff: 2200, prog: 'B' }, // bright
  MATH:    { root: 293.66, bpm: 104, wave: 'triangle', cutoff: 2400, prog: 'B' }, // crisp
  BC:      { root: 233.08, bpm: 84,  wave: 'triangle', cutoff: 1800, prog: 'C' }, // playful
  XOX:     { root: 196.00, bpm: 88,  wave: 'sine',     cutoff: 1700, prog: 'C' }, // retro
  default: { root: 220.00, bpm: 78,  wave: 'sine',     cutoff: 1500, prog: 'A' },
}
const ARP = [0, 2, 1, 2, 0, 1, 2, 1]   // chord-note index per 8th-note step

// ── Audio graph (built once, lazily) ────────────────────────────────────
let ctx = null, master = null, filter = null
let running = false, timer = null
let theme = THEMES.default
let nextTime = 0, step = 0, bar = 0

function ensureCtx() {
  if (ctx) return ctx
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  ctx = new AC()
  master = ctx.createGain(); master.gain.value = 0
  filter = ctx.createBiquadFilter()
  filter.type = 'lowpass'; filter.frequency.value = 1500; filter.Q.value = 0.6
  // gentle feedback delay → a sense of space
  const delay = ctx.createDelay(1.0); delay.delayTime.value = 0.34
  const fb = ctx.createGain(); fb.gain.value = 0.27
  const wet = ctx.createGain(); wet.gain.value = 0.22
  filter.connect(master)
  filter.connect(delay); delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master)
  master.connect(ctx.destination)
  return ctx
}

const freq = (root, semi) => root * Math.pow(2, semi / 12)

function note(t, f, dur, type, vol, attack = 0.005) {
  const o = ctx.createOscillator(), g = ctx.createGain()
  o.type = type
  o.frequency.setValueAtTime(f, t)
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(vol, t + attack)
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  o.connect(g); g.connect(filter)
  o.start(t); o.stop(t + dur + 0.05)
}

function scheduleStep(stepIdx, t) {
  const chord = PROG[theme.prog][bar]
  const beat = 60 / theme.bpm
  if (stepIdx === 0) {
    // pad: full chord, slow swell across the bar
    chord.forEach(s => note(t, freq(theme.root, s), beat * 4 * 0.98, theme.wave, 0.05, beat * 0.6))
    // soft bass on beats 1 & 3
    note(t, freq(theme.root, chord[0] - 12), beat * 1.4, 'sine', 0.10)
    note(t + beat * 2, freq(theme.root, chord[0] - 12), beat * 1.4, 'sine', 0.09)
  }
  // arpeggio an octave up, with a little human velocity wobble
  const idx = ARP[stepIdx] % chord.length
  note(t, freq(theme.root, chord[idx] + 12), beat * 0.5, theme.wave, 0.06 + Math.random() * 0.035)
}

function tick() {
  const stepDur = (60 / theme.bpm) / 2
  while (nextTime < ctx.currentTime + 0.12) {
    scheduleStep(step, nextTime)
    step = (step + 1) % 8
    if (step === 0) bar = (bar + 1) % 4
    nextTime += stepDur
  }
}

export function playMusicFor(mode) {
  if (!isMusicEnabled()) return
  const c = ensureCtx(); if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  theme = THEMES[mode] || THEMES.default
  filter.frequency.setTargetAtTime(theme.cutoff, c.currentTime, 0.3)
  master.gain.cancelScheduledValues(c.currentTime)
  master.gain.setTargetAtTime(MUSIC_LEVEL, c.currentTime, 0.5)   // fade in
  if (!running) {
    running = true
    nextTime = c.currentTime + 0.1
    step = 0; bar = 0
    timer = setInterval(tick, 25)
  }
}

export function stopMusic() {
  if (!ctx) return
  master.gain.cancelScheduledValues(ctx.currentTime)
  master.gain.setTargetAtTime(0, ctx.currentTime, 0.3)          // fade out
  if (timer) { clearInterval(timer); timer = null }
  running = false
}

// Pause when the tab is hidden; resume when it returns (if a track is active).
// Also re-resume on any gesture in case the browser suspended us after autoplay.
if (typeof window !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!ctx) return
    if (document.hidden) ctx.suspend?.().catch(() => {})
    else if (running) ctx.resume?.().catch(() => {})
  })
  const resume = () => { if (ctx && ctx.state === 'suspended' && running) ctx.resume().catch(() => {}) }
  window.addEventListener('pointerdown', resume)
  window.addEventListener('keydown', resume)
}
