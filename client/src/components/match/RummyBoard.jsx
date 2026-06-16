import { useEffect, useMemo, useState } from 'react'
import styles from './RummyBoard.module.css'

const SUIT_SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' }
const isRed = (suit) => suit === 'H' || suit === 'D'
const isJoker = (card) => card?.suit === 'JOKER'

function Card({ card, wildRank, selected, dim, onClick, small }) {
  if (!card) return null
  const joker = isJoker(card)
  const wild = !joker && card.rank === wildRank
  return (
    <button
      type="button"
      className={[
        styles.card,
        small ? styles.cardSm : '',
        (!joker && isRed(card.suit)) ? styles.red : '',
        selected ? styles.selected : '',
        dim ? styles.dim : '',
        onClick ? '' : styles.static,
      ].join(' ')}
      onClick={onClick}
      disabled={!onClick}
      aria-label={joker ? 'Joker' : `${card.rank} of ${card.suit}`}
    >
      {joker ? (
        <span className={styles.jokerFace}>🃏</span>
      ) : (
        <>
          <span className={styles.rank}>{card.rank}</span>
          <span className={styles.suit}>{SUIT_SYMBOL[card.suit]}</span>
          {wild && <span className={styles.wildPip} title="Wild joker">★</span>}
        </>
      )}
    </button>
  )
}

// Face-down stack used for opponents' hands and the closed stock.
function CardBacks({ count, onClick, label }) {
  return (
    <button type="button" className={styles.stack} onClick={onClick} disabled={!onClick} aria-label={label}>
      <span className={styles.back} />
      <span className={styles.stackCount}>{count}</span>
    </button>
  )
}

