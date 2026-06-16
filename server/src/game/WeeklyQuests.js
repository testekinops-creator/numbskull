const QUEST_POOL = [
  { id: 'q_win5_gtn',   title: 'Win 5 GTN games',         goal: 5,  mode: 'GTN',  type: 'wins',    xp: 150 },
  { id: 'q_win3_bc',    title: 'Win 3 Bulls & Cows',       goal: 3,  mode: 'BC',   type: 'wins',    xp: 200 },
  { id: 'q_optimal3',   title: 'Solve GTN optimally 3×',   goal: 3,  mode: 'GTN',  type: 'optimal', xp: 250 },
  { id: 'q_daily3',     title: 'Complete 3 daily challenges', goal: 3, mode: null,  type: 'daily',   xp: 180 },
  { id: 'q_play10',     title: 'Play 10 games',            goal: 10, mode: null,   type: 'play',    xp: 100 },
  { id: 'q_multi5',     title: 'Win 5 multiplayer games',  goal: 5,  mode: null,   type: 'multi',   xp: 300 },
  { id: 'q_bc_4bulls',  title: 'Get 4 bulls in B&C',       goal: 1,  mode: 'BC',   type: 'win',     xp: 120 },
  { id: 'q_speed',      title: 'Win GTN in under 10s',     goal: 1,  mode: 'GTN',  type: 'speed',   xp: 200 },
]

export function weekSeed(date = new Date()) {
  const d = new Date(date)
  d.setHours(0,0,0,0)
  d.setDate(d.getDate() - d.getDay())
  return parseInt(d.toISOString().slice(0,10).replace(/-/g,''), 10)
}

function seededShuffle(arr, seed) {
  const a = [...arr]
  let s = seed
  const rng = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 0x100000000 }
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function getWeeklyQuests(date) {
  const seed = weekSeed(date)
  return seededShuffle(QUEST_POOL, seed).slice(0, 3)
}

export function claimQuest(questId, progress) {
  const quest = QUEST_POOL.find(q => q.id === questId)
  if (!quest) return null
  const completed = progress >= quest.goal
  return { questId, progress, goal: quest.goal, completed, xp: completed ? quest.xp : 0 }
}
