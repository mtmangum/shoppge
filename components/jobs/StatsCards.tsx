'use client'

import { useState } from 'react'
import Link from 'next/link'
import clsx from 'clsx'

interface Stats {
  pending_count: number
  inprogress_count: number
  completed_count: number
  urgent_open_count: number
  avg_completion_days: number
}

export type StatsFilterKey = 'pending' | 'inprogress' | 'urgent'

const FILTER_HREF: Record<StatsFilterKey, string> = {
  pending: '/jobs?status=pending',
  inprogress: '/jobs?status=inprogress',
  urgent: '/jobs?priority=urgent',
}

export function StatsCards({
  stats,
  onHoverFilter,
}: {
  stats: Stats
  onHoverFilter?: (key: StatsFilterKey | null) => void
}) {
  const [hovered, setHovered] = useState<StatsFilterKey | null>(null)

  const cards: { label: string; value: string | number; color: string; ring: string; filterKey: StatsFilterKey | null }[] = [
    { label: 'Pending',         value: stats.pending_count,       color: 'text-yellow-600', ring: 'ring-yellow-400', filterKey: 'pending' },
    { label: 'In Progress',     value: stats.inprogress_count,    color: 'text-blue-600',   ring: 'ring-blue-400',   filterKey: 'inprogress' },
    { label: 'Urgent Open',     value: stats.urgent_open_count,   color: 'text-red-600',    ring: 'ring-red-400',    filterKey: 'urgent' },
    { label: 'Avg. Completion', value: `${stats.avg_completion_days ?? '—'} days`, color: 'text-green-600', ring: '', filterKey: null },
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
      {cards.map(card => {
        const cardClassName = clsx(
          'block bg-white rounded-lg border p-4 shadow-sm transition-shadow',
          card.filterKey && 'cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#BF5700]',
          hovered === card.filterKey && card.filterKey && ['ring-2', card.ring]
        )
        const content = (
          <>
            <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
            <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
          </>
        )

        if (!card.filterKey) {
          return <div key={card.label} className={cardClassName}>{content}</div>
        }

        return (
          <Link
            key={card.label}
            href={FILTER_HREF[card.filterKey]}
            onMouseEnter={() => handleEnter(card.filterKey)}
            onMouseLeave={handleLeave}
            className={cardClassName}
          >
            {content}
          </Link>
        )
      })}
    </div>
  )
}
