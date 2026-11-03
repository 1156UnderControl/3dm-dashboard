import { useState, type FormEvent } from 'react'
import { db } from '../../firebase'
import { useCurrentMember } from '../../auth/context'
import { addMember, removeMember } from '../../data/members'
import { useMembers } from '../../data/hooks'
import type { Role } from '../../threedm/types'

export default function Members() {
  const { data: members } = useMembers()
  const { user } = useCurrentMember()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('member')

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    await addMember(db, email, role)
    setEmail('')
  }

  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">Membros</h2>
      <form onSubmit={submit} className="mb-4 flex flex-wrap gap-2">
        <input
          type="email" aria-label="E-mail" placeholder="email@exemplo.com" value={email}
          onChange={(e) => setEmail(e.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1"
        />
        <select aria-label="Papel" value={role} onChange={(e) => setRole(e.target.value as Role)} className="rounded border px-2 py-1">
          <option value="member">Membro</option>
          <option value="admin">Admin</option>
        </select>
        <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-white">Adicionar</button>
      </form>
      <ul className="divide-y rounded border bg-white">
        {members.map((m) => (
          <li key={m.email} className="flex items-center justify-between gap-2 px-3 py-2">
            <span className="min-w-0 truncate">{m.email} <span className="text-sm text-slate-500">({m.role === 'admin' ? 'Admin' : 'Membro'})</span></span>
            {m.email !== user?.email?.toLowerCase() && (
              <button className="text-sm text-red-600" onClick={() => removeMember(db, m.email)}>Remover</button>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}
