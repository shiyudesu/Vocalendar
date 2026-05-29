import { serve } from '@hono/node-server'

import { apiPort } from './config/ports.js'
import { createApp } from './http/app.js'

const app = createApp()

serve(
  {
    fetch: app.fetch,
    port: apiPort,
  },
  (info) => {
    console.log(`Vocalendar API listening on http://localhost:${info.port}`)
  },
)
