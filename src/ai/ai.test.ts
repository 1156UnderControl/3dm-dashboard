import { beforeEach, describe, expect, test, vi } from 'vitest'
import { z } from 'zod'

const anthropicCreate = vi.fn()
const openaiCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: class { messages = { create: anthropicCreate } },
}))
vi.mock('openai', () => ({
  default: class { responses = { create: openaiCreate } },
}))
const fs = vi.hoisted(() => ({ setDoc: vi.fn(async () => {}), updateDoc: vi.fn(async () => {}), addDoc: vi.fn(async () => {}), commit: vi.fn(async () => {}), batchSet: vi.fn() }))
vi.mock('firebase/firestore', async (orig) => ({
  ...(await orig<typeof import('firebase/firestore')>()),
  setDoc: fs.setDoc, updateDoc: fs.updateDoc, addDoc: fs.addDoc,
  writeBatch: () => ({ set: fs.batchSet, update: fs.batchSet, delete: fs.batchSet, commit: fs.commit }),
  doc: (_db: unknown, ...p: string[]) => ({ path: p.join('/') }),
}))

vi.mock('../firebase', () => ({ db: {} }))
import { clearKey, getKey, resolveKey, setKey, setTeamKey } from './keys'
import { AiError, aiErrorMessage, getProvider } from './provider'

const schema = z.object({ n: z.number() })
const cfgA = { aiProvider: 'anthropic', model: 'claude-sonnet-5-5' } as const
const cfgO = { aiProvider: 'openai', model: 'gpt-5.1' } as const
const req = { system: 'sys', content: [{ type: 'pdf', base64: 'QUJD' }, { type: 'text', text: 'hi' }] as never, schema, schemaName: 'out' }

beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })

describe('keys', () => {
  test('get/set/clear use localStorage', () => {
    setKey('openai', 'sk-x'); expect(getKey('openai')).toBe('sk-x'); expect(localStorage.getItem('3dm.ai.key.openai')).toBe('sk-x')
    clearKey('openai'); expect(getKey('openai')).toBeNull()
  })
  test('resolveKey prefers personal key over team key', () => {
    expect(resolveKey('anthropic', { anthropic: 'team' })).toEqual({ key: 'team', source: 'equipe' })
    setKey('anthropic', 'mine')
    expect(resolveKey('anthropic', { anthropic: 'team' })).toEqual({ key: 'mine', source: 'pessoal' })
    expect(resolveKey('openai', {})).toBeNull()
  })
  test('getProvider throws no-key when no personal and no team key', () => {
    expect(() => getProvider(cfgA, {})).toThrowError(expect.objectContaining({ code: 'no-key' }))
    expect(aiErrorMessage('no-key')).toBe('Configure uma chave de IA em Configurações.')
  })
  test('setTeamKey writes no history event', async () => {
    await setTeamKey({} as never, 'a@b.c', 'anthropic', 'sk-team-1')
    expect(fs.setDoc).toHaveBeenCalledTimes(1)
    const [ref, data] = fs.setDoc.mock.calls[0] as unknown as [{ path: string }, Record<string, unknown>]
    expect(ref.path).toBe('secrets/ai')
    expect(data.anthropic).toBe('sk-team-1'); expect(data.updatedBy).toBe('a@b.c')
    expect(fs.commit).not.toHaveBeenCalled(); expect(fs.addDoc).not.toHaveBeenCalled()
  })
  test('key is never passed to firestore (personal flows)', async () => {
    setKey('anthropic', 'sk-secret-personal'); getKey('anthropic'); resolveKey('anthropic', {})
    anthropicCreate.mockResolvedValue({ stop_reason: 'tool_use', content: [{ type: 'tool_use', input: { n: 1 } }] })
    await getProvider(cfgA, {}).generate(req)
    clearKey('anthropic')
    for (const f of [fs.setDoc, fs.updateDoc, fs.addDoc, fs.batchSet]) {
      expect(JSON.stringify(f.mock.calls)).not.toContain('sk-secret-personal')
    }
    expect(fs.setDoc).not.toHaveBeenCalled()
  })
})

