import { serve } from '@hono/node-server'
import { Hono } from 'hono'
import { cors } from 'hono/cors'

const app = new Hono().basePath('/api')

app.use(
  '*',
  cors({
    origin: ['http://localhost:8060', 'http://127.0.0.1:8060'],
    allowMethods: ['GET', 'POST', 'PATCH', 'OPTIONS'],
    allowHeaders: ['Content-Type'],
  }),
)

app.get('/health', (c) =>
  c.json({
    data: {
      status: 'ok',
      service: 'vocalendar-api',
    },
  }),
)

app.post('/v1/drafts', async (c) => {
  const body = await c.req.json().catch(() => null)

  return c.json({
    data: {
      received: body,
      message: 'POST /api/v1/drafts is wired through Hono.',
    },
  })
})

app.patch('/v1/drafts/:draftId', async (c) => {
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

app.get('/v1/events', (c) =>
  c.json({
    data: {
      events: [],
      query: Object.fromEntries(new URL(c.req.url).searchParams.entries()),
    },
  }),
)

app.post('/v1/events', async (c) => {
  const body = await c.req.json().catch(() => null)

  return c.json({
    data: {
      received: body,
      message: 'POST /api/v1/events is wired through Hono.',
    },
  })
})

const port = Number(process.env.PORT ?? 8061)

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`Vocalendar API listening on http://localhost:${info.port}`)
  },
)
