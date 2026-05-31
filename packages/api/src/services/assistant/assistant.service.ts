import type {
  AssistantAction,
  AssistantChatRequest,
  AssistantChatResponse,
} from '@vocalendar/schemas'

import type { LlmProvider } from '../../integrations/llm/types.js'
import { ASSISTANT_SYSTEM_PROMPT, assistantTools } from './prompts.js'

export type AssistantServiceDependencies = {
  llm: LlmProvider
}

export function createAssistantService(dependencies: AssistantServiceDependencies) {
  return {
    async chat(request: AssistantChatRequest): Promise<AssistantChatResponse> {
      const systemContent = buildSystemPrompt(request)
      const messages = [
        { role: 'system' as const, content: systemContent },
        ...request.messages.map((m): { role: 'user' | 'assistant'; content: string } => ({
          role: m.role === 'user' ? ('user' as const) : ('assistant' as const),
          content: m.content,
        })),
      ]

      const llmResponse = await dependencies.llm.complete({
        messages,
        tools: assistantTools,
        temperature: 0.3,
        maxTokens: 2048,
      })

      // Case 1: LLM returned tool calls -> parse them into actions
      if (llmResponse.toolCalls.length > 0) {
        const actions: AssistantAction[] = llmResponse.toolCalls.map((tc, index) => {
          const args = parseToolArguments(tc.function.arguments)
          const actionType = mapToolNameToActionType(tc.function.name)

          if (actionType === 'create') {
            return {
              id: `act_${index + 1}`,
              type: 'create' as const,
              status: 'pending' as const,
              eventDraft: {
                title: typeof args.title === 'string' && args.title.length > 0 ? args.title : null,
                startAt:
                  typeof args.startAt === 'string' && args.startAt.length > 0 ? args.startAt : null,
                endAt: typeof args.endAt === 'string' && args.endAt.length > 0 ? args.endAt : null,
                timezone: typeof args.timezone === 'string' ? args.timezone : request.timezone,
                location:
                  typeof args.location === 'string' && args.location.length > 0
                    ? args.location
                    : null,
                participants: Array.isArray(args.participants)
                  ? args.participants.filter((p: unknown): p is string => typeof p === 'string')
                  : [],
              },
            }
          }

          if (actionType === 'update') {
            return {
              id: `act_${index + 1}`,
              type: 'update' as const,
              status: 'pending' as const,
              targetEventId: typeof args.eventId === 'string' ? args.eventId : null,
              changes:
                typeof args.changes === 'object' && args.changes !== null
                  ? (args.changes as Record<string, unknown>)
                  : {},
            }
          }

          if (actionType === 'delete') {
            return {
              id: `act_${index + 1}`,
              type: 'delete' as const,
              status: 'pending' as const,
              targetEventId: typeof args.eventId === 'string' ? args.eventId : null,
            }
          }

          if (actionType === 'query') {
            return {
              id: `act_${index + 1}`,
              type: 'query' as const,
              status: 'pending' as const,
            }
          }

          // clarify
          return {
            id: `act_${index + 1}`,
            type: 'clarify' as const,
            status: 'pending' as const,
            question:
              typeof args.question === 'string' && args.question.length > 0
                ? args.question
                : undefined,
          }
        })

        const executableActions = actions.filter(
          (a) => a.type === 'create' || a.type === 'update' || a.type === 'delete',
        )

        const needsConfirmation = executableActions.length > 0

        const clarifyQuestions = actions
          .filter((a) => a.type === 'clarify' && typeof a.question === 'string')
          .map((a) => a.question as string)

        let replyContent: string
        if (executableActions.length > 0) {
          replyContent = `我识别到了 ${executableActions.length} 个可执行操作（${executableActions
            .map((a) => typeToLabel(a.type))
            .join('、')}），请确认是否执行：`
        } else if (clarifyQuestions.length > 0) {
          replyContent = clarifyQuestions.join('；')
        } else {
          replyContent = '请告诉我更多信息。'
        }

        return {
          reply: { role: 'assistant', content: replyContent },
          actions,
          needsConfirmation,
        }
      }

      // Case 2: No tool calls -> direct text reply
      const content = llmResponse.content ?? '抱歉，我没有理解您的意思。'

      return {
        reply: { role: 'assistant', content },
        actions: [],
        needsConfirmation: false,
      }
    },
  }
}

function buildSystemPrompt(request: AssistantChatRequest): string {
  const parts = [
    ASSISTANT_SYSTEM_PROMPT,
    `\n## 当前时间\n${request.referenceAt}`,
    `## 用户时区\n${request.timezone}`,
  ]

  if (request.recentEvents.length > 0) {
    parts.push(
      `## 用户最近事件\n${request.recentEvents
        .map(
          (e) =>
            `- ID: ${e.id}, 标题: ${e.title}, 时间: ${e.startTime}${e.location ? `, 地点: ${e.location}` : ''}`,
        )
        .join('\n')}`,
    )
  }

  return parts.join('\n')
}

function parseToolArguments(argsString: string): Record<string, unknown> {
  try {
    return JSON.parse(argsString) as Record<string, unknown>
  } catch {
    return {}
  }
}

function mapToolNameToActionType(toolName: string): AssistantAction['type'] {
  const map: Record<string, AssistantAction['type']> = {
    create_event: 'create',
    update_event: 'update',
    delete_event: 'delete',
    query_events: 'query',
    ask_clarify: 'clarify',
  }
  return map[toolName] ?? 'clarify'
}

function typeToLabel(type: AssistantAction['type']): string {
  const map: Record<string, string> = {
    create: '创建',
    update: '更新',
    delete: '删除',
    query: '查询',
    clarify: '补问',
  }
  return map[type] ?? type
}
