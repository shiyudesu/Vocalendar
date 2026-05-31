import type { LlmProvider, LlmResponse, LlmToolCall } from './types.js'

// Xiaomi MiMo (xiaomimimo.com) is OpenAI-compatible.
// Docs: https://platform.xiaomimimo.com/docs/zh-CN/api/chat/openai-api
// Default endpoint: https://api.xiaomimimo.com/v1/chat/completions
//
// This provider mirrors the DeepSeek one because both are OpenAI-shaped, but
// is kept as a separate module so the active LLM vendor stays visible in
// runtime wiring instead of being hidden in env values.

type MiMoConfig = {
  apiKey: string
  baseUrl: string
  model: string
  timeoutMs: number
}

type MiMoChoice = {
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

type MiMoUsage = {
  prompt_tokens: number
  completion_tokens: number
  total_tokens: number
}

type MiMoResponse = {
  choices: MiMoChoice[]
  usage?: MiMoUsage
}

export function createMiMoProvider(config: MiMoConfig): LlmProvider {
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
          throw new Error(`MiMo API error: ${response.status} ${text}`)
        }

        const json = (await response.json()) as MiMoResponse
        const choice = json.choices[0]

        if (!choice) {
          throw new Error('MiMo API returned empty choices')
        }

        const nativeToolCalls: LlmToolCall[] =
          choice.message.tool_calls?.map((tc) => ({
            id: tc.id,
            type: tc.type as 'function',
            function: {
              name: tc.function.name,
              arguments: tc.function.arguments,
            },
          })) ?? []

        // MiMo v2.5 ignores the OpenAI tool_calls field and emits inline
        // pseudo-XML markup inside `content` instead:
        //   <tool_call> <function=create_event>
        //     <parameter=title>喝水</parameter>
        //     <parameter=startAt>2026-05-31T22:34:19+08:00</parameter>
        //     ...
        //   </function> </tool_call>
        // We parse those blocks out so downstream services see a real
        // structured tool call and the user never sees raw markup.
        const { toolCalls: inlineToolCalls, cleanedContent } = extractInlineToolCalls(
          choice.message.content,
        )

        const toolCalls = [...nativeToolCalls, ...inlineToolCalls]

        return {
          content: cleanedContent,
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
          throw new Error('MiMo API request timed out')
        }
        throw error
      }
    },
  }
}

const TOOL_CALL_BLOCK_RE = /<tool_call>([\s\S]*?)<\/tool_call>/g
const FUNCTION_BLOCK_RE = /<function=([^>\s]+)>([\s\S]*?)<\/function>/
const PARAMETER_RE = /<parameter=([^>\s]+)>([\s\S]*?)<\/parameter>/g

// Try to coerce a raw parameter value string into a JSON-compatible primitive.
// MiMo's inline tool_call format does not quote anything, so we have to guess.
function coerceParameterValue(raw: string): unknown {
  const trimmed = raw.trim()

  if (trimmed === '' || trimmed === 'None' || trimmed === 'null') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false

  // JSON-shaped array / object → best-effort JSON parse, fall back to raw string
  if (
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'))
  ) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // Sometimes MiMo emits `[张总, 李总]` with unquoted items. Best effort:
      if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
        const inner = trimmed.slice(1, -1).trim()
        if (inner.length === 0) return []
        return inner.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
      }
      return trimmed
    }
  }

  return trimmed
}

function extractInlineToolCalls(content: string | null): {
  toolCalls: LlmToolCall[]
  cleanedContent: string | null
} {
  if (!content) return { toolCalls: [], cleanedContent: content }
  if (!content.includes('<tool_call>')) return { toolCalls: [], cleanedContent: content }

  const toolCalls: LlmToolCall[] = []
  let index = 0

  // Reset stateful regex (`g` flag)
  TOOL_CALL_BLOCK_RE.lastIndex = 0

  for (const blockMatch of content.matchAll(TOOL_CALL_BLOCK_RE)) {
    const inner = blockMatch[1] ?? ''
    const funcMatch = FUNCTION_BLOCK_RE.exec(inner)
    if (!funcMatch) continue

    const name = funcMatch[1]
    const paramsBody = funcMatch[2] ?? ''
    const args: Record<string, unknown> = {}

    PARAMETER_RE.lastIndex = 0
    for (const paramMatch of paramsBody.matchAll(PARAMETER_RE)) {
      const key = paramMatch[1]
      const value = coerceParameterValue(paramMatch[2] ?? '')
      // Drop keys that resolved to null so downstream defaults / nulls kick in
      // (e.g. endAt="None" should not show up as endAt: null in the JSON args
      // when the receiving code already treats missing keys as null).
      if (value === null) continue
      args[key] = value
    }

    index += 1
    toolCalls.push({
      id: `mimo_inline_${index}`,
      type: 'function',
      function: {
        name,
        arguments: JSON.stringify(args),
      },
    })
  }

  if (toolCalls.length === 0) {
    return { toolCalls, cleanedContent: content }
  }

  // Strip the parsed blocks from the visible content so the user never sees
  // raw markup, even if a downstream consumer renders both.
  const stripped = content.replace(TOOL_CALL_BLOCK_RE, '').replace(/\s+/g, ' ').trim()
  return {
    toolCalls,
    cleanedContent: stripped.length > 0 ? stripped : null,
  }
}
