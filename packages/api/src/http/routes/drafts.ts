import { Hono } from 'hono'

export const draftRoutes = new Hono()

draftRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)

  return c.json({
    data: {
      received: body,
      message: 'POST /api/v1/drafts is wired through Hono.',
    },
  })
})

draftRoutes.patch('/:draftId', async (c) => {
  const draftId = c.req.param('draftId')
  const body = await c.req.json().catch(() => null)

  return c.json({
    data: {
      draftId,
      received: body,
      message: 'PATCH /api/v1/drafts/:draftId is wired through Hono.',
    },
  })
})
