import { afterEach, describe, expect, test, vi } from 'vitest'

import { clearSession, getSessionStorageKey, loadSession, saveSession } from './session'

const localStorageMock = {
  store: new Map<string, string>(),
  getItem(key: string) {
    return this.store.get(key) ?? null
  },
  setItem(key: string, value: string) {
    this.store.set(key, value)
  },
  removeItem(key: string) {
    this.store.delete(key)
  },
  clear() {
    this.store.clear()
  },
}

describe('session storage', () => {
  afterEach(() => {
    localStorageMock.clear()
    vi.unstubAllGlobals()
  })

  test('persists and restores sessions from localStorage', () => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    saveSession({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      user: {
        id: 'usr_1',
        name: '测试用户',
        email: 'user@example.com',
        timezone: 'Asia/Shanghai',
        settings: {
          theme: 'system',
          defaultView: 'week',
          defaultReminderMinutes: 15,
          voiceFeedback: true,
          voiceSpeed: 1,
          language: 'zh-CN',
        },
      },
    })

    expect(localStorageMock.getItem(getSessionStorageKey())).toContain('access-token')
    expect(loadSession()?.refreshToken).toBe('refresh-token')
  })

  test('clears invalid or missing storage gracefully', () => {
    vi.stubGlobal('window', {
      localStorage: localStorageMock,
    })

    localStorageMock.setItem(getSessionStorageKey(), '{invalid json')
    expect(loadSession()).toBeNull()

    localStorageMock.setItem(getSessionStorageKey(), JSON.stringify({ accessToken: 'x' }))
    clearSession()
    expect(loadSession()).toBeNull()
  })
})
