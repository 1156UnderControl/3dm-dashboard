import { doc, writeBatch, type Firestore } from 'firebase/firestore'
import { nextOrigin } from '../threedm/origin'
import type { HistoryAction, HistoryEvent, Item, NewItem } from '../threedm/types'
import { historyCol, itemDoc, itemsCol } from './paths'

function event(by: string, stepId: string, itemId: string, action: HistoryAction, extra: Partial<HistoryEvent> = {}): HistoryEvent {
  const e: HistoryEvent = { at: Date.now(), by, stepId, itemId, action }
  for (const [k, v] of Object.entries(extra)) if (v !== undefined) (e as unknown as Record<string, unknown>)[k] = v
  return e
}

export async function createItem(db: Firestore, sid: string, by: string, input: NewItem): Promise<string> {
  const ref = doc(itemsCol(db, sid))
  const now = Date.now()
  const data: Record<string, unknown> = {
    stepId: input.stepId, kind: input.kind, data: input.data,
    origin: input.origin ?? 'human', state: 'active', order: now,
    createdBy: by, updatedBy: by, updatedAt: now,
  }
  if (input.aiKey !== undefined) data.aiKey = input.aiKey
  if (input.citation !== undefined) data.citation = input.citation
  const batch = writeBatch(db)
  batch.set(ref, data)
  batch.set(doc(historyCol(db, sid)), event(by, input.stepId, ref.id, 'create', { after: data }))
  await batch.commit()
  return ref.id
}

export async function updateItem(
  db: Firestore, sid: string, by: string, item: Item, patch: Record<string, unknown>, reason?: string,
): Promise<void> {
  const before: Record<string, unknown> = {}
  const after: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(patch)) {
    before[k] = item.data[k] ?? null
    after[k] = v
  }
  const origin = nextOrigin(item.origin, 'edit')
  if (origin !== item.origin) { before.origin = item.origin; after.origin = origin }
  const batch = writeBatch(db)
  batch.set(itemDoc(db, sid, item.id), { data: patch, origin, updatedBy: by, updatedAt: Date.now() }, { merge: true })
  batch.set(doc(historyCol(db, sid)), event(by, item.stepId, item.id, 'update', { before, after, reason }))
  await batch.commit()
}

export async function acceptItem(db: Firestore, sid: string, by: string, item: Item): Promise<void> {
  const origin = nextOrigin(item.origin, 'accept')
  const batch = writeBatch(db)
  batch.update(itemDoc(db, sid, item.id), { origin, updatedBy: by, updatedAt: Date.now() })
  batch.set(doc(historyCol(db, sid)), event(by, item.stepId, item.id, 'accept', {
    before: { origin: item.origin }, after: { origin },
  }))
  await batch.commit()
}

export async function rejectItem(db: Firestore, sid: string, by: string, item: Item, reason?: string): Promise<void> {
  const batch = writeBatch(db)
  batch.update(itemDoc(db, sid, item.id), { state: 'rejected', updatedBy: by, updatedAt: Date.now() })
  batch.set(doc(historyCol(db, sid)), event(by, item.stepId, item.id, 'reject', {
    before: { state: item.state }, after: { state: 'rejected' }, reason,
  }))
  await batch.commit()
}

export async function deleteItem(db: Firestore, sid: string, by: string, item: Item, reason?: string): Promise<void> {
  if (item.origin !== 'human') throw new Error('Itens de IA não podem ser excluídos; rejeite-os.')
  const batch = writeBatch(db)
  batch.delete(itemDoc(db, sid, item.id))
  batch.set(doc(historyCol(db, sid)), event(by, item.stepId, item.id, 'delete', {
    before: { kind: item.kind, data: item.data }, reason,
  }))
  await batch.commit()
}
