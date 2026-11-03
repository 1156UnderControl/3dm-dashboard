import { describe, expect, test, vi } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { emptyExtraction, type SeasonExtraction } from './seasonSchema'
import { extractSeason, mergeExtractions, splitPdf } from './extract'
import { dedupeByAiKey, mergeExtraction } from './toItems'
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
    expect(dedupeByAiKey([{ stepId: '1.2', kind: 'rule', data: {}, aiKey: 'rule:G403' }], existing)).toEqual([])
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
