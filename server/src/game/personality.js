const TIERS = [
  { name: 'hostile',    min: 1,   max: 10  },
  { name: 'grudging',   min: 11,  max: 30  },
  { name: 'backhanded', min: 31,  max: 99  },
  { name: 'rivalry',   min: 100, max: Infinity },
]

const MESSAGES = {
  hostile: {
    wrong_high:   ["Too high. Shocking. Not.", "Over. As in, you went over. With your big guess.", "Higher IQ required to go lower."],
    wrong_low:    ["Too low. Keep swinging, champ.", "Nope. Higher. Much higher. Like your standards should be.", "Beneath correct. Much like your gaming skills."],
    correct:      ["Fine. You got it. Enjoy it. It won't last.", "A broken clock is right twice a day. Congrats.", "Lucky. Don't mistake it for talent."],
    lose:         ["You couldn't even guess a number. Let that sink in.", "10 guesses. A number. You failed.", "I'm embarrassed FOR you."],
    win_bc:       ["4 bulls. You win. Unfortunately.", "Correct. I hope you're not proud of yourself.", "Sure. Take the win. I'm noting it."],
    pressure_15s: ["Still thinking? The number isn't going to change.", "Clock's ticking. Your neurons aren't."],
    pressure_30s: ["I've seen glaciers make faster decisions.", "Are you asleep? Should I call someone?"],
  },
  grudging: {
    wrong_high:   ["Lower. You'll get there. Eventually.", "Too high. But you're narrowing it down. I guess.", "Overshooting. Story of your life, probably."],
    wrong_low:    ["Under. Aim higher. You've got... potential. Maybe.", "Nope. But you're in the ballpark. A very large ballpark.", "Too low. Keep it up. Grudgingly."],
    correct:      ["Fine. That was... acceptable.", "You got it. Don't make it weird.", "Correct. I'm barely impressed, but it's something."],
    lose:         ["You ran out of guesses. That's on you.", "Didn't make it. Better luck understanding numbers next time.", "Out of guesses. The number was there the whole time."],
    win_bc:       ["4 bulls. You cracked it. Okay.", "Fine. You beat it. I acknowledge this.", "Code broken. Reluctantly: well done."],
    pressure_15s: ["You're taking a while. That's fine. No rush. (There is a rush.)", "Thinking time is over. Guessing time has begun."],
    pressure_30s: ["Half a minute gone. The answer remains elusive to you, apparently.", "Taking your time. I respect that. I don't like it, but I respect it."],
  },
  backhanded: {
    wrong_high:   ["Too high! But you're getting warmer. Technically.", "Overshot it. Classic you. But the instinct was right-ish.", "Down from there. You're reading the field. Just... slowly."],
    wrong_low:    ["Low! Go higher! You're building a pattern here.", "Under the mark. Your logic is sound, just... off.", "Nope! But honestly? That was a reasonable guess. For you."],
    correct:      ["Oh wow, you got it! I mean, it took you a while, but—wow.", "Correct! That's genuinely impressive. For someone who guessed wrong that many times.", "Got it! You're better at this than I like to admit."],
    lose:         ["So close on some of those. The number put up a good fight against you.", "Didn't get it, but you had a system. A bad system, but a system.", "Out of guesses. Tough run. You'll get the next one."],
    win_bc:       ["4 bulls! That's a win! You're actually decent at this.", "Code cracked! You've impressed me. Marginally.", "Bulls across the board! Respect. Backhanded respect, but respect."],
    pressure_15s: ["You're a thinker! That's valuable. That's also 15 seconds.", "Deep in the zone. I can tell. Also: please guess."],
    pressure_30s: ["Still computing. The great strategist at work. Please finish computing.", "30 seconds of pondering. Bold. Unnecessary, but bold."],
  },
  rivalry: {
    wrong_high:   ["Too high, rival. You know better than this.", "High! Come on, I've seen you do better.", "Overshoot. You're off your game today."],
    wrong_low:    ["Low. Tighten up. You're capable of more.", "Under. Focus. I need you performing.", "Not quite. We've been through this enough that you should know better."],
    correct:      ["YES. THAT'S IT. You magnificent number-guesser.", "CORRECT! This is why I keep showing up.", "There it is. Peak performance. I knew you had it."],
    lose:         ["You lost? YOU? I'm shook. The number was clearly worthy of you.", "Didn't get it. First time for everything. Regroup.", "A loss. We'll call it a strategic withdrawal."],
    win_bc:       ["4 BULLS. LEGEND. You're a codebreaker.", "Cracked it. Expected nothing less from you.", "Complete code break. We're on another level."],
    pressure_15s: ["Are you psyching yourself out? Don't. You know this.", "Take your time, rival. But also: don't take too much time."],
    pressure_30s: ["30 seconds. You're dramatizing. I love it. Guess.", "The suspense you create is unmatched. Now end it."],
  },
}

function getTier(totalGames) {
  return TIERS.find(t => totalGames >= t.min && totalGames <= t.max)?.name || 'hostile'
}

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)]
}

export function getRoastMessage(event, totalGames = 1) {
  const tier = getTier(totalGames)
  const pool = MESSAGES[tier]?.[event] || MESSAGES.hostile[event] || ['...']
  return { message: pick(pool), tier, event }
}

export { getTier, TIERS }
