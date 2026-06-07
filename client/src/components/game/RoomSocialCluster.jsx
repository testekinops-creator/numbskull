import { useState, useEffect } from 'react'
import { useRoom } from '../../contexts/RoomContext.jsx'
import { useAuth } from '../../contexts/AuthContext.jsx'
import VoiceCall from '../match/VoiceCall.jsx'
import { UserPlusIcon, UserCheckIcon, ClockIcon } from '../icons/Icons.jsx'
import styles from './RoomSocialCluster.module.css'

// Sits between the two players (replaces the plain "vs"): a premium voice-call
// button (#1) and an add-friend button (#3). Voice is 1v1 only, so `allowVoice`
// is false in party rooms (3–8 players) where it can't form a group call.
export default function RoomSocialCluster({ roomId, opponent, allowVoice = true }) {
  const { state, sendFriendRequest, checkFriendStatus } = useRoom()
  const { isRegistered } = useAuth()
  const [err, setErr] = useState('')

  // When an opponent appears, ask whether we're already friends (a past-session
  // friendship) so the add-friend button starts hidden instead of re-showing.
  const fs = state.friendStatus
  useEffect(() => {
    if (opponent?.id && fs === 'idle' && isRegistered) checkFriendStatus(roomId)
  }, [opponent?.id, fs, isRegistered, roomId, checkFriendStatus])

  async function addFriend() {
    if (!isRegistered) { flash('Sign in to add friends'); return }
    const r = await sendFriendRequest(roomId)
    if (!r?.ok) flash(r?.error || 'Could not send request')
  }
  function flash(msg) { setErr(msg); setTimeout(() => setErr(''), 2400) }

  return (
    <div className={styles.cluster}>
      <span className={styles.vs}>VS</span>
      {opponent && (
        <div className={styles.actions}>
          {allowVoice && <VoiceCall roomId={roomId} opponentName={opponent?.name} />}
          {fs === 'friends' ? (
            <span className={styles.friendDone} title="Friends" aria-label="Friends">
              <UserCheckIcon size={20} />
            </span>
          ) : (
            <button
              className={styles.friendBtn}
              onClick={addFriend}
              disabled={fs === 'requested'}
              title={fs === 'requested' ? 'Request sent' : 'Add friend'}
              aria-label="Add friend"
            >
              {fs === 'requested' ? <ClockIcon size={20} /> : <UserPlusIcon size={20} />}
            </button>
          )}
        </div>
      )}
      {err && <span className={styles.err}>{err}</span>}
    </div>
  )
}
