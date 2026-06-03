// Combinatorial roast generator — produces short, punchy roasts.
// Thousands of combinations so each "Generate" feels fresh & AI-written.

const OPENERS = [
  'Bro',
  'Listen',
  'Honestly',
  'No offense but',
  'Not gonna lie,',
  'Real talk,',
  'My guy',
  'Sweetie',
  'Champ',
  'Buddy',
  'Okay but',
  'I mean,',
]

const JABS = [
  'my grandma guesses faster than you',
  'a coin flip has better strategy than you',
  'you play like the wifi is buffering your brain',
  'even the loading screen is more entertaining',
  'I’ve seen toddlers count better',
  'your guesses are a cry for help',
  'are you guessing or just mashing keys?',
  'the numbers are scared of you — that’s why you can’t find them',
  'you’re speedrunning losing',
  'this is painful to watch and I don’t even have eyes',
  'your strategy is "vibes" and the vibes are off',
  'you couldn’t find water if you fell out of a boat',
  'I’d say good luck but luck gave up on you',
  'your brain buffering is showing',
  'a magic 8-ball would carry your whole account',
  'you’re proof that practice does NOT make perfect',
  'the calculator is filing a restraining order',
  'you guess like you’re allergic to winning',
]

const CLOSERS = [
  '💀',
  'just saying.',
  'no cap.',
  'and that’s the nice version.',
  '...embarrassing.',
  'do better.',
  'I’m rooting for you. Kind of.',
  'L + ratio.',
  'it’s giving "participation trophy".',
  'touch grass after this.',
  'skill issue.',
  'anyway, your turn 😬',
  '',
  '',
]

// Some standalone one-liners for variety
const ONE_LINERS = [
  'You vs the number: the number is winning. Badly.',
  'I’ve recalculated — you’re still losing.',
  'Plot twist: the number was inside you all along. You still missed it.',
  'Breaking news: local player discovers new ways to be wrong.',
  'Your guesses have less direction than a lost tourist.',
  'That guess was so bad the server flinched.',
  'You’re not bad at this… you’re historically bad at this.',
  'Even random.org is laughing at you.',
  'I optimized my roasts. You should try optimizing your guesses.',
  'Confidence: 100%. Accuracy: 2%. Iconic.',
]

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function generateRoast() {
  // 30% chance of a standalone one-liner, else combinatorial
  if (Math.random() < 0.3) return pick(ONE_LINERS)

  const opener = pick(OPENERS)
  const jab    = pick(JABS)
  const closer = pick(CLOSERS)

  let roast = `${opener} ${jab}`
  if (closer) roast += ` ${closer}`
  // Capitalize first letter
  return roast.charAt(0).toUpperCase() + roast.slice(1)
}
