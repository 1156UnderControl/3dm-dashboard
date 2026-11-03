import { readFileSync } from 'node:fs'
import { initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing'
import { collection, doc, getDoc, getDocs, orderBy, query, type Firestore } from 'firebase/firestore'
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'vitest'
import { acceptItem, createItem, createItems, deleteItem, rejectItem, updateItem } from '../../src/data/items'
import { archiveSeason, createSeason, reopenSeason } from '../../src/data/seasons'
import { closeStep, reopenStep, updateStep } from '../../src/data/steps'
import { addMember } from '../../src/data/members'
import { STEPS } from '../../src/threedm/template'
import type { Item } from '../../src/threedm/types'

const ADMIN = 'Admin@Team1156.org' // mixed case on purpose: `by` must equal the token email exactly
const SID = 's26'
let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-3dm',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})
afterAll(async () => { await env?.cleanup() })

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const d = ctx.firestore()
    await d.doc(`members/${ADMIN.toLowerCase()}`).set({ email: ADMIN.toLowerCase(), role: 'admin' })
    await d.doc(`seasons/${SID}`).set({ id: SID, name: '2026', year: 2026, status: 'active', createdAt: 1 })
    await d.doc(`seasons/${SID}/steps/regras`).set({ stepId: 'regras', status: 'nao_iniciado', conclusion: '' })
  })
})

const db = () => env.authenticatedContext('uid-a', { email: ADMIN, email_verified: true }).firestore() as unknown as Firestore

async function history(d: Firestore) {
  const s = await getDocs(query(collection(d, `seasons/${SID}/history`), orderBy('at')))
  return s.docs.map((x) => x.data())
}
async function getItem(d: Firestore, id: string): Promise<Item> {
  return { id, ...(await getDoc(doc(d, `seasons/${SID}/items/${id}`))).data() } as Item
}

