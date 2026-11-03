// Stub: filled in by Task 8.
import { useParams } from 'react-router'

export default function StepPage() {
  const { sid, stepId } = useParams()
  return <p className="text-slate-500">Etapa {stepId} da temporada {sid} (em breve).</p>
}
