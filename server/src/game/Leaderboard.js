const BOARDS = {
  gtn_alltime:  [],
  bc_alltime:   [],
  gtn_weekly:   { entries: [], weekKey: '' },
  bc_weekly:    { entries: [], weekKey: '' },
  daily:        new Map(),
}

function weekKey(date = new Date()) {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - d.getDay())
  return d.toISOString().slice(0, 10)
}

function mergeSorted(arr, entry, limit = 100) {
  const existing = arr.findIndex(e => e.playerId === entry.playerId)
  if (existing !== -1) {
    if (entry.score > arr[existing].score) arr[existing] = entry
    else return arr
  } else {
    arr.push(entry)
  }
  arr.sort((a, b) => b.score - a.score || a.attempts - b.attempts)
  if (arr.length > limit) arr.length = limit
  return arr
}

export function submitScore({ playerId, playerName, mode, score, attempts, date }) {
  const modeKey = mode === 'GTN' ? 'gtn' : 'bc'
  mergeSorted(BOARDS[`${modeKey}_alltime`], { playerId, playerName, score, attempts })

  const wk = weekKey()
  const board = BOARDS[`${modeKey}_weekly`]
  if (board.weekKey !== wk) { board.entries = []; board.weekKey = wk }
  mergeSorted(board.entries, { playerId, playerName, score, attempts })

  if (date) {
    if (!BOARDS.daily.has(date)) BOARDS.daily.set(date, [])
    mergeSorted(BOARDS.daily.get(date), { playerId, playerName, score, attempts, mode })
  }
}

export function getLeaderboard(type, { date } = {}) {
  switch (type) {
    case 'gtn_alltime':  return [...BOARDS.gtn_alltime].slice(0, 50)
    case 'bc_alltime':   return [...BOARDS.bc_alltime].slice(0, 50)
    case 'gtn_weekly':   return [...BOARDS.gtn_weekly.entries].slice(0, 50)
    case 'bc_weekly':    return [...BOARDS.bc_weekly.entries].slice(0, 50)
    case 'daily':        return date ? [...(BOARDS.daily.get(date) || [])] : []
    default:             return []
  }
}

export function getPlayerRank(playerId, type) {
  const board = getLeaderboard(type)
  const idx = board.findIndex(e => e.playerId === playerId)
  return idx === -1 ? null : idx + 1
}
