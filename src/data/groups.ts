import { addDoc, deleteDoc, updateDoc, type Firestore } from 'firebase/firestore'
import type { Group } from '../threedm/types'
import { groupDoc, groupsCol } from './paths'

export async function createGroup(db: Firestore, sid: string, name: string, memberEmails: string[] = []): Promise<string> {
  const ref = await addDoc(groupsCol(db, sid), { name, memberEmails })
  return ref.id
}

export const updateGroup = (db: Firestore, sid: string, id: string, patch: Partial<Omit<Group, 'id'>>) =>
  updateDoc(groupDoc(db, sid, id), patch)

export const deleteGroup = (db: Firestore, sid: string, id: string) => deleteDoc(groupDoc(db, sid, id))
