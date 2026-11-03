import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router'
import { getDocs, updateDoc } from 'firebase/firestore'
import { db } from '../../firebase'
import { useCurrentMember } from '../../auth/context'
import { useSeason } from '../../data/hooks'
import { useAppConfig } from '../../data/config'
import { useTeamKeys } from '../../ai/keys'
import { AiError, aiErrorText, getProvider } from '../../ai/provider'
import { extractSeason } from '../../ai/extract'
import { pdfCache } from '../../ai/pdfCache'
import { countByStep, dedupeAiItems, mergeExtraction } from '../../ai/toItems'
import type { SeasonExtraction } from '../../ai/seasonSchema'
import { createItems } from '../../data/items'
import { itemsCol, seasonDoc } from '../../data/paths'
import { STEPS } from '../../threedm/template'
import type { Item, NewItem } from '../../threedm/types'

type Phase = 'idle' | 'reading' | 'preview' | 'writing' | 'done'

function progressText(done: number, total: number): string {
  const parts = Math.max(1, (total - 1) / 3)
  if (done >= total - 1 && total > 1) return 'Gerando rascunhos de prioridades, protótipos e arquétipos…'
  return `Lendo parte ${Math.min(parts, Math.floor(done / 3) + 1)} de ${parts}…`
}

export default function SeasonSetup() {
  const { sid } = useParams()
  const { data: season, loading } = useSeason(sid)
  const { user } = useCurrentMember()
  const config = useAppConfig()
  const team = useTeamKeys()
  const [pdf, setPdf] = useState<Uint8Array | null>(null)
  const [cached, setCached] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState('')
  const [error, setError] = useState('')
  const [model, setModel] = useState<SeasonExtraction | null>(null)
  const [newItems, setNewItems] = useState<NewItem[]>([])
  const [written, setWritten] = useState(0)

  useEffect(() => {
    if (!sid) return
    let live = true
    pdfCache.get(sid).then((b) => { if (live && b) { setPdf(b); setCached(true) } }).catch(() => {})
    return () => { live = false }
  }, [sid])

  if (loading) return <p className="text-slate-500">Carregando…</p>
  if (!sid || !season) return <p>Temporada não encontrada.</p>
  if (season.status !== 'active') return <p>Esta temporada arquivada é somente leitura.</p>

  async function onPick(file: File | undefined) {
    if (!file || !sid) return
    const bytes = new Uint8Array(await file.arrayBuffer())
    setPdf(bytes); setCached(false); setPhase('idle'); setError(''); setModel(null); setNewItems([])
    try { await pdfCache.put(sid, bytes) } catch { /* cache is a convenience only */ }
  }

  async function read() {
    if (!pdf || !sid) return
    setError(''); setPhase('reading'); setProgress('Preparando o manual…')
    try {
      const provider = getProvider(config, team)
      const existing = await loadExisting(sid)
      const existingKeys = existing.map((i) => i.aiKey).filter((k): k is string => !!k)
      const ex = await extractSeason(provider, pdf, (d, t) => setProgress(progressText(d, t)), existingKeys)
      setModel(ex)
      setNewItems(mergeExtraction(ex, existing))
      setPhase('preview')
    } catch (e) {
      setPhase('idle')
      setError(e instanceof AiError ? aiErrorText(e) : 'Não foi possível ler o manual.')
    }
  }

  async function loadExisting(sid: string): Promise<Item[]> {
    return (await getDocs(itemsCol(db, sid))).docs.map((d) => ({ id: d.id, ...d.data() }) as Item)
  }

  async function add() {
    if (!model || !sid || !user?.email) return
    setPhase('writing'); setError('')
    try {
      // Model first (idempotent); then re-dedupe against the live items so a retry after a partial
      // failure, or another admin's writes since the preview, never duplicate items.
      // JSON round-trip drops undefined fields, which Firestore rejects.
      await updateDoc(seasonDoc(db, sid), { model: JSON.parse(JSON.stringify(model)) })
      const missing = dedupeAiItems(newItems, await loadExisting(sid))
      const n = await createItems(db, sid, user.email, missing)
      setWritten(n); setPhase('done')
    } catch {
      setPhase('preview')
      setError('Falha ao salvar no 3DM. Verifique a conexão e tente novamente.')
    }
  }

  const counts = countByStep(newItems)
  const busy = phase === 'reading' || phase === 'writing'

  return (
    <section className="max-w-2xl space-y-4">
      <h2 className="text-xl font-semibold">Configurar temporada pelo manual · {season.name}</h2>
      <p className="text-sm text-slate-600">
        A IA lê o manual do jogo e cria itens sugeridos (marcados como IA) nas etapas do 3DM. Itens já existentes,
        editados ou rejeitados nunca são sobrescritos. O PDF fica salvo apenas neste navegador.
      </p>
      <label className="block text-sm font-medium">Manual do jogo (PDF)
        <input type="file" accept="application/pdf" disabled={busy} className="mt-1 block"
          onChange={(e) => void onPick(e.target.files?.[0])} />
      </label>
      {cached && <p className="text-sm text-slate-600">Usando o manual salvo neste navegador.</p>}
      <button className="rounded bg-blue-600 px-3 py-1 text-white disabled:opacity-50" disabled={!pdf || busy} onClick={() => void read()}>
        Ler manual com IA
      </button>
      {phase === 'reading' && <p role="status" className="text-sm">{progress}</p>}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {(phase === 'preview' || phase === 'writing') && model && (
        <div className="space-y-2 rounded border bg-white p-3">
          <p className="font-medium">{model.gameName || 'Jogo'}: {newItems.length} itens novos</p>
          <ul className="text-sm">
            {STEPS.filter((s) => counts[s.id]).map((s) => (
              <li key={s.id} className="flex justify-between gap-2">
                <span>{s.id} · {s.title}</span><span data-testid={`count-${s.id}`}>{counts[s.id]}</span>
              </li>
            ))}
          </ul>
          <button className="rounded bg-green-700 px-3 py-1 text-white disabled:opacity-50" disabled={busy} onClick={() => void add()}>
            Adicionar ao 3DM
          </button>
        </div>
      )}
      {phase === 'done' && (
        <p role="status" className="text-sm"><span>{`${written} itens adicionados ao 3DM.`}</span> <Link className="text-blue-600 underline" to={`/s/${sid}`}>Ver pipeline</Link></p>
      )}
    </section>
  )
}
