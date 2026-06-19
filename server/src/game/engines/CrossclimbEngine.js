// Crossclimb — a word-ladder ORDERING race. Every player gets the same set of
// words, SCRAMBLED; they reorder them so each adjacent pair differs by exactly
// one letter. Fastest correct ladder wins.
//
// Generation builds a CHORDLESS chain: the only one-letter links among the chosen
// words are the consecutive ones. That guarantees the ladder is the UNIQUE answer
// (up to reversal) — there's no shortcut and no second valid arrangement. The
// engine owns generation + validation; the answer never leaves the server (the
// player's own arrangement is enough to check), and progression lives in the
// race handlers (matchHandlers).

// A pool of common 4-letter words, chosen to be densely connected in the
// one-letter-change graph so chordless chains are easy to find.
const WORDS4 = [
  'BAKE', 'BALE', 'BALL', 'BALM', 'BAND', 'BANE', 'BANG', 'BANK', 'BARE', 'BARK',
  'BARN', 'BASE', 'BASH', 'BATE', 'BATH', 'BEAD', 'BEAK', 'BEAM', 'BEAN', 'BEAR',
  'BEAT', 'BELL', 'BELT', 'BEND', 'BENT', 'BEST', 'BIKE', 'BILE', 'BILL', 'BIND',
  'BIRD', 'BITE', 'BLOT', 'BLOW', 'BOAR', 'BOAT', 'BOLD', 'BOLT', 'BOND', 'BONE',
  'BOOK', 'BOOM', 'BOOT', 'BORE', 'BORN', 'BOSS', 'BOWL', 'BRAG', 'BRAN', 'BRAY',
  'BREW', 'BRIM', 'BROW', 'BUNK', 'BURN', 'BUSH', 'BUST', 'CAKE', 'CALF', 'CALL',
  'CALM', 'CAME', 'CAMP', 'CANE', 'CAPE', 'CARD', 'CARE', 'CARP', 'CART', 'CASE',
  'CASH', 'CAST', 'CAVE', 'CELL', 'CENT', 'CHAT', 'CHIN', 'CHIP', 'CHOP', 'CITY',
  'CLAP', 'CLAW', 'CLAY', 'CLIP', 'CLOG', 'CLOT', 'CLUB', 'COAL', 'COAT', 'CODE',
  'COIN', 'COLD', 'COLT', 'COMB', 'CONE', 'COOK', 'COOL', 'COPE', 'CORD', 'CORE',
  'CORK', 'CORN', 'COST', 'COVE', 'CRAB', 'CRAM', 'CREW', 'CROP', 'CROW', 'CUBE',
  'CURB', 'CURD', 'CURE', 'CURL', 'CURT', 'DALE', 'DAME', 'DARE', 'DARK', 'DARN',
  'DART', 'DASH', 'DATE', 'DAWN', 'DEAD', 'DEAL', 'DEAR', 'DECK', 'DEED', 'DEEP',
  'DEER', 'DELL', 'DENT', 'DESK', 'DIAL', 'DIME', 'DINE', 'DING', 'DIRE', 'DIRT',
  'DISH', 'DOCK', 'DOLL', 'DOME', 'DONE', 'DOOM', 'DOOR', 'DOSE', 'DOVE', 'DRAG',
  'DRAW', 'DREW', 'DRIP', 'DROP', 'DRUM', 'DUNE', 'DUSK', 'DUST', 'EACH', 'EARL',
  'EARN', 'EASE', 'EAST', 'FACE', 'FACT', 'FADE', 'FAIL', 'FAIR', 'FALL', 'FAME',
  'FARE', 'FARM', 'FAST', 'FATE', 'FEAR', 'FEAT', 'FEED', 'FEEL', 'FELL', 'FELT',
  'FERN', 'FILE', 'FILL', 'FILM', 'FIND', 'FINE', 'FIRE', 'FIRM', 'FISH', 'FIST',
  'FIVE', 'FLAG', 'FLAP', 'FLAT', 'FLAW', 'FLEA', 'FLED', 'FLEW', 'FLIP', 'FLOW',
  'FOAM', 'FOLD', 'FOND', 'FONT', 'FOOD', 'FOOL', 'FOOT', 'FORD', 'FORE', 'FORK',
  'FORM', 'FORT', 'FOUL', 'FOUR', 'FOWL', 'FREE', 'FRET', 'FROG', 'FUEL', 'FULL',
  'FUME', 'FUND', 'FURL', 'GAIN', 'GALE', 'GAME', 'GANG', 'GASH', 'GATE', 'GAVE',
  'GAZE', 'GEAR', 'GENE', 'GERM', 'GIFT', 'GILL', 'GIRD', 'GIRL', 'GIVE', 'GLAD',
  'GLEE', 'GLOW', 'GLUE', 'GOAL', 'GOAT', 'GOLD', 'GOLF', 'GONE', 'GONG', 'GOOD',
  'GORE', 'GOWN', 'GRAB', 'GRAY', 'GREW', 'GRID', 'GRIM', 'GRIN', 'GRIP', 'GROW',
  'GULF', 'GULL', 'GUSH', 'GUST', 'HACK', 'HAIL', 'HAIR', 'HALE', 'HALF', 'HALL',
  'HALT', 'HAND', 'HANG', 'HARD', 'HARE', 'HARK', 'HARM', 'HARP', 'HASH', 'HASP',
  'HATE', 'HAUL', 'HAVE', 'HAWK', 'HEAD', 'HEAL', 'HEAP', 'HEAR', 'HEAT', 'HEED',
  'HEEL', 'HELD', 'HELL', 'HELM', 'HERD', 'HERE', 'HERO', 'HIDE', 'HIGH', 'HIKE',
  'HILL', 'HILT', 'HIND', 'HINT', 'HIRE', 'HIVE', 'HOLD', 'HOLE', 'HOME', 'HOOD',
  'HOOK', 'HOOP', 'HOPE', 'HORN', 'HOSE', 'HOST', 'HOUR', 'HUNT', 'HURL', 'HURT',
  'HUSH', 'HYMN', 'IDLE', 'IRON', 'JADE', 'JAIL', 'JEST', 'JOIN', 'JOKE', 'JOLT',
  'JURY', 'JUST', 'KEEL', 'KEEN', 'KEEP', 'KELP', 'KICK', 'KILL', 'KIND', 'KING',
  'KISS', 'KITE', 'KNEE', 'KNOT', 'KNOW', 'LACE', 'LACK', 'LAID', 'LAIR', 'LAKE',
  'LAMB', 'LAME', 'LAMP', 'LAND', 'LANE', 'LARD', 'LARK', 'LASH', 'LAST', 'LATE',
  'LAWN', 'LEAD', 'LEAF', 'LEAK', 'LEAN', 'LEAP', 'LEFT', 'LEND', 'LENS', 'LENT',
  'LESS', 'LICE', 'LICK', 'LIFE', 'LIFT', 'LIKE', 'LILY', 'LIME', 'LIMP', 'LINE',
  'LINK', 'LINT', 'LION', 'LIST', 'LIVE', 'LOAD', 'LOAF', 'LOAN', 'LOCK', 'LODE',
  'LOFT', 'LONE', 'LONG', 'LOOK', 'LOOM', 'LOOP', 'LORD', 'LORE', 'LOSE', 'LOSS',
  'LOST', 'LOUD', 'LOVE', 'LUCK', 'LULL', 'LUMP', 'LUNG', 'LURE', 'LURK', 'LUSH',
  'LUST', 'MAID', 'MAIL', 'MAIN', 'MAKE', 'MALE', 'MALL', 'MALT', 'MANE', 'MANY',
  'MARE', 'MARK', 'MARS', 'MART', 'MASH', 'MASK', 'MAST', 'MATE', 'MATH', 'MEAL',
  'MEAN', 'MEAT', 'MEEK', 'MEET', 'MELT', 'MEND', 'MERE', 'MILD', 'MILE', 'MILK',
  'MILL', 'MIME', 'MIND', 'MINE', 'MINT', 'MIRE', 'MIST', 'MOAN', 'MOAT', 'MODE',
  'MOLD', 'MOLE', 'MOLT', 'MOOD', 'MOON', 'MOOR', 'MORE', 'MOSS', 'MOST', 'MOTH',
  'MULE', 'MUSH', 'MUST', 'MUTE', 'NAIL', 'NAME', 'NAPE', 'NEAR', 'NEAT', 'NECK',
  'NEED', 'NEST', 'NEWT', 'NICE', 'NINE', 'NODE', 'NOON', 'NOSE', 'NOTE', 'OPEN',
  'OVEN', 'PACE', 'PACK', 'PAGE', 'PAID', 'PAIL', 'PAIN', 'PAIR', 'PALE', 'PALL',
  'PALM', 'PANE', 'PANG', 'PANT', 'PARE', 'PARK', 'PART', 'PASS', 'PAST', 'PATE',
  'PATH', 'PAVE', 'PAWN', 'PEAK', 'PEAL', 'PEAR', 'PEAT', 'PEEL', 'PEEP', 'PEER',
  'PELT', 'PEND', 'PERK', 'PEST', 'PICK', 'PIER', 'PIKE', 'PILE', 'PILL', 'PINE',
  'PING', 'PINK', 'PINT', 'PIPE', 'PLAN', 'PLAY', 'PLOT', 'PLOW', 'PLUG', 'PLUM',
  'POEM', 'POET', 'POKE', 'POLE', 'POLL', 'POND', 'PONY', 'POOL', 'POOR', 'PORE',
  'PORK', 'PORT', 'POSE', 'POST', 'POUR', 'PRAY', 'PREY', 'PROP', 'PUFF', 'PULL',
  'PUMP', 'PUNT', 'PURE', 'PUSH', 'QUIT', 'RACE', 'RACK', 'RAFT', 'RAGE', 'RAID',
  'RAIL', 'RAIN', 'RAKE', 'RAMP', 'RANG', 'RANK', 'RANT', 'RARE', 'RASH', 'RATE',
  'RAVE', 'READ', 'REAL', 'REAP', 'REAR', 'REED', 'REEF', 'REEL', 'REND', 'RENT',
  'REST', 'RICE', 'RICH', 'RIDE', 'RIFT', 'RILE', 'RIME', 'RING', 'RINK', 'RIPE',
  'RISE', 'RISK', 'ROAD', 'ROAM', 'ROAR', 'ROBE', 'ROCK', 'RODE', 'ROLE', 'ROLL',
  'ROOF', 'ROOK', 'ROOM', 'ROOT', 'ROPE', 'ROSE', 'RUDE', 'RUIN', 'RULE', 'RUNG',
  'RUSH', 'RUST', 'SACK', 'SAFE', 'SAGE', 'SAID', 'SAIL', 'SAKE', 'SALE', 'SALT',
  'SAME', 'SAND', 'SANE', 'SANG', 'SANK', 'SASH', 'SAVE', 'SCAN', 'SCAR', 'SEAL',
  'SEAM', 'SEAT', 'SEED', 'SEEK', 'SEEM', 'SEEN', 'SELL', 'SEND', 'SENT', 'SHED',
  'SHIN', 'SHIP', 'SHOP', 'SHOT', 'SHOW', 'SHUT', 'SICK', 'SIDE', 'SIGH', 'SIGN',
  'SILK', 'SILL', 'SING', 'SINK', 'SITE', 'SIZE', 'SKIM', 'SKIN', 'SKIP', 'SLAB',
  'SLAM', 'SLAP', 'SLED', 'SLID', 'SLIM', 'SLIP', 'SLIT', 'SLOT', 'SLOW', 'SNAP',
  'SNIP', 'SNOW', 'SOAK', 'SOAP', 'SOAR', 'SOCK', 'SODA', 'SOFT', 'SOIL', 'SOLD',
  'SOLE', 'SOME', 'SONG', 'SOON', 'SORE', 'SORT', 'SOUL', 'SOUP', 'SOUR', 'SPAN',
  'SPAR', 'SPED', 'SPIN', 'SPIT', 'SPOT', 'SPUN', 'STAG', 'STAR', 'STAY', 'STEM',
  'STEP', 'STEW', 'STIR', 'STOP', 'STOW', 'STUB', 'STUD', 'STUN', 'SUCH', 'SUIT',
  'SUNG', 'SUNK', 'SURE', 'SWAM', 'SWAN', 'SWAP', 'SWAY', 'SWIM', 'TACK', 'TAIL',
  'TAKE', 'TALE', 'TALK', 'TALL', 'TAME', 'TANK', 'TAPE', 'TARE', 'TART', 'TASK',
  'TEAL', 'TEAM', 'TEAR', 'TELL', 'TEND', 'TENT', 'TERM', 'TEST', 'TEXT', 'THAN',
  'THAT', 'THEM', 'THEN', 'THIN', 'THIS', 'TICK', 'TIDE', 'TIDY', 'TILE', 'TILL',
  'TIME', 'TINE', 'TINT', 'TIRE', 'TOAD', 'TOIL', 'TOLD', 'TOLL', 'TOMB', 'TONE',
  'TOOK', 'TOOL', 'TORE', 'TORN', 'TOSS', 'TOUR', 'TOWN', 'TRAP', 'TRAY', 'TREE',
  'TRIM', 'TRIP', 'TROT', 'TRUE', 'TUBE', 'TUNE', 'TURF', 'TURN', 'TWIN', 'VAIN',
  'VALE', 'VANE', 'VASE', 'VAST', 'VEAL', 'VEER', 'VEIL', 'VEIN', 'VENT', 'VERB',
  'VEST', 'VICE', 'VIEW', 'VILE', 'VINE', 'VOID', 'VOLE', 'VOTE', 'WADE', 'WAGE',
  'WAIL', 'WAIT', 'WAKE', 'WALK', 'WALL', 'WAND', 'WANE', 'WANT', 'WARD', 'WARE',
  'WARM', 'WARN', 'WARP', 'WART', 'WASH', 'WASP', 'WAVE', 'WEAK', 'WEAR', 'WEED',
  'WEEK', 'WEEP', 'WELD', 'WELL', 'WELT', 'WEND', 'WENT', 'WEPT', 'WERE', 'WEST',
  'WICK', 'WIDE', 'WIFE', 'WILD', 'WILL', 'WILT', 'WIND', 'WINE', 'WING', 'WINK',
  'WIRE', 'WISE', 'WISH', 'WITH', 'WOLF', 'WOOD', 'WOOL', 'WORD', 'WORE', 'WORK',
  'WORM', 'WORN', 'YARD', 'YARN', 'YEAR', 'YELL', 'ZEST', 'ZONE',
]

