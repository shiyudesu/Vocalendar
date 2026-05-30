import type { Event, EventDraft } from '@vocalendar/schemas'

const drafts = new Map<string, EventDraft>()
const events: Event[] = []

export const eventMemoryRepository = {
  saveDraft(draft: EventDraft) {
    drafts.set(draft.draftId, draft)
    return draft
  },

  findDraft(draftId: string) {
    return drafts.get(draftId) ?? null
  },

  saveEvent(event: Event) {
    events.unshift(event)
    return event
  },

  listRecentEvents(limit: number, offset = 0) {
    return events.slice(offset, offset + limit)
  },

  countEvents() {
    return events.length
  },

  reset() {
    drafts.clear()
    events.length = 0
  },
}
