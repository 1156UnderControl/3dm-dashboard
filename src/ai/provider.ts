import type { z } from 'zod'
import type { AppConfig } from '../threedm/types'
import { resolveKey, type TeamKeys } from './keys'
import { AnthropicProvider } from './anthropic'
import { OpenAiProvider } from './openai'

export type AiContent = { type: 'pdf'; base64: string } | { type: 'text'; text: string }

export interface AiRequest<T> {
  system: string
  content: AiContent[]
  schema: z.ZodType<T>
  schemaName: string
  maxTokens?: number
}
export interface AiProvider { generate<T>(req: AiRequest<T>): Promise<T> }

export type AiErrorCode = 'no-key' | 'invalid-key' | 'rate-limit' | 'invalid-output' | 'network'

export class AiError extends Error {
  code: AiErrorCode
  constructor(code: AiErrorCode, message?: string) {
    super(message ?? code)
    this.name = 'AiError'
    this.code = code
  }
}

const MESSAGES: Record<AiErrorCode, string> = {
  'no-key': 'Configure uma chave de IA em Configurações.',
  'invalid-key': 'Chave inválida.',
  'rate-limit': 'Limite de requisições atingido. Tente novamente em instantes.',
  'invalid-output': 'A IA devolveu uma resposta inválida. Tente novamente.',
  network: 'Falha de rede ao falar com a IA.',
}
export const aiErrorMessage = (code: AiErrorCode): string => MESSAGES[code]

/** Maps an SDK/fetch failure to an AiError. Never includes request data (keys). */
export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e
  const status = (e as { status?: number } | null)?.status
  if (status === 401 || status === 403) return new AiError('invalid-key')
  if (status === 429) return new AiError('rate-limit')
  return new AiError('network')
}

export function getProviderWithKey(config: AppConfig, key: string): AiProvider {
  return config.aiProvider === 'anthropic'
    ? new AnthropicProvider(key, config.model)
    : new OpenAiProvider(key, config.model)
}

export function getProvider(config: AppConfig, team: TeamKeys): AiProvider {
  const r = resolveKey(config.aiProvider, team)
  if (!r) throw new AiError('no-key')
  return getProviderWithKey(config, r.key)
}
