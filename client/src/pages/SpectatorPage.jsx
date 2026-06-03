import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useRoom } from '../contexts/RoomContext.jsx'
import { useSocket } from '../contexts/SocketContext.jsx'
import SkullMascot from '../components/skull/SkullMascot.jsx'
import GuessList from '../components/game/GuessList.jsx'
import styles from './SpectatorPage.module.css'

export default function SpectatorPage() {
  const { roomId } = useParams()
  const navigate = useNavigate()
  const { state, spectate } = useRoom()
  const { socket } = useSocket()
  const [liveRooms, setLiveRooms] = useState([])

  useEffect(() => {
    if (!socket) return
    if (roomId) {
      spectate(roomId)
    } else {
      socket.emit('room:list', {}, r => {
        if (r?.ok) setLiveRooms(r.rooms)
      })
    }
  }, [socket, roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  const room = state.room

  if (!roomId) {
    return (
      <div className="screen">
        <div className={`panel ${styles.spectator}`}>
          <div className={styles.header}>
            <button className="btn btn-ghost btn-sm" onClick={() => navigate('/')}>← Back</button>
            <h1 className={styles.title}>Live Games</h1>
          </div>
          {liveRooms.length === 0 ? (
            <p className={styles.empty}>No live games right now. Check back soon.</p>
          ) : (
            <ul className={styles.roomList}>
              {liveRooms.map(r => (
                <li key={r.id}>
                  <button
                    className={`${styles.roomItem} card`}
                    onClick={() => navigate(`/spectate/${r.id}`)}
                  >
                    <span className={`badge badge-juice`}>{r.mode}</span>
                    <span className={styles.roomPlayers}>
                      {r.players.map(p => p.name).join(' vs ')}
                    </span>
                    <span className={`badge ${r.phase === 'PLAYING' ? 'badge-pink' : 'badge-juice'}`}>
                      {r.phase}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    )
  }

  if (!room) {
    return (
      <div className="screen">
        <div className={styles.loading}>Connecting to game…</div>
      </div>
    )
  }

  return (
    <div className="screen">
      <div className={`panel ${styles.spectator}`}>
        <div className={styles.header}>
          <button className="btn btn-ghost btn-sm" onClick={() => navigate('/spectate')}>← All games</button>
          <span className={`badge badge-pink`}>Spectating</span>
          <span className={`badge badge-juice`}>{room.mode}</span>
        </div>

        <div className={styles.players}>
          {room.players.map((p, i) => (
            <div key={p.id} className={styles.playerCard}>
              <span className={styles.pName}>{p.name}</span>
              <span className={styles.pScore}>{p.score}</span>
            </div>
          ))}
        </div>

        <div className={styles.skullRow}>
          <SkullMascot expression="neutral" size={72} glow={false} />
          {state.roast && <p className={styles.roast}>"{state.roast}"</p>}
        </div>

        <GuessList guesses={state.guesses} mode={room.mode} />
      </div>
    </div>
  )
}
