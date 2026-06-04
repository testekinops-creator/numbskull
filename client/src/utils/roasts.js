// Mode-specific roast lines. Each new game gets taunts that fit its vibe,
// surfaced on the game-over screen (and a few mid-game spots).
const ROASTS = {
  XOX: {
    win:  [
      'Three in a row and a smug little grin. Enjoy it while it lasts.',
      'You beat a 3×3 grid. Hold the applause… actually, hold all of it.',
      'A win! Even a stopped clock lines up twice a day.',
    ],
    lose: [
      'Outwitted by noughts and crosses. Bold of you to even sit down.',
      'Nine squares. NINE. And you still found a way to lose.',
      'That board has more strategy than you do, and it’s cardboard.',
    ],
    draw: [
      'A draw — the participation trophy of outcomes.',
      'Nobody won. Somehow that feels exactly right for you.',
    ],
  },
  MATH: {
    win:  [
      'Numbers fear you. Very, very mildly.',
      'Sharp work. For a carbon-based life form.',
      'You did maths fast AND right. I’m almost impressed. Almost.',
    ],
    lose: [
      'The calculator is filing a restraining order.',
      'Math: 1. You: also technically a number, just a smaller one.',
      'Speed without accuracy. The human special.',
    ],
    draw: [
      'Dead even. Beautifully, perfectly mediocre.',
      'A tie. You both get to feel slightly disappointed.',
    ],
    correct: ['Correct — don’t let it go to your head.', 'Right! A broken clock, etc.'],
    wrong:   ['Wrong. Confidently wrong, even.', 'That’s a no. Try using your fingers.'],
  },
  SUDOKU: {
    win:  [
      'You out-numbered your partner. Petty. I respect it.',
      'Grid conquered. Barely. With help. But sure, your win.',
    ],
    lose: [
      'Your partner basically carried you across that grid.',
      'Even the empty cells were judging your choices.',
    ],
    draw: [
      'A perfectly balanced disappointment. Thanos would weep.',
      'Tied. You filled squares together and learned nothing.',
    ],
    wrong: ['Red again? The grid is blushing on your behalf.', 'Wrong number. Bold, chaotic strategy.'],
  },
}

export function getModeRoast(mode, event) {
  const pool = ROASTS[mode]?.[event]
  if (!pool || !pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
