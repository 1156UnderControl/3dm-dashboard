import { useState } from 'react'
import type { PresenceMap } from '../../data/presence'
import type { ColumnDef, ItemKindDef } from '../../threedm/template'
import type { Item, Member } from '../../threedm/types'
import ImageField from '../common/ImageField'
import AiBadge from './AiBadge'

export interface RowActions {
  onSave: (item: Item, patch: Record<string, unknown>) => void
  onFocusField: (field: string) => void
  onBlurField: () => void
  onAccept: (item: Item) => void
  onReject: (item: Item, reason?: string) => void
  onDelete: (item: Item) => void
  onHistory?: (item: Item) => void
}

const inputCls = 'w-full min-w-[8rem] rounded border border-slate-300 px-1.5 py-1 text-sm disabled:bg-slate-100'

function Cell({ item, col, members, disabled, actions }: {
  item: Item; col: ColumnDef; members: Member[]; disabled: boolean; actions: RowActions
}) {
  const stored = item.data[col.key]
  const storedStr = stored === undefined || stored === null ? '' : String(stored)
  const [draft, setDraft] = useState<string | null>(null)
  const text = draft ?? storedStr
  const field = `${item.id}.${col.key}`
  const focus = () => actions.onFocusField(field)
  const commit = () => {
    actions.onBlurField()
    if (draft === null || draft === storedStr) { setDraft(null); return }
    const value = col.type === 'number' ? (draft.trim() === '' ? null : Number(draft)) : draft
    setDraft(null)
    actions.onSave(item, { [col.key]: value })
  }
  const save = (value: unknown) => actions.onSave(item, { [col.key]: value })

  switch (col.type) {
    case 'bool':
      return (
        <input
          type="checkbox" aria-label={col.label} disabled={disabled} checked={stored === true}
          onFocus={focus} onBlur={actions.onBlurField} onChange={(e) => save(e.target.checked)}
        />
      )
    case 'enum':
      return (
        <select aria-label={col.label} disabled={disabled} value={storedStr} className={inputCls}
          onFocus={focus} onBlur={actions.onBlurField} onChange={(e) => save(e.target.value)}>
          <option value="">—</option>
          {col.options?.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      )
    case 'person':
      return (
        <select aria-label={col.label} disabled={disabled} value={storedStr} className={inputCls}
          onFocus={focus} onBlur={actions.onBlurField} onChange={(e) => save(e.target.value)}>
          <option value="">—</option>
          {members.map((m) => <option key={m.email} value={m.email}>{m.displayName ?? m.email}</option>)}
        </select>
      )
    case 'image':
      return (
        <ImageField label={col.label} value={storedStr} disabled={disabled} onSave={save} onFocus={focus} onBlur={actions.onBlurField} />
      )
    case 'longtext':
      return (
        <textarea aria-label={col.label} disabled={disabled} value={text} rows={2} className={inputCls}
          onFocus={focus} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
      )
    default: {
      const type = col.type === 'number' ? 'number' : col.type === 'date' ? 'date' : 'text'
      return (
        <div className="flex items-center gap-1">
          <input aria-label={col.label} type={type} disabled={disabled} value={text} className={inputCls}
            onFocus={focus} onChange={(e) => setDraft(e.target.value)} onBlur={commit} />
          {col.type === 'link' && storedStr && (
            <a href={storedStr} target="_blank" rel="noreferrer" aria-label={`Abrir ${col.label}`} className="text-blue-600">↗</a>
          )}
        </div>
      )
    }
  }
}

export default function ItemRow({ item, kindDef, members, disabled, presence, selfUid, actions }: {
  item: Item; kindDef: ItemKindDef; members: Member[]; disabled: boolean
  presence: PresenceMap; selfUid?: string; actions: RowActions
}) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  const isAi = item.origin !== 'human'
  const pending = item.origin === 'ai' && item.state === 'active'
  const rejected = item.state === 'rejected'

  return (
    <tr data-testid="item-row" data-item={item.id} className={rejected ? 'bg-slate-50 opacity-60' : ''}>
      <td className="whitespace-nowrap px-2 py-1 align-top">
        {isAi && <AiBadge citation={item.citation} />}
        {rejected && <span className="ml-1 text-xs text-slate-500">rejeitado</span>}
      </td>
      {kindDef.columns.map((col) => {
        const field = `${item.id}.${col.key}`
        const editor = Object.entries(presence).find(([uid, p]) => uid !== selfUid && p.field === field)?.[1]
        return (
          <td key={col.key} className="px-2 py-1 align-top">
            <Cell item={item} col={col} members={members} disabled={disabled || rejected} actions={actions} />
            {editor && <div className="text-xs text-amber-600">{editor.name} está editando</div>}
          </td>
        )
      })}
      <td className="whitespace-nowrap px-2 py-1 align-top">
        {!disabled && pending && !rejecting && (
          <span className="flex gap-1">
            <button aria-label="Aceitar" title="Aceitar" className="text-green-700" onClick={() => actions.onAccept(item)}>✓</button>
            <button aria-label="Rejeitar" title="Rejeitar" className="text-red-700" onClick={() => setRejecting(true)}>✗</button>
            <button aria-label="Editar" title="Editar (edite qualquer célula)" className="text-slate-700"
              onClick={(e) => e.currentTarget.closest('tr')?.querySelector<HTMLElement>('input,textarea,select')?.focus()}>✎</button>
          </span>
        )}
        {!disabled && rejecting && (
          <span className="flex gap-1">
            <input aria-label="Motivo (opcional)" placeholder="Motivo (opcional)" value={reason}
              onChange={(e) => setReason(e.target.value)} className="w-32 rounded border px-1 text-xs" />
            <button className="text-xs text-red-700" onClick={() => { actions.onReject(item, reason.trim() || undefined); setRejecting(false); setReason('') }}>Confirmar</button>
            <button className="text-xs" onClick={() => setRejecting(false)}>Cancelar</button>
          </span>
        )}
        {!disabled && !isAi && (
          <button className="text-xs text-red-600" onClick={() => actions.onDelete(item)}>Excluir</button>
        )}
        {actions.onHistory && (
          <button className="ml-1 text-xs text-slate-600" onClick={() => actions.onHistory?.(item)}>Histórico</button>
        )}
      </td>
    </tr>
  )
}
