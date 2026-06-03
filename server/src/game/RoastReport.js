import { computeOptimalMoves } from './utils/optimal.js'

function buildGTNOptimalPath(secret, range = 100) {
  const path = []
  let low = 1, high = range
  while (low <= high) {
    const guess = Math.floor((low + high) / 2)
    path.push(guess)
    if (guess === secret) break
    if (guess < secret) low = guess + 1
    else high = guess - 1
  }
  return path
}

function roastEfficiency(optimal, actual) {
  const ratio = optimal / actual
  if (ratio >= 1)   return { grade: 'S', label: 'Optimal', comment: "You played like a machine. Terrifyingly good." }
  if (ratio >= 0.8) return { grade: 'A', label: 'Sharp',   comment: "Close to optimal. You almost impressed me." }
  if (ratio >= 0.6) return { grade: 'B', label: 'Decent',  comment: "Not bad. 'Not bad' is the highest praise I'll give." }
  if (ratio >= 0.4) return { grade: 'C', label: 'Sloppy',  comment: "You got there. Eventually. Through sheer stubbornness." }
  return               { grade: 'D', label: 'Chaotic',  comment: "I've seen random number generators do better." }
}

export function generateRoastReport({ mode, secret, guesses, timeMs }) {
  if (mode === 'GTN') {
    const secretNum = parseInt(secret, 10)
    const range = 100
    const optimalPath = buildGTNOptimalPath(secretNum, range)
    const optimal = optimalPath.length
    const actual = guesses.length
    const efficiency = roastEfficiency(optimal, actual)

    const wastedGuesses = guesses.filter((g, i) => {
      const opt = optimalPath[i]
      return opt != null && Math.abs(g - opt) > range * 0.1
    }).length

    return {
      mode, secret: secretNum,
      optimal, actual,
      efficiency,
      optimalPath,
      wastedGuesses,
      timeMs,
      grade: efficiency.grade,
      comment: efficiency.comment,
    }
  }

  if (mode === 'BC') {
    const optimal = 5
    const actual = guesses.length
    const efficiency = roastEfficiency(optimal, actual)
    return {
      mode, secret,
      optimal, actual,
      efficiency,
      grade: efficiency.grade,
      comment: efficiency.comment,
      timeMs,
    }
  }

  return null
}
