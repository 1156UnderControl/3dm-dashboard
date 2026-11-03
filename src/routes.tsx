import { Link, Navigate, NavLink, Outlet, Route, Routes, useNavigate, useParams } from 'react-router'
import { signOut } from 'firebase/auth'
import { auth } from './firebase'
import { useCurrentMember } from './auth/context'
import { useSeasons } from './data/hooks'
import Pipeline from './ui/Home/PipelineContainer'
import StepPage from './ui/Step/StepPage'
import Members from './ui/Admin/Members'
import Seasons from './ui/Admin/Seasons'
import Groups from './ui/Admin/Groups'
import AiSettings from './ui/Admin/AiSettings'
import SeasonSetup from './ui/Admin/SeasonSetup'

function RequireAdmin() {
  const { member } = useCurrentMember()
  return member?.role === 'admin' ? <Outlet /> : <Navigate to="/" replace />
}

function Layout() {
  const { member, user } = useCurrentMember()
  const { data: seasons } = useSeasons()
  const { sid } = useParams()
  const navigate = useNavigate()
  const current = sid ?? seasons.find((s) => s.status === 'active')?.id ?? ''
  const link = 'rounded px-2 py-1 text-sm hover:bg-slate-100'
  return (
    <>
      <nav className="flex flex-wrap items-center gap-2 border-b bg-white px-4 py-2">
        <select
          aria-label="Temporada" value={current} onChange={(e) => navigate(`/s/${e.target.value}`)}
          className="rounded border px-2 py-1 text-sm"
        >
          {seasons.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <NavLink to="/" className={link}>Pipeline</NavLink>
        {current && <NavLink to={`/s/${current}/groups`} className={link}>Grupos</NavLink>}
        <NavLink to="/settings/ai" className={link}>IA</NavLink>
        {member?.role === 'admin' && (
          <>
            <NavLink to="/admin/members" className={link}>Membros</NavLink>
            <NavLink to="/admin/seasons" className={link}>Temporadas</NavLink>
          </>
        )}
        <span className="ml-auto flex items-center gap-2 text-sm text-slate-600">
          <span className="hidden sm:inline">{user?.email}</span>
          <button className="rounded border px-2 py-1" onClick={() => signOut(auth)}>Sair</button>
        </span>
      </nav>
      <main className="mx-auto max-w-5xl p-4"><Outlet /></main>
    </>
  )
}

function Home() {
  const { data: seasons, loading } = useSeasons()
  if (loading) return <p className="text-slate-500">Carregando…</p>
  const active = seasons.find((s) => s.status === 'active') // seasons are ordered newest first
  if (!active) return <p>Nenhuma temporada ativa. <Link className="text-blue-600 underline" to="/admin/seasons">Criar temporada</Link></p>
  return <Pipeline sid={active.id} />
}

function SeasonPipeline() {
  const { sid } = useParams()
  return sid ? <Pipeline sid={sid} /> : null
}

export default function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="s/:sid" element={<SeasonPipeline />} />
        <Route path="s/:sid/step/:stepId" element={<StepPage />} />
        <Route path="s/:sid/groups" element={<Groups />} />
        <Route path="settings/ai" element={<AiSettings />} />
        <Route element={<RequireAdmin />}>
          <Route path="admin/members" element={<Members />} />
          <Route path="admin/seasons" element={<Seasons />} />
          <Route path="s/:sid/setup" element={<SeasonSetup />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
