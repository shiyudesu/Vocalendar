import { assistantChatRequestSchema } from '@vocalendar/schemas'
import { Hono } from 'hono'

import type { AssistantServiceDependencies } from '../../services/assistant/assistant.service.js'
import { createAssistantService } from '../../services/assistant/assistant.service.js'
import { llmUnavailable, ok, validationError } from '../utils/responses.js'

type AssistantRouteDependencies = {
  llm?: AssistantServiceDependencies['llm']
}

export function createAssistantRoutes(runtime: AssistantRouteDependencies) {
  const assistantRoutes = new Hono()

  assistantRoutes.post('/chat', async (c) => {
    if (!runtime.llm) {
      return llmUnavailable(c, 'LLM provider is not configured')
    }

    const body = await c.req.json().catch(() => null)
    const result = assistantChatRequestSchema.safeParse(body)

    if (!result.success) {
      return validationError(c, result.error.flatten())
    }

    const assistantService = createAssistantService({ llm: runtime.llm })

    try {
      const response = await assistantService.chat(result.data)
      return ok(c, response)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'LLM service unavailable'
      return llmUnavailable(c, message)
    }
  })

  return assistantRoutes
}
