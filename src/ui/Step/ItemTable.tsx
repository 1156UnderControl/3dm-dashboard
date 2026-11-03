import { useState } from 'react'
import { db } from '../../firebase'
import { acceptItem, createItem, deleteItem, rejectItem, updateItem } from '../../data/items'
import { setPresence, type PresenceMap } from '../../data/presence'
import type { ItemKindDef, StepDef } from '../../threedm/template'
import type { Item, Member } from '../../threedm/types'
import ItemRow, { type RowActions } from './ItemRow'

export interface ItemTableProps {
  sid: string
  stepDef: StepDef
  kindDef: ItemKindDef
  /** Any items of the step; filtered by `kindDef.kind` here. */
  items: Item[]
  readOnly: boolean
  /** Signed-in user's email (history author). */
  by: string
  presence: PresenceMap
  selfUid?: string
  members?: Member[]
  onHistory?: (item: Item) => void
}

export function ItemTable({ sid, stepDef, kindDef, items, readOnly, by, presence, selfUid, members = [], onHistory }: ItemTableProps) {
  const [showRejected, setShowRejected] = useState(false)
  const mine = items.filter((i) => i.kind === kindDef.kind).sort((a, b) => a.order - b.order)
  const rejectedCount = mine.filter((i) => i.state === 'rejected').length
  const visible = mine.filter((i) => showRejected || i.state !== 'rejected')

  const actions: RowActions = {
    onSave: (item, patch) => void updateItem(db, sid, by, item, patch),
    onFocusField: (field) => void setPresence(sid, { stepId: stepDef.id, field }).catch(() => {}),
    onBlurField: () => void setPresence(sid, { stepId: stepDef.id }).catch(() => {}),
    onAccept: (item) => void acceptItem(db, sid, by, item),
    onReject: (item, reason) => void rejectItem(db, sid, by, item, reason),
    onDelete: (item) => void deleteItem(db, sid, by, item),
    onHistory,
  }

  return (
    <section className="mb-6">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{kindDef.label}</h3>
        {rejectedCount > 0 && (
          <button className="text-sm text-slate-600 underline" onClick={() => setShowRejected((v) => !v)}>
            {showRejected ? `Ocultar rejeitados (${rejectedCount})` : `Mostrar rejeitados (${rejectedCount})`}
          </button>
        )}
      </div>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-600">
            <tr>
              <th className="px-2 py-1" />
              {kindDef.columns.map((c) => <th key={c.key} className="px-2 py-1 font-medium">{c.label}</th>)}
              <th className="px-2 py-1" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {visible.map((item) => (
              <ItemRow key={item.id} item={item} kindDef={kindDef} members={members} disabled={readOnly}
                presence={presence} selfUid={selfUid} actions={actions} />
            ))}
            {visible.length === 0 && (
              <tr><td colSpan={kindDef.columns.length + 2} className="px-2 py-3 text-slate-500">Nenhum item.</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {!readOnly && (
        <button className="mt-2 rounded border px-3 py-1 text-sm"
          onClick={() => void createItem(db, sid, by, { stepId: stepDef.id, kind: kindDef.kind, data: {} })}>
          Adicionar linha
        </button>
      )}
    </section>
  )
}

export default ItemTable
