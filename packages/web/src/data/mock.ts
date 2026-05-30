export interface Event {
  id: string
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

export interface RecurrenceRule {
  frequency: 'daily' | 'weekly' | 'monthly' | 'yearly'
  interval?: number
  byWeekDay?: number[]
  byMonthDay?: number[]
  until?: Date
  count?: number
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

export interface User {
  id: string
  name: string
  email: string
  avatar?: string
  timezone: string
  settings: UserSettings
}

export interface UserSettings {
  theme: 'light' | 'dark' | 'system'
  defaultView: 'day' | 'week' | 'month' | 'list'
  defaultReminderMinutes: number
  voiceFeedback: boolean
  voiceSpeed: number
  language: string
}

const now = new Date()
const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setDate(result.getDate() + days)
  return result
}

function addHours(date: Date, hours: number): Date {
  const result = new Date(date)
  result.setHours(result.getHours() + hours)
  return result
}

function setTime(date: Date, hour: number, minute: number): Date {
  const result = new Date(date)
  result.setHours(hour, minute, 0, 0)
  return result
}

export const mockUser: User = {
  id: 'user-001',
  name: '张伟',
  email: 'zhangwei@vocalendar.app',
  timezone: 'Asia/Shanghai',
  settings: {
    theme: 'system',
    defaultView: 'week',
    defaultReminderMinutes: 15,
    voiceFeedback: true,
    voiceSpeed: 1.0,
    language: 'zh-CN',
  },
}

export const mockEvents: Event[] = [
  {
    id: 'evt-001',
    title: '部门早会',
    description: '讨论本周项目进度',
    startTime: setTime(today, 9, 0),
    endTime: setTime(today, 10, 0),
    timezone: 'Asia/Shanghai',
    location: '会议室 A',
    reminders: [{ id: 'rem-001', eventId: 'evt-001', minutesBefore: 10, method: 'push' }],
    attendees: [
      { id: 'att-001', name: '李明', status: 'accepted' },
      { id: 'att-002', name: '王芳', status: 'accepted' },
      { id: 'att-003', name: '赵强', status: 'pending' },
    ],
    priority: 'normal',
    tags: ['工作', '例会'],
    source: 'manual',
    createdAt: addDays(today, -2),
    updatedAt: addDays(today, -1),
  },
  {
    id: 'evt-002',
    title: '和客户开会',
    description: '讨论产品需求方案',
    startTime: setTime(today, 10, 30),
    endTime: setTime(today, 12, 0),
    timezone: 'Asia/Shanghai',
    location: '国贸三期 28 层',
    reminders: [
      { id: 'rem-002', eventId: 'evt-002', minutesBefore: 30, method: 'push' },
      { id: 'rem-003', eventId: 'evt-002', minutesBefore: 60, method: 'email' },
    ],
    attendees: [
      { id: 'att-004', name: '张总', status: 'accepted' },
      { id: 'att-005', name: '陈秘书', status: 'accepted' },
    ],
    priority: 'high',
    tags: ['工作', '客户'],
    source: 'voice',
    createdAt: addDays(today, -1),
    updatedAt: addDays(today, -1),
  },
  {
    id: 'evt-003',
    title: '午餐 - 团队聚餐',
    description: '庆祝项目上线',
    startTime: setTime(today, 12, 0),
    endTime: setTime(today, 13, 30),
    timezone: 'Asia/Shanghai',
    location: '海底捞（国贸店）',
    reminders: [{ id: 'rem-004', eventId: 'evt-003', minutesBefore: 15, method: 'push' }],
    attendees: [
      { id: 'att-006', name: '小明', status: 'accepted' },
      { id: 'att-007', name: '小红', status: 'accepted' },
    ],
    priority: 'normal',
    tags: ['团队', '聚餐'],
    source: 'manual',
    createdAt: addDays(today, -3),
    updatedAt: addDays(today, -2),
  },
  {
    id: 'evt-004',
    title: '健身',
    description: '力量训练 + 有氧',
    startTime: setTime(today, 18, 0),
    endTime: setTime(today, 19, 30),
    timezone: 'Asia/Shanghai',
    location: '乐刻健身',
    recurrence: {
      frequency: 'weekly',
      byWeekDay: [1, 3, 5],
    },
    reminders: [{ id: 'rem-005', eventId: 'evt-004', minutesBefore: 30, method: 'push' }],
    priority: 'low',
    tags: ['健康', '运动'],
    source: 'voice',
    createdAt: addDays(today, -7),
    updatedAt: addDays(today, -7),
  },
  {
    id: 'evt-005',
    title: '项目评审会',
    description: 'Q2 产品规划评审',
    startTime: setTime(addDays(today, 1), 14, 0),
    endTime: setTime(addDays(today, 1), 16, 0),
    timezone: 'Asia/Shanghai',
    location: '线上腾讯会议',
    reminders: [{ id: 'rem-006', eventId: 'evt-005', minutesBefore: 15, method: 'push' }],
    attendees: [
      { id: 'att-008', name: '产品经理', status: 'accepted' },
      { id: 'att-009', name: '技术负责人', status: 'pending' },
    ],
    priority: 'high',
    tags: ['工作', '会议'],
    source: 'manual',
    createdAt: addDays(today, -2),
    updatedAt: addDays(today, -1),
  },
  {
    id: 'evt-006',
    title: '看牙医',
    description: '半年一次常规检查',
    startTime: setTime(addDays(today, 2), 15, 0),
    endTime: setTime(addDays(today, 2), 16, 0),
    timezone: 'Asia/Shanghai',
    location: '瑞尔齿科',
    reminders: [
      { id: 'rem-007', eventId: 'evt-006', minutesBefore: 60, method: 'push' },
      { id: 'rem-008', eventId: 'evt-006', minutesBefore: 30, method: 'sms' },
    ],
    priority: 'normal',
    tags: ['健康'],
    source: 'voice',
    createdAt: addDays(today, -5),
    updatedAt: addDays(today, -5),
  },
  {
    id: 'evt-007',
    title: '飞上海出差',
    description: '参加行业峰会',
    startTime: setTime(addDays(today, 4), 8, 0),
    endTime: setTime(addDays(today, 4), 11, 0),
    timezone: 'Asia/Shanghai',
    location: '首都机场 T3',
    reminders: [{ id: 'rem-009', eventId: 'evt-007', minutesBefore: 120, method: 'push' }],
    priority: 'high',
    tags: ['出差', '工作'],
    source: 'manual',
    createdAt: addDays(today, -10),
    updatedAt: addDays(today, -3),
  },
  {
    id: 'evt-008',
    title: '妈妈生日',
    description: '记得打电话祝福',
    startTime: setTime(addDays(today, 5), 0, 0),
    endTime: setTime(addDays(today, 5), 23, 59),
    allDay: true,
    timezone: 'Asia/Shanghai',
    reminders: [{ id: 'rem-010', eventId: 'evt-008', minutesBefore: 0, method: 'push' }],
    priority: 'high',
    tags: ['家庭', '生日'],
    source: 'manual',
    createdAt: addDays(today, -30),
    updatedAt: addDays(today, -30),
  },
  {
    id: 'evt-009',
    title: '代码评审',
    description: 'Review 前端组件库 PR',
    startTime: setTime(addDays(today, -1), 14, 0),
    endTime: setTime(addDays(today, -1), 15, 30),
    timezone: 'Asia/Shanghai',
    location: '线上',
    reminders: [{ id: 'rem-011', eventId: 'evt-009', minutesBefore: 10, method: 'push' }],
    priority: 'normal',
    tags: ['工作', '开发'],
    source: 'manual',
    createdAt: addDays(today, -3),
    updatedAt: addDays(today, -2),
  },
  {
    id: 'evt-010',
    title: '周末读书',
    description: '读完《深度工作》最后两章',
    startTime: setTime(addDays(today, 6), 10, 0),
    endTime: setTime(addDays(today, 6), 12, 0),
    timezone: 'Asia/Shanghai',
    location: '家中书房',
    reminders: [{ id: 'rem-012', eventId: 'evt-010', minutesBefore: 0, method: 'push' }],
    priority: 'low',
    tags: ['学习', '阅读'],
    source: 'voice',
    createdAt: addDays(today, -4),
    updatedAt: addDays(today, -4),
  },
]

export const voiceHistory = [
  {
    id: 'vh-001',
    text: '明天下午三点和张总在国贸喝咖啡',
    result: '已创建：明天下午 3 点的「和张总在国贸喝咖啡」',
    timestamp: addDays(today, -1),
    status: 'success' as const,
  },
  {
    id: 'vh-002',
    text: '把我刚才加的会议删掉',
    result: '已删除「临时会议」',
    timestamp: addDays(today, -1),
    status: 'success' as const,
  },
  {
    id: 'vh-003',
    text: '下周我要出差吗？',
    result: '下周您有 2 个出差相关事件：周一飞上海、周四返程',
    timestamp: addDays(today, -2),
    status: 'success' as const,
  },
  {
    id: 'vh-004',
    text: '每周一三五晚上 8 点提醒我去健身',
    result: '已创建重复事件：每周一、三、五晚 8 点的「健身」',
    timestamp: addDays(today, -7),
    status: 'success' as const,
  },
]

export const quickCommands = [
  { command: '我到家了', action: '标记当前外出事件为结束' },
  { command: '会议延期 15 分钟', action: '将当前会议延后 15 分钟' },
  { command: '会议取消', action: '删除即将开始的事件' },
  { command: '今天有什么安排', action: '播报今日所有事件' },
  { command: '下周日程', action: '展示下周日历概览' },
]

export const mockNotifications = [
  {
    id: 'notif-001',
    title: '会议即将开始',
    message: '「和客户开会」将在 30 后开始，地点：国贸三期',
    time: addHours(now, -0.5),
    read: false,
  },
  {
    id: 'notif-002',
    title: '事件已创建',
    message: '已成功创建「每周健身」重复事件',
    time: addDays(now, -7),
    read: true,
  },
  {
    id: 'notif-003',
    title: '时间冲突提醒',
    message: '「项目评审会」与「团队会议」时间重叠，建议调整',
    time: addDays(now, -1),
    read: true,
  },
]

export function getEventsForDate(events: Event[], date: Date): Event[] {
  const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0)
  const endOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59)

  return events.filter((event) => {
    if (event.allDay) {
      const eventDay = new Date(
        event.startTime.getFullYear(),
        event.startTime.getMonth(),
        event.startTime.getDate(),
      )
      return (
        eventDay.getFullYear() === startOfDay.getFullYear() &&
        eventDay.getMonth() === startOfDay.getMonth() &&
        eventDay.getDate() === startOfDay.getDate()
      )
    }
    return event.startTime >= startOfDay && event.startTime <= endOfDay
  })
}

