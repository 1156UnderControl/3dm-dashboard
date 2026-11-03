import { collection, doc, type Firestore } from 'firebase/firestore'

export const seasonsCol = (db: Firestore) => collection(db, 'seasons')
export const seasonDoc = (db: Firestore, sid: string) => doc(db, 'seasons', sid)
export const stepsCol = (db: Firestore, sid: string) => collection(db, 'seasons', sid, 'steps')
export const stepDoc = (db: Firestore, sid: string, stepId: string) => doc(db, 'seasons', sid, 'steps', stepId)
export const itemsCol = (db: Firestore, sid: string) => collection(db, 'seasons', sid, 'items')
export const itemDoc = (db: Firestore, sid: string, id: string) => doc(db, 'seasons', sid, 'items', id)
export const groupsCol = (db: Firestore, sid: string) => collection(db, 'seasons', sid, 'groups')
export const groupDoc = (db: Firestore, sid: string, id: string) => doc(db, 'seasons', sid, 'groups', id)
export const historyCol = (db: Firestore, sid: string) => collection(db, 'seasons', sid, 'history')
export const membersCol = (db: Firestore) => collection(db, 'members')
// Member doc ids are lowercase emails (the rules lowercase the token email).
export const memberDoc = (db: Firestore, email: string) => doc(db, 'members', email.toLowerCase())
