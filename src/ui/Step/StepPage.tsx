import { useEffect, useState, type ReactNode } from 'react'
import { useParams } from 'react-router'
import { useCurrentMember } from '../../auth/context'
import { useGroups, useItems, useMembers, useSeason, useSteps } from '../../data/hooks'
import { setPresence, usePresence } from '../../data/presence'
import { getStep, STEPS, type ItemKindDef, type StepDef } from '../../threedm/template'
import type { Item } from '../../threedm/types'
import { AskManual, SuggestBar } from './AiTools'
import CadFlow from './CadFlow'
import DecisionMatrix from './DecisionMatrix'
import HistoryPanel from './HistoryPanel'
import { ItemTable } from './ItemTable'
import PriorityBoard from './PriorityBoard'
import StepHeader from './StepHeader'

interface ViewProps {
  sid: string; by: string; selfUid?: string; readOnly: boolean
  items: Item[]; presence: ReturnType<typeof usePresence>; members: ReturnType<typeof useMembers>['data']
  onHistory: (item: Item) => void
}

/** Single switch point on `stepDef.view`. */
function renderKind(stepDef: StepDef, kindDef: ItemKindDef, p: ViewProps): ReactNode {
  const tableProps = {
    sid: p.sid, stepDef, items: p.items, readOnly: p.readOnly, by: p.by, presence: p.presence,
    selfUid: p.selfUid, members: p.members, onHistory: p.onHistory,
  }
  switch (stepDef.view) {
    case 'priority-board':
      return kindDef.kind === 'priority' ? <PriorityBoard key={kindDef.kind} {...tableProps} kindDef={kindDef} /> : (
        <ItemTable key={kindDef.kind} {...tableProps} kindDef={kindDef} />
      )
    case 'decision-matrix':
      return kindDef.kind === 'attribute' ? <DecisionMatrix key={kindDef.kind} {...tableProps} /> : null
    case 'cad-flow':
      return kindDef.kind === 'cad' ? <CadFlow key={kindDef.kind} {...tableProps} /> : null
    default:
      return (
        <ItemTable key={kindDef.kind} sid={p.sid} stepDef={stepDef} kindDef={kindDef} items={p.items}
          readOnly={p.readOnly} by={p.by} presence={p.presence} selfUid={p.selfUid} members={p.members} onHistory={p.onHistory} />
      )
  }
}

export default function StepPage() {
  const { sid, stepId } = useParams()
  const { user, member } = useCurrentMember()
  const { data: season } = useSeason(sid)
  const { data: stepStates } = useSteps(sid)
  const { data: items } = useItems(sid, stepId)
  const { data: groups } = useGroups(sid)
  const { data: members } = useMembers()
  const presence = usePresence(sid)
  const [historyItem, setHistoryItem] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)

  useEffect(() => {
    if (!sid || !stepId) return
    void setPresence(sid, { stepId }).catch(() => {})
    return () => { void setPresence(sid, {}).catch(() => {}) }
  }, [sid, stepId])

  const stepDef = stepId ? STEPS.find((s) => s.id === stepId) && getStep(stepId) : undefined
  if (!sid || !stepDef) return <p className="text-slate-500">Etapa não encontrada.</p>
  const by = user?.email ?? ''
  const readOnly = season?.status === 'archived'
  const labels = Object.fromEntries(stepDef.kinds.flatMap((k) => k.columns.map((c) => [c.key, c.label])))

  const props: ViewProps = {
    sid, by, selfUid: user?.uid, readOnly, items, presence, members,
    onHistory: (item) => { setHistoryItem(item.id); setShowHistory(true) },
  }

  return (
    <div>
      {readOnly && <div role="status" className="mb-3 rounded bg-amber-100 p-2 text-amber-900">Temporada arquivada</div>}
      <StepHeader sid={sid} stepDef={stepDef} state={stepStates.find((s) => s.stepId === stepDef.id)} groups={groups} by={by} readOnly={readOnly} isAdmin={member?.role === 'admin'} />
      {stepDef.id === '1.2' && <AskManual sid={sid} by={by} readOnly={readOnly} items={items} />}
      {stepDef.kinds.map((k) => {
        const view = renderKind(stepDef, k, props)
        return view && (
          <div key={k.kind}>
            <SuggestBar sid={sid} stepDef={stepDef} kindDef={k} items={items} by={by} readOnly={readOnly} />
            {view}
          </div>
        )
      })}
      <button className="rounded border px-3 py-1 text-sm" onClick={() => { setHistoryItem(null); setShowHistory((v) => !v) }}>
        {showHistory && !historyItem ? 'Ocultar histórico' : 'Histórico da etapa'}
      </button>
      {showHistory && (
        <div className="mt-3">
          <HistoryPanel key={historyItem ?? 'step'} sid={sid} stepId={historyItem ? undefined : stepDef.id} itemId={historyItem ?? undefined}
            members={members} labels={labels} onClose={() => { setShowHistory(false); setHistoryItem(null) }} />
        </div>
      )}
    </div>
  )
}
