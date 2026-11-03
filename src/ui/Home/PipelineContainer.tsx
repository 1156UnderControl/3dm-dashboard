import { useEffect } from 'react'
import { useAiPendingCounts, useGroups, useSteps } from '../../data/hooks'
import { setPresence, usePresence } from '../../data/presence'
import { STAGES, STEPS } from '../../threedm/template'
import { Pipeline } from './Pipeline'

const todayStr = () => {
  const d = new Date()
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function PipelineContainer({ sid }: { sid: string }) {
  const { data: stepStates } = useSteps(sid)
  const { data: groups } = useGroups(sid)
  const aiPendingByStep = useAiPendingCounts(sid)
  const presence = usePresence(sid)
  useEffect(() => { void setPresence(sid, {}).catch(() => {}) }, [sid])
  return (
    <Pipeline
      sid={sid} stages={STAGES} steps={STEPS} stepStates={stepStates} groups={groups}
      aiPendingByStep={aiPendingByStep} presence={presence} today={todayStr()}
    />
  )
}
