export type LlmMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type LlmToolDefinition = {
  type: 'function'
  function: {
    name: string
    description: string
    parameters: Record<string, unknown>
  }
}

export type LlmToolCall = {
  id: string
  type: 'function'
  function: {
    name: string
    arguments: string
  }
}

export type LlmResponse = {
  content: string | null
  toolCalls: LlmToolCall[]
  usage?: {
    promptTokens: number
    completionTokens: number
    totalTokens: number
  }
}

export type LlmProvider = {
  complete(options: {
    messages: LlmMessage[]
    tools?: LlmToolDefinition[]
    temperature?: number
    maxTokens?: number
  }): Promise<LlmResponse>
}
