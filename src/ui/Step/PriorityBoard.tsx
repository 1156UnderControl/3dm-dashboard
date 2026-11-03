import { useState } from 'react'
import { db } from '../../firebase'
import { acceptItem, createItem, rejectItem, updateItem } from '../../data/items'
import { useItems } from '../../data/hooks'
import type { ItemTableProps } from './ItemTable'
import AiBadge from './AiBadge'

const BUCKETS = ['Precisamos', 'Queremos', 'Seria bom', 'Ignorar']
const norm = (s: unknown) => String(s ?? '').trim().toLowerCase()

function Card({ item, sid, by, readOnly }: { item: ItemTableProps['items'][number]; sid: string; by: string; readOnly: boolean }) {
  const [target, setTarget] = useState<string | null>(null)
  const [motivo, setMotivo] = useState('')
  const pending = item.origin === 'ai' && item.state === 'active'
  return (
    <div data-testid="priority-card" className="mb-2 rounded border bg-white p-2 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-1">
        <span>{String(item.data.item ?? '') || <em className="text-slate-400">sem título</em>}</span>
        {item.origin !== 'human' && <AiBadge citation={item.citation} />}
      </div>
      {typeof item.data.meta === 'string' && item.data.meta && <div className="text-xs text-slate-500">Meta: {item.data.meta}</div>}
      {!readOnly && pending && (
        <span className="flex gap-1">
          <button aria-label="Aceitar" title="Aceitar" className="text-green-700" onClick={() => void acceptItem(db, sid, by, item)}>✓</button>
          <button aria-label="Rejeitar" title="Rejeitar" className="text-red-700" onClick={() => void rejectItem(db, sid, by, item)}>✗</button>
        </span>
      )}
      {!readOnly && target === null && (
        <select aria-label="Mover para…" value="" className="mt-1 w-full rounded border text-xs"
          onChange={(e) => setTarget(e.target.value === '__none' ? '' : e.target.value)}>
          <option value="">Mover para…</option>
          <option value="__none">Sem classificação</option>
          {BUCKETS.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      )}
      {!readOnly && target !== null && (
        <div className="mt-1 flex flex-col gap-1">
          <span className="text-xs">Mover para: {target || 'Sem classificação'}</span>
          <input aria-label="Motivo (opcional)" placeholder="Motivo (opcional)" value={motivo}
            onChange={(e) => setMotivo(e.target.value)} className="rounded border px-1 text-xs" />
          <span className="flex gap-2">
            <button className="text-xs underline" onClick={() => {
              void updateItem(db, sid, by, item, { bucket: target }, motivo.trim() || undefined)
              setTarget(null); setMotivo('')
            }}>Confirmar</button>
            <button className="text-xs" onClick={() => { setTarget(null); setMotivo('') }}>Cancelar</button>
          </span>
        </div>
      )}
    </div>
  )
}

export default function PriorityBoard({ sid, stepDef, kindDef, items, readOnly, by }: ItemTableProps) {
  const { data: skills } = useItems(sid, '1.4')
  const cards = items.filter((i) => i.kind === kindDef.kind && i.state !== 'rejected').sort((a, b) => a.order - b.order)
  const columns = [
    { key: 'sem', title: 'Sem classificação', match: (b: string) => !BUCKETS.includes(b) },
    ...BUCKETS.map((b) => ({ key: b, title: b, match: (x: string) => x === b })),
  ]

  const importSkills = async () => {
    const existing = new Set(cards.map((c) => norm(c.data.item)))
    for (const s of skills) {
      if (s.kind !== 'skill' || s.state === 'rejected') continue
      const name = String(s.data.habilidade ?? '').trim()
      if (!name || existing.has(norm(name))) continue
      existing.add(norm(name))
      await createItem(db, sid, by, { stepId: stepDef.id, kind: kindDef.kind, data: { item: name, bucket: '' } })
    }
  }

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{kindDef.label}</h3>
        {!readOnly && (
          <button className="rounded border px-3 py-1 text-sm" onClick={() => void importSkills()}>Importar habilidades da 1.4</button>
        )}
      </div>
      {stepDef.guidance && <p className="mb-2 text-sm text-slate-600">{stepDef.guidance}</p>}
      <div className="grid gap-3 md:grid-cols-5">
        {columns.map((col) => (
          <div key={col.key} data-testid={`col-${col.key}`} className="rounded bg-slate-50 p-2">
            <h4 className="mb-2 text-sm font-medium">{col.title}</h4>
            {cards.filter((c) => col.match(String(c.data.bucket ?? ''))).map((c) => (
              <Card key={c.id} item={c} sid={sid} by={by} readOnly={readOnly} />
            ))}
          </div>
        ))}
      </div>
      {!readOnly && (
        <button className="mt-2 rounded border px-3 py-1 text-sm"
          onClick={() => void createItem(db, sid, by, { stepId: stepDef.id, kind: kindDef.kind, data: { item: '', bucket: '' } })}>
          Adicionar prioridade
        </button>
      )}
    </section>
  )
}
