import { Hono } from 'hono'

export const eventRoutes = new Hono()

eventRoutes.get('/', (c) =>
  c.json({
    data: {
      events: [],
      query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
    },
  }),
)

eventRoutes.post('/', async (c) => {
  const body = await c.req.json().catch(() => null)

  return c.json({
    data: {
      received: body,
      message: 'POST /api/v1/events is wired through Hono.',
    },
  })
})
