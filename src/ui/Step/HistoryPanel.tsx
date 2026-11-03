import { useHistory } from '../../data/hooks'
import type { HistoryAction, Member } from '../../threedm/types'
import { fmt } from './historyFormat'

const ACTION_LABEL: Record<HistoryAction, string> = {
  create: 'Criou item', update: 'Editou item', accept: 'Aceitou item da IA', reject: 'Rejeitou item da IA',
  delete: 'Excluiu item', 'step-update': 'Atualizou a etapa', close: 'Concluiu a etapa', reopen: 'Reabriu a etapa',
}


function diffRows(before: unknown, after: unknown): Array<[string, unknown, unknown]> {
  const b = (before && typeof before === 'object' ? before : {}) as Record<string, unknown>
  const a = (after && typeof after === 'object' ? after : {}) as Record<string, unknown>
  return [...new Set([...Object.keys(b), ...Object.keys(a)])].map((k) => [k, b[k], a[k]])
}

export default function HistoryPanel({ sid, stepId, itemId, members = [], labels = {}, onClose }: {
  sid: string; stepId?: string; itemId?: string; members?: Member[]
  /** field key -> column label */
  labels?: Record<string, string>
  onClose?: () => void
}) {
  const { data: events, loading } = useHistory(sid, { stepId, itemId })
  const who = (email: string) => members.find((m) => m.email === email)?.displayName ?? email
  return (
    <aside className="rounded border bg-white p-3" aria-label="Histórico">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="font-semibold">{itemId ? 'Histórico do item' : 'Histórico da etapa'}</h3>
        {onClose && <button className="text-sm" onClick={onClose}>Fechar</button>}
      </div>
      {loading && <p className="text-sm text-slate-500">Carregando…</p>}
      {!loading && events.length === 0 && <p className="text-sm text-slate-500">Sem eventos.</p>}
      <ul className="space-y-2">
        {[...events].sort((x, y) => y.at - x.at).map((e) => (
          <li key={e.id} className="border-b pb-2 text-sm">
            <div>
              <strong>{who(e.by)}</strong> · {ACTION_LABEL[e.action]}
              <span className="ml-2 text-xs text-slate-500">{new Date(e.at).toLocaleString('pt-BR')}</span>
            </div>
            {(e.action === 'update' || e.action === 'step-update' || e.action === 'accept' || e.action === 'close' || e.action === 'reopen' || e.action === 'reject') && (
              <ul className="ml-3 text-slate-700">
                {diffRows(e.before, e.after).map(([k, b, a]) => (
                  <li key={k}>{labels[k] ?? k}: {fmt(b)} → {fmt(a)}</li>
                ))}
              </ul>
            )}
            {e.reason && <div className="ml-3 italic text-slate-600">Motivo: {e.reason}</div>}
          </li>
        ))}
      </ul>
    </aside>
  )
}
