import type { LlmProvider, LlmResponse, LlmToolCall } from './types.js'

type DeepSeekConfig = {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
}

type DeepSeekChoice = {
  message: {
    role: string
    content: string | null
    tool_calls?: Array<{
      id: string
      type: string
      function: {
        name: string
        arguments: string
      }
    }>
  }
  finish_reason: string
}

type DeepSeekUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

type DeepSeekResponse = {
  choices: DeepSeekChoice[]
  usage?: DeepSeekUsage
}

export function createDeepSeekProvider(config: DeepSeekConfig): LlmProvider {
  return {
    async complete(options): Promise<LlmResponse> {
      const abortController = new AbortController()
      const timeoutId = setTimeout(() => abortController.abort(), config.timeoutMs)

      try {
        const response = await fetch(`${config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${config.apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: config.model,
            messages: options.messages,
            tools: options.tools,
            tool_choice: options.tools && options.tools.length > 0 ? 'auto' : undefined,
            temperature: options.temperature ?? 0.3,
            max_tokens: options.maxTokens ?? 2048,
          }),
          signal: abortController.signal,
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
          const text = await response.text().catch(() => 'unknown error')
          throw new Error(`DeepSeek API error: ${response.status} ${text}`)
        }

        const json = (await response.json()) as DeepSeekResponse
        const choice = json.choices[0]

        if (!choice) {
          throw new Error('DeepSeek API returned empty choices')
        }

        const toolCalls: LlmToolCall[] =
          choice.message.tool_calls?.map((tc) => ({
            id: tc.id,
            type: tc.type as 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })) ?? []

        return {
          content: choice.message.content,
          toolCalls,
          usage: json.usage
            ? {
                promptTokens: json.usage.prompt_tokens,
                completionTokens: json.usage.completion_tokens,
                totalTokens: json.usage.total_tokens,
              }
            : undefined,
        }
      } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('DeepSeek API request timed out')
        }
        throw error
      }
    },
  }
}
