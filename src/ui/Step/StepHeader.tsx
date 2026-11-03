import { useState } from 'react'
import { db } from '../../firebase'
import { closeStep, reopenStep, updateStep } from '../../data/steps'
import type { StepDef } from '../../threedm/template'
import type { Group, StepState, StepStatus } from '../../threedm/types'

const STATUS_LABEL: Record<StepStatus, string> = {
  nao_iniciado: 'Não iniciado', em_andamento: 'Em andamento', em_revisao: 'Em revisão', concluido: 'Concluído',
}

export default function StepHeader({ sid, stepDef, state, groups, by, readOnly, isAdmin = false }: {
  sid: string; stepDef: StepDef; state?: StepState; groups: Group[]; by: string; readOnly: boolean
  /** Closing/reopening a stage is admin-only (spec §3); members only see the status. */
  isAdmin?: boolean
}) {
  const [draft, setDraft] = useState<string | null>(null)
  const [deadlineDraft, setDeadlineDraft] = useState<string | null>(null)
  const conclusion = draft ?? state?.conclusion ?? ''
  const [reopening, setReopening] = useState(false)
  const [reason, setReason] = useState('')
  const [guidanceOpen, setGuidanceOpen] = useState(false)
  const status = state?.status ?? 'nao_iniciado'
  const closed = status === 'concluido'
  const patch = (p: Partial<StepState>) => void updateStep(db, sid, by, stepDef.id, p)

  return (
    <header className="mb-4 rounded border bg-white p-4">
      <h2 className="text-xl font-semibold">{stepDef.id} · {stepDef.title}</h2>
      <p className="text-sm text-slate-600">{stepDef.description}</p>
      {stepDef.guidance && (
        <div className="mt-2">
          <button className="text-sm text-blue-700 underline" aria-expanded={guidanceOpen} onClick={() => setGuidanceOpen((v) => !v)}>
            {guidanceOpen ? 'Ocultar orientações' : 'Ver orientações'}
          </button>
          {guidanceOpen && <p className="mt-1 rounded bg-blue-50 p-2 text-sm">{stepDef.guidance}</p>}
        </div>
      )}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <label className="text-sm">Grupo
          <select disabled={readOnly} value={state?.groupId ?? ''} className="mt-1 w-full rounded border px-2 py-1"
            onChange={(e) => patch({ groupId: e.target.value })}>
            <option value="">—</option>
            {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
          </select>
        </label>
        <label className="text-sm">Prazo
          <input type="date" disabled={readOnly} value={deadlineDraft ?? state?.deadline ?? ''} className="mt-1 w-full rounded border px-2 py-1"
            onChange={(e) => setDeadlineDraft(e.target.value)}
            onBlur={() => {
              if (deadlineDraft !== null && deadlineDraft !== (state?.deadline ?? '')) patch({ deadline: deadlineDraft })
              setDeadlineDraft(null)
            }} />
        </label>
        <label className="text-sm">Status
          <select disabled={readOnly || closed} value={status} className="mt-1 w-full rounded border px-2 py-1"
            onChange={(e) => patch({ status: e.target.value as StepStatus })}>
            {(Object.keys(STATUS_LABEL) as StepStatus[])
              .filter((s) => s !== 'concluido' || closed)
              .map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
          </select>
        </label>
      </div>
      <label className="mt-3 block text-sm">Conclusão
        <textarea disabled={readOnly} value={conclusion} rows={3} className="mt-1 w-full rounded border px-2 py-1"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => { if (draft !== null && draft !== (state?.conclusion ?? '')) patch({ conclusion: draft }); setDraft(null) }} />
      </label>
      {!readOnly && isAdmin && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {!closed && (
            <button className="rounded bg-emerald-600 px-3 py-1 text-white" onClick={() => void closeStep(db, sid, by, stepDef.id, conclusion)}>
              Concluir etapa
            </button>
          )}
          {closed && !reopening && (
            <button className="rounded border px-3 py-1" onClick={() => setReopening(true)}>Reabrir</button>
          )}
          {closed && reopening && (
            <form className="flex gap-2" onSubmit={(e) => {
              e.preventDefault()
              if (!reason.trim()) return
              void reopenStep(db, sid, by, stepDef.id, reason.trim()); setReopening(false); setReason('')
            }}>
              <input aria-label="Motivo da reabertura" placeholder="Motivo da reabertura" required value={reason}
                onChange={(e) => setReason(e.target.value)} className="rounded border px-2 py-1" />
              <button type="submit" className="rounded bg-amber-600 px-3 py-1 text-white">Confirmar reabertura</button>
              <button type="button" className="px-2" onClick={() => setReopening(false)}>Cancelar</button>
            </form>
          )}
        </div>
      )}
    </header>
  )
}
