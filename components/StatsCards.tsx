'use client'

import { useState } from 'react'
import clsx from 'clsx'

interface Stats {
  pending_count: number
  inprogress_count: number
  completed_count: number
  urgent_open_count: number
  avg_completion_days: number
}

export type StatsFilterKey = 'pending' | 'inprogress' | 'urgent'

export function StatsCards({
  stats,
  onHoverFilter,
}: {
  stats: Stats
  onHoverFilter?: (key: StatsFilterKey | null) => void
}) {
  const [hovered, setHovered] = useState<StatsFilterKey | null>(null)

  const cards: { label: string; value: string | number; color: string; filterKey: StatsFilterKey | null }[] = [
    { label: 'Pending',         value: stats.pending_count,       color: 'text-yellow-600', filterKey: 'pending' },
    { label: 'In Progress',     value: stats.inprogress_count,    color: 'text-blue-600',   filterKey: 'inprogress' },
    { label: 'Urgent Open',     value: stats.urgent_open_count,   color: 'text-red-600',    filterKey: 'urgent' },
    { label: 'Avg. Completion', value: `${stats.avg_completion_days ?? '—'} days`, color: 'text-green-600', filterKey: null },
  ]

  function handleEnter(key: StatsFilterKey | null) {
    setHovered(key)
    onHoverFilter?.(key)
  }

  function handleLeave() {
    setHovered(null)
    onHoverFilter?.(null)
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(card => (
        <div
          key={card.label}
          onMouseEnter={() => handleEnter(card.filterKey)}
          onMouseLeave={handleLeave}
          className={clsx(
            'bg-white rounded-lg border p-4 shadow-sm transition-shadow',
            card.filterKey && 'cursor-pointer',
            hovered === card.filterKey && card.filterKey && 'ring-2 ring-[#BF5700]'
          )}
        >
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
          <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}
