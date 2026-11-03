import { createContext, useContext } from 'react'
import type { User } from 'firebase/auth'
import type { Member } from '../threedm/types'

export interface CurrentMember { user: User | null; member: Member | null; loading: boolean }

export const Ctx = createContext<CurrentMember>({ user: null, member: null, loading: true })

/** `user.email` is what every mutation passes as `by`. */
export const useCurrentMember = () => useContext(Ctx)
