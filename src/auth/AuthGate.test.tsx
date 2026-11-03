import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../firebase', () => ({ auth: {}, db: {}, rtdb: {} }))
vi.mock('../data/paths', () => ({ memberDoc: (_db: unknown, email: string) => ({ email }) }))
vi.mock('../data/hooks', () => ({
  useSeasons: () => ({ data: [], loading: false, error: null }),
  useMembers: () => ({ data: [], loading: false, error: null }),
  useGroups: () => ({ data: [], loading: false, error: null }),
}))

let authUser: { email: string } | null = null
let memberData: unknown = null
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => { cb(authUser); return () => {} },
}))
vi.mock('firebase/firestore', () => ({
  onSnapshot: (_ref: unknown, cb: (s: unknown) => void) => {
    cb({ exists: () => memberData !== null, data: () => memberData })
    return () => {}
  },
}))

import AuthGate from './AuthGate'
import AppRoutes from '../routes'

const renderApp = () => render(
  <MemoryRouter><AuthGate><AppRoutes /></AuthGate></MemoryRouter>,
)

describe('AuthGate', () => {
  beforeEach(() => { authUser = null; memberData = null })

  it('shows sign-in when signed out', () => {
    renderApp()
    expect(screen.getByText('Entrar com Google')).toBeInTheDocument()
  })

  it('shows denial when signed in but not allowlisted', () => {
    authUser = { email: 'x@y.com' }
    renderApp()
    expect(screen.getByText('Sua conta não está liberada. Peça acesso a um admin da 1156.')).toBeInTheDocument()
  })

  it('lets a member in without admin links', () => {
    authUser = { email: 'm@y.com' }
    memberData = { email: 'm@y.com', role: 'member' }
    renderApp()
    expect(screen.getByText('Pipeline')).toBeInTheDocument()
    expect(screen.queryByText('Membros')).not.toBeInTheDocument()
    expect(screen.queryByText('Temporadas')).not.toBeInTheDocument()
  })

  it('shows admin links to admins', () => {
    authUser = { email: 'a@y.com' }
    memberData = { email: 'a@y.com', role: 'admin' }
    renderApp()
    expect(screen.getByText('Membros')).toBeInTheDocument()
    expect(screen.getByText('Temporadas')).toBeInTheDocument()
  })
})
