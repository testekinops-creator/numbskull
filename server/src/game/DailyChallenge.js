import { computeOptimalMoves } from './utils/optimal.js'

const MODES = ['GTN', 'BC']

function dateKey(date = new Date()) {
  return date.toISOString().slice(0, 10)
}

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

function deterministicSecret(mode, seed) {
  const rng = seededRandom(seed)
  if (mode === 'GTN') {
    return String(Math.floor(rng() * 100) + 1)
  }
  const digits = ['0','1','2','3','4','5','6','7','8','9']
  for (let i = digits.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [digits[i], digits[j]] = [digits[j], digits[i]]
  }
  return digits.slice(0, 4).join('')
}

function dateToSeed(dateStr) {
  return dateStr.split('-').reduce((acc, n) => acc * 100 + parseInt(n, 10), 0)
}

export function getDailyChallenge(dateStr) {
  const key = dateStr || dateKey()
  const seed = dateToSeed(key)
  const modeIndex = dateToSeed(key) % 2
  const mode = MODES[modeIndex]
  const secret = deterministicSecret(mode, seed)

  return {
    date: key,
    mode,
    secret,
    range: mode === 'GTN' ? 100 : null,
    optimalMoves: mode === 'GTN' ? computeOptimalMoves(100) : 5,
  }
}

export function todaysChallenge() {
  return getDailyChallenge(dateKey())
}
