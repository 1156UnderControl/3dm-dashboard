import Anthropic from '@anthropic-ai/sdk'
import { z } from 'zod'
import { AiError, toAiError, type AiProvider, type AiRequest } from './provider'

export class AnthropicProvider implements AiProvider {
  private apiKey: string
  private model: string
  constructor(apiKey: string, model: string) { this.apiKey = apiKey; this.model = model }

  async generate<T>(req: AiRequest<T>): Promise<T> {
    const client = new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true })
    const { $schema: _omit, ...input_schema } = z.toJSONSchema(req.schema) as Record<string, unknown>
    void _omit
    const content = req.content.map((c) =>
      c.type === 'pdf'
        ? { type: 'document' as const, source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: c.base64 } }
        : { type: 'text' as const, text: c.text },
    )
    let res
    try {
      res = await client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 16000,
        system: req.system,
        messages: [{ role: 'user', content }],
        tools: [{ name: req.schemaName, description: `Return the result as ${req.schemaName}.`, input_schema: input_schema as { type: 'object' } }],
        tool_choice: { type: 'tool', name: req.schemaName },
      })
    } catch (e) {
      throw toAiError(e)
    }
    if (res.stop_reason === 'max_tokens') {
      throw new AiError('invalid-output', 'Resposta truncada (max_tokens atingido). Tente com um trecho menor.')
    }
    const block = res.content.find((b) => b.type === 'tool_use')
    const parsed = req.schema.safeParse(block && block.type === 'tool_use' ? block.input : undefined)
    if (!parsed.success) throw new AiError('invalid-output')
    return parsed.data
  }
}
