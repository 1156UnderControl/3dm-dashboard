import { PDFDocument } from 'pdf-lib'
import type { z } from 'zod'
import { AiError } from './errors'
import type { AiContent, AiProvider } from './provider'
import {
  ARRAY_FIELDS, emptyExtraction, type ArrayField, SEASON_SYSTEM_PROMPT, SectionA, SectionB, SectionC, SectionD, type SeasonExtraction,
} from './seasonSchema'
import { normalizeKey, primaryNorm, primaryText } from './toItems'

/**
 * Pages per request. A page costs roughly 1.5-3k input tokens (text + page image), so 30 pages
 * stays well under the per-minute input limits of new API accounts; 90 did not.
 */
export const PDF_CHUNK_PAGES = 30

/** Splits a PDF into chunks of at most `maxPages` pages (pdf-lib). */
export async function splitPdf(bytes: Uint8Array, maxPages = PDF_CHUNK_PAGES): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(bytes, { ignoreEncryption: true })
  const total = src.getPageCount()
  if (total <= maxPages) return [bytes]
  const chunks: Uint8Array[] = []
  for (let start = 0; start < total; start += maxPages) {
    const out = await PDFDocument.create()
    const idx = Array.from({ length: Math.min(maxPages, total - start) }, (_, i) => start + i)
    for (const p of await out.copyPages(src, idx)) out.addPage(p)
    chunks.push(await out.save())
  }
  return chunks
}

/** Extraction array field → 3DM item kind (fields without a kind are deduped by name). */
const FIELD_KIND: Partial<Record<ArrayField, string>> = {
  scoring: 'scoring', rps: 'rp', rules: 'rule', questions: 'question', skills: 'skill', history: 'reference',
  autos: 'auto', priorityDraft: 'priority', prototypeDraft: 'prototype', archetypeDraft: 'archetype',
}

/** Raw extraction record → the item-data shape the primary-text helpers expect (rules carry the ID in `key`). */
const asData = (kind: string, x: Record<string, unknown>) => (kind === 'rule' ? { ...x, regra: x.key } : x)

/** Dedupe keys for a record: normalized key (same as the item aiKey) and normalized primary text. */
function dedupeKeys(f: ArrayField, x: Record<string, unknown>): string[] {
  const kind = FIELD_KIND[f]
  if (!kind) return [String(x.key ?? x.name ?? JSON.stringify(x)).trim().toLowerCase()]
  const data = asData(kind, x)
  const keys = [`k:${normalizeKey(kind, String(x.key ?? ''), primaryText(kind, data))}`]
  const p = primaryNorm(kind, data)
  if (p) keys.push(`p:${p}`)
  return keys
}

/** Concatenates arrays deduping by normalized key or primary text (first wins); gameName from the first non-empty part. */
export function mergeExtractions(parts: SeasonExtraction[]): SeasonExtraction {
  const out = emptyExtraction()
  out.gameName = parts.find((p) => p.gameName?.trim())?.gameName ?? ''
  for (const f of ARRAY_FIELDS) {
    const seen = new Set<string>()
    const merged: Record<string, unknown>[] = []
    for (const p of parts) {
      for (const x of (p[f] ?? []) as Record<string, unknown>[]) {
        const ks = dedupeKeys(f, x)
        if (ks.some((k) => seen.has(k))) continue
        ks.forEach((k) => seen.add(k))
        merged.push(x)
      }
    }
    ;(out as Record<string, unknown>)[f] = merged
  }
  return out
}

function toBase64(bytes: Uint8Array): string {
  let bin = ''
  const step = 0x8000
  for (let i = 0; i < bytes.length; i += step) bin += String.fromCharCode(...bytes.subarray(i, i + step))
  return btoa(bin)
}

const isTooLarge = (e: unknown): boolean =>
  e instanceof AiError && e.code === 'request' && (e.status === 413 || /too (long|large)|request_too_large/i.test(e.message))

/** Still rate-limited after the SDK's own retries: usually one request is bigger than the per-minute token limit. */
const isRateLimited = (e: unknown): boolean => e instanceof AiError && e.code === 'rate-limit'

/** Splits a chunk into two halves; [] when it has fewer than `minPages` pages. */
async function halvePdf(bytes: Uint8Array, minPages = 2): Promise<Uint8Array[]> {
  const n = (await PDFDocument.load(bytes, { ignoreEncryption: true })).getPageCount()
  if (n < minPages) return []
  return splitPdf(bytes, Math.ceil(n / 2))
}

