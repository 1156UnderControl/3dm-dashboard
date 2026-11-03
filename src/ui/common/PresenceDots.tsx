import type { PresenceEntry } from '../../data/presence'

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? '').join('') || '?'

export default function PresenceDots({ people }: { people: PresenceEntry[] }) {
  if (people.length === 0) return null
  return (
    <span className="flex -space-x-1" aria-label={`${people.length} online nesta etapa`}>
      {people.slice(0, 4).map((p, i) => (
        <span
          key={i} title={p.name}
          className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-white bg-emerald-600 text-[10px] font-semibold text-white"
        >{initials(p.name)}</span>
      ))}
      {people.length > 4 && <span className="pl-2 text-xs text-slate-500">+{people.length - 4}</span>}
    </span>
  )
}
