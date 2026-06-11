// Emoji-avatar system. No DB, no image hosting: an avatar is just an id that
// maps to a curated emoji + a tinted gradient disc. Every player ALWAYS has one
// — if they never picked, we derive a stable avatar from their playerId so all
// viewers (HUD, chat, leaderboard) see the exact same face for that person.

// Curated, broadly-likeable set. Order is stable — never reorder (the index is
// part of the deterministic fallback).
export const AVATARS = [
  { id: 'fox',     emoji: '🦊' },
  { id: 'wolf',    emoji: '🐺' },
  { id: 'cat',     emoji: '🐱' },
  { id: 'tiger',   emoji: '🐯' },
  { id: 'lion',    emoji: '🦁' },
  { id: 'panda',   emoji: '🐼' },
  { id: 'koala',   emoji: '🐨' },
  { id: 'bear',    emoji: '🐻' },
  { id: 'frog',    emoji: '🐸' },
  { id: 'monkey',  emoji: '🐵' },
  { id: 'owl',     emoji: '🦉' },
  { id: 'eagle',   emoji: '🦅' },
  { id: 'unicorn', emoji: '🦄' },
  { id: 'dragon',  emoji: '🐲' },
  { id: 'octopus', emoji: '🐙' },
  { id: 'shark',   emoji: '🦈' },
  { id: 'robot',   emoji: '🤖' },
  { id: 'alien',   emoji: '👽' },
  { id: 'ghost',   emoji: '👻' },
  { id: 'skull',   emoji: '💀' },
  { id: 'clown',   emoji: '🤡' },
  { id: 'ninja',   emoji: '🥷' },
  { id: 'wizard',  emoji: '🧙' },
  { id: 'crown',   emoji: '👑' },
  { id: 'fire',    emoji: '🔥' },
  { id: 'star',    emoji: '⭐' },
  { id: 'bolt',    emoji: '⚡' },
  { id: 'rocket',  emoji: '🚀' },
  { id: 'diamond', emoji: '💎' },
  { id: 'joystick',emoji: '🕹️' },
  { id: 'dice',    emoji: '🎲' },
  { id: 'sunglasses', emoji: '😎' },
]

// Tinted gradient discs — picked deterministically by the avatar id so the same
// avatar always wears the same colours, across every screen and every viewer.
const GRADS = [
  'linear-gradient(150deg, #ff6ec4, #7873f5)',
  'linear-gradient(150deg, #00f5ff, #2563eb)',
  'linear-gradient(150deg, #f7971e, #ffd200)',
  'linear-gradient(150deg, #00e676, #00b8d4)',
  'linear-gradient(150deg, #ff3e8a, #ff8a5b)',
  'linear-gradient(150deg, #a259ff, #4dccff)',
  'linear-gradient(150deg, #f54ea2, #ff7676)',
  'linear-gradient(150deg, #18cb96, #2fd8d8)',
  'linear-gradient(150deg, #6a82fb, #fc5c7d)',
  'linear-gradient(150deg, #ffd740, #f76b1c)',
]

// Cheap, stable string hash (djb2-ish) → non-negative int.
function hashStr(s) {
  let h = 5381
  const str = String(s ?? '')
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0
  return Math.abs(h)
}

const byId = new Map(AVATARS.map(a => [a.id, a]))

// Resolve to a render-ready { id, emoji, grad }.
//  - `value` is a chosen avatar id (may be null/unknown).
//  - `seed`  is a stable identity (playerId / username) used for the fallback.
// When no valid id is chosen, the fallback is deterministic in `seed`, so every
// viewer renders the identical face for the same person.
export function resolveAvatar(value, seed) {
  let entry = value && byId.get(value)
  if (!entry) entry = AVATARS[hashStr(seed ?? value ?? 'numbskull') % AVATARS.length]
  const grad = GRADS[hashStr(entry.id) % GRADS.length]
  return { id: entry.id, emoji: entry.emoji, grad }
}

export function isAvatarId(value) {
  return !!(value && byId.has(value))
}
