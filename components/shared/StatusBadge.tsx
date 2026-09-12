import type { JobStatus } from '@/lib/types'

const config: Record<JobStatus, { label: string; className: string }> = {
  pending:    { label: 'Pending',     className: 'bg-yellow-100 text-yellow-800' },
  inprogress: { label: 'In Progress', className: 'bg-blue-100 text-blue-800' },
  completed:  { label: 'Completed',   className: 'bg-green-100 text-green-800' },
  cancelled:  { label: 'Cancelled',   className: 'bg-gray-100 text-gray-600' },
}

export function StatusBadge({ status }: { status: JobStatus }) {
  const { label, className } = config[status] ?? config.pending
  return (
    <span className={`inline-flex items-center whitespace-nowrap px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
