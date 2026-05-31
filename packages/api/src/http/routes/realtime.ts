import { upgradeWebSocket } from '@hono/node-server'
import { Hono } from 'hono'

import type { RuntimeDependencies } from '../../config/runtime.js'
import { nowIso } from '../../utils/clock.js'

type RealtimeWsContext = {
  raw: {
    on: (event: 'close' | 'error', listener: () => void) => void
    off: (event: 'close' | 'error', listener: () => void) => void
  }
  send: (data: string) => void
}

export function createRealtimeRoutes(runtime: RuntimeDependencies) {
  const realtimeRoutes = new Hono()

  realtimeRoutes.get('/', async (c) => {
    const accessToken = c.req.query('accessToken')

    if (!accessToken) {
      return unauthorizedWsResponse('Access token is required.')
    }

    const payload = await runtime.tokens.verifyAccessToken(accessToken).catch(() => null)

    if (!payload) {
      return unauthorizedWsResponse('Access token is invalid.')
    }

    return upgradeWebSocket(c, {
      async onOpen(_event, ws) {
        for (const bufferedEvent of await runtime.repositories.realtime.list(payload.sub)) {
          ws.send(JSON.stringify(bufferedEvent))
        }

        const unsubscribe = await runtime.repositories.realtime.subscribe((event) => {
          ws.send(JSON.stringify(event))
        }, payload.sub)
        const context = ws as unknown as RealtimeWsContext
        const cleanup = () => {
          unsubscribe()
          context.raw.off('close', cleanup)
          context.raw.off('error', cleanup)
        }

        context.raw.on('close', cleanup)
        context.raw.on('error', cleanup)
      },
    })
  })

  return realtimeRoutes
}

function unauthorizedWsResponse(message: string) {
  return Response.json(
    {
      error: {
        code: 'UNAUTHORIZED',
        message,
        details: null,
      },
      meta: {
        requestId: 'dev-request',
        timestamp: nowIso(),
      },
    },
    {
      status: 401,
    },
  )
}
