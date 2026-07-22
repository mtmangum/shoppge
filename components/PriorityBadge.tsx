import type { JobPriority } from '@/lib/types'

const config: Record<JobPriority, { label: string; className: string }> = {
  normal: { label: 'Normal', className: 'bg-gray-100 text-gray-700' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700' },
}

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  const { label, className } = config[priority] ?? config.normal
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}>
      {label}
    </span>
  )
}
