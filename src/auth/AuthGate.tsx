import { useEffect, useState, type ReactNode } from 'react'
import { Ctx, type CurrentMember } from './context'
import { GoogleAuthProvider, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth'
import { onSnapshot } from 'firebase/firestore'
import { auth, db } from '../firebase'
import { memberDoc } from '../data/paths'
import type { Member } from '../threedm/types'

/** Listens to Firebase auth, then to members/{email}. Prefer `useCurrentMember()` inside the gate. */
function useCurrentMemberState(): CurrentMember {
  const [state, setState] = useState<CurrentMember>({ user: null, member: null, loading: true })
  useEffect(() => {
    let unsubMember: (() => void) | undefined
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      unsubMember?.()
      unsubMember = undefined
      if (!user || !user.email) { setState({ user: null, member: null, loading: false }); return }
      setState({ user, member: null, loading: true })
      unsubMember = onSnapshot(
        memberDoc(db, user.email),
        (snap) => setState({ user, member: snap.exists() ? (snap.data() as Member) : null, loading: false }),
        () => setState({ user, member: null, loading: false }),
      )
    })
    return () => { unsubMember?.(); unsubAuth() }
  }, [])
  return state
}


export default function AuthGate({ children }: { children: ReactNode }) {
  const state = useCurrentMemberState()
  if (state.loading) return <p className="p-6 text-slate-500">Carregando…</p>
  if (!state.user) {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <p className="mb-4">Entre com a conta Google da equipe.</p>
        <button
          className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
          onClick={() => signInWithPopup(auth, new GoogleAuthProvider())}
        >
          Entrar com Google
        </button>
      </div>
    )
  }
  if (!state.member) {
    return (
      <div className="mx-auto max-w-sm p-6 text-center">
        <p className="mb-4">Sua conta não está liberada. Peça acesso a um admin da 1156.</p>
        <button className="rounded border px-3 py-1" onClick={() => signOut(auth)}>Sair</button>
      </div>
    )
  }
  return <Ctx.Provider value={state}>{children}</Ctx.Provider>
}
