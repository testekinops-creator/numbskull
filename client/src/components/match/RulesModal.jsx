import { useEffect } from 'react'
import GameIcon from '../icons/GameIcon.jsx'
import { GAME_ICON_KEY } from '../../utils/gameIcons.js'
import { CloseIcon } from '../icons/Icons.jsx'
import s from './RulesModal.module.css'

// Per-mode "How to play" content. SPIN gets the full breakdown (it's the most
// complex); the others get a concise refresher. Rendered inside a glass popup.
const RULES = {
  SPIN: {
    title: '🎡 Spin Battle',
    sections: [
      { h: 'Goal', p: 'Crack the hidden phrase shown as blanks. Reveal every letter — or solve the whole phrase on your turn — to win the round. First to 2 round wins takes the match.' },
      { h: 'On your turn', list: [
        'Spin the wheel to set a point value, then call a consonant.',
        'Buy a vowel (A E I O U) from your bank anytime — no spin needed.',
        'Or hit 💡 Solve and type the full phrase.',
      ] },
      { h: 'Scoring', list: [
        'A correct consonant pays its wedge value × how many times it appears.',
        'A correct vowel costs from your bank but reveals the letter.',
        'Solving correctly wins the round instantly.',
      ] },
      { h: 'Turn rules', list: [
        'A wrong consonant or a wrong solve passes the turn.',
        'Your missed letters are private — opponents never see them.',
        'Stall too long and you forfeit the round.',
      ] },
      { h: 'Wheel segments', list: [
        'Numbers (200–1000): points per correct consonant.',
        '💀 BANKRUPT wipes your round bank — 🛡️ SHIELD blocks it once.',
        '🔥 DOUBLE ×2 your bank · 💰 JACKPOT +1000 · 🎁 +200.',
        '🦹 STEAL takes up to 400 from the richest opponent.',
        '❄️ FREEZE skips the next player’s turn · ⛔ LOSE A TURN.',
      ] },
      { h: 'Winning', p: 'Banks reset each round. Round wins decide the match (this round’s bank breaks ties).' },
    ],
    faq: [
      { q: 'Can I re-guess a letter I missed?', a: 'No — missed letters are struck out on your keyboard (only you can see them).' },
      { q: 'What happens between rounds?', a: 'A short synced countdown reveals the answer, then the next round starts automatically.' },
    ],
  },
  XOX: {
    title: '⭕ Tic-Tac-Toe',
    sections: [
      { h: 'Goal', p: 'Get three of your marks in a row — across, down, or diagonally — before your opponent.' },
      { h: 'Turn rules', list: ['X always moves first.', 'Tap any empty square on your turn.', 'Stall too long and you forfeit.'] },
      { h: 'Winning', p: 'Best of 3. A full board with no line is a draw.' },
    ],
  },
  MATH: {
    title: '🧮 Math Battle',
    sections: [
      { h: 'Goal', p: 'You and your rival see the same question at the same time. First to lock in an answer takes it.' },
      { h: 'Scoring', list: ['Correct = +1 for you.', 'Wrong = −1 for you AND +1 for your rival — so don’t mash buttons.'] },
      { h: 'Winning', p: 'Highest score after all questions wins. Tie is a draw.' },
    ],
  },
  SUDOKU: {
    title: '🔢 Sudoku Duel',
    sections: [
      { h: 'Goal', p: 'You and your rival race to fill the SAME grid. Tap an empty cell, then a number — correct cells turn YOUR colour (cyan vs pink). Claim the most.' },
      { h: 'Combo scoring', list: ['Correct = +1, but a streak pays more: 2 in a row = +2, 3+ = +3, 5+ = +4.', 'A wrong answer is −1 AND breaks your combo.', 'Watch the lead bar 🔥 — a hot streak can swing the whole game.'] },
      { h: 'Watch out', p: 'Wrong cells turn red — only your rival can fix them. Hit the mistake limit and you forfeit. Last cells left? It’s a sprint to the finish.' },
    ],
  },
  SOS: {
    title: '🔠 SOS',
    sections: [
      { h: 'Goal', p: 'Take turns placing an S or an O on the grid. Spell S‑O‑S in any direction to score — most S‑O‑S lines when the board fills up wins.' },
      { h: 'On your turn', list: [
        'Pick S or O on the toggle, then tap an empty cell.',
        'Form an S‑O‑S (across, down, or diagonally) and you score.',
        'One move can complete more than one S‑O‑S at once.',
      ] },
      { h: 'Claiming', list: [
        'When you form an S‑O‑S the board locks — DRAW the line over it to score.',
        'Drag across the three cells (or tap a highlighted cell) to claim each line.',
        'Every line you make = +1 and another go. Draw them all to continue.',
      ] },
      { h: 'Turn timer', p: 'You get 40s per turn. Miss it and your turn passes — and your opponent pockets +2 points. So don’t dawdle.' },
      { h: 'Winning', p: 'When the board is full, the player with the most S‑O‑S lines wins. Equal lines is a draw.' },
    ],
  },
  RMCS: {
    title: '👑 Raja Mantri Chor Sipahi',
    sections: [
      { h: 'Goal', p: 'Four players, four secret roles each round: Raja (1000), Mantri (800), Sipahi (500), Chor (0). Highest total when the host ends the game wins.' },
      { h: 'Each round', list: [
        'Tap your chit to see your secret role — poker face on.',
        'When all four reveal, the Raja and Mantri are announced.',
        'The other two stay hidden: one Sipahi, one Chor.',
      ] },
      { h: 'The hunt', list: [
        'The Mantri has 60 seconds to accuse one of the two hidden players.',
        'Caught the Chor → Mantri keeps 800, Sipahi gets 500, Chor gets 0.',
        'Wrong → the Chor ESCAPES with the Mantri’s 800!',
        'Chat and emoji stay open — bluff, accuse, mislead.',
      ] },
      { h: 'Rounds', p: 'The host deals the next round (new secret roles) or ends the game. Totals carry across rounds.' },
    ],
  },
  RUMMY: {
    title: '🃏 Rummy (13-card)',
    sections: [
      { h: 'Goal', p: 'Be first to arrange all 13 cards into valid groups and declare. 2–6 players; your hand is secret — rivals see only your card count.' },
      { h: 'On your turn', list: [
        'Draw one card — from the closed stock or the open discard pile.',
        'Then discard one card to the pile (turn passes), or declare.',
        'A 45-second timer keeps things moving — miss it and a card is auto-discarded.',
      ] },
      { h: 'Valid groups', list: [
        'Run: 3+ consecutive cards of the SAME suit (e.g. 5♥ 6♥ 7♥).',
        'Set: 3–4 cards of the same rank in DIFFERENT suits.',
        'The cut wild-joker rank and the printed 🃏 jokers substitute any missing card.',
      ] },
      { h: 'Declaring', list: [
        'You need at least ONE pure sequence (a run with no joker) and TWO sequences total.',
        'Group all 13 cards, leave one to finish, then Show & Declare.',
        'A wrong declaration loses you the round — be sure before you show.',
      ] },
      { h: 'Winning', p: 'The first valid declaration wins the round (and counts toward the monthly leaderboard).' },
    ],
  },
  QUEENS: {
    title: '👑 Queens',
    sections: [
      { h: 'Goal', p: 'Everyone races the SAME colored board. Place exactly one 👑 in every row, every column AND every color region. The rest keep racing until they finish or time runs out.' },
      { h: 'Placing', list: [
        'Tap a cell to cycle: blank → 👑 → ✕ (a “no” mark to plan) → blank.',
        'No two queens may TOUCH — not even diagonally.',
        'A queen that breaks a rule glows red, so you can fix it fast.',
      ] },
      { h: 'Winning', p: 'Solve all four constraints to finish. Final standings are ranked by solve time — 🥇 fastest.' },
    ],
  },
  TANGO: {
    title: '☀️ Tango',
    sections: [
      { h: 'Goal', p: 'Fill the 6×6 grid with ☀️ Suns and 🌙 Moons so every row and column has exactly 3 of each. Everyone races the same board — fastest correct fill wins.' },
      { h: 'Rules', list: [
        'Tap a cell to cycle blank → ☀️ → 🌙 → blank.',
        'Never 3 of the same symbol in a row (across or down).',
        '“=” between two cells means they must MATCH; “×” means they must be OPPOSITE.',
        'Pre-filled cells are locked. A cell that breaks a rule glows red.',
      ] },
      { h: 'Winning', p: 'Final standings are ranked by solve time — 🥇 fastest.' },
    ],
  },
  ZIP: {
    title: '🔢 Zip',
    sections: [
      { h: 'Goal', p: 'Draw ONE path that starts at 1 and connects 2, 3, … in order — and passes through EVERY cell exactly once. Everyone races the same board; fastest wins.' },
      { h: 'Drawing', list: [
        'Drag across cells to draw the path; drag back (or Undo) to retract.',
        'Numbers must be reached in order — and the path ENDS on the highest number.',
        'Orange bars are walls — the path can never cross one.',
      ] },
      { h: 'Watch out', p: 'You must cover EVERY cell. Reaching the last number with cells still empty is a dead end — back up and route the path through them.' },
    ],
  },
  CROSSCLIMB: {
    title: '🪜 Crossclimb',
    sections: [
      { h: 'Goal', p: 'Everyone gets the SAME scrambled words. Reorder them into a ladder where each word differs from the one above it by exactly ONE letter. Fastest correct ladder wins.' },
      { h: 'Ordering', list: [
        'Use ▲ / ▼ on a rung to move it up or down.',
        'A green ✓ appears between two rungs when that pair differs by one letter.',
        'There’s only one valid ladder (and its reverse) — get every link green.',
      ] },
      { h: 'Winning', p: 'Final standings are ranked by solve time — 🥇 fastest. Don’t finish in time and you’re ranked by how many links you got right.' },
    ],
  },
  PINPOINT: {
    title: '📌 Pinpoint',
    sections: [
      { h: 'Goal', p: 'A hidden category is revealed one clue at a time. Both players see the same clues — pick the connecting category from four options before your rival does.' },
      { h: 'Scoring', list: [
        'Answer on the 1st clue = +5, 2nd = +4, … 5th = +1. The fewer clues you need, the more you score.',
        'A wrong guess locks YOU out of that round — your rival can still grab it.',
        'A new clue appears every few seconds until someone’s right (or time’s up).',
      ] },
      { h: 'Winning', p: 'Five rounds. Highest total points wins — a tie is a draw.' },
    ],
  },
  LUDO: {
    title: '🎲 Ludo',
    sections: [
      { h: 'Goal', p: 'Be the first to walk all four of your tokens around the board and into your home. 2–4 players take turns; empty seats can be filled with bots.' },
      { h: 'Turns', list: [
        'On your turn, tap Roll. You can only move a token out of its base on a 6.',
        'Tap a glowing token to move it that many steps along the track.',
        'Roll a 6 and you go again — but three 6s in a row burns your turn.',
      ] },
      { h: 'Captures & safety', list: [
        'Land exactly on a lone opponent and you send it back to its base.',
        'Star squares and coloured start squares are safe — no captures there.',
        'You need an exact roll to step into the final home — overshooting waits.',
      ] },
      { h: 'Winning', p: 'First to get all four tokens home wins. Standings rank everyone by tokens home.' },
    ],
  },
  GTN: {
    title: '🎯 Guess The Number',
    sections: [
      { h: 'Goal', p: 'You each pick a secret number. Crack your opponent’s before they crack yours.' },
      { h: 'Turn rules', list: ['Guess on your turn.', 'After each guess you’re told higher or lower.', 'Who goes first alternates each round.'] },
      { h: 'Winning', p: 'Best of 3 — first to crack the secret wins the round.' },
    ],
  },
  BC: {
    title: '🐂 Bulls & Cows',
    sections: [
      { h: 'Goal', p: 'Crack your opponent’s secret code before they crack yours.' },
      { h: 'Scoring', list: ['🐂 Bull = right digit, right position.', '🐄 Cow = right digit, wrong position.', 'Digits can repeat.'] },
      { h: 'Winning', p: 'Best of 3 — all bulls cracks the code and wins the round.' },
    ],
  },
}

