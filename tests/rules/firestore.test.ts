import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest'

// Member docs are keyed by lowercase email: members/{email}.
const ADMIN = 'admin@team1156.org'
const MEMBER = 'member@team1156.org'
const OUTSIDER = 'outsider@gmail.com'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-3dm',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearFirestore()
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore()
    await db.doc(`members/${ADMIN}`).set({ email: ADMIN, role: 'admin' })
    await db.doc(`members/${MEMBER}`).set({ email: MEMBER, role: 'member' })
    await db.doc('config/app').set({ aiProvider: 'anthropic', model: 'claude-sonnet-5-5' })
    await db.doc('secrets/ai').set({ anthropic: 'sk-test', updatedBy: ADMIN, updatedAt: 1 })
    await db.doc('seasons/s26').set({ id: 's26', name: '2026', year: 2026, status: 'active', createdAt: 1 })
    await db.doc('seasons/s25').set({ id: 's25', name: '2025', year: 2025, status: 'archived', createdAt: 1 })
    await db.doc('seasons/s26/items/i1').set({ stepId: 'regras', kind: 'rule', data: {} })
    await db.doc('seasons/s25/items/i1').set({ stepId: 'regras', kind: 'rule', data: {} })
    await db.doc('seasons/s26/history/h1').set({ at: 1, by: MEMBER, stepId: 'regras', action: 'create' })
  })
})

function as(email: string) {
  return env.authenticatedContext(`uid-${email}`, { email, email_verified: true }).firestore()
}

const item = (by: string) => ({ stepId: 'regras', kind: 'rule', data: { text: 'x' }, origin: 'human',
  state: 'active', order: 1, createdBy: by, updatedBy: by, updatedAt: 2 })
const event = (by: string) => ({ at: 2, by, stepId: 'regras', itemId: 'i2', action: 'create' })

describe('allowlist', () => {
  test('non-allowlisted user cannot read seasons', async () => {
    await assertFails(as(OUTSIDER).doc('seasons/s26').get())
    await assertFails(as(OUTSIDER).doc('seasons/s26/items/i1').get())
  })

  test('unauthenticated user cannot read seasons', async () => {
    await assertFails(env.unauthenticatedContext().firestore().doc('seasons/s26').get())
  })

  test('unverified email is not trusted even if allowlisted', async () => {
    const db = env.authenticatedContext('uid-x', { email: MEMBER, email_verified: false }).firestore()
    await assertFails(db.doc('seasons/s26').get())
  })

  test('member can read seasons, items and history', async () => {
    await assertSucceeds(as(MEMBER).doc('seasons/s26').get())
    await assertSucceeds(as(MEMBER).doc('seasons/s25/items/i1').get())
    await assertSucceeds(as(MEMBER).doc('seasons/s26/history/h1').get())
  })

  test('member removed from allowlist can no longer write', async () => {
    await assertSucceeds(as(MEMBER).doc('seasons/s26/items/i2').set(item(MEMBER)))
    await env.withSecurityRulesDisabled(async (ctx) => {
      await ctx.firestore().doc(`members/${MEMBER}`).delete()
    })
    await assertFails(as(MEMBER).doc('seasons/s26/items/i3').set(item(MEMBER)))
    await assertFails(as(MEMBER).doc('seasons/s26').get())
  })
})

describe('season subcollections', () => {
  test('member can write item in active season', async () => {
    await assertSucceeds(as(MEMBER).doc('seasons/s26/items/i2').set(item(MEMBER)))
    await assertSucceeds(as(MEMBER).doc('seasons/s26/items/i1').update({ order: 3 }))
    await assertSucceeds(as(MEMBER).doc('seasons/s26/steps/regras').set({ stepId: 'regras', status: 'em_andamento', conclusion: '' }))
    await assertSucceeds(as(MEMBER).doc('seasons/s26/groups/g1').set({ id: 'g1', name: 'A', memberEmails: [] }))
    await assertSucceeds(as(MEMBER).doc('seasons/s26/items/i1').delete())
  })

  test('member cannot write item in archived season', async () => {
    await assertFails(as(MEMBER).doc('seasons/s25/items/i2').set(item(MEMBER)))
    await assertFails(as(MEMBER).doc('seasons/s25/items/i1').update({ order: 3 }))
    await assertFails(as(MEMBER).doc('seasons/s25/items/i1').delete())
    await assertFails(as(MEMBER).doc('seasons/s25/steps/regras').set({ stepId: 'regras', status: 'concluido', conclusion: '' }))
    await assertFails(as(ADMIN).doc('seasons/s25/groups/g1').set({ id: 'g1', name: 'A', memberEmails: [] }))
  })

  test('non-member cannot write item in active season', async () => {
    await assertFails(as(OUTSIDER).doc('seasons/s26/items/i2').set(item(OUTSIDER)))
  })

  test('cannot write into a season that does not exist', async () => {
    await assertFails(as(MEMBER).doc('seasons/nope/items/i1').set(item(MEMBER)))
  })
})

