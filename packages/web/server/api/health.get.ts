import { defineEventHandler } from 'nitro/h3'

export default defineEventHandler(() => ({
  data: {
    status: 'ok',
    service: 'vocalendar-web',
  },
}))
