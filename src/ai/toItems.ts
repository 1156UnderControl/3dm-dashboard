import type { Item, NewItem } from '../threedm/types'
import type { SeasonExtraction } from './seasonSchema'
import { slug } from './slug'

/** Primary (human-meaningful) field(s) per AI item kind, used for content-based dedupe. */
const PRIMARY: Record<string, string[]> = {
  rule: ['regra'], question: ['pergunta'], skill: ['habilidade'], reference: ['acao'], auto: ['nome'],
  priority: ['item'], prototype: ['pergunta'], archetype: ['nome'], scoring: ['acao', 'periodo'], rp: ['nome'],
}

/** Raw primary text of an item's data for `kind` (fields joined by a space). */
export function primaryText(kind: string, data: Record<string, unknown>): string {
  return (PRIMARY[kind] ?? []).map((f) => String(data[f] ?? '').trim()).filter(Boolean).join(' ')
}

/** Comparable primary text: trimmed, lowercase, collapsed whitespace; '' when unknown/empty. */
export function primaryNorm(kind: string, data: Record<string, unknown>): string {
  const fields = PRIMARY[kind]
  if (!fields) return ''
  const first = String(data[fields[0]] ?? '').trim()
  if (!first) return ''
  return fields.map((f) => String(data[f] ?? '').normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ')).join('|')
}

/**
 * Stable key part for an AI item: rule keys → trimmed UPPERCASE (manual IDs); everything else → slug(key).
 * Empty key → slug(primaryText) (slug falls back to a hash when that is empty too).
 */
export function normalizeKey(kind: string, key: string, primary: string): string {
  const k = (key ?? '').trim()
  if (!k) return slug(primary ?? '')
  return kind === 'rule' ? k.toUpperCase() : slug(k)
}

type Existing = Pick<Item, 'aiKey'> & Partial<Pick<Item, 'kind' | 'data'>>

/**
 * Drops new items whose aiKey already exists in `existing` (any origin/state), or whose normalized
 * primary text (per kind) matches an existing item's, or that repeat either within the batch.
 */
export function dedupeAiItems(newItems: NewItem[], existing: Existing[]): NewItem[] {
  const keys = new Set(existing.map((i) => i.aiKey).filter((k): k is string => !!k))
  const prims = new Set<string>()
  for (const e of existing) {
    if (!e.kind || !e.data) continue
    const p = primaryNorm(e.kind, e.data)
    if (p) prims.add(`${e.kind}\u0000${p}`)
  }
  const out: NewItem[] = []
  for (const n of newItems) {
    const p = primaryNorm(n.kind, n.data)
    const pk = p ? `${n.kind}\u0000${p}` : ''
    if ((n.aiKey && keys.has(n.aiKey)) || (pk && prims.has(pk))) continue
    if (n.aiKey) keys.add(n.aiKey)
    if (pk) prims.add(pk)
    out.push(n)
  }
  return out
}

const ai = (stepId: string, kind: string, key: string, data: Record<string, unknown>, citation?: string): NewItem => {
  const n: NewItem = { stepId, kind, data, origin: 'ai', aiKey: `${kind}:${normalizeKey(kind, key, primaryText(kind, data))}` }
  if (citation) n.citation = citation
  return n
}

/** Maps an extraction to 3DM items (origin 'ai'), skipping aiKeys/primary texts already present in `existing`. */
export function mergeExtraction(ex: SeasonExtraction, existing: Existing[]): NewItem[] {
  const items: NewItem[] = [
    ...ex.scoring.map((x) => ai('1.1', 'scoring', x.key, { acao: x.acao, periodo: x.periodo, pontos: x.pontos, observacao: x.observacao })),
    ...ex.rps.map((x) => ai('1.1', 'rp', x.key, { nome: x.nome, requisito: x.requisito, depende_alianca: x.dependeAlianca })),
    ...ex.rules.map((x) => ai('1.2', 'rule', x.key, {
      regra: x.key.trim().toUpperCase(), texto: x.texto, porque: x.porque, penalidade: x.penalidade, categoria: x.categoria,
    }, x.key.trim().toUpperCase())),
    ...ex.questions.map((x) => ai('1.2', 'question', x.key, { pergunta: x.pergunta, resposta: x.resposta, citacao: x.citacao }, x.citacao)),
    ...ex.skills.map((x) => ai('1.4', 'skill', x.key, { categoria: x.categoria, habilidade: x.habilidade, kpis: x.kpis.join('; ') })),
    ...ex.history.map((x) => ai('1.5', 'reference', x.key, {
      acao: x.acao, jogo_ano: x.jogoAno, robo_referencia: x.roboReferencia, mecanismo: x.mecanismo, observacoes: x.observacoes,
    })),
    ...ex.autos.map((x) => ai('1.6', 'auto', x.key, { nome: x.nome, descricao: x.descricao, acoes: x.acoes })),
    ...ex.priorityDraft.map((x) => ai('2', 'priority', x.key, { item: x.item, bucket: x.bucket, motivo: x.motivo })),
    ...ex.prototypeDraft.map((x) => ai('3', 'prototype', x.key, {
      subsistema: x.subsistema, conceito: x.conceito, pergunta: x.pergunta, fidelidade: x.fidelidade,
    })),
    ...ex.archetypeDraft.map((x) => ai('4.1', 'archetype', x.key, { nome: x.nome, habilidades: x.habilidades, observacoes: x.observacoes })),
  ]
  return dedupeAiItems(items, existing)
}

/** Count of new items per stepId (for the preview). */
export function countByStep(items: NewItem[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const i of items) c[i.stepId] = (c[i.stepId] ?? 0) + 1
  return c
}
