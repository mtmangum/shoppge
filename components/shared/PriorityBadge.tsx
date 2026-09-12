import { Pill } from '../ui/Pill'
import type { JobPriority } from '@/lib/types'

const config: Record<JobPriority, { label: string; className: string }> = {
  normal: { label: 'Normal', className: 'bg-gray-100 text-gray-700' },
  urgent: { label: 'Urgent', className: 'bg-red-100 text-red-700' },
}

export function PriorityBadge({ priority }: { priority: JobPriority }) {
  const { label, className } = config[priority] ?? config.normal
  return <Pill className={className}>{label}</Pill>
}
