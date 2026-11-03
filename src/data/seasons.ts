import { doc, updateDoc, writeBatch, type Firestore } from 'firebase/firestore'
import { STEPS } from '../threedm/template'
import { seasonDoc, seasonsCol, stepDoc } from './paths'

export async function createSeason(db: Firestore, by: string, name: string, year: number): Promise<string> {
  void by // seasons carry no author; kept for a uniform signature with other mutations
  const ref = doc(seasonsCol(db))
  // Season doc first: the step rules check season status with get() on pre-request state,
  // so seeding steps in the same batch would be denied.
  await writeBatch(db).set(ref, { id: ref.id, name, year, status: 'active', createdAt: Date.now() }).commit()
  const batch = writeBatch(db)
  for (const s of STEPS) batch.set(stepDoc(db, ref.id, s.id), { stepId: s.id, status: 'nao_iniciado', conclusion: '' })
  await batch.commit()
  return ref.id
}

export const archiveSeason = (db: Firestore, sid: string) => updateDoc(seasonDoc(db, sid), { status: 'archived' })
export const reopenSeason = (db: Firestore, sid: string) => updateDoc(seasonDoc(db, sid), { status: 'active' })
