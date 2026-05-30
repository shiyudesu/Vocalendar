import type { CreateDraftRequest, EventDraft } from '@vocalendar/schemas'

import { eventMemoryRepository } from '../../repositories/events.memory.js'
import { parseDraftFields } from './draft-parser.js'

export function createDraft(input: CreateDraftRequest): EventDraft {
  const parsedDraft = parseDraftFields({
    sourceText: input.sourceText,
    timezone: input.timezone,
    referenceAt: input.referenceAt,
  })
  const draft: EventDraft = {
    draftId: `drf_${crypto.randomUUID()}`,
    sourceText: input.sourceText,
    source: input.source,
    referenceAt: input.referenceAt,
    normalizedText: parsedDraft.normalizedText,
    parsed: parsedDraft.parsed,
    missingFields: parsedDraft.missingFields,
    warnings: parsedDraft.warnings,
    canSave: parsedDraft.missingFields.length === 0,
    clarificationPrompt: parsedDraft.clarificationPrompt,
  }

  return eventMemoryRepository.saveDraft(draft)
}
