import { PDFDocument } from 'pdf-lib'
import type { z } from 'zod'
import type { AiContent, AiProvider } from './provider'
import {
  ARRAY_FIELDS, emptyExtraction, SEASON_SYSTEM_PROMPT, SectionA, SectionB, SectionC, SectionD, type SeasonExtraction,
} from './seasonSchema'

/** Splits a PDF into chunks of at most `maxPages` pages (pdf-lib). */
export async function splitPdf(bytes: Uint8Array, maxPages = 90): Promise<Uint8Array[]> {
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

const dedupeKey = (x: Record<string, unknown>): string =>
  String(x.key ?? x.name ?? JSON.stringify(x)).trim().toLowerCase()

/** Concatenates arrays deduping by key (first wins); gameName from the first non-empty part. */
export function mergeExtractions(parts: SeasonExtraction[]): SeasonExtraction {
  const out = emptyExtraction()
  out.gameName = parts.find((p) => p.gameName?.trim())?.gameName ?? ''
  for (const f of ARRAY_FIELDS) {
    const seen = new Set<string>()
    const merged: Record<string, unknown>[] = []
    for (const p of parts) {
      for (const x of (p[f] ?? []) as Record<string, unknown>[]) {
        const k = dedupeKey(x)
        if (seen.has(k)) continue
        seen.add(k)
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

const SECTIONS: { name: string; schema: z.ZodType<Partial<SeasonExtraction>>; ask: string }[] = [
  { name: 'season_overview', schema: SectionA, ask: 'Extraia: nome do jogo (gameName), peças de jogo (gamePieces), zonas do campo (zones), períodos da partida com duração em segundos (periods), ações que pontuam com período e pontos (scoring) e ranking points com requisito e se dependem da aliança (rps).' },
  { name: 'season_rules', schema: SectionB, ask: 'Extraia: regras relevantes para estratégia e design (rules: key = ID da regra, texto resumido, por que importa, penalidade, categoria Gameplay/Robô/Bumper/Outros) e perguntas que a equipe deveria se fazer com resposta e citação do manual (questions).' },
  { name: 'season_skills', schema: SectionC, ask: 'Extraia: habilidades possíveis do robô com categoria e KPIs (skills), rotinas autônomas possíveis com descrição e ações (autos) e, para cada ação do jogo, referências históricas de jogos anteriores da FRC (history).' },
]

const DRAFTS_ASK = 'Com base no modelo do jogo abaixo (extraído do manual), proponha rascunhos: lista de prioridades (priorityDraft, bucket em Precisamos/Queremos/Seria bom/Ignorar, com motivo), perguntas de prototipagem (prototypeDraft: subsistema, conceito, pergunta mensurável, fidelidade Análise 2D/Protótipo físico simples/Protótipo físico complexo) e arquétipos de robô (archetypeDraft: nome, habilidades, observações).'

/**
 * R15: per PDF chunk, three section calls (A, B, C); then one text-only drafts call (D)
 * over the merged result. Progress total = chunks × 3 + 1.
 */
export async function extractSeason(
  provider: AiProvider, pdf: Uint8Array, onProgress?: (done: number, total: number) => void,
): Promise<SeasonExtraction> {
  const chunks = await splitPdf(pdf)
  const total = chunks.length * SECTIONS.length + 1
  let done = 0
  onProgress?.(done, total)
  const parts: SeasonExtraction[] = []
  for (const [i, chunk] of chunks.entries()) {
    const pdfContent: AiContent = { type: 'pdf', base64: toBase64(chunk) }
    const part: SeasonExtraction = emptyExtraction()
    for (const sec of SECTIONS) {
      const res = await provider.generate({
        system: SEASON_SYSTEM_PROMPT,
        content: [pdfContent, { type: 'text', text: `Trecho ${i + 1} de ${chunks.length} do manual. ${sec.ask}` }],
        schema: sec.schema, schemaName: sec.name, maxTokens: 16000,
      })
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
    content: [{ type: 'text', text: `${DRAFTS_ASK}\n\n${JSON.stringify(model)}` }],
    schema: SectionD, schemaName: 'season_drafts', maxTokens: 16000,
  })
  onProgress?.(++done, total)
  return mergeExtractions([{ ...merged, ...drafts }])
}