function differByOne(a, b) {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) { diff++; if (diff > 1) return false }
  }
  return diff === 1
}

// Precompute the one-letter-change neighbour list once (module load).
const WORD_SET = new Set(WORDS4)
const NEIGHBORS = (() => {
  const map = new Map(WORDS4.map(w => [w, []]))
  for (let i = 0; i < WORDS4.length; i++) {
    for (let j = i + 1; j < WORDS4.length; j++) {
      if (differByOne(WORDS4[i], WORDS4[j])) {
        map.get(WORDS4[i]).push(WORDS4[j])
        map.get(WORDS4[j]).push(WORDS4[i])
      }
    }
  }
  return map
})()

function shuffle(arr, rng = Math.random) {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// A valid ladder: every adjacent pair differs by exactly one letter (≥2 words).
export function isLadder(order) {
  if (!Array.isArray(order) || order.length < 2) return false
  for (let i = 0; i + 1 < order.length; i++) {
    if (!differByOne(order[i], order[i + 1])) return false
  }
  return true
}

// How many adjacent links are already valid (progress / DNF ranking metric).
export function ladderLinks(order) {
  if (!Array.isArray(order)) return 0
  let n = 0
  for (let i = 0; i + 1 < order.length; i++) if (differByOne(order[i], order[i + 1])) n++
  return n
}

// Curated chordless ladders — a guaranteed fallback if random generation ever
// fails to find one in time. Each is verified chordless by the tests.
const FALLBACKS = [
  ['COLD', 'CORD', 'CARD', 'CART', 'CARE', 'BARE'],
  ['WARM', 'WARD', 'WORD', 'WORE', 'CORE', 'CARE'],
  ['HEAD', 'HEAL', 'HEAP', 'HEMP', 'HUMP', 'HUMS'].filter(w => WORD_SET.has(w)),
  ['LOVE', 'LORE', 'BORE', 'BONE', 'BANE', 'BAND'],
  ['FAST', 'LAST', 'LEST', 'BEST', 'BELT', 'BOLT'],
  ['MOON', 'MOOR', 'BOOR', 'BOOK', 'BOOT', 'BOLT'].filter(w => WORD_SET.has(w)),
].filter(c => c.length >= 5 && isChordless(c))

// A chain is chordless iff the only one-letter links among its words are the
// consecutive pairs — which makes the chain the UNIQUE ladder (up to reversal).
function isChordless(chain) {
  for (let i = 0; i < chain.length; i++) {
    for (let j = i + 1; j < chain.length; j++) {
      if (differByOne(chain[i], chain[j]) && j !== i + 1) return false
    }
  }
  return true
}

// Randomised DFS for a chordless simple path of the requested length.
function findChain(len, rng) {
  const starts = shuffle(WORDS4, rng)
  let budget = 60_000   // total node expansions cap (keeps worst-case bounded)

  const dfs = (path) => {
    if (path.length === len) return true
    if (budget-- <= 0) return false
    const last = path[path.length - 1]
    for (const w of shuffle(NEIGHBORS.get(last) || [], rng)) {
      if (path.includes(w)) continue
      // chordless: w must not be one-letter from any earlier word (only the last)
      let chord = false
      for (let i = 0; i < path.length - 1; i++) {
        if (differByOne(path[i], w)) { chord = true; break }
      }
      if (chord) continue
      path.push(w)
      if (dfs(path)) return true
      path.pop()
    }
    return false
  }

  for (const start of starts) {
    if (budget <= 0) break
    const path = [start]
    if (dfs(path)) return path
  }
  return null
}

export class CrossclimbEngine {
  constructor({ difficulty = 'medium', rng = Math.random } = {}) {
    this.len = difficulty === 'easy' ? 5 : difficulty === 'hard' ? 7 : 6
    const chain = findChain(this.len, rng) || pickFallback(this.len, rng)
    this.solution = chain                    // SERVER ONLY (the ordered ladder)
    this.len = chain.length
    // Scramble for display — never hand out the solved (or simply reversed) order.
    let scrambled = shuffle(chain, rng)
    let guard = 0
    while ((sameOrder(scrambled, chain) || sameOrder(scrambled, [...chain].reverse())) && guard++ < 20) {
      scrambled = shuffle(chain, rng)
    }
    this.words = scrambled                   // PUBLIC (the rungs to arrange)
  }

  // Client-safe puzzle: the scrambled rungs + length. Never the solution.
  publicPuzzle() {
    return { words: this.words, len: this.len }
  }

  // Validate a submitted ordering: must be a permutation of the puzzle words…
  check(order) {
    if (!Array.isArray(order) || order.length !== this.len) return { valid: false }
    const a = [...order].sort().join(','), b = [...this.words].sort().join(',')
    if (a !== b) return { valid: false }
    return { valid: true, solved: isLadder(order), links: ladderLinks(order) }
  }
}

function sameOrder(a, b) { return a.length === b.length && a.every((w, i) => w === b[i]) }

function pickFallback(len, rng) {
  const fits = FALLBACKS.filter(c => c.length >= len).map(c => c.slice(0, len))
  const usable = (fits.length ? fits : FALLBACKS).filter(c => isChordless(c) && c.length >= 2)
  return usable[Math.floor((rng ? rng() : Math.random()) * usable.length)] || FALLBACKS[0]
}

export { differByOne, isChordless }
