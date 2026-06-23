import { useEffect, useRef, useState, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext.jsx'
import { usePlayer } from '../../contexts/PlayerContext.jsx'
import { AlertIcon } from '../icons/Icons.jsx'
import styles from './SocialLoginButtons.module.css'

// Compact horizontal row of premium auth icons: Google, Facebook and (optionally)
// Guest. Google/Facebook render only when their env key is configured; Guest
// renders whenever `onGuest` is supplied. Both social tokens are verified
// server-side (/auth/google, /auth/facebook).
const GOOGLE_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID
const FB_ID     = import.meta.env.VITE_FACEBOOK_APP_ID

function loadScript(id, src) {
  return new Promise((resolve, reject) => {
    const existing = document.getElementById(id)
    if (existing) {
      if (existing.dataset.loaded) return resolve()
      existing.addEventListener('load', resolve)
      existing.addEventListener('error', reject)
      return
    }
    const s = document.createElement('script')
    s.id = id; s.src = src; s.async = true; s.defer = true
    s.onload = () => { s.dataset.loaded = '1'; resolve() }
    s.onerror = reject
    document.head.appendChild(s)
  })
}

export default function SocialLoginButtons({ label = 'or continue with', onDone, onGuest }) {
  const { socialLogin } = useAuth()
  const { playerId } = usePlayer()
  const tokenClientRef = useRef(null)
  const [busy, setBusy] = useState('')   // '' | 'google' | 'facebook'
  const [err, setErr] = useState('')

  const finish = useCallback(async (provider, payload) => {
    setBusy(provider); setErr('')
    try {
      await socialLogin(provider, { ...payload, guestId: playerId })
      onDone?.()
    } catch (e) {
      setErr(e?.message || `${provider} sign-in failed`)
      setBusy('')
    }
  }, [socialLogin, playerId, onDone])

  // Google Identity Services — OAuth2 token client (custom button).
  useEffect(() => {
    if (!GOOGLE_ID) return
    let cancelled = false
    loadScript('gsi-script', 'https://accounts.google.com/gsi/client').then(() => {
      if (cancelled || !window.google?.accounts?.oauth2) return
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_ID,
        scope: 'openid email profile',
        callback: (resp) => resp?.access_token ? finish('google', { accessToken: resp.access_token }) : setBusy(''),
      })
    }).catch(() => {})
    return () => { cancelled = true }
  }, [finish])

  // Facebook JS SDK.
  useEffect(() => {
    if (!FB_ID) return
    window.fbAsyncInit = () => window.FB?.init({ appId: FB_ID, cookie: true, xfbml: false, version: 'v19.0' })
    loadScript('fb-jssdk', 'https://connect.facebook.net/en_US/sdk.js').catch(() => {})
  }, [])

  function googleClick() {
    if (!tokenClientRef.current) return
    setBusy('google'); setErr('')
    tokenClientRef.current.requestAccessToken()
  }
  function facebookClick() {
    if (!window.FB) return
    setBusy('facebook'); setErr('')
    window.FB.login(
      (resp) => resp?.authResponse?.accessToken ? finish('facebook', { accessToken: resp.authResponse.accessToken }) : setBusy(''),
      { scope: 'email' },
    )
  }

  if (!GOOGLE_ID && !FB_ID && !onGuest) return null
  const disabled = !!busy

  return (
    <div className={styles.wrap}>
      {label && (
        <div className={styles.divider}>
          <span className={styles.line} /><span className={styles.label}>{label}</span><span className={styles.line} />
        </div>
      )}

      <div className={styles.row}>
        {GOOGLE_ID && (
          <button type="button" className={styles.item} onClick={googleClick} disabled={disabled} aria-label="Continue with Google" title="Continue with Google">
            <span className={`${styles.disc} ${styles.google} ${busy === 'google' ? styles.busy : ''}`}><GoogleIcon /></span>
            <span className={styles.cap}>Google</span>
          </button>
        )}
        {FB_ID && (
          <button type="button" className={styles.item} onClick={facebookClick} disabled={disabled} aria-label="Continue with Facebook" title="Continue with Facebook">
            <span className={`${styles.disc} ${styles.facebook} ${busy === 'facebook' ? styles.busy : ''}`}><FacebookIcon /></span>
            <span className={styles.cap}>Facebook</span>
          </button>
        )}
        {onGuest && (
          <button type="button" className={styles.item} onClick={onGuest} disabled={disabled} aria-label="Continue as guest" title="Continue as guest">
            <span className={`${styles.disc} ${styles.guest}`}><GuestIcon /></span>
            <span className={styles.cap}>Guest</span>
          </button>
        )}
      </div>

      {onGuest && <p className={styles.guestNote} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><AlertIcon size={13} /> Guest progress isn’t saved</p>}
      {err && <p className={styles.err} role="alert">{err}</p>}
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 18 18" fill="none" aria-hidden="true">
      <path d="M17.64 9.2c0-.638-.057-1.252-.164-1.84H9v3.48h4.844a4.14 4.14 0 01-1.796 2.716v2.258h2.908c1.702-1.566 2.684-3.874 2.684-6.614z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.836.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  )
}

function FacebookIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M24 12c0-6.627-5.373-12-12-12S0 5.373 0 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078V12h3.047V9.356c0-3.007 1.792-4.668 4.533-4.668 1.312 0 2.686.234 2.686.234v2.953H15.83c-1.49 0-1.955.925-1.955 1.874V12h3.328l-.532 3.469h-2.796v8.385C19.612 22.954 24 17.99 24 12z" fill="#fff"/>
    </svg>
  )
}

function GuestIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="2" />
      <path d="M4 20c0-3.866 3.582-7 8-7s8 3.134 8 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
