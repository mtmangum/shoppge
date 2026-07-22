interface Stats {
  pending_count: number
  inprogress_count: number
  completed_count: number
  urgent_open_count: number
  avg_completion_days: number
}

export function StatsCards({ stats }: { stats: Stats }) {
  const cards = [
    { label: 'Pending',         value: stats.pending_count,       color: 'text-yellow-600' },
    { label: 'In Progress',     value: stats.inprogress_count,    color: 'text-blue-600' },
    { label: 'Urgent Open',     value: stats.urgent_open_count,   color: 'text-red-600' },
    { label: 'Avg. Completion', value: `${stats.avg_completion_days ?? '—'} days`, color: 'text-green-600' },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(card => (
        <div key={card.label} className="bg-white rounded-lg border p-4 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">{card.label}</p>
          <p className={`text-3xl font-bold mt-1 ${card.color}`}>{card.value}</p>
        </div>
      ))}
    </div>
  )
}
