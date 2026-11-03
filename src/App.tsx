import { BrowserRouter } from 'react-router'
import AuthGate from './auth/AuthGate'
import AppRoutes from './routes'

export default function App() {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b bg-white px-4 py-3">
        <h1 className="text-lg font-semibold">3DM · Under Control 1156</h1>
      </header>
      <AuthGate>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthGate>
    </div>
  )
}
