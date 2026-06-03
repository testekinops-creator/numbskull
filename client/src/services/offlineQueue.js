const QUEUE_KEY = 'ns_offline_queue'

function load() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}

function save(q) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export const OfflineQueue = {
  enqueue(item) {
    const q = load()
    q.push({ ...item, queuedAt: Date.now() })
    save(q)
  },

  async flush(apiFn) {
    if (!navigator.onLine) return 0
    const q = load()
    if (q.length === 0) return 0

    let flushed = 0
    const remaining = []
    for (const item of q) {
      try {
        await apiFn(item)
        flushed++
      } catch {
        remaining.push(item)
      }
    }
    save(remaining)
    return flushed
  },

  size() { return load().length },
  clear() { save([]) },
}

window.addEventListener('online', async () => {
  const { api } = await import('./api.js')
  await OfflineQueue.flush((item) => api.post('/daily/submit', item))
})
