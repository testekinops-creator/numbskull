import { v4 as uuidv4 } from 'uuid'

const cards = new Map()
const CARD_TTL_MS = 7 * 24 * 60 * 60 * 1000

export function createShareCard({ mode, guesses, won, secret, optimalMoves, timeMs, playerName }) {
  const id = uuidv4().slice(0, 8)
  cards.set(id, {
    mode, guesses, won, secret, optimalMoves, timeMs, playerName,
    createdAt: Date.now(),
  })
  return id
}

export function getShareCard(id) {
  const card = cards.get(id)
  if (!card) return null
  if (Date.now() - card.createdAt > CARD_TTL_MS) { cards.delete(id); return null }
  return card
}

export function buildShareText({ mode, guesses, won, optimalMoves, playerName }) {
  const emoji = won ? '✅' : '❌'
  const modeLabel = mode === 'GTN' ? 'Guess The Number' : 'Bulls & Cows'
  const attempts = guesses.length
  const opt = optimalMoves ? ` (optimal: ${optimalMoves})` : ''
  return `${emoji} ${playerName || 'I'} ${won ? 'solved' : 'failed'} Numbskull ${modeLabel} in ${attempts} guesses${opt}! Can you beat that? 💀 numbskull.app`
}
