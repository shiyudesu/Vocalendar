import { exportDataQuerySchema } from '@vocalendar/schemas'
import { Hono } from 'hono'

import type { RuntimeDependencies } from '../../config/runtime.js'
import { notFoundWithCode, unauthorized, validationError } from '../utils/responses.js'

export function createExportRoutes(runtime: RuntimeDependencies) {
  const exportRoutes = new Hono()

  exportRoutes.get('/', async (c) => {
    const result = exportDataQuerySchema.safeParse(c.req.query())

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const currentUser = c.get('currentUser')

    if (!currentUser) {
      return unauthorized(c, 'Access token is required.')
    }

    const user = await runtime.repositories.users.findUserById(currentUser.id)

    if (!user) {
      return notFoundWithCode(c, 'User was not found.', null, 'USER_NOT_FOUND')
    }

    const events = await listAllEventsForUser(runtime, currentUser.id)

    if (result.data.format === 'csv') {
      const csv = [
        'email,name',
        `${csvEscape(user.email)},${csvEscape(user.name)}`,
        '',
        'eventId,title,description,startTime,endTime,timezone,location,source,priority,allDay,tags,recurrence,reminders,attendees',
        ...events.map((event) =>
          [
            event.id,
            event.title,
            event.description ?? '',
            event.startTime,
            event.endTime ?? '',
            event.timezone,
            event.location ?? '',
            event.source,
            event.priority,
            String(event.allDay),
            JSON.stringify(event.tags),
            JSON.stringify(event.recurrence),
            JSON.stringify(event.reminders),
            JSON.stringify(event.attendees),
          ]
            .map(csvEscape)
            .join(','),
        ),
      ].join('\n')

      c.header('content-type', 'text/csv; charset=utf-8')
      c.header('content-disposition', 'attachment; filename="vocalendar-export.csv"')
      return c.body(csv)
    }

    const ics = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Vocalendar//EN',
      ...events.flatMap((event) => buildIcsEventLines(event)),
      'END:VCALENDAR',
    ].join('\r\n')

    c.header('content-type', 'text/calendar; charset=utf-8')
    c.header('content-disposition', 'attachment; filename="vocalendar-export.ics"')
    return c.body(ics)
  })

  return exportRoutes
}

async function listAllEventsForUser(runtime: RuntimeDependencies, userId: string) {
  const items = []
  let cursor: string | null = null

  for (;;) {
    const page = await runtime.repositories.events.listEvents({
      userId,
      cursor,
      limit: 100,
    })

    items.push(...page.items)

    if (!page.nextCursor) {
      break
    }

    cursor = page.nextCursor
  }

  return items
}

function buildIcsEventLines(event: Awaited<ReturnType<typeof listAllEventsForUser>>[number]) {
  const lines = [
    'BEGIN:VEVENT',
    `UID:${event.id}`,
    `DTSTAMP:${toIcsUtcTimestamp(event.updatedAt)}`,
    `DTSTART:${toIcsUtcTimestamp(event.startTime)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
  ]

  if (event.endTime) {
    lines.push(`DTEND:${toIcsUtcTimestamp(event.endTime)}`)
  }

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`)
  }

  if (event.location) {
    lines.push(`LOCATION:${escapeIcsText(event.location)}`)
  }

  if (event.recurrence) {
    const rrule = buildRrule(event.recurrence)

    if (rrule) {
      lines.push(`RRULE:${rrule}`)
    }
  }

  for (const attendee of event.attendees) {
    if (!attendee.email) {
      continue
    }

    lines.push(`ATTENDEE;CN=${escapeIcsText(attendee.name)}:mailto:${attendee.email}`)
  }

  for (const reminder of event.reminders) {
    lines.push('BEGIN:VALARM')
    lines.push(`TRIGGER:-PT${reminder.minutesBefore}M`)
    lines.push('ACTION:DISPLAY')
    lines.push(`DESCRIPTION:${escapeIcsText(event.title)} 提醒`)
    lines.push('END:VALARM')
  }

  lines.push('END:VEVENT')

  return lines
}

function buildRrule(
  recurrence: NonNullable<Awaited<ReturnType<typeof listAllEventsForUser>>[number]['recurrence']>,
) {
  const parts = [`FREQ=${recurrence.frequency.toUpperCase()}`]

  if ((recurrence.interval ?? 1) > 1) {
    parts.push(`INTERVAL=${recurrence.interval}`)
  }

  if (recurrence.count != null) {
    parts.push(`COUNT=${recurrence.count}`)
  }

  if (recurrence.until) {
    parts.push(`UNTIL=${toIcsUtcTimestamp(recurrence.until)}`)
  }

  if (recurrence.byWeekDay.length > 0) {
    parts.push(`BYDAY=${recurrence.byWeekDay.map(mapWeekDayToIcs).join(',')}`)
  }

  if (recurrence.byMonthDay.length > 0) {
    parts.push(`BYMONTHDAY=${recurrence.byMonthDay.join(',')}`)
  }

  return parts.join(';')
}

function mapWeekDayToIcs(day: number) {
  return ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'][day] ?? 'SU'
}

function toIcsUtcTimestamp(iso: string) {
  return iso.replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function escapeIcsText(value: string) {
  return value
    .replaceAll('\\', '\\\\')
    .replaceAll(';', '\\;')
    .replaceAll(',', '\\,')
    .replaceAll('\n', '\\n')
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) {
    return `"${value.replaceAll('"', '""')}"`
  }

  return value
}
