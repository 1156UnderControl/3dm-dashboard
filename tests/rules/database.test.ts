import { readFileSync } from 'node:fs'
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing'
import { afterAll, beforeAll, beforeEach, describe, test } from 'vitest'

let env: RulesTestEnvironment

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-3dm',
    database: { rules: readFileSync(new URL('../../database.rules.json', import.meta.url), 'utf8') },
  })
})

afterAll(async () => {
  await env?.cleanup()
})

beforeEach(async () => {
  await env.clearDatabase()
  await env.withSecurityRulesDisabled(async (ctx) => {
    await ctx.database().ref('presence/s26/bob').set({ name: 'Bob', stepId: 'regras' })
  })
})

const alice = () => env.authenticatedContext('alice', { email: 'alice@team1156.org', email_verified: true }).database()

describe('rtdb presence', () => {
  test('rtdb: user can write own presence, not others', async () => {
    await assertSucceeds(alice().ref('presence/s26/alice').set({ name: 'Alice', stepId: 'regras' }))
    await assertSucceeds(alice().ref('presence/s26/alice').remove())
    await assertFails(alice().ref('presence/s26/bob').set({ name: 'Mallory', stepId: 'regras' }))
    await assertFails(alice().ref('presence/s26/bob').remove())
  })

  test('rtdb: signed-in user can read season presence; anonymous cannot', async () => {
    await assertSucceeds(alice().ref('presence/s26').get())
    await assertFails(env.unauthenticatedContext().database().ref('presence/s26').get())
  })

  test('rtdb: unauthenticated user cannot write presence', async () => {
    await assertFails(env.unauthenticatedContext().database().ref('presence/s26/alice').set({ name: 'x' }))
  })

  test('rtdb: everything outside presence is denied', async () => {
    await assertFails(alice().ref('other').set(1))
    await assertFails(alice().ref('/').get())
  })
})
