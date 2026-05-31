import type { User } from './models'

export interface AuthSession {
  accessToken: string
  refreshToken: string
  user: User
}

const SESSION_STORAGE_KEY = 'vocalendar:auth-session'

export function loadSession(): AuthSession | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY)

    if (!raw) {
      return null
    }

    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function saveSession(session: AuthSession) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session))
}

export function clearSession() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(SESSION_STORAGE_KEY)
}

export function getSessionStorageKey() {
  return SESSION_STORAGE_KEY
}
