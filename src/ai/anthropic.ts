import Anthropic from '@anthropic-ai/sdk'
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod'
import { AiError, toAiError, type AiProvider, type AiRequest } from './provider'

export class AnthropicProvider implements AiProvider {
  private apiKey: string
  private model: string
  constructor(apiKey: string, model: string) { this.apiKey = apiKey; this.model = model }

  async generate<T>(req: AiRequest<T>): Promise<T> {
    const client = new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true, maxRetries: 4 })
    // Structured outputs instead of a forced tool call: current models (Opus 5.5,
    // Sonnet 5.5, Fable 5.1) reject tool_choice "tool"/"any" with a 400.
    const format = zodOutputFormat(req.schema)
    const content = req.content.map((c) =>
      c.type === 'pdf'
        ? {
            type: 'document' as const,
            source: { type: 'base64' as const, media_type: 'application/pdf' as const, data: c.base64 },
            ...(c.cache ? { cache_control: { type: 'ephemeral' as const } } : {}),
          }
        : { type: 'text' as const, text: c.text },
    )
    let res
    try {
      res = await client.messages.create({
        model: this.model,
        max_tokens: req.maxTokens ?? 16000,
        system: req.system,
        messages: [{ role: 'user', content }],
        output_config: { format },
      })
    } catch (e) {
      throw toAiError(e)
    }
    if (res.stop_reason === 'max_tokens') {
      throw new AiError('invalid-output', 'Resposta truncada (max_tokens atingido). Tente com um trecho menor.')
    }
    if (res.stop_reason === 'refusal') throw new AiError('invalid-output', 'A IA recusou o pedido.')
    const text = res.content.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('')
    try {
      return format.parse(text) as T
    } catch {
      throw new AiError('invalid-output')
    }
  }
}