const SECTIONS: { name: string; schema: z.ZodType<Partial<SeasonExtraction>>; ask: string; kinds: string[] }[] = [
  { name: 'season_overview', schema: SectionA, ask: 'Extraia: nome do jogo (gameName), peças de jogo (gamePieces), zonas do campo (zones), períodos da partida com duração em segundos (periods), ações que pontuam com período e pontos (scoring) e ranking points com requisito e se dependem da aliança (rps).', kinds: ['scoring', 'rp'] },
  { name: 'season_rules', schema: SectionB, ask: 'Extraia: regras relevantes para estratégia e design (rules: key = ID da regra, texto resumido, por que importa, penalidade, categoria Gameplay/Robô/Bumper/Outros) e perguntas que a equipe deveria se fazer com resposta e citação do manual (questions).', kinds: ['rule', 'question'] },
  { name: 'season_skills', schema: SectionC, ask: 'Extraia: habilidades possíveis do robô com categoria e KPIs (skills), rotinas autônomas possíveis com descrição e ações (autos) e, para cada ação do jogo, referências históricas de jogos anteriores da FRC (history).', kinds: ['skill', 'auto', 'reference'] },
]

const DRAFT_KINDS = ['priority', 'prototype', 'archetype']

/** Prompt suffix listing the existing keys of `kinds` (from aiKeys like `rule:G403`), or '' when none. */
export function existingKeysText(existingKeys: string[], kinds: string[]): string {
  const lines: string[] = []
  for (const kind of kinds) {
    const ks = [...new Set(existingKeys.filter((k) => k.startsWith(`${kind}:`)).map((k) => k.slice(kind.length + 1)).filter(Boolean))]
    if (ks.length) lines.push(`${kind}: ${ks.join(', ')}`)
  }
  return lines.length
    ? `\n\nKeys já existentes no 3DM — reutilize estas keys para os mesmos itens (não invente uma key nova para algo que já existe):\n${lines.join('\n')}`
    : ''
}

const DRAFTS_ASK = 'Com base no modelo do jogo abaixo (extraído do manual), proponha rascunhos: lista de prioridades (priorityDraft, bucket em Precisamos/Queremos/Seria bom/Ignorar, com motivo), perguntas de prototipagem (prototypeDraft: subsistema, conceito, pergunta mensurável, fidelidade Análise 2D/Protótipo físico simples/Protótipo físico complexo) e arquétipos de robô (archetypeDraft: nome, habilidades, observações).'

/**
 * R15: per PDF chunk, three section calls (A, B, C); then one text-only drafts call (D)
 * over the merged result. Progress total = chunks × 3 + 1.
 */
export async function extractSeason(
  provider: AiProvider, pdf: Uint8Array, onProgress?: (done: number, total: number) => void, existingKeys: string[] = [],
): Promise<SeasonExtraction> {
  const chunks = await splitPdf(pdf)
  const total = chunks.length * SECTIONS.length + 1
  let done = 0
  onProgress?.(done, total)
  const parts: SeasonExtraction[] = []
  for (const [i, chunk] of chunks.entries()) {
    const part: SeasonExtraction = emptyExtraction()
    for (const sec of SECTIONS) {
      const ask = (bytes: Uint8Array, label: string) => provider.generate({
        system: SEASON_SYSTEM_PROMPT,
        // cache: the same chunk is sent for each of the three sections.
        content: [{ type: 'pdf', base64: toBase64(bytes), cache: true } satisfies AiContent,
          { type: 'text', text: `${label} ${sec.ask}${existingKeysText(existingKeys, sec.kinds)}` }],
        schema: sec.schema, schemaName: sec.name, maxTokens: 16000,
      })
      // Too large or over the rate limit: split the chunk in halves and retry, recursively.
      const askSplitting = async (bytes: Uint8Array, label: string): Promise<Partial<SeasonExtraction>> => {
        try {
          return await ask(bytes, label)
        } catch (e) {
          const halves = isTooLarge(e) ? await halvePdf(bytes) : isRateLimited(e) ? await halvePdf(bytes, 4) : []
          if (halves.length < 2) throw e
          const results: Partial<SeasonExtraction>[] = []
          for (const [j, h] of halves.entries()) results.push(await askSplitting(h, `${label} (parte ${j + 1} de ${halves.length})`))
          const m = mergeExtractions(results.map((r) => ({ ...emptyExtraction(), ...r })))
          const keys = new Set(results.flatMap((r) => Object.keys(r)))
          return Object.fromEntries([...keys].map((k) => [k, m[k as keyof SeasonExtraction]]))
        }
      }
      const res = await askSplitting(chunk, `Trecho ${i + 1} de ${chunks.length} do manual.`)
      Object.assign(part, res)
      onProgress?.(++done, total)
    }
    parts.push(part)
  }
  const merged = mergeExtractions(parts)
  const { priorityDraft: _p, prototypeDraft: _t, archetypeDraft: _a, ...model } = merged
  void _p; void _t; void _a
  const drafts = await provider.generate({
    system: SEASON_SYSTEM_PROMPT,
    content: [{ type: 'text', text: `${DRAFTS_ASK}${existingKeysText(existingKeys, DRAFT_KINDS)}\n\n${JSON.stringify(model)}` }],
    schema: SectionD, schemaName: 'season_drafts', maxTokens: 16000,
  })
  onProgress?.(++done, total)
  return mergeExtractions([{ ...merged, ...drafts }])
}
