import type {
  EventRecord,
  NotificationRecord,
  UpdateEventRequest,
  UserProfile,
  V1EventDraftRecord,
} from './api-types'
import type { Event, NotificationItem, User } from './models'

function toOptionalDate(value: string | null) {
  return value ? new Date(value) : undefined
}

export function toEventModel(record: EventRecord): Event {
  return {
    id: record.id,
    userId: record.userId,
    title: record.title,
    description: record.description ?? undefined,
    startTime: new Date(record.startTime),
    endTime: toOptionalDate(record.endTime),
    allDay: record.allDay,
    timezone: record.timezone,
    location: record.location ?? undefined,
    recurrence: record.recurrence
      ? {
          frequency: record.recurrence.frequency,
          interval: record.recurrence.interval,
          byWeekDay: record.recurrence.byWeekDay,
          byMonthDay: record.recurrence.byMonthDay,
          until: toOptionalDate(record.recurrence.until),
          count: record.recurrence.count ?? undefined,
          exclusions: record.recurrence.exclusions,
        }
      : undefined,
    reminders: record.reminders.map((reminder) => ({
      id: reminder.id,
      eventId: reminder.eventId,
      minutesBefore: reminder.minutesBefore,
      method: reminder.method,
      sentAt: toOptionalDate(reminder.sentAt),
    })),
    attendees:
      record.attendees.length > 0
        ? record.attendees.map((attendee) => ({
            id: attendee.id,
            name: attendee.name,
            email: attendee.email ?? undefined,
            status: attendee.status,
          }))
        : undefined,
    priority: record.priority,
    tags: record.tags.length > 0 ? record.tags : undefined,
    source: record.source,
    createdAt: new Date(record.createdAt),
    updatedAt: new Date(record.updatedAt),
  }
}

export function toNotificationModel(record: NotificationRecord): NotificationItem {
  return {
    id: record.id,
    title: record.title,
    message: record.message,
    time: new Date(record.time),
    read: record.read,
  }
}

export function toUserModel(profile: UserProfile): User {
  return {
    id: profile.id,
    name: profile.name,
    email: profile.email,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    settings: profile.settings,
    createdAt: new Date(profile.createdAt),
    updatedAt: new Date(profile.updatedAt),
  }
}

export function toDraftInputText(draft: V1EventDraftRecord) {
  return draft.sourceText
}

export function toUpdateEventRequest(event: Event): UpdateEventRequest {
  return {
    title: event.title,
    description: event.description ?? null,
    startTime: event.startTime.toISOString(),
    endTime: event.endTime?.toISOString() ?? null,
    allDay: event.allDay ?? false,
    timezone: event.timezone,
    location: event.location ?? null,
    recurrence: event.recurrence
      ? {
          frequency: event.recurrence.frequency,
          interval: event.recurrence.interval ?? 1,
          byWeekDay: event.recurrence.byWeekDay ?? [],
          byMonthDay: event.recurrence.byMonthDay ?? [],
          until: event.recurrence.until?.toISOString() ?? null,
          count: event.recurrence.count ?? null,
          exclusions: event.recurrence.exclusions ?? [],
        }
      : null,
    reminders: event.reminders.map((reminder) => ({
      id: reminder.id,
      eventId: reminder.eventId,
      minutesBefore: reminder.minutesBefore,
      method: reminder.method,
      sentAt: reminder.sentAt?.toISOString() ?? null,
    })),
    attendees: (event.attendees ?? []).map((attendee) => ({
      id: attendee.id,
      name: attendee.name,
      email: attendee.email ?? null,
      status: attendee.status,
    })),
    priority: event.priority,
    tags: event.tags ?? [],
    source: event.source,
  }
}
