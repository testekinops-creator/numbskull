// Cosmetics catalog (server source of truth). Two types:
//   frame — an avatar ring style; `value` is the Avatar `ring` key the client renders.
//   title — a short label shown under the username; `value` is the label string.
// Ownership lives in the existing FeatureUnlock table (feature = cosmetic `id`).
// `value` is what gets stored in User.equippedFrame / User.equippedTitle, so the
// client can render an equipped cosmetic WITHOUT needing this catalog.
//
// The default frame is the built-in 'cyan' ring (free, always available, not listed).

export const COSMETICS = [
  // ── Frames (avatar rings) ──
  { id: 'frame_bronze',  type: 'frame', name: 'Bronze Ring',  value: 'bronze',  cost: 100,  minLevel: 2 },
  { id: 'frame_silver',  type: 'frame', name: 'Silver Ring',  value: 'silver',  cost: 250,  minLevel: 4 },
  { id: 'frame_gold',    type: 'frame', name: 'Gold Ring',    value: 'gold',    cost: 500,  minLevel: 6 },
  { id: 'frame_neon',    type: 'frame', name: 'Neon Pulse',   value: 'neon',    cost: 800,  minLevel: 8 },
  { id: 'frame_rainbow', type: 'frame', name: 'Rainbow',      value: 'rainbow', cost: 1500, minLevel: 12 },
  // ── Titles (shown under the username) ──
  { id: 'title_rookie',  type: 'title', name: 'Rookie',       value: 'Rookie',           cost: 0,    minLevel: 1 },
  { id: 'title_sharp',   type: 'title', name: 'Sharpshooter', value: 'Sharpshooter',     cost: 200,  minLevel: 3 },
  { id: 'title_menace',  type: 'title', name: 'Menace',       value: 'Menace',           cost: 400,  minLevel: 5 },
  { id: 'title_legend',  type: 'title', name: 'Legend',       value: 'Numbskull Legend', cost: 1000, minLevel: 10 },
]

export const DEFAULT_FRAME = 'cyan'   // built-in ring, always available

export function getCosmetic(id) {
  return COSMETICS.find(c => c.id === id) || null
}

export function listShop() {
  return COSMETICS
}
