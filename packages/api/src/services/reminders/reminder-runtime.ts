import type { RuntimeDependencies } from '../../config/runtime.js'
import { processDueReminders } from './reminder-processor.js'

const DEFAULT_REMINDER_POLL_INTERVAL_MS = 30_000

export type ReminderRuntime = {
  processDue: (input?: { now?: string }) => Promise<{ processedCount: number }>
  startPolling: (input?: { intervalMs?: number }) => () => void
}

export function createReminderRuntime(
  runtime: Pick<RuntimeDependencies, 'repositories'>,
): ReminderRuntime {
  return {
    async processDue(input = {}) {
      return await processDueReminders(input, {
        eventsRepository: runtime.repositories.events,
        notificationsRepository: runtime.repositories.notifications,
        realtimeRepository: runtime.repositories.realtime,
      })
    },

    startPolling(input = {}) {
      const intervalMs = input.intervalMs ?? DEFAULT_REMINDER_POLL_INTERVAL_MS
      let stopped = false
      let inFlight = false

      const tick = async () => {
        if (stopped || inFlight) {
          return
        }

        inFlight = true

        try {
          await this.processDue()
        } catch (error) {
          console.error('Reminder processing failed.', error)
        } finally {
          inFlight = false
        }
      }

      void tick()
      const timer = setInterval(() => {
        void tick()
      }, intervalMs)

      return () => {
        stopped = true
        clearInterval(timer)
      }
    },
  }
}
