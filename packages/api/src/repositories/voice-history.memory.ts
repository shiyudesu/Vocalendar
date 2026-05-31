import type { VoiceHistoryItem, VoiceHistoryRepository } from './events.types.js'

type StoredVoiceHistoryItem = {
  item: VoiceHistoryItem
  userId: string | null
}

const voiceHistoryItems: StoredVoiceHistoryItem[] = []

export const voiceHistoryMemoryRepository: VoiceHistoryRepository = {
  async add(item: VoiceHistoryItem, userId?: string | null) {
    voiceHistoryItems.unshift({
      item,
      userId: userId ?? null,
    })
    return item
  },

  async list(userId?: string | null) {
    return voiceHistoryItems
      .filter((entry) => !userId || entry.userId === userId)
      .map((entry) => entry.item)
  },

  reset() {
    voiceHistoryItems.length = 0
  },
}
