'use client'

import { useState } from 'react'
import { StatsCards, type StatsFilterKey } from './StatsCards'
import { JobsTable } from './JobsTable'
import type { JobListItem, JobStatus, JobPriority } from '@/lib/types'

interface Stats {
  pending_count: number
  inprogress_count: number
  completed_count: number
  urgent_open_count: number
  avg_completion_days: number
}

interface OpenJobsViewProps {
  stats: Stats
  jobs: JobListItem[]
  page: number
  totalPages: number
  search: string
  status: JobStatus | 'all'
  priority: JobPriority | 'all'
  sort: string
  dir: 'asc' | 'desc'
}

export function OpenJobsView({ stats, jobs, page, totalPages, search, status, priority, sort, dir }: OpenJobsViewProps) {
  const [highlightFilter, setHighlightFilter] = useState<StatsFilterKey | null>(null)

  return (
    <>
      <StatsCards stats={stats} onHoverFilter={setHighlightFilter} />
      <JobsTable
        jobs={jobs}
        highlightFilter={highlightFilter}
        page={page}
        totalPages={totalPages}
        search={search}
        status={status}
        priority={priority}
        sort={sort}
        dir={dir}
      />
    </>
  )
}
