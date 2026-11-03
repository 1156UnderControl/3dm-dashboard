import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { db } from '../../firebase'
import { useCurrentMember } from '../../auth/context'
import { archiveSeason, createSeason, reopenSeason } from '../../data/seasons'
import { useSeasons } from '../../data/hooks'

export default function Seasons() {
  const { data: seasons } = useSeasons()
  const { user } = useCurrentMember()
  const [name, setName] = useState('')
  const [year, setYear] = useState('2026')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim() || !user?.email) return
    await createSeason(db, user.email, name.trim(), Number(year))
    setName('')
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">Temporadas</h2>
      <form onSubmit={submit} className="mb-4 flex flex-wrap gap-2">
        <input aria-label="Nome" placeholder="REBUILT 2026" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1" />
        <input aria-label="Ano" type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-24 rounded border px-2 py-1" />
        <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-white">Criar temporada</button>
      </form>
      <ul className="divide-y rounded border bg-white">
        {seasons.map((s) => (
          <li key={s.id} className="flex items-center justify-between gap-2 px-3 py-2">
            <span>{s.name} ({s.year}) <span className="text-sm text-slate-500">{s.status === 'active' ? 'ativa' : 'arquivada'}</span></span>
            {s.status === 'active'
              ? <span className="flex gap-3">
                  <Link className="text-sm text-blue-600" to={`/s/${s.id}/setup`}>Configurar pelo manual</Link>
                  <button className="text-sm text-red-600" onClick={() => archiveSeason(db, s.id)}>Arquivar</button>
                </span>
              : <button className="text-sm text-blue-600" onClick={() => reopenSeason(db, s.id)}>Reabrir</button>}
          </li>
        ))}
      </ul>
    </section>
  )
}
