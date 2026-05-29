import { defineEventHandler, getRouterParam, readBody } from 'nitro/h3'

export default defineEventHandler(async (event) => {
  const draftId = getRouterParam(event, 'draftId')
  const body = await readBody(event)

  return {
    data: {
      draftId,
      received: body,
      message: 'PATCH /api/v1/drafts/:draftId is wired through Nitro.',
    },
  }
})
