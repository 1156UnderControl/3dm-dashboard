import { z } from 'zod'
import type { AiContent, AiProvider } from './provider'
import { SEASON_SYSTEM_PROMPT, type SeasonExtraction } from './seasonSchema'
import { splitPdf } from './extract'
import { dedupeByAiKey } from './toItems'
import type { ColumnDef, ItemKindDef, StepDef } from '../threedm/template'
import type { Item, NewItem } from '../threedm/types'

const MAX_SUGGESTIONS = 10

function columnSchema(c: ColumnDef): z.ZodType | null {
  switch (c.type) {
    case 'image': return null
    case 'number': return z.number()
    case 'bool': return z.boolean()
    case 'enum': return c.options?.length ? z.enum(c.options as [string, ...string[]]) : z.string()
    default: return z.string()
  }
}

/** `{ items: [{ key, ...columns }] }` built from the kind's columns (image columns skipped). */
export function suggestionSchema(kind: ItemKindDef) {
  const shape: Record<string, z.ZodType> = { key: z.string().describe('slug estável em minúsculas e hífens') }
  for (const c of kind.columns) {
    const s = columnSchema(c)
    if (s) shape[c.key] = s.describe(c.label)
  }
  return z.object({ items: z.array(z.object(shape)) })
}

export function slug(text: string): string {
  const s = text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  if (s) return s
  let h = 5381
  for (const ch of text.trim().toLowerCase()) h = ((h * 33) ^ ch.codePointAt(0)!) >>> 0
  return `q${h.toString(36)}`
}

export interface SuggestInput {
  step: StepDef
  kind: ItemKindDef
  seasonModel: SeasonExtraction
  existing: Item[]
  instruction?: string
}

export async function suggestForStep(provider: AiProvider, input: SuggestInput): Promise<NewItem[]> {
  const { step, kind, seasonModel, existing, instruction } = input
  const schema = suggestionSchema(kind)
  const current = existing.filter((i) => i.kind === kind.kind && i.state === 'active').map((i) => i.data)
  const text = [
    `Etapa ${step.id} · ${step.title}: ${step.description}`,
    step.guidance ? `Orientações: ${step.guidance}` : '',
    `Sugira até ${MAX_SUGGESTIONS} novos itens do tipo "${kind.label}" (colunas: ${kind.columns.map((c) => c.label).join(', ')}). Não repita itens já existentes. Cada item precisa de uma "key" estável (slug; para regras, o ID da regra).`,
    instruction?.trim() ? `Instrução da equipe: ${instruction.trim()}` : '',
    `Modelo da temporada:\n${JSON.stringify(seasonModel)}`,
    `Itens existentes:\n${JSON.stringify(current)}`,
  ].filter(Boolean).join('\n\n')
  const res = await provider.generate({
    system: SEASON_SYSTEM_PROMPT, content: [{ type: 'text', text }], schema, schemaName: `suggest_${kind.kind}`, maxTokens: 8000,
  })
  const fresh: NewItem[] = res.items.slice(0, MAX_SUGGESTIONS).map(({ key, ...data }) => ({
    stepId: step.id, kind: kind.kind, data, origin: 'ai', aiKey: `${kind.kind}:${key}`,
  }))
  return dedupeByAiKey(fresh, existing)
}

const ManualAnswer = z.object({ answer: z.string(), citacao: z.string(), encontrado: z.boolean() })
const NO_PDF_PREFIX = '(Sem o PDF neste navegador) '

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step))
  return btoa(bin)
}

export async function askManual(
  provider: AiProvider, pdf: Uint8Array | null, seasonModel: SeasonExtraction, question: string,
): Promise<{ answer: string; citacao: string }> {
  const ask = (content: AiContent[]) => provider.generate({
    system: SEASON_SYSTEM_PROMPT, content, schema: ManualAnswer, schemaName: 'manual_answer', maxTokens: 4000,
  })
  const q = `Pergunta: ${question}\n\nResponda em português, cite o ID da regra ou a seção do manual em "citacao". Use encontrado=false se o trecho recebido não responde à pergunta.`
  if (!pdf) {
    const r = await ask([{ type: 'text', text: `${q}\n\nVocê não tem o PDF; responda apenas com base neste resumo da temporada:\n${JSON.stringify(seasonModel)}` }])
    return { answer: NO_PDF_PREFIX + r.answer, citacao: r.citacao }
  }
  const chunks = await splitPdf(pdf)
  let last = { answer: '', citacao: '', encontrado: false }
  for (const [i, chunk] of chunks.entries()) {
    last = await ask([
      { type: 'pdf', base64: toBase64(chunk) },
      { type: 'text', text: chunks.length > 1 ? `Trecho ${i + 1} de ${chunks.length} do manual. ${q}` : q },
    ])
    if (last.encontrado) break
  }
  return { answer: last.answer, citacao: last.citacao }
}
