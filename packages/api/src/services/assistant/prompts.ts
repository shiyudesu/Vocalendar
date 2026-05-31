import type { LlmToolDefinition } from '../../integrations/llm/types.js'

export const ASSISTANT_SYSTEM_PROMPT =
  `你是 Vocalendar 的智能日历助手，名叫「小V」。你的任务是帮用户通过自然语言管理日程。

## 当前能力
- 创建事件：提取标题、时间、地点、参与者
- 更新事件：修改已有事件的时间、地点等信息
- 删除事件：按用户描述删除对应事件
- 查询日程：帮用户查看 upcoming 事件
- 信息补问：当信息不足时，礼貌地向用户提问

## 规则
1. 用户说一句话包含多个事件时，拆分为多个独立的 create_event 操作
2. 时间解析以用户时区为准，当前时间作为基准。相对时间（如"明天下午三点"）必须推断为具体 ISO 8601 时间
3. 用户用"刚才的会议""明天的会"等指代时，结合 recentEvents 匹配最可能的事件
4. 所有创建/更新/删除操作都必须通过 tool call 输出，不能直接执行
5. 如果只是闲聊或问候，不要调用工具，直接友好回复
6. 回复要简洁自然，像微信聊天一样
7. 当需要用户确认时，tool call 的 status 设为 pending
8. **重要：只有用户完全没提供标题，或连大概时间都无法推断时，才调用 ask_clarify。只要用户说了类似"明天下午三点做某事"，就直接调用 create_event，不要补问**

## 输出格式
- 需要操作时：调用对应 tool
- 不需要操作时：直接回复文本，不要输出 JSON` as const

export const assistantTools: LlmToolDefinition[] = [
  {
    type: 'function',
    function: {
      name: 'create_event',
      description: '创建一个日历事件。当用户描述了一个需要添加到日程的事项时调用。',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '事件标题' },
          startAt: { type: 'string', description: '开始时间，ISO 8601 格式' },
          endAt: { type: ['string', 'null'], description: '结束时间，ISO 8601 格式，无则 null' },
          timezone: { type: 'string', description: '时区，如 Asia/Shanghai' },
          location: { type: ['string', 'null'], description: '地点' },
          participants: {
            type: 'array',
            items: { type: 'string' },
            description: '参与者姓名列表',
          },
        },
        required: ['title', 'startAt', 'timezone'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'update_event',
      description: '更新一个已有事件。当用户想修改已有日程时调用。',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: ['string', 'null'], description: '事件 ID，有则直接用' },
          eventReference: {
            type: ['string', 'null'],
            description: '用户对事件的描述，如"刚才的会议""明天的咖啡"',
          },
          changes: {
            type: 'object',
            description: '要修改的字段',
            properties: {
              title: { type: ['string', 'null'] },
              startTime: { type: ['string', 'null'], description: 'ISO 8601' },
              endTime: { type: ['string', 'null'], description: 'ISO 8601' },
              location: { type: ['string', 'null'] },
            },
          },
        },
        required: ['changes'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'delete_event',
      description: '删除一个事件。当用户想取消日程时调用。',
      parameters: {
        type: 'object',
        properties: {
          eventId: { type: ['string', 'null'], description: '事件 ID' },
          eventReference: {
            type: ['string', 'null'],
            description: '用户对事件的描述',
          },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'query_events',
      description: '查询用户日程。当用户问"今天有什么安排"等时调用。',
      parameters: {
        type: 'object',
        properties: {
          timeRange: {
            type: ['string', 'null'],
            description: '时间范围描述，如"今天""本周""下周"',
          },
          keyword: { type: ['string', 'null'], description: '关键词过滤' },
        },
        required: [],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'ask_clarify',
      description: '当信息不足，需要向用户提问时调用。',
      parameters: {
        type: 'object',
        properties: {
          question: { type: 'string', description: '要问用户的问题' },
        },
        required: ['question'],
      },
    },
  },
]
