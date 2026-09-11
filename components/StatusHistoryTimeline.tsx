import { format } from 'date-fns'
import { StatusBadge } from './StatusBadge'
import type { JobStatus } from '@/lib/types'

interface HistoryEntry {
  id: number
  fromStatus: JobStatus | null
  toStatus: JobStatus
  note?: string | null
  changedAt: string
  changedByName?: string
}

export function StatusHistoryTimeline({ history }: { history: HistoryEntry[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-gray-500 italic">No status changes yet.</p>
  }

  return (
    <ol className="space-y-4">
      {history.map(entry => (
        <li key={entry.id} className="text-sm border-l-2 border-gray-200 pl-3">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge status={entry.toStatus} />
            <span className="text-xs text-gray-500">
              {format(new Date(entry.changedAt), 'MMM d, yyyy h:mm a')}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            {entry.changedByName ?? 'System'}
          </p>
          {entry.note && <p className="text-gray-700 mt-1">{entry.note}</p>}
        </li>
      ))}
    </ol>
  )
}
