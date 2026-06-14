/* global __APP_VERSION__, __BUILD_TIME__, __COMMIT_SHA__, __COMMIT_MSG__ */
// Build-time app info, injected by Vite `define` (see vite.config.js). The commit
// fields come from Vercel's build env, so they refresh on every deploy. `typeof`
// guards keep this safe if the defines are ever absent (e.g. an odd test runner).
export const APP_VERSION = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
export const BUILD_TIME  = typeof __BUILD_TIME__  !== 'undefined' ? __BUILD_TIME__  : ''
export const COMMIT_SHA  = typeof __COMMIT_SHA__  !== 'undefined' ? __COMMIT_SHA__  : ''
export const COMMIT_MSG  = typeof __COMMIT_MSG__  !== 'undefined' ? __COMMIT_MSG__  : ''

// e.g. "v1.0.0 · a1b2c3d" (sha omitted locally where it's empty).
export const VERSION_LINE = `v${APP_VERSION}${COMMIT_SHA ? ` · ${COMMIT_SHA}` : ''}`

export const BUILD_DATE = BUILD_TIME
  ? new Date(BUILD_TIME).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  : ''
