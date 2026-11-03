import { useEffect, useState } from 'react'
import { onDisconnect, onValue, ref, remove, serverTimestamp, set } from 'firebase/database'
import { auth, rtdb } from '../firebase'

export interface PresenceEntry { name: string; stepId?: string; field?: string; at: number }
export type PresenceMap = Record<string, PresenceEntry>

export const presenceRef = (sid: string, uid?: string) =>
  ref(rtdb, uid ? `presence/${sid}/${uid}` : `presence/${sid}`)

/** Announce where the current user is. Pass `{}` for "online, not on a step". Removed automatically on disconnect. */
export async function setPresence(sid: string, where: { stepId?: string; field?: string } = {}): Promise<void> {
  const user = auth.currentUser
  if (!user) return
  const r = presenceRef(sid, user.uid)
  await onDisconnect(r).remove()
  await set(r, {
    name: user.displayName ?? user.email ?? 'Alguém',
    stepId: where.stepId ?? null,
    field: where.field ?? null,
    at: serverTimestamp(),
  })
}

export const clearPresence = async (sid: string): Promise<void> => {
  const user = auth.currentUser
  if (user) await remove(presenceRef(sid, user.uid))
}

export function usePresence(sid: string | undefined): PresenceMap {
  const [map, setMap] = useState<PresenceMap>({})
  useEffect(() => {
    if (!sid) return
    return onValue(presenceRef(sid), (snap) => {
      const raw = (snap.val() ?? {}) as Record<string, { name?: string; stepId?: string | null; field?: string | null; at?: number }>
      const out: PresenceMap = {}
      for (const [uid, v] of Object.entries(raw)) {
        out[uid] = { name: v.name ?? 'Alguém', stepId: v.stepId ?? undefined, field: v.field ?? undefined, at: v.at ?? 0 }
      }
      setMap(out)
    }, () => setMap({}))
  }, [sid])
  return map
}
