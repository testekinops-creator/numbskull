// Guest mode is an intentional per-SESSION choice (sessionStorage → resets on a
// new tab). Kept in its own tiny module (no imports) so both AuthContext and the
// auth pages can use it without a circular dependency.
const GUEST_KEY = 'ns_guest_mode'

export function setGuestMode() {
  sessionStorage.setItem(GUEST_KEY, '1')
  localStorage.removeItem(GUEST_KEY)   // clean up any stale flag from old builds
}

export function isGuestMode() {
  return !!sessionStorage.getItem(GUEST_KEY)
}

export function clearGuestMode() {
  sessionStorage.removeItem(GUEST_KEY)
}
