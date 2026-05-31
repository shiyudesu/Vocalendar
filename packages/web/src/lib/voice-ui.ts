import type { QuickCommandItem } from './models'

export const quickCommands: QuickCommandItem[] = [
  { command: '我到家了', action: '标记当前外出事件为结束' },
  { command: '会议延期 15 分钟', action: '将当前会议延后 15 分钟' },
  { command: '会议取消', action: '删除即将开始的事件' },
  { command: '今天有什么安排', action: '播报今日所有事件' },
  { command: '下周日程', action: '展示下周日历概览' },
]
