import { useState } from 'react'
import { db } from '../../firebase'
import { createItem, updateItem } from '../../data/items'
import { useItems } from '../../data/hooks'
import { scoreMatrix } from '../../threedm/matrix'
import type { Item } from '../../threedm/types'
import ItemTable, { type ItemTableProps } from './ItemTable'

const DEFAULT_ATTRS: [string, number][] = [['Simplicity', 0.2], ['Versionabilidade', 0.15], ['CoG', 0.1], ['Knowledge Base', 0.2]]
const pct = (n: number) => `${Math.round(n * 100)}%`
type Props = Omit<ItemTableProps, 'kindDef'>

function ScoreInput({ label, value, disabled, onSave }: { label: string; value: number | undefined; disabled: boolean; onSave: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input type="number" min={0} max={5} step="0.5" aria-label={label} disabled={disabled} className="w-16 rounded border px-1 py-0.5 text-sm"
      value={draft ?? (value === undefined ? '' : String(value))}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => {
        if (draft === null) return
        const n = Number(draft)
        const was = draft
        setDraft(null)
        if (was.trim() === '' || Number.isNaN(n)) return
        const v = Math.min(5, Math.max(0, n))
        if (v !== value) onSave(v)
      }} />
  )
}

export default function DecisionMatrix(props: Props) {
  const { sid, stepDef, items, readOnly, by } = props
  const { data: prioItems } = useItems(sid, '2')
  const { data: archItems } = useItems(sid, '4.1')
  const [chosen, setChosen] = useState<string | null>(null)
  const [just, setJust] = useState<string | null>(null)

  const active = (xs: Item[], kind: string) => xs.filter((i) => i.kind === kind && i.state !== 'rejected')
  const priorities = active(prioItems, 'priority').filter((p) => p.data.bucket === 'Precisamos' || p.data.bucket === 'Queremos')
  const archetypes = active(archItems, 'archetype')
  const attrItems = active(items, 'attribute')
  const attributes = attrItems.filter((a) => String(a.data.atributo ?? '').trim()).map((a) => ({ atributo: String(a.data.atributo), peso: Number(a.data.peso) || 0 }))
  const coverageItems = active(items, 'coverage')
  const scoreItems = active(items, 'score')
  const choice = active(items, 'choice')[0]
  const pname = (id: string) => String(priorities.find((p) => p.id === id)?.data.item ?? id)
  const aname = (a: Item) => String(a.data.nome ?? '') || a.id

  const result = scoreMatrix({
    archetypes: archetypes.map((a) => a.id),
    priorities: priorities.map((p) => ({ id: p.id, bucket: p.data.bucket as 'Precisamos' | 'Queremos' })),
    coverage: coverageItems.map((c) => ({ archetypeId: String(c.data.archetypeId), priorityId: String(c.data.priorityId), atende: c.data.atende === true })),
    attributes,
    scores: scoreItems.map((s) => ({ archetypeId: String(s.data.archetypeId), attribute: String(s.data.attribute), nota: Number(s.data.nota) || 0 })),
  })

  const toggle = (archetypeId: string, priorityId: string, atende: boolean) => {
    const ex = coverageItems.find((c) => c.data.archetypeId === archetypeId && c.data.priorityId === priorityId)
    if (ex) void updateItem(db, sid, by, ex, { atende })
    else void createItem(db, sid, by, { stepId: stepDef.id, kind: 'coverage', data: { archetypeId, priorityId, atende } })
  }
  const setScore = (archetypeId: string, attribute: string, nota: number) => {
    const ex = scoreItems.find((c) => c.data.archetypeId === archetypeId && c.data.attribute === attribute)
    if (ex) void updateItem(db, sid, by, ex, { nota })
    else void createItem(db, sid, by, { stepId: stepDef.id, kind: 'score', data: { archetypeId, attribute, nota } })
  }
  const choiceArch = chosen ?? String(choice?.data.archetypeId ?? '')
  const choiceJust = just ?? String(choice?.data.justificativa ?? '')
  const escolher = async () => {
    const data = { archetypeId: choiceArch, justificativa: choiceJust.trim() }
    if (choice) await updateItem(db, sid, by, choice, data)
    else await createItem(db, sid, by, { stepId: stepDef.id, kind: 'choice', data })
    setChosen(null); setJust(null)
  }
  const seedDefaults = async () => {
    for (const [atributo, peso] of DEFAULT_ATTRS) await createItem(db, sid, by, { stepId: stepDef.id, kind: 'attribute', data: { atributo, peso } })
  }

  const th = 'px-2 py-1 text-left text-xs font-medium'
  return (
    <div>
      <section className="mb-6">
        <h3 className="mb-2 font-semibold">Cobertura das prioridades</h3>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Prioridade</th>{archetypes.map((a) => <th key={a.id} className={th}>{aname(a)}</th>)}</tr></thead>
            <tbody className="divide-y">
              {priorities.map((p) => (
                <tr key={p.id}>
                  <td className="px-2 py-1">{pname(p.id)} <span className="text-xs text-slate-500">({String(p.data.bucket)})</span></td>
                  {archetypes.map((a) => (
                    <td key={a.id} className="px-2 py-1">
                      <input type="checkbox" aria-label={`${pname(p.id)} / ${aname(a)}`} disabled={readOnly}
                        checked={coverageItems.some((c) => c.data.archetypeId === a.id && c.data.priorityId === p.id && c.data.atende === true)}
                        onChange={(e) => toggle(a.id, p.id, e.target.checked)} />
                    </td>
                  ))}
                </tr>
              ))}
              {(priorities.length === 0 || archetypes.length === 0) && (
                <tr><td className="px-2 py-3 text-slate-500" colSpan={archetypes.length + 1}>Defina prioridades (etapa 2) e arquétipos (etapa 4.1) para preencher a matriz.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <ItemTable {...props} kindDef={stepDef.kinds.find((k) => k.kind === 'attribute')!} />
      {!readOnly && attrItems.length === 0 && (
        <button className="mb-4 rounded border px-3 py-1 text-sm" onClick={() => void seedDefaults()}>Usar atributos padrão</button>
      )}

      <section className="mb-6">
        <h3 className="mb-2 font-semibold">Notas (0 a 5)</h3>
        <div className="overflow-x-auto rounded border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr><th className={th}>Atributo (peso)</th>{archetypes.map((a) => <th key={a.id} className={th}>{aname(a)}</th>)}</tr></thead>
            <tbody className="divide-y">
              {attributes.map((at) => (
                <tr key={at.atributo}>
                  <td className="px-2 py-1">{at.atributo} ({at.peso})</td>
                  {archetypes.map((a) => (
                    <td key={a.id} className="px-2 py-1">
                      <ScoreInput label={`${at.atributo} / ${aname(a)}`} disabled={readOnly}
                        value={(scoreItems.find((s) => s.data.archetypeId === a.id && s.data.attribute === at.atributo)?.data.nota as number | undefined)}
                        onSave={(n) => setScore(a.id, at.atributo, n)} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-slate-50 text-sm">
              <tr><th className={th}>Cobertura</th>{archetypes.map((a) => <td key={a.id} data-testid={`coverage-${a.id}`} className="px-2 py-1">{pct(result[a.id]?.coveragePct ?? 0)}</td>)}</tr>
              <tr><th className={th}>Ponderado</th>{archetypes.map((a) => <td key={a.id} data-testid={`weighted-${a.id}`} className="px-2 py-1">{pct(result[a.id]?.weighted ?? 0)}</td>)}</tr>
              <tr><th className={th}>Final</th>{archetypes.map((a) => <td key={a.id} data-testid={`final-${a.id}`} className="px-2 py-1 font-semibold">{(result[a.id]?.finalPct ?? 0)}%</td>)}</tr>
            </tfoot>
          </table>
        </div>
        {archetypes.map((a) => {
          const missing = result[a.id]?.missingNeeds ?? []
          return missing.length > 0 ? (
            <p key={a.id} role="alert" className="mt-2 text-sm text-red-600">
              {aname(a)}: Precisamos não atendidas: {missing.map(pname).join(', ')}
            </p>
          ) : null
        })}
      </section>

      <section className="mb-6">
        <h3 className="mb-2 font-semibold">Escolha</h3>
        <div className="flex flex-col gap-2">
          <select aria-label="Arquétipo escolhido" disabled={readOnly} value={choiceArch} className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setChosen(e.target.value)}>
            <option value="">—</option>
            {archetypes.map((a) => <option key={a.id} value={a.id}>{aname(a)}</option>)}
          </select>
          <textarea aria-label="Justificativa" disabled={readOnly} rows={3} value={choiceJust} className="rounded border px-2 py-1 text-sm"
            onChange={(e) => setJust(e.target.value)} />
          {!readOnly && (
            <button className="self-start rounded border px-3 py-1 text-sm disabled:opacity-50"
              disabled={!choiceArch || !choiceJust.trim()} onClick={() => void escolher()}>Escolher</button>
          )}
        </div>
      </section>
    </div>
  )
}
