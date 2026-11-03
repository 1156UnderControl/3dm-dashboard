import { deleteDoc, setDoc, type Firestore } from 'firebase/firestore'
import type { Member, Role } from '../threedm/types'
import { memberDoc } from './paths'

export async function addMember(db: Firestore, email: string, role: Role, displayName?: string): Promise<void> {
  const e = email.trim().toLowerCase()
  const m: Member = { email: e, role }
  if (displayName) m.displayName = displayName
  await setDoc(memberDoc(db, e), m)
}

export const removeMember = (db: Firestore, email: string) => deleteDoc(memberDoc(db, email))
