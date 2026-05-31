import { cors } from 'hono/cors'

import { webDevOrigins } from '../../config/ports.js'

export const corsMiddleware = cors({
  origin: webDevOrigins,
  allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization'],
})
