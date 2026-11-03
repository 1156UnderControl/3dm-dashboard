import { cadBudget } from '../../threedm/budget'
import ItemTable, { type ItemTableProps } from './ItemTable'

const DEFAULT_MAX = 52.16

export default function CadFlow(props: Omit<ItemTableProps, 'kindDef'>) {
  const { stepDef, items } = props
  const cadKind = stepDef.kinds.find((k) => k.kind === 'cad')!
  const budgetKind = stepDef.kinds.find((k) => k.kind === 'budget')!
  const active = items.filter((i) => i.state !== 'rejected')
  const maxRaw = active.find((i) => i.kind === 'budget')?.data.peso_max_kg
  const max = typeof maxRaw === 'number' && !Number.isNaN(maxRaw) ? maxRaw : DEFAULT_MAX
  const rows = active.filter((i) => i.kind === 'cad').map((i) => ({ peso_kg: Number(i.data.peso_kg) || 0 }))
  const { used, remaining } = cadBudget(rows, max)
  const negative = remaining < 0
  return (
    <div>
      <ItemTable {...props} kindDef={cadKind} />
      <div className="mb-3 flex gap-4 text-sm">
        <span>Usado: {used} kg</span>
        <span>Máximo: {max} kg</span>
        <strong data-negative={negative ? 'true' : undefined} className={negative ? 'text-red-600' : 'text-green-700'}>
          Sobra: {remaining} kg
        </strong>
      </div>
      <ItemTable {...props} kindDef={budgetKind} />
    </div>
  )
}
