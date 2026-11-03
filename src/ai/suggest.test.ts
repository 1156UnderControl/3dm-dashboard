import { describe, expect, test } from 'vitest'
import { PDFDocument } from 'pdf-lib'
import { z } from 'zod'
import type { AiProvider, AiRequest } from './provider'
import { askManual, suggestForStep } from './suggest'
import { emptyExtraction } from './seasonSchema'
import { getStep } from '../threedm/template'
import type { Item } from '../threedm/types'

const model = { ...emptyExtraction(), gameName: 'REBUILT' }
const item = (patch: Partial<Item>): Item => ({
  id: 'x', stepId: '1.2', kind: 'rule', data: { regra: 'G403' }, origin: 'human', state: 'active', order: 1,
  createdBy: 'a', updatedBy: 'a', updatedAt: 1, ...patch,
})
function fake(responses: unknown[]) {
  const calls: AiRequest<unknown>[] = []
  const provider: AiProvider = {
    async generate<T>(req: AiRequest<T>) { calls.push(req as AiRequest<unknown>); return responses.shift() as T },
  }
  return { provider, calls }
}
const step = getStep('1.2')
const ruleKind = step.kinds[0]
const row = (key: string) => ({ key, regra: key, texto: 't', porque: 'p', penalidade: 'x', categoria: 'Gameplay' })

describe('suggestForStep', () => {
  test('never includes keys already present', async () => {
    const { provider } = fake([{ items: [row('G403'), row('G404')] }])
    const out = await suggestForStep(provider, { step, kind: ruleKind, seasonModel: model, existing: [item({ aiKey: 'rule:G403' })] })
    expect(out.map((i) => i.aiKey)).toEqual(['rule:G404'])
    expect(out[0]).toMatchObject({ stepId: '1.2', kind: 'rule', origin: 'ai' })
    expect(out[0].data).toMatchObject({ regra: 'G404', texto: 't' })
    expect(out[0].data).not.toHaveProperty('key')
  })

  test('schema matches the kind columns plus key', async () => {
    const { provider, calls } = fake([{ items: [] }])
    await suggestForStep(provider, { step, kind: ruleKind, seasonModel: model, existing: [], instruction: 'foco em bumpers' })
    const json = z.toJSONSchema(calls[0].schema as z.ZodType) as unknown as { properties: { items: { items: { properties: Record<string, unknown> } } } }
    expect(Object.keys(json.properties.items.items.properties).sort())
      .toEqual(['categoria', 'key', 'penalidade', 'porque', 'regra', 'texto'])
    expect(calls[0].content.every((c) => c.type === 'text')).toBe(true)
    expect(JSON.stringify(calls[0].content)).toContain('foco em bumpers')
  })
})

const ans = (encontrado: boolean, answer = 'a') => ({ answer, citacao: 'c', encontrado })
async function makePdf(pages: number) {
  const pdf = await PDFDocument.create()
  for (let i = 0; i < pages; i++) pdf.addPage([100, 100])
  return pdf.save()
}

describe('askManual', () => {
  test('without cached pdf sends only text and says so', async () => {
    const { provider, calls } = fake([ans(true, 'resp')])
    const r = await askManual(provider, null, model, 'Posso?')
    expect(calls).toHaveLength(1)
    expect(calls[0].content.every((c) => c.type === 'text')).toBe(true)
    expect(r.answer).toBe('(Sem o PDF neste navegador) resp')
    expect(r.citacao).toBe('c')
  })

  test('small pdf: one call with the pdf', async () => {
    const { provider, calls } = fake([ans(true)])
    await askManual(provider, await makePdf(3), model, 'Q')
    expect(calls).toHaveLength(1)
    expect(calls[0].content.some((c) => c.type === 'pdf')).toBe(true)
  })

  test('multi-chunk stops at first encontrado', async () => {
    const { provider, calls } = fake([ans(false, 'n1'), ans(true, 'achei'), ans(true, 'x')])
    const r = await askManual(provider, await makePdf(200), model, 'Q')
    expect(calls).toHaveLength(2)
    expect(r.answer).toBe('achei')
  })

  test('multi-chunk none found returns the last answer', async () => {
    const { provider, calls } = fake([ans(false, 'n1'), ans(false, 'n2'), ans(false, 'n3')])
    const r = await askManual(provider, await makePdf(70), model, 'Q')
    expect(calls).toHaveLength(3)
    expect(r.answer).toBe('n3')
  })
})

describe('suggestForStep normalization', () => {
  test('rule keys are uppercased and primary-text duplicates dropped', async () => {
    const { provider } = fake([{ items: [row('g404'), { ...row('g405'), regra: 'G403' }] }])
    const out = await suggestForStep(provider, { step, kind: ruleKind, seasonModel: model, existing: [item({ aiKey: 'rule:X' })] })
    expect(out.map((i) => i.aiKey)).toEqual(['rule:G404'])
  })
})

describe('slug', () => {
  test('non-latin question gives non-empty stable slug', async () => {
    const { slug } = await import('./suggest')
    expect(slug('这是什么？')).not.toBe('')
    expect(slug('这是什么？')).toBe(slug('这是什么？'))
    expect(slug('Posso tocar no HUB?')).toBe('posso-tocar-no-hub')
  })
})
