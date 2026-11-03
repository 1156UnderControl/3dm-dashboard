import type { Item, NewItem } from '../threedm/types'
import type { SeasonExtraction } from './seasonSchema'

/** Drops new items whose aiKey already exists in `existing` (any origin/state) or repeats within the batch. */
export function dedupeByAiKey(newItems: NewItem[], existing: Pick<Item, 'aiKey'>[]): NewItem[] {
  const seen = new Set(existing.map((i) => i.aiKey).filter((k): k is string => !!k))
  const out: NewItem[] = []
  for (const n of newItems) {
    if (n.aiKey) {
      if (seen.has(n.aiKey)) continue
      seen.add(n.aiKey)
    }
    out.push(n)
  }
  return out
}

const ai = (stepId: string, kind: string, key: string, data: Record<string, unknown>, citation?: string): NewItem => {
  const n: NewItem = { stepId, kind, data, origin: 'ai', aiKey: `${kind}:${key}` }
  if (citation) n.citation = citation
  return n
}

/** Maps an extraction to 3DM items (origin 'ai'), skipping aiKeys already present in `existing`. */
export function mergeExtraction(ex: SeasonExtraction, existing: Pick<Item, 'aiKey'>[]): NewItem[] {
  const items: NewItem[] = [
    ...ex.scoring.map((x) => ai('1.1', 'scoring', x.key, { acao: x.acao, periodo: x.periodo, pontos: x.pontos, observacao: x.observacao })),
    ...ex.rps.map((x) => ai('1.1', 'rp', x.key, { nome: x.nome, requisito: x.requisito, depende_alianca: x.dependeAlianca })),
    ...ex.rules.map((x) => ai('1.2', 'rule', x.key, {
      regra: x.key, texto: x.texto, porque: x.porque, penalidade: x.penalidade, categoria: x.categoria,
    }, x.key)),
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
  return dedupeByAiKey(items, existing)
}

/** Count of new items per stepId (for the preview). */
export function countByStep(items: NewItem[]): Record<string, number> {
  const c: Record<string, number> = {}
  for (const i of items) c[i.stepId] = (c[i.stepId] ?? 0) + 1
  return c
}
