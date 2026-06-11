// Conservative chat profanity mask. Whole-word, case-insensitive matching so
// innocent lookalikes ("class", "assassin", "Scunthorpe") are NOT touched, and
// we MASK (with asterisks) rather than drop the message — cleaner UX than a
// silent reject. Intentionally small and curated to avoid the false positives
// that plague large block-lists. Emoji reactions are already whitelisted
// elsewhere, so this only needs to cover free-text chat.
const WORDS = [
  'fuck', 'fucker', 'fucking', 'motherfucker', 'shit', 'bullshit', 'bitch',
  'bastard', 'asshole', 'dick', 'dickhead', 'pussy', 'cunt', 'slut', 'whore',
  'nigger', 'nigga', 'faggot', 'fag', 'retard', 'rape', 'cock', 'wanker',
]

// \b word boundaries keep matches to standalone words. Sorted longest-first so
// "motherfucker" masks fully before "fucker"/"fuck" could partially match.
const PATTERN = [...WORDS].sort((a, b) => b.length - a.length).join('|')

// Mask whole-word profanity, preserving length (so "shit" → "****").
export function cleanText(text) {
  if (typeof text !== 'string') return text
  return text.replace(new RegExp(`\\b(${PATTERN})\\b`, 'gi'), (m) => '*'.repeat(m.length))
}

// True if the text contains any flagged word (handy for tests / metrics).
export function isProfane(text) {
  return new RegExp(`\\b(${PATTERN})\\b`, 'i').test(String(text || ''))
}
