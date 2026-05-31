import { once } from 'node:events'
import type { AddressInfo } from 'node:net'

import { serve, type ServerType } from '@hono/node-server'
import { WebSocketServer } from 'ws'

import type { RuntimeDependencies } from '../config/runtime.js'
import { createApp } from './app.js'

export type StartedTestServer = {
  baseUrl: string
  close: () => Promise<void>
}

export async function startTestServer(runtime: RuntimeDependencies): Promise<StartedTestServer> {
  const app = createApp({ runtime })
  const wss = new WebSocketServer({ noServer: true })
  const server = serve({
    fetch: app.fetch,
    port: 0,
    websocket: { server: wss },
  })

  await once(server, 'listening')

  const address = server.address()

  if (!address || typeof address === 'string') {
    await closeServer(server, wss)
    throw new Error('Test server did not expose a TCP address.')
  }

  return {
    baseUrl: `http://127.0.0.1:${(address as AddressInfo).port}`,
    async close() {
      await closeServer(server, wss)
    },
  }
}

async function closeServer(server: ServerType, wss: WebSocketServer) {
  for (const client of wss.clients) {
    client.terminate()
  }

  await new Promise<void>((resolve, reject) => {
    wss.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error)
        return
      }

      resolve()
    })
  })
}
