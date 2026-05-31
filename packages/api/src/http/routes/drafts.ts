import { createDraftRequestSchema, updateDraftRequestSchema } from '@vocalendar/schemas'
import { Hono } from 'hono'

import { DraftParseError } from '../../services/drafts/draft-parser.js'
import { createDraft, updateDraft } from '../../services/drafts/draft.service.js'
import { createEventFromDraft } from '../../services/events/event.service.js'
import { nowIso } from '../../utils/clock.js'
import {
  draftMissingFields,
  draftParseFailed,
  notFoundWithCode,
  ok,
  validationError,
} from '../utils/responses.js'

type DraftRouteDependencies = {
  repositories: {
    events: Parameters<typeof createEventFromDraft>[1]['eventsRepository']
    notifications: Parameters<typeof createEventFromDraft>[1]['notificationsRepository']
    realtime: Parameters<typeof createEventFromDraft>[1]['realtimeRepository']
    users: Parameters<typeof createEventFromDraft>[1]['usersRepository']
  }
}

export function createDraftRoutes(runtime: DraftRouteDependencies) {
  const draftRoutes = new Hono()
  const createEventDependencies = {
    eventsRepository: runtime.repositories.events,
    notificationsRepository: runtime.repositories.notifications,
    realtimeRepository: runtime.repositories.realtime,
    usersRepository: runtime.repositories.users,
  }

  draftRoutes.post('/', async (c) => {
    const body = await c.req.json().catch(() => null)
    const result = createDraftRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    try {
      const draft = await createDraft(
        result.data,
        {
          eventsRepository: runtime.repositories.events,
        },
        {
          userId: c.get('currentUser')?.id ?? null,
        },
      )
      const currentUserId = c.get('currentUser')?.id ?? null

      if (currentUserId && !draft.canSave && draft.clarificationPrompt) {
        await runtime.repositories.realtime.push(
          {
            type: 'draft.clarification',
            payload: {
              draftId: draft.draftId,
              missingFields: draft.missingFields,
              clarificationPrompt: draft.clarificationPrompt,
            },
            createdAt: nowIso(),
          },
          currentUserId,
        )
      }

      return ok(c, { draft })
    } catch (error) {
      if (error instanceof DraftParseError) {
        return draftParseFailed(c, { sourceText: result.data.sourceText })
      }

      throw error
    }
  })

  draftRoutes.patch('/:draftId', async (c) => {
    const draftId = c.req.param('draftId')
    const body = await c.req.json().catch(() => null)
    const result = updateDraftRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    try {
      const draft = await updateDraft(
        draftId,
        result.data,
        {
          eventsRepository: runtime.repositories.events,
        },
        {
          userId: c.get('currentUser')?.id ?? null,
        },
      )

      if (!draft) {
        return notFoundWithCode(c, 'Draft was not found.', { draftId }, 'DRAFT_NOT_FOUND')
      }

      const currentUserId = c.get('currentUser')?.id ?? null

      if (currentUserId && !draft.canSave && draft.clarificationPrompt) {
        await runtime.repositories.realtime.push(
          {
            type: 'draft.clarification',
            payload: {
              draftId: draft.draftId,
              missingFields: draft.missingFields,
              clarificationPrompt: draft.clarificationPrompt,
            },
            createdAt: nowIso(),
          },
          currentUserId,
        )
      }

      return ok(c, { draft })
    } catch (error) {
      if (error instanceof DraftParseError) {
        return draftParseFailed(c, { draftId, userInput: result.data.userInput })
      }

      throw error
    }
  })

  draftRoutes.post('/:draftId/confirm', async (c) => {
    const draftId = c.req.param('draftId')
    const createResult = await createEventFromDraft(
      draftId,
      createEventDependencies,
      c.get('currentUser')?.id ?? null,
    )

    if (!createResult.ok) {
      if (createResult.reason === 'not_found') {
        return notFoundWithCode(c, 'Draft was not found.', { draftId }, 'DRAFT_NOT_FOUND')
      }

      return draftMissingFields(c, {
        draftId,
        missingFields: createResult.missingFields,
      })
    }

    return ok(c, { event: createResult.event })
  })

  return draftRoutes
}
