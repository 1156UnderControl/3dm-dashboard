import { describe, expect, test, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { emptyExtraction, type SeasonExtraction } from './seasonSchema'
import { extractSeason, mergeExtractions, splitPdf } from './extract'
import { dedupeAiItems, mergeExtraction, normalizeKey } from './toItems'
import type { AiProvider, AiRequest } from './provider'
import type { Item } from '../threedm/types'

async function makePdf(pages: number): Promise<Uint8Array> {
  const pdf = await PDFDocument.create()
  for (let i = 0; i < pages; i++) pdf.addPage([200, 200])
  return pdf.save()
}
const pageCount = async (b: Uint8Array) => (await PDFDocument.load(b)).getPageCount()

const ex = (patch: Partial<SeasonExtraction>): SeasonExtraction => ({ ...emptyExtraction(), ...patch })
const rule = (key: string, texto: string) => ({ key, texto, porque: 'p', penalidade: 'MINOR FOUL', categoria: 'Gameplay' })

const item = (patch: Partial<Item>): Item => ({
  id: 'x', stepId: '1.2', kind: 'rule', data: {}, origin: 'human', state: 'active', order: 1,
  createdBy: 'a', updatedBy: 'a', updatedAt: 1, ...patch,
})

describe('splitPdf', () => {
  test('splitPdf chunks at 90 pages', async () => {
    const chunks = await splitPdf(await makePdf(200))
    expect(await Promise.all(chunks.map(pageCount))).toEqual([90, 90, 20])
  })
})

describe('mergeExtractions', () => {
  test('mergeExtractions dedupes by key, first wins', () => {
    const a = ex({ gameName: '', rules: [rule('G403', 'first')], gamePieces: [{ name: 'FUEL', notes: '' }] })
    const b = ex({ gameName: 'REBUILT', rules: [rule('G403', 'second'), rule('G407', 'x')], gamePieces: [{ name: 'FUEL', notes: 'dup' }] })
    const m = mergeExtractions([a, b])
    expect(m.gameName).toBe('REBUILT')
    expect(m.rules.map((r) => [r.key, r.texto])).toEqual([['G403', 'first'], ['G407', 'x']])
    expect(m.gamePieces).toHaveLength(1)
  })
})

describe('mergeExtraction', () => {
  test('mergeExtraction maps rules to step 1.2 kind rule with origin ai and aiKey rule:G403', () => {
    const out = mergeExtraction(ex({
      rules: [rule('G403', 'Robôs não podem…')],
      questions: [{ key: 'q1', pergunta: 'P?', resposta: 'R', citacao: 'G403' }],
      skills: [{ key: 'coletar-fuel', categoria: 'Coleta', habilidade: 'Coletar FUEL do chão', kpis: ['a', 'b'] }],
      rps: [{ key: 'energized', nome: 'ENERGIZED', requisito: 'r', dependeAlianca: true }],
    }), [])
    const r = out.find((i) => i.aiKey === 'rule:G403')!
    expect(r).toMatchObject({ stepId: '1.2', kind: 'rule', origin: 'ai', citation: 'G403' })
    expect(r.data).toMatchObject({ regra: 'G403', texto: 'Robôs não podem…', penalidade: 'MINOR FOUL', categoria: 'Gameplay' })
    expect(out.find((i) => i.aiKey === 'question:q1')).toMatchObject({ stepId: '1.2', citation: 'G403' })
    expect(out.find((i) => i.aiKey === 'skill:coletar-fuel')!.data.kpis).toBe('a; b')
    expect(out.find((i) => i.aiKey === 'rp:energized')).toMatchObject({ stepId: '1.1', data: { depende_alianca: true } })
  })

  test('mergeExtraction skips existing keys and human items', () => {
    const existing = [
      item({ aiKey: 'rule:G403', origin: 'ai-edited', state: 'rejected' }),
      item({ aiKey: 'rule:G407', origin: 'human' }),
    ]
    const out = mergeExtraction(ex({ rules: [rule('G403', 'a'), rule('G407', 'b'), rule('R103', 'c')] }), existing)
    expect(out.map((i) => i.aiKey)).toEqual(['rule:R103'])
    expect(dedupeAiItems([{ stepId: '1.2', kind: 'rule', data: {}, aiKey: 'rule:G403' }], existing)).toEqual([])
  })
})

describe('extractSeason', () => {
  test('extractSeason calls provider 3x per chunk + 1 drafts call and reports progress', async () => {
    const calls: AiRequest<unknown>[] = []
    const provider: AiProvider = {
      generate: vi.fn(async <T,>(req: AiRequest<T>) => {
        calls.push(req as AiRequest<unknown>)
        const n = calls.length
        const shape = Object.keys((req.schema as unknown as { shape: Record<string, unknown> }).shape)
        const out: Record<string, unknown> = {}
        for (const k of shape) out[k] = k === 'gameName' ? 'REBUILT' : []
        if (shape.includes('rules')) out.rules = [rule(`G${n}`, 't')]
        if (shape.includes('priorityDraft')) out.priorityDraft = [{ key: 'p1', item: 'Coletar FUEL', bucket: 'Precisamos', motivo: 'm' }]
        return out as T
      }) as AiProvider['generate'],
    }
    const progress: [number, number][] = []
    const res = await extractSeason(provider, await makePdf(100), (d, t) => progress.push([d, t]))
    expect(calls).toHaveLength(2 * 3 + 1)
    expect(calls.slice(0, 6).every((c) => c.content[0].type === 'pdf')).toBe(true)
    expect(calls[6].content.every((c) => c.type === 'text')).toBe(true)
    expect(progress.at(-1)).toEqual([7, 7])
    expect(progress.map((p) => p[0])).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
    expect(res.gameName).toBe('REBUILT')
    expect(res.rules).toHaveLength(2)
    expect(res.priorityDraft).toHaveLength(1)
  })
})

describe('key normalization and dedupe (re-running setup)', () => {
  test('normalizeKey: rules uppercased, others slugged, empty key uses primary text', () => {
    expect(normalizeKey('rule', ' g403 ', '')).toBe('G403')
    expect(normalizeKey('skill', 'Coletar FUEL', 'x')).toBe('coletar-fuel')
    expect(normalizeKey('skill', '  ', 'Coletar FUEL do chão')).toBe('coletar-fuel-do-chao')
    expect(normalizeKey('auto', '', '')).not.toBe('')
  })

  test("'G403' vs 'g403' dedupes against existing items and across chunks", () => {
    const out = mergeExtraction(ex({ rules: [rule('g403', 'a'), rule('R103', 'c')] }), [item({ aiKey: 'rule:G403', origin: 'ai' })])
    expect(out.map((i) => i.aiKey)).toEqual(['rule:R103'])
    const m = mergeExtractions([ex({ rules: [rule('G403', 'first')] }), ex({ rules: [rule(' g403', 'second')] })])
    expect(m.rules).toHaveLength(1)
  })

  test('differing keys but same pergunta dedupe', () => {
    const existing = [item({ kind: 'question', aiKey: 'question:outra-key', data: { pergunta: 'Posso tocar no HUB?' } })]
    const out = mergeExtraction(ex({ questions: [{ key: 'tocar-hub', pergunta: '  posso tocar no HUB? ', resposta: 'r', citacao: 'G1' }] }), existing)
    expect(out).toEqual([])
    const m = mergeExtractions([
      ex({ questions: [{ key: 'a', pergunta: 'P?', resposta: 'r', citacao: '' }] }),
      ex({ questions: [{ key: 'b', pergunta: 'p?', resposta: 'r', citacao: '' }] }),
    ])
    expect(m.questions).toHaveLength(1)
  })

  test('same primary text dedupes within a batch and vs human items; empty primary never dedupes', () => {
    const existing = [item({ stepId: '2', kind: 'priority', origin: 'human', data: { item: 'Coletar FUEL' } }),
      item({ stepId: '2', kind: 'priority', origin: 'human', data: { item: '' } })]
    const n = (key: string, it: string) => ({ stepId: '2', kind: 'priority', data: { item: it }, origin: 'ai' as const, aiKey: `priority:${key}` })
    expect(dedupeAiItems([n('a', 'coletar fuel'), n('b', 'Escalar'), n('c', 'escalar'), n('d', ''), n('e', '')], existing)
      .map((i) => i.aiKey)).toEqual(['priority:b', 'priority:d', 'priority:e'])
  })

  test('empty key gets the slug of the primary text', () => {
    const out = mergeExtraction(ex({ skills: [{ key: '', categoria: 'c', habilidade: 'Coletar FUEL do chão', kpis: [] }] }), [])
    expect(out[0].aiKey).toBe('skill:coletar-fuel-do-chao')
  })

  test('extractSeason passes existing keys per section into the prompts', async () => {
    const calls: AiRequest<unknown>[] = []
    const provider: AiProvider = {
      generate: vi.fn(async <T,>(req: AiRequest<T>) => {
        calls.push(req as AiRequest<unknown>)
        const out: Record<string, unknown> = {}
        for (const k of Object.keys((req.schema as unknown as { shape: Record<string, unknown> }).shape)) out[k] = k === 'gameName' ? '' : []
        return out as T
      }) as AiProvider['generate'],
    }
    await extractSeason(provider, await makePdf(2), undefined, ['rule:G403', 'skill:coletar-fuel', 'priority:fuel-rapido', 'scoring:fuel-hub'])
    const text = (i: number) => JSON.stringify(calls[i].content.filter((c) => c.type === 'text'))
    expect(text(0)).toContain('fuel-hub'); expect(text(0)).not.toContain('G403')
    expect(text(1)).toContain('G403'); expect(text(1)).toContain('reutilize')
    expect(text(2)).toContain('coletar-fuel'); expect(text(2)).not.toContain('G403')
    expect(text(3)).toContain('fuel-rapido')
  })
})
