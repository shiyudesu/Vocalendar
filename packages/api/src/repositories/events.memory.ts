import type { EventRecord, V1EventDraftRecord as EventDraft } from '@vocalendar/schemas'

import type { EventsRepository } from './events.types.js'

const drafts = new Map<string, EventDraft>()
const events = new Map<string, EventRecord>()

function sortEventsDescending(items: EventRecord[]) {
  return items.sort((left, right) => right.startTime.localeCompare(left.startTime))
}

export const eventMemoryRepository: EventsRepository = {
  async saveDraft(draft: EventDraft) {
    drafts.set(draft.draftId, draft)
    return draft
  },

  async findDraft(draftId: string, userId?: string | null) {
    const draft = drafts.get(draftId) ?? null

    if (!draft) {
      return null
    }

    if (userId && draft.userId !== userId) {
      return null
    }

    return draft
  },

  async saveEvent(event: EventRecord) {
    events.set(event.id, event)
    return event
  },

  async findEvent(eventId: string, userId?: string | null) {
    const event = events.get(eventId) ?? null

    if (!event) {
      return null
    }

    if (userId && event.userId !== userId) {
      return null
    }

    return event
  },

  async listReminderCandidateEvents(input?: { userId?: string | null }) {
    return [...events.values()].filter((event) => {
      if (input?.userId && event.userId !== input.userId) {
        return false
      }

      return event.reminders.length > 0
    })
  },

  async listEvents(input) {
    const filteredItems = [...events.values()].filter((event) => {
      if (input.userId && event.userId !== input.userId) {
        return false
      }

      if (input.startDate && event.startTime < input.startDate) {
        return false
      }

      if (input.endDate && event.startTime > input.endDate) {
        return false
      }

      if (input.keyword) {
        const keyword = input.keyword.toLowerCase()
        const haystack = [event.title, event.description ?? '', event.location ?? '', ...event.tags]
          .join(' ')
          .toLowerCase()

        if (!haystack.includes(keyword)) {
          return false
        }
      }

      if (input.source && event.source !== input.source) {
        return false
      }

      if (input.priority && event.priority !== input.priority) {
        return false
      }

      return true
    })
    const sorted = sortEventsDescending(filteredItems)
    const startIndex = input.cursor
      ? Math.max(sorted.findIndex((event) => event.id === input.cursor) + 1, 0)
      : 0
    const items = sorted.slice(startIndex, startIndex + input.limit)
    const nextCursor = startIndex + input.limit < sorted.length ? (items.at(-1)?.id ?? null) : null

    return {
      items,
      nextCursor,
    }
  },

  async deleteEvent(eventId: string, userId?: string | null) {
    const current = events.get(eventId)

    if (!current) {
      return false
    }

    if (userId && current.userId !== userId) {
      return false
    }

    return events.delete(eventId)
  },

  async countEvents(userId?: string | null) {
    if (!userId) {
      return events.size
    }

    return [...events.values()].filter((event) => event.userId === userId).length
  },

  reset() {
    drafts.clear()
    events.clear()
  },
}
