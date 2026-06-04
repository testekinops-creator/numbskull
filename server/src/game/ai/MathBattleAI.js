// Difficulty-tuned behaviour for the single-player Math Battle AI.
// The AI "buzzes in" after a random delay (the player races this clock) and
// answers correctly with a difficulty-based probability.

const ACCURACY = { easy: 0.55, medium: 0.75, hard: 0.92 }

// Buzz-in delay window in ms — lower = the AI answers faster (harder to beat).
const BUZZ_MS = {
  easy:   [2600, 5200],
  medium: [1900, 3800],
  hard:   [1200, 2600],
}

export const MathBattleAI = {
  answersCorrectly(difficulty = 'medium') {
    const p = ACCURACY[difficulty] ?? ACCURACY.medium
    return Math.random() < p
  },

  buzzDelayMs(difficulty = 'medium') {
    const [lo, hi] = BUZZ_MS[difficulty] || BUZZ_MS.medium
    return Math.floor(Math.random() * (hi - lo)) + lo
  },
}