describe('history', () => {
  test('member can append history to active season', async () => {
    await assertSucceeds(as(MEMBER).doc('seasons/s26/history/h2').set(event(MEMBER)))
  })

  test('item write + history event in one batch succeeds', async () => {
    const db = as(MEMBER)
    const batch = db.batch()
    batch.set(db.doc('seasons/s26/items/i2'), item(MEMBER))
    batch.set(db.doc('seasons/s26/history/h2'), event(MEMBER))
    await assertSucceeds(batch.commit())
  })

  test('history is append-only: update and delete fail', async () => {
    await assertFails(as(MEMBER).doc('seasons/s26/history/h1').update({ reason: 'edit' }))
    await assertFails(as(MEMBER).doc('seasons/s26/history/h1').set(event(MEMBER)))
    await assertFails(as(MEMBER).doc('seasons/s26/history/h1').delete())
    await assertFails(as(ADMIN).doc('seasons/s26/history/h1').update({ reason: 'edit' }))
    await assertFails(as(ADMIN).doc('seasons/s26/history/h1').delete())
  })

  test('history create fails when by != own email', async () => {
    await assertFails(as(MEMBER).doc('seasons/s26/history/h2').set(event(ADMIN)))
    await assertFails(as(MEMBER).doc('seasons/s26/history/h3').set({ at: 2, stepId: 'regras', action: 'create' }))
  })

  test('history create fails in archived season', async () => {
    await assertFails(as(MEMBER).doc('seasons/s25/history/h2').set(event(MEMBER)))
  })
})

describe('admin-only collections', () => {
  test('member cannot write members, config or secrets; admin can', async () => {
    const m = as(MEMBER)
    await assertFails(m.doc(`members/${OUTSIDER}`).set({ email: OUTSIDER, role: 'member' }))
    await assertFails(m.doc(`members/${MEMBER}`).update({ role: 'admin' }))
    await assertFails(m.doc('config/app').set({ aiProvider: 'openai', model: 'x' }))
    await assertFails(m.doc('secrets/ai').set({ anthropic: 'sk-evil', updatedBy: MEMBER, updatedAt: 2 }))

    const a = as(ADMIN)
    await assertSucceeds(a.doc(`members/${OUTSIDER}`).set({ email: OUTSIDER, role: 'member' }))
    await assertSucceeds(a.doc(`members/${OUTSIDER}`).delete())
    await assertSucceeds(a.doc('config/app').set({ aiProvider: 'openai', model: 'x' }))
    await assertSucceeds(a.doc('secrets/ai').set({ anthropic: 'sk-new', updatedBy: ADMIN, updatedAt: 2 }))
  })

  test('only admin can create, update or delete seasons (even archived)', async () => {
    await assertFails(as(MEMBER).doc('seasons/s27').set({ id: 's27', name: '2027', year: 2027, status: 'active', createdAt: 1 }))
    await assertFails(as(MEMBER).doc('seasons/s26').update({ status: 'archived' }))
    await assertSucceeds(as(ADMIN).doc('seasons/s27').set({ id: 's27', name: '2027', year: 2027, status: 'active', createdAt: 1 }))
    await assertSucceeds(as(ADMIN).doc('seasons/s25').update({ status: 'active' }))
    await assertSucceeds(as(ADMIN).doc('seasons/s27').delete())
  })

  test('member can read members and config; non-member cannot', async () => {
    await assertSucceeds(as(MEMBER).collection('members').get())
    await assertSucceeds(as(MEMBER).doc('config/app').get())
    await assertFails(as(OUTSIDER).collection('members').get())
    await assertFails(as(OUTSIDER).doc('config/app').get())
  })

  test('non-member cannot read secrets/ai; member can', async () => {
    await assertFails(as(OUTSIDER).doc('secrets/ai').get())
    await assertFails(env.unauthenticatedContext().firestore().doc('secrets/ai').get())
    await assertSucceeds(as(MEMBER).doc('secrets/ai').get())
  })

  test('unknown top-level collections are denied', async () => {
    await assertFails(as(ADMIN).doc('other/x').set({ a: 1 }))
    await assertFails(as(ADMIN).doc('other/x').get())
  })
})
