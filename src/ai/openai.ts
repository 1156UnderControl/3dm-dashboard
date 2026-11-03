import OpenAI from 'openai'
import { z } from 'zod'
import { AiError, toAiError, type AiProvider, type AiRequest } from './provider'

export class OpenAiProvider implements AiProvider {
  private apiKey: string
  private model: string
  constructor(apiKey: string, model: string) { this.apiKey = apiKey; this.model = model }

  async generate<T>(req: AiRequest<T>): Promise<T> {
    const client = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true })
    const { $schema: _omit, ...schema } = z.toJSONSchema(req.schema) as Record<string, unknown>
    void _omit
    const content = req.content.map((c) =>
      c.type === 'pdf'
        ? { type: 'input_file' as const, filename: 'manual.pdf', file_data: `data:application/pdf;base64,${c.base64}` }
        : { type: 'input_text' as const, text: c.text },
    )
    let res
    try {
      res = await client.responses.create({
        model: this.model,
        instructions: req.system,
        max_output_tokens: req.maxTokens ?? 16000,
        input: [{ role: 'user', content }],
        // strict:false — zod schemas may have optional fields; zod validation below is the real gate.
        text: { format: { type: 'json_schema', name: req.schemaName, schema, strict: false } },
      })
    } catch (e) {
      throw toAiError(e)
    }
    if (res.status === 'incomplete') {
      throw new AiError('invalid-output', 'Resposta truncada (limite de tokens atingido). Tente com um trecho menor.')
    }
    let json: unknown
    try { json = JSON.parse(res.output_text) } catch { throw new AiError('invalid-output') }
    const parsed = req.schema.safeParse(json)
    if (!parsed.success) throw new AiError('invalid-output')
    return parsed.data
  }
}
