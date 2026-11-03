import type { z } from 'zod'
import type { AppConfig } from '../threedm/types'
import { resolveKey, type TeamKeys } from './keys'
import { AnthropicProvider } from './anthropic'
import { OpenAiProvider } from './openai'

/** `cache`: the provider may cache this block (and everything before it) for the next requests. */
export type AiContent = { type: 'pdf'; base64: string; cache?: boolean } | { type: 'text'; text: string }

export interface AiRequest<T> {
  system: string
  content: AiContent[]
  schema: z.ZodType<T>
  schemaName: string
  maxTokens?: number
}
export interface AiProvider { generate<T>(req: AiRequest<T>): Promise<T> }

import { AiError } from './errors'
export { AiError, aiErrorMessage, aiErrorText, toAiError, type AiErrorCode } from './errors'

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
