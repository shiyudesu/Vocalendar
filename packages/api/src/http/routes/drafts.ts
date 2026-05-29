import { createDraftRequestSchema } from '@vocalendar/schemas'
import { Hono } from 'hono'

import { createDraft } from '../../services/drafts/draft.service.js'
import { ok, validationError } from '../utils/responses.js'

export const draftRoutes = new Hono()

draftRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)
  const result = createDraftRequestSchema.safeParse(body)

  if (!result.success) {
    return validationError(c, result.error.flatten())
  }

  const draft = createDraft(result.data)

  return ok(c, { draft })
})

draftRoutes.patch('/:draftId', async (c) => {
  const draftId = c.req.param('draftId')
  const body = await c.req.json().catch(() => null)

  return ok(c, {
    draftId,
    received: body,
    message: 'PATCH /api/v1/drafts/:draftId is reserved for v0.1 draft refinement.',
  })
})
