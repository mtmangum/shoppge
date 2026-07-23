'use client'

import { useState } from 'react'
import { StatsCards, type StatsFilterKey } from './StatsCards'
import { JobsTable } from './JobsTable'
import type { JobListItem } from '@/lib/types'

interface Stats {
  pending_count: number
  inprogress_count: number
  completed_count: number
  urgent_open_count: number
  avg_completion_days: number
}

export function OpenJobsView({ stats, jobs }: { stats: Stats; jobs: JobListItem[] }) {
  const [highlightFilter, setHighlightFilter] = useState<StatsFilterKey | null>(null)

  return (
    <>
      <StatsCards stats={stats} onHoverFilter={setHighlightFilter} />
      <JobsTable jobs={jobs} highlightFilter={highlightFilter} />
    </>
  )
}
