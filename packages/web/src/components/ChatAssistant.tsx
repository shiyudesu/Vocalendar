import type { AssistantAction, RecentEventContext, UpdateEventRequest } from '@vocalendar/schemas'
import { useCallback, useEffect, useMemo, useRef } from 'react'

import { useAssistantChat } from '../hooks/useAssistantChat'
import type { ApiClient } from '../lib/api-client'
import type { Event } from '../lib/models'
import { ChatActionCard } from './ChatActionCard'
import { ChatInputBar } from './ChatInputBar'
import { ChatMessageBubble } from './ChatMessageBubble'

interface ChatAssistantProps {
  apiClient: ApiClient
  accessToken: string | null
  language: string
  events: Event[]
  userTimezone: string
  voiceFeedback: boolean
  onPlayTts: (text: string) => Promise<void>
  onEventsChange: () => Promise<void>
}

export function ChatAssistant({
  apiClient,
  accessToken,
  language,
  events,
  userTimezone,
  voiceFeedback,
  onPlayTts,
  onEventsChange,
}: ChatAssistantProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  // Remember the id of the last assistant message we've already spoken so
  // action-status updates (which produce a new chat.messages reference) don't
  // re-trigger TTS for the same reply.
  const lastSpokenMessageIdRef = useRef<string | null>(null)

  const recentEvents: RecentEventContext[] = useMemo(() => {
    return events
      .slice()
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, 10)
      .map((e) => ({
        id: e.id,
        title: e.title,
        startTime: e.startTime.toISOString(),
        location: e.location ?? null,
      }))
  }, [events])

  const chat = useAssistantChat({
    apiClient,
    timezone: userTimezone,
    recentEvents,
  })

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [chat.messages, scrollToBottom])

  useEffect(() => {
    const lastMessage = chat.messages[chat.messages.length - 1]
    if (
      lastMessage?.role === 'assistant' &&
      voiceFeedback &&
      lastMessage.content.trim().length > 0 &&
      lastSpokenMessageIdRef.current !== lastMessage.id
    ) {
      lastSpokenMessageIdRef.current = lastMessage.id
      void onPlayTts(lastMessage.content)
    }
  }, [chat.messages, voiceFeedback, onPlayTts])

  const handleTranscriptReady = useCallback(
    (text: string) => {
      void chat.sendMessage(text, 'voice')
    },
    [chat],
  )

  const handleConfirmAction = useCallback(
    async (action: AssistantAction) => {
      chat.updateActionStatus(action.id, 'confirmed')

      try {
        if (action.type === 'create' && action.eventDraft) {
          const event = await apiClient.createEvent({
            title: action.eventDraft.title ?? '未命名事件',
            startTime: action.eventDraft.startAt ?? new Date().toISOString(),
            endTime: action.eventDraft.endAt,
            timezone: action.eventDraft.timezone,
            location: action.eventDraft.location,
            source: 'voice',
          })
          chat.updateActionStatus(action.id, 'executed')
          await onEventsChange()
          void onPlayTts(`已为您创建${event.title ? '「' + event.title + '」' : '日程安排'}`)
        } else if (action.type === 'update' && action.targetEventId && action.changes) {
          const currentEvent = events.find((e) => e.id === action.targetEventId)
          if (!currentEvent) {
            void onPlayTts('找不到对应的事件')
            return
          }

          const patch = buildUpdatePatch(currentEvent, action.changes)
          await apiClient.updateEvent(action.targetEventId, patch)
          chat.updateActionStatus(action.id, 'executed')
          await onEventsChange()
          void onPlayTts('已更新事件')
        } else if (action.type === 'delete' && action.targetEventId) {
          await apiClient.deleteEvent(action.targetEventId)
          chat.updateActionStatus(action.id, 'executed')
          await onEventsChange()
          void onPlayTts('已删除事件')
        }
      } catch (error) {
        console.error('Action execution failed:', error)
        chat.updateActionStatus(action.id, 'pending')
        void onPlayTts('操作执行失败，请重试')
      }
    },
    [chat, apiClient, events, onEventsChange, onPlayTts],
  )

  const handleCancelAction = useCallback(
    (action: AssistantAction) => {
      chat.updateActionStatus(action.id, 'cancelled')
    },
    [chat],
  )

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {chat.messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-teal-50">
              <span className="text-2xl">🎙️</span>
            </div>
            <p className="text-sm">我是你的语音助手</p>
            <p className="mt-1 text-xs">按住麦克风或输入文字开始对话</p>
          </div>
        )}

        <div className="flex flex-col gap-4">
          {chat.messages.map((msg) => (
            <div className="flex flex-col gap-3" key={msg.id}>
              <ChatMessageBubble message={{ role: msg.role, content: msg.content, type: 'text' }} />
              {msg.actions?.map((action) => (
                <ChatActionCard
                  action={action}
                  key={action.id}
                  onCancel={handleCancelAction}
                  onConfirm={handleConfirmAction}
                />
              ))}
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      <ChatInputBar
        accessToken={accessToken}
        isProcessing={chat.status === 'processing'}
        language={language}
        onTranscriptReady={handleTranscriptReady}
      />
    </div>
  )
}

function buildUpdatePatch(
  currentEvent: Event,
  changes: Record<string, unknown>,
): UpdateEventRequest {
  const patch = {
    title: ('title' in changes ? changes.title : currentEvent.title) as string,
    description: currentEvent.description ?? null,
    startTime: ('startTime' in changes
      ? changes.startTime
      : currentEvent.startTime.toISOString()) as string,
    endTime: ('endTime' in changes
      ? changes.endTime
      : (currentEvent.endTime?.toISOString() ?? null)) as string | null,
    allDay: currentEvent.allDay ?? false,
    timezone: currentEvent.timezone,
    location: ('location' in changes ? changes.location : (currentEvent.location ?? null)) as
      | string
      | null,
    recurrence: (currentEvent.recurrence ?? null) as UpdateEventRequest['recurrence'],
    reminders: currentEvent.reminders,
    attendees: currentEvent.attendees ?? [],
    priority: currentEvent.priority,
    tags: currentEvent.tags ?? [],
    source: currentEvent.source,
  }

  return patch as unknown as UpdateEventRequest
}
