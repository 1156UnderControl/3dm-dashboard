import { z } from 'zod'

const s = z.string()

export const PRIORITY_BUCKETS = ['Precisamos', 'Queremos', 'Seria bom', 'Ignorar'] as const
export const FIDELIDADES = ['Análise 2D', 'Protótipo físico simples', 'Protótipo físico complexo'] as const

export const SeasonExtraction = z.object({
  gameName: s,
  gamePieces: z.array(z.object({ name: s, count: z.number().optional(), notes: s })),
  zones: z.array(z.object({ name: s, description: s })),
  periods: z.array(z.object({ name: s, durationS: z.number() })),
  scoring: z.array(z.object({ key: s, acao: s, periodo: s, pontos: z.number(), observacao: s })),
  rps: z.array(z.object({ key: s, nome: s, requisito: s, dependeAlianca: z.boolean() })),
  rules: z.array(z.object({ key: s.describe('ID da regra no manual, ex.: G403'), texto: s, porque: s, penalidade: s, categoria: s })),
  questions: z.array(z.object({ key: s, pergunta: s, resposta: s, citacao: s })),
  skills: z.array(z.object({ key: s, categoria: s, habilidade: s, kpis: z.array(s) })),
  autos: z.array(z.object({ key: s, nome: s, descricao: s, acoes: s })),
  history: z.array(z.object({ key: s, acao: s, jogoAno: s, roboReferencia: s, mecanismo: s, observacoes: s })),
  priorityDraft: z.array(z.object({ key: s, item: s, bucket: z.enum(PRIORITY_BUCKETS), motivo: s })),
  prototypeDraft: z.array(z.object({ key: s, subsistema: s, conceito: s, pergunta: s, fidelidade: s })),
  archetypeDraft: z.array(z.object({ key: s, nome: s, habilidades: s, observacoes: s })),
})
export type SeasonExtraction = z.infer<typeof SeasonExtraction>

/** R15: per-chunk section calls (A, B, C) and one drafts call (D) to stay under max_tokens. */
export const SectionA = SeasonExtraction.pick({ gameName: true, gamePieces: true, zones: true, periods: true, scoring: true, rps: true })
export const SectionB = SeasonExtraction.pick({ rules: true, questions: true })
export const SectionC = SeasonExtraction.pick({ skills: true, autos: true, history: true })
export const SectionD = SeasonExtraction.pick({ priorityDraft: true, prototypeDraft: true, archetypeDraft: true })

export type ArrayField = Exclude<keyof SeasonExtraction, 'gameName'>
export const ARRAY_FIELDS: ArrayField[] = [
  'gamePieces', 'zones', 'periods', 'scoring', 'rps', 'rules', 'questions',
  'skills', 'autos', 'history', 'priorityDraft', 'prototypeDraft', 'archetypeDraft',
]

export const emptyExtraction = (): SeasonExtraction => ({
  gameName: '', gamePieces: [], zones: [], periods: [], scoring: [], rps: [], rules: [], questions: [],
  skills: [], autos: [], history: [], priorityDraft: [], prototypeDraft: [], archetypeDraft: [],
})

export const SEASON_SYSTEM_PROMPT = `Você analisa o manual do jogo da FIRST Robotics Competition (FRC) para a equipe 1156.
Responda SEMPRE em português do Brasil, mas mantenha os termos do jogo em inglês exatamente como no manual (ex.: HUB, FUEL, TRENCH, MINOR FOUL, ranking point).
Regras:
- Cite os IDs das regras e as seções do manual (ex.: G403, R103, 6.4.2). Para regras, "key" é exatamente o ID da regra (ex.: G403).
- Todas as outras "key" são slugs estáveis em minúsculas e hífens, derivados do conteúdo (ex.: coletar-fuel-chao), para que a mesma coisa receba a mesma key em execuções futuras.
- Extraia apenas o que está no trecho recebido; se uma seção não aparecer no trecho, devolva a lista vazia.
- Na análise histórica, use seu conhecimento de jogos anteriores da FRC (ano/jogo, robô de referência, mecanismo) e registre qualquer incerteza em "observacoes".
- Seja objetivo e completo: inclua todas as regras de gameplay e de robô relevantes para o design e a estratégia.`
