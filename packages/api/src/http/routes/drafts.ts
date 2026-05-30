import { createDraftRequestSchema, updateDraftRequestSchema } from '@vocalendar/schemas'
import { Hono } from 'hono'

import { DraftParseError } from '../../services/drafts/draft-parser.js'
import { createDraft, updateDraft } from '../../services/drafts/draft.service.js'
import { draftParseFailed, notFound, ok, validationError } from '../utils/responses.js'

export const draftRoutes = new Hono()

draftRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const result = createDraftRequestSchema.safeParse(body)

  if (!result.success) {
    return validationError(c, result.error.flatten())
  }

  try {
    const draft = createDraft(result.data)

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
    const draft = updateDraft(draftId, result.data)

    if (!draft) {
      return notFound(c, 'Draft was not found.', { draftId })
    }

    return ok(c, { draft })
  } catch (error) {
    if (error instanceof DraftParseError) {
      return draftParseFailed(c, { draftId, userInput: result.data.userInput })
    }

    throw error
  }
})
