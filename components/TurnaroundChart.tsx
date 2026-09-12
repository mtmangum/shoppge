'use client'

import { useState } from 'react'
import { format } from 'date-fns'

interface WeekPoint {
  weekStart: string
  avgDays: number | null
}

const DATA_COLOR = '#BF5700'
const AXIS_COLOR = 'var(--chart-axis)'
const GRID_COLOR = 'var(--chart-grid)'
const MUTED_TEXT = 'var(--chart-muted)'

function niceMax(max: number) {
  if (max <= 0) return 4
  const steps = [2, 4, 5, 10, 20, 25, 50, 100]
  for (const s of steps) {
    if (max <= s) return s
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
  return Math.ceil(max / magnitude) * magnitude
}

export function TurnaroundChart({ data }: { data: WeekPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null)

  const width = 680
  const height = 220
  const padL = 32
  const padR = 44
  const padT = 12
  const padB = 28
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  const known = data.filter(d => d.avgDays !== null) as { weekStart: string; avgDays: number }[]
  if (known.length === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Avg. Turnaround Time / Week</h4>
        <p className="text-sm text-gray-400 italic py-8 text-center">No completed jobs in the last 12 weeks.</p>
      </div>
    )
  }

  const max = niceMax(Math.max(...known.map(d => d.avgDays)))
  const bandW = plotW / (data.length - 1 || 1)
  const yFor = (v: number) => padT + plotH - (v / max) * plotH
  const xFor = (i: number) => padL + i * bandW
  const ticks = [0, max / 2, max].map(v => Math.round(v))

  const segments: { x1: number; y1: number; x2: number; y2: number }[] = []
  for (let i = 0; i < data.length - 1; i++) {
    if (data[i].avgDays !== null && data[i + 1].avgDays !== null) {
      segments.push({ x1: xFor(i), y1: yFor(data[i].avgDays!), x2: xFor(i + 1), y2: yFor(data[i + 1].avgDays!) })
    }
  }

  const lastKnownIdx = data.map(d => d.avgDays).lastIndexOf(known[known.length - 1].avgDays)

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-1">Avg. Turnaround Time / Week (days)</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Average turnaround time in days, per week, last 12 weeks">
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={yFor(t)} y2={yFor(t)} stroke={GRID_COLOR} strokeWidth={1} />
            <text x={padL - 6} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={MUTED_TEXT}>
              {t}
            </text>
          </g>
        ))}
        <line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke={AXIS_COLOR} strokeWidth={1} />

        {segments.map((s, i) => (
          <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke={DATA_COLOR} strokeWidth={2} strokeLinecap="round" />
        ))}

        {data.map((d, i) =>
          d.avgDays !== null ? (
            <circle
              key={d.weekStart}
              cx={xFor(i)}
              cy={yFor(d.avgDays)}
              r={4}
              fill={DATA_COLOR}
              stroke="var(--surface)"
              strokeWidth={2}
            />
          ) : null
        )}

        {/* end label */}
        <text x={xFor(lastKnownIdx) + 8} y={yFor(known[known.length - 1].avgDays) + 3} fontSize={10} fill="var(--fg-900)" fontWeight={600}>
          {known[known.length - 1].avgDays}d
        </text>

        {data.map((d, i) => {
          const showLabel = i === data.length - 1 || i % 2 === 1
          return (
            <g key={d.weekStart}>
              <rect
                x={xFor(i) - bandW / 2}
                y={padT}
                width={bandW}
                height={plotH}
                fill="transparent"
                onPointerMove={() => setHovered(i)}
                onPointerLeave={() => setHovered(null)}
                onFocus={() => setHovered(i)}
                onBlur={() => setHovered(null)}
                tabIndex={0}
              />
              {showLabel && (
                <text x={xFor(i)} y={height - 8} textAnchor="middle" fontSize={9} fill={MUTED_TEXT}>
                  {format(new Date(d.weekStart), 'M/d')}
                </text>
              )}
            </g>
          )
        })}

        {hovered !== null && (
          <g pointerEvents="none">
            <line x1={xFor(hovered)} x2={xFor(hovered)} y1={padT} y2={padT + plotH} stroke={AXIS_COLOR} strokeWidth={1} />
            {(() => {
              const d = data[hovered]
              const boxW = 148
              const boxH = 52
              const gapV = 12
              const gapH = 10
              const pointX = xFor(hovered)
              const pointY = d.avgDays !== null ? yFor(d.avgDays) : padT + plotH
              const halfPoint = 6
              let boxX: number
              let boxY: number
              const preferredY = pointY - boxH - gapV
              if (preferredY >= padT) {
                boxY = preferredY
                boxX = Math.min(Math.max(pointX - boxW / 2, padL), width - padR - boxW)
              } else {
                boxY = padT
                const spaceRight = width - padR - (pointX + halfPoint + gapH)
                const spaceLeft = pointX - halfPoint - gapH - padL
                boxX = spaceRight >= boxW || spaceRight >= spaceLeft
                  ? Math.min(pointX + halfPoint + gapH, width - padR - boxW)
                  : Math.max(pointX - halfPoint - gapH - boxW, padL)
              }
              return (
                <g transform={`translate(${boxX}, ${boxY})`} style={{ transition: 'transform 150ms ease-out' }}>
                  <rect width={boxW} height={boxH} rx={6} fill="var(--tooltip-bg)" opacity={0.96} />
                  <text x={12} y={22} fontSize={14} fill="var(--tooltip-fg)" fontWeight={600}>
                    {d.avgDays !== null ? `${d.avgDays} days avg` : 'No completions'}
                  </text>
                  <text x={12} y={39} fontSize={13} fill="var(--tooltip-fg-muted)">
                    Week of {format(new Date(d.weekStart), 'MMM d')}
                  </text>
                </g>
              )
            })()}
          </g>
        )}
      </svg>
    </div>
  )
}
