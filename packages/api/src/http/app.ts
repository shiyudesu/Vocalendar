import { Hono } from 'hono'

import { corsMiddleware } from './middleware/cors.js'
import { draftRoutes } from './routes/drafts.js'
import { eventRoutes } from './routes/events.js'
import { healthRoutes } from './routes/health.js'

export function createApp() {
  const app = new Hono().basePath('/api')

  app.use('*', corsMiddleware)
  app.route('/health', healthRoutes)
  app.route('/v1/drafts', draftRoutes)
  app.route('/v1/events', eventRoutes)

  return app
}
