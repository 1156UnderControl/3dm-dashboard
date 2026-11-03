import { deleteField, doc, getDoc, writeBatch, type Firestore } from 'firebase/firestore'
import type { HistoryAction, HistoryEvent, StepState } from '../threedm/types'
import { historyCol, stepDoc } from './paths'

async function commitStep(
  db: Firestore, sid: string, by: string, stepId: string, action: HistoryAction,
  write: Record<string, unknown>, shown: Record<string, unknown>, reason?: string,
) {
  const snap = await getDoc(stepDoc(db, sid, stepId))
  const cur = (snap.data() ?? {}) as Record<string, unknown>
  const before: Record<string, unknown> = {}
  for (const k of Object.keys(shown)) before[k] = cur[k] ?? null
  const ev: HistoryEvent = { at: Date.now(), by, stepId, action, before, after: shown }
  if (reason !== undefined) ev.reason = reason
  const batch = writeBatch(db)
  batch.set(stepDoc(db, sid, stepId), { stepId, ...write }, { merge: true })
  batch.set(doc(historyCol(db, sid)), ev)
  await batch.commit()
}

export async function updateStep(db: Firestore, sid: string, by: string, stepId: string, patch: Partial<StepState>): Promise<void> {
  const clean = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
  await commitStep(db, sid, by, stepId, 'step-update', clean, clean)
}

export async function closeStep(db: Firestore, sid: string, by: string, stepId: string, conclusion: string): Promise<void> {
  const closedAt = Date.now()
  const shown = { status: 'concluido', conclusion, closedBy: by, closedAt }
  await commitStep(db, sid, by, stepId, 'close', shown, shown)
}

export async function reopenStep(db: Firestore, sid: string, by: string, stepId: string, reason: string): Promise<void> {
  await commitStep(
    db, sid, by, stepId, 'reopen',
    { status: 'em_andamento', closedBy: deleteField(), closedAt: deleteField() },
    { status: 'em_andamento', closedBy: null, closedAt: null },
    reason,
  )
}