describe('data layer', () => {
  test('updateItem writes item and one history event with before/after of changed fields', async () => {
    const d = db()
    const id = await createItem(d, SID, ADMIN, { stepId: 'regras', kind: 'rule', data: { text: 'a', note: 'n' } })
    const item = await getItem(d, id)
    expect(item.createdBy).toBe(ADMIN)
    await updateItem(d, SID, ADMIN, item, { text: 'b' }, 'typo')
    const after = await getItem(d, id)
    expect(after.data).toEqual({ text: 'b', note: 'n' })
    expect(after.updatedBy).toBe(ADMIN)
    const ev = (await history(d)).filter((e) => e.action === 'update')
    expect(ev).toHaveLength(1)
    expect(ev[0]).toMatchObject({ by: ADMIN, itemId: id, stepId: 'regras', before: { text: 'a' }, after: { text: 'b' }, reason: 'typo' })
  })

  test('history never stores image data URLs (create/update/delete), the item does', async () => {
    const d = db()
    const img1 = 'data:image/jpeg;base64,AAAA'
    const img2 = 'data:image/jpeg;base64,BBBB'
    const id = await createItem(d, SID, ADMIN, { stepId: 'regras', kind: 'rule', data: { foto: img1, text: 'a' } })
    await updateItem(d, SID, ADMIN, await getItem(d, id), { foto: img2 })
    expect((await getItem(d, id)).data.foto).toBe(img2)
    await createItems(d, SID, ADMIN, [{ stepId: 'regras', kind: 'rule', data: { foto: img1 } }])
    await deleteItem(d, SID, ADMIN, await getItem(d, id))
    const h = await history(d)
    expect(JSON.stringify(h)).not.toContain('data:')
    expect(h.find((e) => e.action === 'update')).toMatchObject({ before: { foto: '[imagem]' }, after: { foto: '[imagem]' } })
    expect(h.find((e) => e.action === 'create')).toMatchObject({ after: { data: { foto: '[imagem]', text: 'a' } } })
    expect(h.find((e) => e.action === 'delete')).toMatchObject({ before: { data: { foto: '[imagem]' } } })
  })

  test('createItems writes 250 items and 250 create history events across batches', async () => {
    const d = db()
    const items = Array.from({ length: 250 }, (_, i) => ({ stepId: '1.2', kind: 'rule', data: { regra: `G${i}` }, origin: 'ai' as const, aiKey: `rule:G${i}`, citation: `G${i}` }))
    expect(await createItems(d, SID, ADMIN, items)).toBe(250)
    const its = await getDocs(collection(d, `seasons/${SID}/items`))
    expect(its.size).toBe(250)
    expect(its.docs[0].data()).toMatchObject({ origin: 'ai', state: 'active', createdBy: ADMIN })
    const h = await history(d)
    expect(h).toHaveLength(250)
    expect(h.every((e) => e.action === 'create' && e.by === ADMIN && e.stepId === '1.2')).toBe(true)
  })

  test('editing an ai item sets origin ai-edited', async () => {
    const d = db()
    const id = await createItem(d, SID, ADMIN, { stepId: 'regras', kind: 'rule', data: { text: 'a' }, origin: 'ai', aiKey: 'rule:G1' })
    await updateItem(d, SID, ADMIN, await getItem(d, id), { text: 'b' })
    expect((await getItem(d, id)).origin).toBe('ai-edited')
  })

  test('acceptItem moves ai to ai-accepted', async () => {
    const d = db()
    const id = await createItem(d, SID, ADMIN, { stepId: 'regras', kind: 'rule', data: {}, origin: 'ai' })
    await acceptItem(d, SID, ADMIN, await getItem(d, id))
    expect((await getItem(d, id)).origin).toBe('ai-accepted')
    expect((await history(d)).at(-1)).toMatchObject({ action: 'accept', before: { origin: 'ai' }, after: { origin: 'ai-accepted' } })
  })

  test('rejectItem keeps the doc with state rejected', async () => {
    const d = db()
    const id = await createItem(d, SID, ADMIN, { stepId: 'regras', kind: 'rule', data: {}, origin: 'ai' })
    await rejectItem(d, SID, ADMIN, await getItem(d, id), 'irrelevante')
    expect((await getItem(d, id)).state).toBe('rejected')
    expect((await history(d)).at(-1)).toMatchObject({ action: 'reject', before: { state: 'active' }, after: { state: 'rejected' }, reason: 'irrelevante' })
  })

  test('deleteItem removes human items but throws for ai items', async () => {
    const d = db()
    const h = await createItem(d, SID, ADMIN, { stepId: 'regras', kind: 'rule', data: {} })
    const a = await createItem(d, SID, ADMIN, { stepId: 'regras', kind: 'rule', data: {}, origin: 'ai' })
    await expect(deleteItem(d, SID, ADMIN, await getItem(d, a))).rejects.toThrow()
    await deleteItem(d, SID, ADMIN, await getItem(d, h))
    expect((await getDoc(doc(d, `seasons/${SID}/items/${h}`))).exists()).toBe(false)
    expect((await history(d)).at(-1)).toMatchObject({ action: 'delete', itemId: h })
  })

  test('createSeason creates 14 step states', async () => {
    const d = db()
    const sid = await createSeason(d, ADMIN, '2027', 2027)
    const season = (await getDoc(doc(d, `seasons/${sid}`))).data()
    expect(season).toMatchObject({ name: '2027', year: 2027, status: 'active' })
    const steps = await getDocs(collection(d, `seasons/${sid}/steps`))
    expect(steps.size).toBe(14)
    expect(STEPS).toHaveLength(14)
    expect(steps.docs.every((s) => s.data().status === 'nao_iniciado' && s.data().conclusion === '')).toBe(true)
    expect((await getDocs(collection(d, `seasons/${sid}/history`))).size).toBe(0)
  })

  test('closeStep records closedBy and conclusion; reopenStep clears them', async () => {
    const d = db()
    await closeStep(d, SID, ADMIN, 'regras', 'tudo certo')
    const s = (await getDoc(doc(d, `seasons/${SID}/steps/regras`))).data()
    expect(s).toMatchObject({ status: 'concluido', conclusion: 'tudo certo', closedBy: ADMIN })
    expect(typeof s?.closedAt).toBe('number')
    expect((await history(d)).at(-1)).toMatchObject({ action: 'close', by: ADMIN, stepId: 'regras' })
    await reopenStep(d, SID, ADMIN, 'regras', 'faltou algo')
    const r = (await getDoc(doc(d, `seasons/${SID}/steps/regras`))).data()
    expect(r?.status).toBe('em_andamento')
    expect(r?.closedBy).toBeUndefined()
    expect((await history(d)).at(-1)).toMatchObject({ action: 'reopen', reason: 'faltou algo' })
  })

  test('updateStep writes patch and a step-update event', async () => {
    const d = db()
    await updateStep(d, SID, ADMIN, 'regras', { status: 'em_andamento', deadline: '2026-12-01' })
    expect((await getDoc(doc(d, `seasons/${SID}/steps/regras`))).data()).toMatchObject({ status: 'em_andamento', deadline: '2026-12-01' })
    expect((await history(d)).at(-1)).toMatchObject({ action: 'step-update', before: { status: 'nao_iniciado', deadline: null }, after: { status: 'em_andamento', deadline: '2026-12-01' } })
  })

  test('archive/reopen season and addMember lowercases email', async () => {
    const d = db()
    await archiveSeason(d, SID)
    expect((await getDoc(doc(d, `seasons/${SID}`))).data()?.status).toBe('archived')
    await reopenSeason(d, SID)
    expect((await getDoc(doc(d, `seasons/${SID}`))).data()?.status).toBe('active')
    await addMember(d, 'New.Person@Team1156.org', 'member')
    expect((await getDoc(doc(d, 'members/new.person@team1156.org'))).data()).toEqual({ email: 'new.person@team1156.org', role: 'member' })
  })
})
