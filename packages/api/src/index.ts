import { serve } from '@hono/node-server'
import { WebSocketServer } from 'ws'

import { bootstrapRuntime, createRuntimeDependencies } from './config/runtime.js'
import { createApp } from './http/app.js'

const runtime = await createRuntimeDependencies(process.env)
await bootstrapRuntime(runtime)
const app = createApp({ runtime })
const websocketServer = new WebSocketServer({ noServer: true })
const stopReminderPolling = runtime.reminders.startPolling()

serve(
  {
    fetch: app.fetch,
    port: runtime.env.port,
    websocket: { server: websocketServer },
  },
  (info) => {
    console.log(`Vocalendar API listening on http://localhost:${info.port}`)
  },
)

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    stopReminderPolling()
    void runtime.dispose().finally(() => {
      process.exit(0)
    })
  })
}
