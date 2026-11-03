import { Link } from 'react-router'
import type { PresenceMap } from '../../data/presence'
import type { StepDef } from '../../threedm/template'
import type { Group, StepState, StepStatus } from '../../threedm/types'
import PresenceDots from '../common/PresenceDots'

const STATUS_LABEL: Record<StepStatus, string> = {
  nao_iniciado: 'Não iniciado',
  em_andamento: 'Em andamento',
  em_revisao: 'Em revisão',
  concluido: 'Concluído',
}

const STATUS_STYLE: Record<StepStatus, string> = {
  nao_iniciado: 'bg-slate-100 text-slate-600',
  em_andamento: 'bg-blue-100 text-blue-800',
  em_revisao: 'bg-amber-100 text-amber-800',
  concluido: 'bg-emerald-100 text-emerald-800',
}

export interface PipelineProps {
  sid: string
  stages: { stage: number; title: string }[]
  steps: StepDef[]
  stepStates: StepState[]
  groups: Group[]
  aiPendingByStep: Record<string, number>
  presence: PresenceMap
  /** YYYY-MM-DD */
  today: string
}

const fmtDate = (d: string) => d.split('-').reverse().join('/')

export function Pipeline({ sid, stages, steps, stepStates, groups, aiPendingByStep, presence, today }: PipelineProps) {
  const states = new Map(stepStates.map((s) => [s.stepId, s]))
  const groupNames = new Map(groups.map((g) => [g.id, g.name]))
  const people = Object.values(presence)
  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h1 className="text-lg font-semibold">Pipeline</h1>
        <span className="text-sm text-slate-600"><span aria-hidden className="mr-1 text-emerald-600">●</span>{people.length} online</span>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {stages.map((stage) => (
          <section key={stage.stage} data-testid="stage-column" className="w-64 shrink-0 rounded-lg bg-slate-100 p-2">
            <h2 className="mb-2 px-1 text-sm font-semibold text-slate-700">{stage.stage}. {stage.title}</h2>
            <div className="flex flex-col gap-2">
              {steps.filter((s) => s.stage === stage.stage).map((step) => {
                const st = states.get(step.id)
                const status: StepStatus = st?.status ?? 'nao_iniciado'
                const overdue = !!st?.deadline && st.deadline < today && status !== 'concluido'
                const group = st?.groupId ? groupNames.get(st.groupId) : undefined
                const pending = aiPendingByStep[step.id] ?? 0
                const here = people.filter((p) => p.stepId === step.id)
                return (
                  <Link
                    key={step.id} to={`/s/${sid}/step/${step.id}`} data-testid="step-card" data-step={step.id}
                    {...(overdue ? { 'data-overdue': '' } : {})}
                    className={`block rounded-md border bg-white p-3 shadow-sm hover:shadow ${overdue ? 'border-red-400' : 'border-slate-200'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{step.id} {step.title}</span>
                      <PresenceDots people={here} />
                    </div>
                    {group && <p className="mt-1 text-xs text-slate-600">{group}</p>}
                    {st?.deadline && (
                      <p className={`mt-1 text-xs ${overdue ? 'font-semibold text-red-600' : 'text-slate-500'}`}>
                        Prazo: {fmtDate(st.deadline)}
                      </p>
                    )}
                    <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs ${STATUS_STYLE[status]}`}>{STATUS_LABEL[status]}</span>
                    {pending > 0 && (
                      <p className="mt-1 text-xs text-violet-700">{pending} {pending === 1 ? 'item IA' : 'itens IA'} para revisar</p>
                    )}
                  </Link>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
