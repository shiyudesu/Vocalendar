export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  byWeekDay?: number[]
  byMonthDay?: number[]
  until?: Date
  count?: number
  exclusions?: string[]
}

export interface Reminder {
  id: string
  eventId: string
  minutesBefore: number
  method: 'push' | 'email' | 'sms'
  sentAt?: Date
}

export interface Attendee {
  id: string
  name: string
  email?: string
  status: 'pending' | 'accepted' | 'declined'
}

export interface Event {
  id: string
  userId: string
  title: string
  description?: string
  startTime: Date
  endTime?: Date
  allDay?: boolean
  timezone: string
  location?: string
  recurrence?: RecurrenceRule
  reminders: Reminder[]
  attendees?: Attendee[]
  priority: 'low' | 'normal' | 'high'
  tags?: string[]
  source: 'voice' | 'manual'
  createdAt: Date
  updatedAt: Date
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  defaultView: 'day' | 'week' | 'month' | 'list'
  defaultReminderMinutes: number
  voiceFeedback: boolean
  voiceSpeed: number
  language: string
}

export interface User {
  id: string
  name: string
  email: string
  timezone: string
  settings: UserSettings
  createdAt?: Date
  updatedAt?: Date
}

export interface NotificationItem {
  id: string
  title: string
  message: string
  time: Date
  read: boolean
}

export interface VoiceHistoryItem {
  id: string
  text: string
  result: string
  timestamp: Date
  status: 'success' | 'error'
}

export interface QuickCommandItem {
  command: string
  action: string
}
