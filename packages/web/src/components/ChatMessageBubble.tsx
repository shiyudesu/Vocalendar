import type { ChatMessage } from '@vocalendar/schemas'
import { Bot, User } from 'lucide-react'

interface ChatMessageBubbleProps {
  message: ChatMessage
}

export function ChatMessageBubble({ message }: ChatMessageBubbleProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isUser ? 'bg-slate-900 text-white' : 'bg-teal-100 text-teal-700'
        }`}
      >
        {isUser ? <User size={16} /> : <Bot size={16} />}
      </div>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
          isUser ? 'bg-slate-900 text-white' : 'border border-slate-200 bg-white text-slate-700'
        }`}
      >
        {message.content}
      </div>
    </div>
  )
}