export default function RulesModal({ mode = 'SPIN', onClose }) {
  // Close on Escape; lock background scroll so the room behind doesn't move.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [onClose])

  const r = RULES[mode] || RULES.SPIN

  return (
    <div className={s.backdrop} onClick={onClose} role="dialog" aria-modal="true" aria-label="How to play">
      <div className={`${s.panel} anim-slide-up`} onClick={e => e.stopPropagation()}>
        <div className={s.head}>
          <h2 className={s.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            {GAME_ICON_KEY[mode] && <GameIcon icon={GAME_ICON_KEY[mode]} size={22} />} {r.title.replace(/^\S+️?\s/, '')}
          </h2>
          <button className={s.close} onClick={onClose} aria-label="Close"><CloseIcon size={16} /></button>
        </div>
        <p className={s.sub}>How to play · scoring · rules</p>

        <div className={s.body}>
          {r.sections.map((sec, i) => (
            <section key={i} className={s.section}>
              <h3 className={s.h}>{sec.h}</h3>
              {sec.p && <p className={s.p}>{sec.p}</p>}
              {sec.list && (
                <ul className={s.list}>
                  {sec.list.map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              )}
            </section>
          ))}

          {r.faq && (
            <section className={s.section}>
              <h3 className={s.h}>FAQ</h3>
              {r.faq.map((f, i) => (
                <div key={i} className={s.faqItem}>
                  <p className={s.q}>{f.q}</p>
                  <p className={s.a}>{f.a}</p>
                </div>
              ))}
            </section>
          )}
        </div>

        <button className={`btn btn-juice ${s.gotIt}`} onClick={onClose}>Got it</button>
      </div>
    </div>
  )
}
