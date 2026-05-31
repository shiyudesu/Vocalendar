import type {
  AssistantAction,
  AssistantChatResponse,
  ChatMessage,
  RecentEventContext,
} from '@vocalendar/schemas'
import { useCallback, useRef, useState } from 'react'

import { ApiClient } from '../lib/api-client'

type ChatStatus = 'idle' | 'processing' | 'error'

export interface ChatMessageItem {
  id: string
  role: 'user' | 'assistant'
  content: string
  actions?: AssistantAction[]
  needsConfirmation?: boolean
  timestamp: Date
}

export interface UseAssistantChatOptions {
  apiClient: ApiClient
  timezone: string
  recentEvents: RecentEventContext[]
}

export interface UseAssistantChatReturn {
  messages: ChatMessageItem[]
  status: ChatStatus
  error: string | null
  sendMessage: (content: string, type?: 'text' | 'voice') => Promise<void>
  updateActionStatus: (actionId: string, status: AssistantAction['status']) => void
  clearMessages: () => void
}

let messageIdCounter = 0

function generateMessageId() {
  messageIdCounter += 1
  return `msg_${Date.now()}_${messageIdCounter}`
}

export function useAssistantChat(options: UseAssistantChatOptions): UseAssistantChatReturn {
  const [messages, setMessages] = useState<ChatMessageItem[]>([])
  const [status, setStatus] = useState<ChatStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const messagesRef = useRef(messages)

  messagesRef.current = messages

  const sendMessage = useCallback(
    async (content: string, type: 'text' | 'voice' = 'text') => {
      setStatus('processing')
      setError(null)

      const userMessage: ChatMessageItem = {
        id: generateMessageId(),
        role: 'user',
        content,
        timestamp: new Date(),
      }

      setMessages((prev) => [...prev, userMessage])

      const history: ChatMessage[] = messagesRef.current
        .filter((m) => m.role === 'user' || m.role === 'assistant')
        .map((m) => ({
          role: m.role,
          content: m.content,
          type: 'text',
        }))

      try {
        const response: AssistantChatResponse = await options.apiClient.sendAssistantMessage({
          messages: [...history, { role: 'user', content, type }],
          timezone: options.timezone,
          referenceAt: new Date().toISOString(),
          recentEvents: options.recentEvents,
        })

        const assistantMessage: ChatMessageItem = {
          id: generateMessageId(),
          role: 'assistant',
          content: response.reply.content,
          actions: response.actions,
          needsConfirmation: response.needsConfirmation,
          timestamp: new Date(),
        }

        setMessages((prev) => [...prev, assistantMessage])
        setStatus('idle')
      } catch (err) {
        const message = err instanceof Error ? err.message : '请求失败'
        setError(message)
        setStatus('error')

        const errorMessage: ChatMessageItem = {
          id: generateMessageId(),
          role: 'assistant',
          content: '抱歉，服务暂时不可用，请稍后再试。',
          timestamp: new Date(),
        }
        setMessages((prev) => [...prev, errorMessage])
      }
    },
    [options.apiClient, options.timezone, options.recentEvents],
  )

  const updateActionStatus = useCallback(
    (actionId: string, newStatus: AssistantAction['status']) => {
      setMessages((prev) =>
        prev.map((msg) => {
          if (!msg.actions) return msg
          return {
            ...msg,
            actions: msg.actions.map((action) =>
              action.id === actionId ? { ...action, status: newStatus } : action,
            ),
          }
        }),
      )
    },
    [],
  )

  const clearMessages = useCallback(() => {
    setMessages([])
    setStatus('idle')
    setError(null)
  }, [])

  return {
    messages,
    status,
    error,
    sendMessage,
    updateActionStatus,
    clearMessages,
  }
}
