import { Hono } from 'hono'

import type { RuntimeDependencies } from '../config/runtime.js'
import { eventMemoryRepository } from '../repositories/events.memory.js'
import { notificationMemoryRepository } from '../repositories/notifications.memory.js'
import { realtimeMemoryRepository } from '../repositories/realtime.memory.js'
import { userMemoryRepository } from '../repositories/users.memory.js'
import { requireAuth } from './middleware/auth.js'
import { corsMiddleware } from './middleware/cors.js'
import { createAuthRoutes } from './routes/auth.js'
import { createDraftRoutes } from './routes/drafts.js'
import { createEventRoutes } from './routes/events.js'
import { createExportRoutes } from './routes/export.js'
import { healthRoutes } from './routes/health.js'
import { createMeRoutes } from './routes/me.js'
import { createNotificationRoutes } from './routes/notifications.js'
import { createRealtimeRoutes } from './routes/realtime.js'
import { createVoiceHistoryRoutes, createVoiceRoutes } from './routes/voice.js'

export type CreateAppOptions = {
  runtime?: RuntimeDependencies
}

export function createApp(_options: CreateAppOptions = {}) {
  const app = new Hono().basePath('/api')
  const runtime = _options.runtime
  const routeDependencies =
    runtime ??
    ({
      repositories: {
        events: eventMemoryRepository,
        notifications: notificationMemoryRepository,
        realtime: realtimeMemoryRepository,
        users: userMemoryRepository,
      },
    } as const)

  app.use('*', corsMiddleware)
  app.route('/health', healthRoutes)
  if (runtime) {
    app.use('/v1/drafts/*', requireAuth(runtime))
    app.use('/v1/drafts', requireAuth(runtime))
    app.use('/v1/events/*', requireAuth(runtime))
    app.use('/v1/events', requireAuth(runtime))
    app.use('/v1/auth/logout', requireAuth(runtime))
    app.route('/v1/drafts', createDraftRoutes(runtime))
    app.route('/v1/events', createEventRoutes(runtime))
    app.route('/v1/auth', createAuthRoutes(runtime))
    app.use('/v1/notifications/*', requireAuth(runtime))
    app.use('/v1/notifications', requireAuth(runtime))
    app.route('/v1/notifications', createNotificationRoutes(runtime))
    app.use('/v1/voice-history', requireAuth(runtime))
    app.route('/v1/voice-history', createVoiceHistoryRoutes(runtime))
    app.use('/v1/voice/asr', requireAuth(runtime))
    app.use('/v1/voice/tts', requireAuth(runtime))
    app.route('/v1/realtime/ws', createRealtimeRoutes(runtime))
    app.use('/v1/me/*', requireAuth(runtime))
    app.use('/v1/me', requireAuth(runtime))
    app.route('/v1/me', createMeRoutes(runtime))
    app.route('/v1/me/export', createExportRoutes(runtime))
    app.route('/v1/voice', createVoiceRoutes(runtime))
    return app
  }

  app.route('/v1/drafts', createDraftRoutes(routeDependencies))
  app.route('/v1/events', createEventRoutes(routeDependencies))

  return app
}
