import { defineEventHandler, getQuery } from 'nitro/h3'

export default defineEventHandler((event) => ({
  data: {
    events: [],
    query: getQuery(event),
  },
}))
