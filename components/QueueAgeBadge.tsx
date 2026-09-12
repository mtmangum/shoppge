import type { JobStatus } from '@/lib/types'

export function QueueAgeBadge({ days, status, showUnit = false }: { days: number; status?: JobStatus; showUnit?: boolean }) {
  const isOpen = status === undefined || status === 'pending' || status === 'inprogress'
  const color = !isOpen || days <= 3
    ? 'bg-gray-100 text-gray-700'
    : days <= 7
      ? 'bg-amber-100 text-amber-800'
      : 'bg-red-100 text-red-800'
  const label = `${days} ${days === 1 ? 'day' : 'days'}`

  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold tabular-nums ${color}`}
      aria-label={showUnit ? undefined : `${label} in queue`}
      title={isOpen ? 'Queue age: 0–3 days neutral, 4–7 amber, 8+ red. Due-date lateness is tracked separately.' : 'Time since entry. This job is no longer open.'}
    >
      {showUnit ? label : days}
    </span>
  )
}
