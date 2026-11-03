import { render, screen } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('./firebase', () => ({ auth: {}, db: {}, rtdb: {} }))
vi.mock('firebase/auth', () => ({
  GoogleAuthProvider: class {},
  signInWithPopup: vi.fn(),
  signOut: vi.fn(),
  onAuthStateChanged: (_a: unknown, cb: (u: unknown) => void) => { cb(null); return () => {} },
}))

import App from './App'

describe('App', () => {
  it('renders the shell header', () => {
    render(<App />)
    expect(screen.getByText('3DM · Under Control 1156')).toBeInTheDocument()
  })
})
