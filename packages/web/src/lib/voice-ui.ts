import type { QuickCommandItem, VoiceHistoryItem } from './models'

export const quickCommands: QuickCommandItem[] = [
  { command: '我到家了', action: '标记当前外出事件为结束' },
  { command: '会议延期 15 分钟', action: '将当前会议延后 15 分钟' },
  { command: '会议取消', action: '删除即将开始的事件' },
  { command: '今天有什么安排', action: '播报今日所有事件' },
  { command: '下周日程', action: '展示下周日历概览' },
]

export const placeholderVoiceHistory: VoiceHistoryItem[] = [
  {
    id: 'vh-placeholder-1',
    text: '真实语音记录将在接入在线 ASR 后展示',
    result: '当前版本仅开放文本草稿创建流程',
    timestamp: new Date('2026-05-31T00:00:00.000Z'),
    status: 'success',
  },
]
