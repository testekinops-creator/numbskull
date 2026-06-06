import { useState } from 'react'
import { useRoom } from '../../contexts/RoomContext.jsx'
import { useAuth } from '../../contexts/AuthContext.jsx'
import VoiceCall from '../match/VoiceCall.jsx'
import styles from './RoomSocialCluster.module.css'

// Sits between the two players (replaces the plain "vs"): a premium voice-call
// button (#1) and an add-friend button (#3).
export default function RoomSocialCluster({ roomId, opponent }) {
  const { state, sendFriendRequest } = useRoom()
  const { isRegistered } = useAuth()
  const [err, setErr] = useState('')

  async function addFriend() {
    if (!isRegistered) { flash('Sign in to add friends'); return }
    const r = await sendFriendRequest(roomId)
    if (!r?.ok) flash(r?.error || 'Could not send request')
  }
  function flash(msg) { setErr(msg); setTimeout(() => setErr(''), 2400) }

  const fs = state.friendStatus

  return (
    <div className={styles.cluster}>
      <span className={styles.vs}>VS</span>
      {opponent && (
        <div className={styles.actions}>
          <VoiceCall roomId={roomId} opponentName={opponent?.name} />
          {fs === 'friends' ? (
            <span className={styles.friendDone} title="Friends" aria-label="Friends">🤝</span>
          ) : (
            <button
              className={styles.friendBtn}
              onClick={addFriend}
              disabled={fs === 'requested'}
              title={fs === 'requested' ? 'Request sent' : 'Add friend'}
              aria-label="Add friend"
            >
              {fs === 'requested' ? '⏳' : '🙋'}
            </button>
          )}
        </div>
      )}
      {err && <span className={styles.err}>{err}</span>}
    </div>
  )
}