export default function RummyBoard({ match, myTurn, playerId, players = [], onDraw, onDiscard, onDeclare }) {
  const { myHand = [], handCounts = {}, discardTop, stockCount = 0, wildJoker, wildRank, hasDrawn, eliminated = [] } = match || {}

  const [selected, setSelected] = useState(() => new Set())
  const [declareMode, setDeclareMode] = useState(false)
  const [groups, setGroups] = useState([])          // array of arrays of card ids
  const [declareErr, setDeclareErr] = useState('')
  const [busy, setBusy] = useState(false)

  const handIds = useMemo(() => new Set(myHand.map(c => c.id)), [myHand])
  const groupedIds = useMemo(() => new Set(groups.flat()), [groups])
  const loose = useMemo(() => myHand.filter(c => !groupedIds.has(c.id)), [myHand, groupedIds])

  const opponents = players.filter(p => p.id !== playerId)
  const amEliminated = eliminated.includes(playerId)
  const canDraw = myTurn && !hasDrawn && !amEliminated
  const canDiscard = myTurn && hasDrawn && !amEliminated

  // If the turn passes (or times out) while you're mid-declare, drop out of
  // declare mode so you're never stuck staring at a dead "Show & Declare".
  useEffect(() => {
    if (!myTurn && declareMode) { setDeclareMode(false); setGroups([]); setSelected(new Set()); setDeclareErr('') }
  }, [myTurn, declareMode])

  function toggle(id) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function clearSelection() { setSelected(new Set()) }

  function doDiscard() {
    if (!canDiscard || selected.size !== 1) return
    const [id] = [...selected]
    onDiscard?.(id)
    clearSelection()
  }

  // ── Declare flow (tap-based grouping) ──────────────────────────────────────
  function enterDeclare() { setDeclareMode(true); setGroups([]); setDeclareErr(''); clearSelection() }
  function cancelDeclare() { setDeclareMode(false); setGroups([]); setDeclareErr(''); clearSelection() }

  function addGroup() {
    const ids = [...selected].filter(id => handIds.has(id) && !groupedIds.has(id))
    if (ids.length < 3) { setDeclareErr('A group needs at least 3 cards'); return }
    setGroups(g => [...g, ids])
    setDeclareErr('')
    clearSelection()
  }
  function removeGroup(i) { setGroups(g => g.filter((_, idx) => idx !== i)) }

  async function confirmDeclare() {
    setDeclareErr('')
    if (groupedIds.size !== 13) { setDeclareErr('Group exactly 13 cards (leave 1 to finish)'); return }
    if (loose.length !== 1) { setDeclareErr('Leave exactly 1 card to discard & finish'); return }
    setBusy(true)
    const r = await onDeclare?.(groups, loose[0].id)
    setBusy(false)
    if (r && r.ok === false) setDeclareErr(r.error || 'Could not declare')
    else if (r && r.valid === false) setDeclareErr(r.reason || 'Invalid declaration')
    // On a valid declare the match ends and this board unmounts.
  }

  return (
    <div className={styles.board}>
      {/* Opponents */}
      <div className={styles.opponents}>
        {opponents.map(o => (
          <div key={o.id} className={`${styles.opp} ${eliminated.includes(o.id) ? styles.oppOut : ''}`}>
            <span className={styles.oppName}>{o.name}{o.isBot ? ' 🤖' : ''}</span>
            <CardBacks count={handCounts[o.id] ?? 0} label={`${o.name}'s hand`} />
          </div>
        ))}
      </div>

      {/* Table: stock, discard, wild joker */}
      <div className={styles.table}>
        <div className={styles.pileCol}>
          <CardBacks count={stockCount} onClick={canDraw ? () => onDraw?.('stock') : undefined} label="Draw from stock" />
          <span className={styles.pileLabel}>Stock</span>
        </div>
        <div className={styles.pileCol}>
          {discardTop
            ? <Card card={discardTop} wildRank={wildRank} onClick={canDraw ? () => onDraw?.('discard') : undefined} />
            : <span className={styles.emptyPile} />}
          <span className={styles.pileLabel}>Discard</span>
        </div>
        <div className={styles.pileCol}>
          <Card card={wildJoker} wildRank={wildRank} />
          <span className={styles.pileLabel}>Wild</span>
        </div>
      </div>

      {/* Status line */}
      <div className={styles.status}>
        {amEliminated ? 'You are out this round'
          : canDraw ? 'Your turn — draw from a pile'
          : canDiscard ? (declareMode ? 'Make your groups, then declare' : 'Discard a card or declare')
          : "Opponent's turn…"}
      </div>

      {/* Declared groups (declare mode) */}
      {declareMode && (
        <div className={styles.groups}>
          {groups.map((g, i) => (
            <div key={i} className={styles.group}>
              {g.map(id => {
                const card = myHand.find(c => c.id === id)
                return <Card key={id} card={card} wildRank={wildRank} small />
              })}
              <button type="button" className={styles.groupX} onClick={() => removeGroup(i)} aria-label="Remove group">✕</button>
            </div>
          ))}
          {groups.length === 0 && <span className={styles.hint}>Select cards below, then “Add group”.</span>}
        </div>
      )}

      {/* My hand (loose cards) */}
      <div className={styles.handScroll}>
        <div className={styles.hand}>
          {(declareMode ? loose : myHand).map(card => (
            <Card
              key={card.id}
              card={card}
              wildRank={wildRank}
              selected={selected.has(card.id)}
              onClick={() => toggle(card.id)}
            />
          ))}
        </div>
      </div>

      {declareMode && !declareErr && (
        <div className={styles.declareHint}>
          {groupedIds.size}/13 grouped ·{' '}
          {loose.length === 1
            ? `leave “${isJoker(loose[0]) ? '🃏' : loose[0].rank + (SUIT_SYMBOL[loose[0].suit] || '')}” to finish`
            : `leave exactly 1 card to finish (${loose.length} loose)`}
        </div>
      )}
      {declareErr && <div className={styles.err}>{declareErr}</div>}

      {/* Actions */}
      <div className={styles.actions}>
        {!declareMode && (
          <>
            <button className="btn btn-juice" disabled={!canDiscard || selected.size !== 1} onClick={doDiscard}>
              Discard
            </button>
            <button className="btn btn-ghost" disabled={!canDiscard} onClick={enterDeclare}>
              Declare
            </button>
            {selected.size > 0 && (
              <button className="btn btn-ghost btn-sm" onClick={clearSelection}>Clear</button>
            )}
          </>
        )}
        {declareMode && (
          <>
            <button className="btn btn-ghost" disabled={selected.size < 3} onClick={addGroup}>Add group</button>
            <button className="btn btn-juice" disabled={busy || groupedIds.size !== 13 || loose.length !== 1} onClick={confirmDeclare}>
              {busy ? 'Checking…' : 'Show & Declare'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={cancelDeclare}>Cancel</button>
          </>
        )}
      </div>
    </div>
  )
}
