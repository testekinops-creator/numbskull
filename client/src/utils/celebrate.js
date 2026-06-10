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

// SOS line claim — a quick coloured pop at the drawn line (origin in normalised
// screen coords). A combo (2+ lines from one move) gets a bigger, punchier burst.
export function celebrateSos({ x = 0.5, y = 0.5 } = {}, combo = 1) {
  if (reduced()) return
  const big = combo >= 2
  confetti({
    particleCount: big ? 80 : 26,
    spread: big ? 80 : 45,
    startVelocity: big ? 42 : 26,
    scalar: big ? 1.15 : 0.85,
    origin: { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) },
    colors: COLORS,
    ticks: big ? 140 : 90,
    zIndex: 1300,
  })
}

// Small gold pop for a badge unlock.
export function celebrateBadge() {
  if (reduced()) return
  confetti({ particleCount: 70, spread: 60, startVelocity: 35, origin: { y: 0.2 }, colors: ['#FFD740', '#00F5FF', '#FF3E8A'], zIndex: 1300 })
}
