// Premium "your turn" glow wrapper. Centers + caps the width to the board so the
// pulsing ring hugs the board's own frame (and has side room to bloom) instead of
// spanning the whole play column. `maxWidth` should be a touch larger than the
// board's max-width so the ring frames it with a small even gap.
export default function TurnGlow({ active, maxWidth = 460, children }) {
  return (
    <div
      className={active ? 'your-turn-glow' : undefined}
      style={{ width: '100%', maxWidth, margin: '0 auto' }}
    >
      {children}
    </div>
  )
}