describe('anthropic', () => {
  beforeEach(() => setKey('anthropic', 'k'))
  test('forces the schema tool and sends pdf as document block', async () => {
    anthropicCreate.mockResolvedValue({ stop_reason: 'tool_use', content: [{ type: 'tool_use', name: 'out', input: { n: 7 } }] })
    const out = await getProvider(cfgA, {}).generate(req)
    expect(out).toEqual({ n: 7 })
    const arg = anthropicCreate.mock.calls[0][0]
    expect(arg.tool_choice).toEqual({ type: 'tool', name: 'out' })
    expect(arg.tools).toHaveLength(1); expect(arg.tools[0].name).toBe('out')
    expect(arg.tools[0].input_schema.$schema).toBeUndefined()
    expect(arg.tools[0].input_schema.properties.n).toBeDefined()
    expect(arg.max_tokens).toBe(16000); expect(arg.model).toBe('claude-sonnet-5-5')
    expect(arg.messages[0].content[0]).toEqual({ type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: 'QUJD' } })
    expect(arg.messages[0].content[1]).toEqual({ type: 'text', text: 'hi' })
  })
  test('maps 401 to invalid-key error', async () => {
    anthropicCreate.mockRejectedValue(Object.assign(new Error('x'), { status: 401 }))
    await expect(getProvider(cfgA, {}).generate(req)).rejects.toMatchObject({ code: 'invalid-key' })
  })
  test('maps 429 to rate-limit and other failures to network', async () => {
    anthropicCreate.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 429 }))
    await expect(getProvider(cfgA, {}).generate(req)).rejects.toMatchObject({ code: 'rate-limit' })
    anthropicCreate.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(getProvider(cfgA, {}).generate(req)).rejects.toMatchObject({ code: 'network' })
  })
  test('rejects invalid extraction without writing', async () => {
    anthropicCreate.mockResolvedValue({ stop_reason: 'tool_use', content: [{ type: 'tool_use', input: { n: 'nope' } }] })
    const p = getProvider(cfgA, {}).generate(req)
    await expect(p).rejects.toBeInstanceOf(AiError)
    await expect(p).rejects.toMatchObject({ code: 'invalid-output' })
    expect(fs.setDoc).not.toHaveBeenCalled(); expect(fs.commit).not.toHaveBeenCalled()
  })
  test('max_tokens stop is reported as truncation', async () => {
    anthropicCreate.mockResolvedValue({ stop_reason: 'max_tokens', content: [] })
    await expect(getProvider(cfgA, {}).generate(req)).rejects.toMatchObject({ code: 'invalid-output', message: expect.stringMatching(/trunc/i) })
  })
})

describe('openai', () => {
  beforeEach(() => setKey('openai', 'k'))
  test('sends input_file and json_schema format, validates output', async () => {
    openaiCreate.mockResolvedValue({ status: 'completed', output_text: '{"n":3}' })
    expect(await getProvider(cfgO, {}).generate(req)).toEqual({ n: 3 })
    const arg = openaiCreate.mock.calls[0][0]
    expect(arg.input[0].content[0]).toMatchObject({ type: 'input_file', file_data: 'data:application/pdf;base64,QUJD' })
    expect(arg.text.format).toMatchObject({ type: 'json_schema', name: 'out' })
  })
  test('maps 401 and bad output', async () => {
    openaiCreate.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 401 }))
    await expect(getProvider(cfgO, {}).generate(req)).rejects.toMatchObject({ code: 'invalid-key' })
    openaiCreate.mockResolvedValueOnce({ status: 'completed', output_text: 'not json' })
    await expect(getProvider(cfgO, {}).generate(req)).rejects.toMatchObject({ code: 'invalid-output' })
  })
})