export function getEventsForWeek(events: Event[], weekStart: Date): Event[] {
  const start = new Date(weekStart)
  start.setHours(0, 0, 0, 0)
  const end = new Date(start)
  end.setDate(end.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  return events.filter((event) => {
    const eventStart = event.startTime
    return eventStart >= start && eventStart <= end
  })
}

export function getEventsForMonth(events: Event[], year: number, month: number): Event[] {
  const start = new Date(year, month, 1, 0, 0, 0)
  const end = new Date(year, month + 1, 0, 23, 59, 59)

  return events.filter((event) => {
    const eventStart = event.startTime
    return eventStart >= start && eventStart <= end
  })
}

export function getPriorityColor(priority: string): string {
  switch (priority) {
    case 'high':
      return 'bg-rose-500'
    case 'normal':
      return 'bg-teal-500'
    case 'low':
      return 'bg-slate-400'
    default:
      return 'bg-slate-400'
  }
}

export function getPriorityBorderColor(priority: string): string {
  switch (priority) {
    case 'high':
      return 'border-rose-200 bg-rose-50'
    case 'normal':
      return 'border-teal-200 bg-teal-50'
    case 'low':
      return 'border-slate-200 bg-slate-50'
    default:
      return 'border-slate-200 bg-slate-50'
  }
}
