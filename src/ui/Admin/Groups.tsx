import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { db } from '../../firebase'
import { createGroup, deleteGroup, updateGroup } from '../../data/groups'
import { useGroups, useMembers } from '../../data/hooks'

export default function Groups() {
  const { sid } = useParams()
  const { data: groups } = useGroups(sid)
  const { data: members } = useMembers()
  const [name, setName] = useState('')
  if (!sid) return null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    await createGroup(db, sid!, name.trim(), [])
    setName('')
  }

  const toggle = (gid: string, current: string[], email: string) =>
    updateGroup(db, sid, gid, { memberEmails: current.includes(email) ? current.filter((x) => x !== email) : [...current, email] })

  return (
    <section>
      <h2 className="mb-3 text-xl font-semibold">Grupos</h2>
      <form onSubmit={submit} className="mb-4 flex gap-2">
        <input aria-label="Nome do grupo" placeholder="Nome do grupo" value={name} onChange={(e) => setName(e.target.value)} className="min-w-0 flex-1 rounded border px-2 py-1" />
        <button type="submit" className="rounded bg-blue-600 px-3 py-1 text-white">Criar grupo</button>
      </form>
      <div className="grid gap-3 sm:grid-cols-2">
        {groups.map((g) => (
          <div key={g.id} className="rounded border bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="font-medium">{g.name}</h3>
              <button className="text-sm text-red-600" onClick={() => deleteGroup(db, sid, g.id)}>Excluir</button>
            </div>
            <ul>
              {members.map((m) => (
                <li key={m.email}>
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" checked={g.memberEmails.includes(m.email)} onChange={() => toggle(g.id, g.memberEmails, m.email)} />
                    {m.email}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}
