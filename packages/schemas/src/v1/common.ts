import { z } from 'zod'

function isValidIanaTimezone(timezone: string) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(new Date())
    return true
  } catch {
    return false
  }
}

export const isoDateTimeSchema = z.string().datetime({ offset: true, local: true })
export const timezoneSchema = z.string().min(1).refine(isValidIanaTimezone, {
  message: 'Invalid IANA timezone.',
})
