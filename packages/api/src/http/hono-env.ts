import type { UserProfile } from '@vocalendar/schemas'

declare module 'hono' {
  interface ContextVariableMap {
    accessToken: string
    currentUser: UserProfile | null
    wsUserId: string
  }
}
