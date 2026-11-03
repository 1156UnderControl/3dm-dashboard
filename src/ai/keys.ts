import { useEffect, useState } from 'react'
import { deleteField, doc, onSnapshot, setDoc, type Firestore } from 'firebase/firestore'
import { db as appDb } from '../firebase'

export type ProviderId = 'anthropic' | 'openai'
export type TeamKeys = { anthropic?: string; openai?: string }

const lsName = (p: ProviderId) => `3dm.ai.key.${p}`

export function getKey(p: ProviderId): string | null {
  try { return localStorage.getItem(lsName(p)) || null } catch { return null }
}
export function setKey(p: ProviderId, key: string): void {
  try { localStorage.setItem(lsName(p), key) } catch { /* storage unavailable */ }
}
export function clearKey(p: ProviderId): void {
  try { localStorage.removeItem(lsName(p)) } catch { /* storage unavailable */ }
}

/** Personal key wins over the team key. */
export function resolveKey(p: ProviderId, team: TeamKeys): { key: string; source: 'pessoal' | 'equipe' } | null {
  const personal = getKey(p)
  if (personal) return { key: personal, source: 'pessoal' }
  const t = team[p]
  if (t) return { key: t, source: 'equipe' }
  return null
}

export const teamSecretsDoc = (db: Firestore) => doc(db, 'secrets', 'ai')

/** Live `secrets/ai` (readable by members). Keys are never logged. */
export function useTeamKeys(): TeamKeys {
  const [keys, setKeys] = useState<TeamKeys>({})
  useEffect(() => onSnapshot(
    teamSecretsDoc(appDb),
    (snap) => {
      const d = snap.data() ?? {}
      setKeys({
        anthropic: typeof d.anthropic === 'string' ? d.anthropic : undefined,
        openai: typeof d.openai === 'string' ? d.openai : undefined,
      })
    },
    () => setKeys({}),
  ), [])
  return keys
}

/** Admin only (rules). Deliberately writes no history event. */
export async function setTeamKey(db: Firestore, by: string, p: ProviderId, key: string | null): Promise<void> {
  await setDoc(
    teamSecretsDoc(db),
    { [p]: key === null ? deleteField() : key, updatedBy: by, updatedAt: Date.now() },
    { merge: true },
  )
}

export const keyHint = (key: string) => `•••• ${key.slice(-4)}`
