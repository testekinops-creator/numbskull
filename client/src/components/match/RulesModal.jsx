import { useEffect } from 'react'
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
      { h: 'Goal', p: 'You and your rival fill the SAME grid in real time. Tap an empty cell, then a number.' },
      { h: 'Scoring', list: ['Correct = +1.', 'Wrong = −1 and the cell turns red — only your partner can fix it.', 'Highlights show peers, matching numbers, and rule conflicts.'] },
      { h: 'Watch out', p: 'Hit the per-player mistake limit and you forfeit. Finish the grid; highest score wins.' },
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
          <h2 className={s.title}>{r.title}</h2>
          <button className={s.close} onClick={onClose} aria-label="Close">✕</button>
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
