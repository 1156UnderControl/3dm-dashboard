/** AI error type and messages (no Firebase/SDK deps, safe to import anywhere). */
export type AiErrorCode = 'no-key' | 'invalid-key' | 'rate-limit' | 'invalid-output' | 'network' | 'request' | 'server'

export class AiError extends Error {
  code: AiErrorCode
  /** HTTP status from the provider, when known. */
  status?: number
  constructor(code: AiErrorCode, message?: string, status?: number) {
    super(message ?? code)
    this.name = 'AiError'
    this.code = code
    if (status !== undefined) this.status = status
  }
}

const MESSAGES: Record<AiErrorCode, string> = {
  'no-key': 'Configure uma chave de IA em Configurações.',
  'invalid-key': 'Chave inválida.',
  'rate-limit': 'Limite de requisições atingido. Tente novamente em instantes.',
  'invalid-output': 'A IA devolveu uma resposta inválida. Tente novamente.',
  network: 'Falha de rede ao falar com a IA.',
  request: 'A IA recusou o pedido.',
  server: 'Serviço de IA indisponível, tente de novo',
}
export const aiErrorMessage = (code: AiErrorCode): string => MESSAGES[code]

/** User-facing text for an AiError: its own message when it has one (e.g. truncation), else the code's message. */
export function aiErrorText(e: AiError): string {
  const detail = e.message && e.message !== e.code ? e.message : ''
  if (!detail) return MESSAGES[e.code]
  if (e.code === 'rate-limit') return `Limite da API atingido: ${detail}`
  return e.code === 'request' ? `${MESSAGES.request.replace(/\.$/, '')}: ${detail}` : detail
}

/** Provider error text only (never request data), with anything key-like masked, max 200 chars. */
function providerMessage(e: unknown): string {
  const err = e as { error?: { message?: unknown; error?: { message?: unknown } }; message?: unknown } | null
  const raw = err?.error?.error?.message ?? err?.error?.message ?? err?.message
  if (typeof raw !== 'string') return ''
  return raw.replace(/\b(sk|key)[-_][A-Za-z0-9_-]{6,}/g, '[chave]').replace(/\s+/g, ' ').trim().slice(0, 200)
}

/** Maps an SDK/fetch failure to an AiError. Never includes request data (keys). */
export function toAiError(e: unknown): AiError {
  if (e instanceof AiError) return e
  const status = (e as { status?: number } | null)?.status
  if (status === 401 || status === 403) return new AiError('invalid-key', undefined, status)
  if (status === 429) return new AiError('rate-limit', providerMessage(e) || undefined, status)
  if (typeof status === 'number' && status >= 500) return new AiError('server', undefined, status)
  if (typeof status === 'number' && status >= 400) return new AiError('request', providerMessage(e) || undefined, status)
  return new AiError('network')
}
