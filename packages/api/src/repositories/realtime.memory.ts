import type { RealtimeEvent, RealtimeRepository } from './events.types.js'

const realtimeEvents = new Map<string | null, RealtimeEvent[]>()
const listeners = new Map<string | null, Set<(event: RealtimeEvent) => void>>()

function realtimeKey(userId?: string | null) {
  return userId ?? null
}

export const realtimeMemoryRepository: RealtimeRepository = {
  async push(event: RealtimeEvent, userId?: string | null) {
    const key = realtimeKey(userId)
    const bufferedEvents = realtimeEvents.get(key) ?? []

    bufferedEvents.push(event)
    realtimeEvents.set(key, bufferedEvents)

    for (const listener of listeners.get(key) ?? []) {
      listener(event)
    }
    return event
  },

  async list(userId?: string | null) {
    return [...(realtimeEvents.get(realtimeKey(userId)) ?? [])].reverse()
  },

  async subscribe(listener: (event: RealtimeEvent) => void, userId?: string | null) {
    const key = realtimeKey(userId)
    const scopedListeners = listeners.get(key) ?? new Set<(event: RealtimeEvent) => void>()

    scopedListeners.add(listener)
    listeners.set(key, scopedListeners)

    return () => {
      scopedListeners.delete(listener)

      if (scopedListeners.size === 0) {
        listeners.delete(key)
      }
    }
  },

  reset() {
    realtimeEvents.clear()
    listeners.clear()
  },
}
