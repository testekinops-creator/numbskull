const TURN_LIMIT_MS = 30_000

export class TurnTimer {
  constructor(roomId, onExpire) {
    this._roomId = roomId
    this._onExpire = onExpire
    this._handle = null
  }

  start(ms = TURN_LIMIT_MS) {
    this.clear()
    this._handle = setTimeout(() => {
      this._onExpire(this._roomId)
    }, ms)
  }

  clear() {
    if (this._handle) {
      clearTimeout(this._handle)
      this._handle = null
    }
  }

  get active() { return this._handle !== null }
}

const timers = new Map()

export function getTimer(roomId, onExpire) {
  if (!timers.has(roomId)) {
    timers.set(roomId, new TurnTimer(roomId, onExpire))
  }
  return timers.get(roomId)
}

export function clearTimer(roomId) {
  timers.get(roomId)?.clear()
  timers.delete(roomId)
}
