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
  CROSSCLIMB: {
    win:  [
      'Climbed the ladder fastest. Mind the ego on the way down.',
      'One letter at a time, all the way to a win. Tidy.',
      'You out-laddered them. Spelling bee energy, respect.',
    ],
    lose: [
      'Stuck on the bottom rung while they reached the top.',
      'Six words. One order. You found a different one. Wrong, but creative.',
      'Out-climbed. The ladder remains undefeated for you.',
    ],
    draw: [
      'A tie — two ladders, equally wobbly.',
      'Dead even. You both squinted at the same rungs.',
    ],
  },
  PINPOINT: {
    win:  [
      'Pinned it on the first clue, did you? Show-off.',
      'You connected the dots faster. The dots are unimpressed.',
      'A win built on vibes and one lucky guess. We saw it.',
    ],
    lose: [
      'Five clues and you still picked the decoy. Bold.',
      'The category was right there. You waved as it passed.',
      'Outguessed. By a human. Sit with that.',
    ],
    draw: [
      'Dead even — two minds, equally confused.',
      'A tie. You both squinted at the same clues for nothing.',
    ],
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
  SOS: {
    win: [
      'Three letters, one big ego. Enjoy your S‑O‑S supremacy.',
      'You spelled victory in the most literal way possible.',
      'More lines than a kindergarten worksheet. Well done, champ.',
    ],
    lose: [
      'Outspelled. By three letters. Let that one sink in.',
      'You had ONE word to make and still fumbled it.',
      'S‑O‑S — fitting, since your strategy was a distress signal.',
    ],
    draw: [
      'A tie. You both ran out of letters and ideas simultaneously.',
      'Dead even. The board is as confused as you are.',
    ],
  },
  RMCS: {
    win: [
      'Crowned in a game of liars. Says a lot about your skill set.',
      'Top of the court. The Chor respects you. The Chor IS you, probably.',
      'You read faces like a cheap palm reader — and somehow it worked.',
    ],
    lose: [
      'Outbluffed by your own friends. Awkward family dinner energy.',
      'The Chor walked off with the points AND your dignity.',
      'Four roles in the game and yours was apparently "decoration".',
    ],
    draw: [
      'A tie in a bluffing game means nobody believed anybody. Healthy.',
      'Even the Raja is embarrassed by this scoreline.',
    ],
  },
}

export function getModeRoast(mode, event) {
  const pool = ROASTS[mode]?.[event]
  if (!pool || !pool.length) return null
  return pool[Math.floor(Math.random() * pool.length)]
}
