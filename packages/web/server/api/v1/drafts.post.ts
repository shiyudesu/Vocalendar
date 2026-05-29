import { defineEventHandler, readBody } from 'nitro/h3'

export default defineEventHandler(async (event) => {
  const body = await readBody(event)

  return {
    data: {
      received: body,
      message: 'POST /api/v1/drafts is wired through Nitro.',
    },
  }
})
