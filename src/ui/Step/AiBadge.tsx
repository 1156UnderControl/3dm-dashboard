export default function AiBadge({ citation }: { citation?: string }) {
  return (
    <span title={citation} className="rounded bg-purple-100 px-1.5 py-0.5 text-xs font-semibold text-purple-700">IA</span>
  )
}
