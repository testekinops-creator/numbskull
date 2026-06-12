import { v4 as uuidv4 } from 'uuid'

// Bots fill empty seats so a Raja Mantri table can start with 1–3 humans instead
// of needing exactly 4. They're server-only "virtual players": no socket, they
// auto-reveal their chit and (if they draw the Mantri) make an honest coin-flip
// guess. Avatar ids match the client AVATARS set so they render normally.
const BOT_NAMES   = ['Botu', 'Chip', 'Pixel', 'Glitch', 'Circuit', 'Sprocket', 'Cogsworth', 'Data']
const BOT_AVATARS = ['robot', 'alien', 'ghost', 'dragon', 'octopus', 'wizard']

export function isBotId(id) {
  return typeof id === 'string' && id.startsWith('bot_')
}

// Make a bot seat-filler. `takenNames` = names already in the room (avoid dupes).
export function makeBot(takenNames = []) {
  const free = BOT_NAMES.filter(n => !takenNames.includes(n))
  const pool = free.length ? free : BOT_NAMES
  const name = pool[Math.floor(Math.random() * pool.length)]
  const avatar = BOT_AVATARS[Math.floor(Math.random() * BOT_AVATARS.length)]
  return { id: `bot_${uuidv4()}`, name, avatar, isBot: true, ready: true, score: 0 }
}

// The Mantri bot has no observable information, so it's a fair coin-flip — the
// social-deduction edge belongs to the humans, not the filler.
export function botPickSuspect(suspects = []) {
  return suspects[Math.floor(Math.random() * suspects.length)]
}
