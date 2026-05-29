import type { CreateDraftRequest, EventDraft } from '@vocalendar/schemas'

import { eventMemoryRepository } from '../../repositories/events.memory.js'

export function createDraft(input: CreateDraftRequest): EventDraft {
  const normalizedText = input.sourceText.trim()
  const parsedTitle = normalizedText.replace(/^(明天|今天|后天|下周[一二三四五六日天]?)/, '').trim()
  const startAt = null
  const title = parsedTitle.length > 0 ? parsedTitle : null
  const missingFields = [...(title ? [] : ['title']), ...(startAt ? [] : ['startAt'])]
  const draft: EventDraft = {
    draftId: `drf_${crypto.randomUUID()}`,
    sourceText: input.sourceText,
    source: input.source,
    referenceAt: input.referenceAt,
    normalizedText,
    parsed: {
      title,
      startAt,
      endAt: null,
      timezone: input.timezone,
      location: null,
      participants: [],
    },
    missingFields,
    warnings: [],
    canSave: missingFields.length === 0,
    clarificationPrompt: missingFields.length > 0 ? '请补充事件标题或开始时间。' : null,
  }

  return eventMemoryRepository.saveDraft(draft)
}
