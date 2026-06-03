const TIERS = [
  { name: 'hostile',    min: 1,   max: 10  },
  { name: 'grudging',   min: 11,  max: 30  },
  { name: 'backhanded', min: 31,  max: 99  },
  { name: 'rivalry',    min: 100, max: Infinity },
]

export function getTierFromGames(totalGames = 1) {
  return TIERS.find(t => totalGames >= t.min && totalGames <= t.max)?.name || 'hostile'
}

export function getSkullExpression(lastResult, phase) {
  if (phase === 'GAME_OVER') {
    return lastResult?.won ? 'impressed' : 'annoyed'
  }
  if (!lastResult || lastResult.valid === false) return 'judging'
  if (lastResult.proximity >= 0.9) return 'evil'
  if (lastResult.proximity >= 0.6) return 'grudging'
  return 'neutral'
}
