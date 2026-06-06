import confetti from 'canvas-confetti'

// Honor the user's reduce-motion preference — no confetti if they opted out.
const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches

const COLORS = ['#00F5FF', '#FF3E8A', '#FFD740', '#7C4DFF', '#00E676']

// Big win celebration: a center burst + two side cannons.
export function celebrateWin() {
  if (reduced()) return
  confetti({ particleCount: 130, spread: 75, startVelocity: 45, origin: { y: 0.6 }, colors: COLORS, zIndex: 1300 })
  setTimeout(() => confetti({ particleCount: 55, angle: 60,  spread: 55, origin: { x: 0 }, colors: COLORS, zIndex: 1300 }), 160)
  setTimeout(() => confetti({ particleCount: 55, angle: 120, spread: 55, origin: { x: 1 }, colors: COLORS, zIndex: 1300 }), 160)
}

// Small gold pop for a badge unlock.
export function celebrateBadge() {
  if (reduced()) return
  confetti({ particleCount: 70, spread: 60, startVelocity: 35, origin: { y: 0.2 }, colors: ['#FFD740', '#00F5FF', '#FF3E8A'], zIndex: 1300 })
}
