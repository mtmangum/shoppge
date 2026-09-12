'use client'

import { useState } from 'react'
import { format } from 'date-fns'

interface WeekPoint {
  weekStart: string
  count: number
}

const DATA_COLOR = '#BF5700'
const AXIS_COLOR = 'var(--chart-axis)'
const GRID_COLOR = 'var(--chart-grid)'
const MUTED_TEXT = 'var(--chart-muted)'

function niceMax(max: number) {
  if (max <= 0) return 4
  const steps = [1, 2, 4, 5, 10, 20, 25, 50, 100]
  for (const s of steps) {
    if (max <= s) return s
  }
  const magnitude = Math.pow(10, Math.floor(Math.log10(max)))
  return Math.ceil(max / magnitude) * magnitude
}

export function ThroughputChart({ data }: { data: WeekPoint[] }) {
  const [hovered, setHovered] = useState<number | null>(null)

  const width = 680
  const height = 220
  const padL = 32
  const padR = 12
  const padT = 12
  const padB = 28
  const plotW = width - padL - padR
  const plotH = height - padT - padB

  const max = niceMax(Math.max(...data.map(d => d.count)))
  const bandW = plotW / data.length
  const barW = Math.min(24, bandW * 0.5)

  const yFor = (v: number) => padT + plotH - (v / max) * plotH
  const ticks = [0, max / 2, max].map(v => Math.round(v))

  const totalCompleted = data.reduce((sum, d) => sum + d.count, 0)
  const peakIdx = data.reduce((best, d, i) => (d.count > data[best].count ? i : best), 0)

  if (totalCompleted === 0) {
    return (
      <div>
        <h4 className="text-sm font-semibold text-gray-700 mb-1">Jobs Completed / Week</h4>
        <p className="text-sm text-gray-400 italic py-8 text-center">No completed jobs in the last 12 weeks.</p>
      </div>
    )
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-gray-700 mb-1">Jobs Completed / Week</h4>
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" role="img" aria-label="Jobs completed per week, last 12 weeks">
        {ticks.map(t => (
          <g key={t}>
            <line x1={padL} x2={width - padR} y1={yFor(t)} y2={yFor(t)} stroke={GRID_COLOR} strokeWidth={1} />
            <text x={padL - 6} y={yFor(t)} textAnchor="end" dominantBaseline="middle" fontSize={10} fill={MUTED_TEXT}>
              {t}
            </text>
          </g>
        ))}
        <line x1={padL} x2={width - padR} y1={padT + plotH} y2={padT + plotH} stroke={AXIS_COLOR} strokeWidth={1} />

        {data.map((d, i) => {
          const x = padL + i * bandW + (bandW - barW) / 2
          const barH = (d.count / max) * plotH
          const y = padT + plotH - barH
          const isHovered = hovered === i
          const showLabel = i === data.length - 1 || i % 2 === 1
          const isPeak = i === peakIdx && d.count > 0
          return (
            <g key={d.weekStart}>
              <rect
                x={x}
                y={barH > 0 ? y : padT + plotH - 1}
                width={barW}
                height={Math.max(barH, barH > 0 ? 1 : 0)}
                rx={4}
                fill={DATA_COLOR}
                opacity={isHovered ? 0.85 : 1}
              />
              {isPeak && (
                <text x={x + barW / 2} y={y - 6} textAnchor="middle" fontSize={10} fontWeight={600} fill="var(--fg-900)">
                  {d.count}
                </text>
              )}
              <rect
                x={padL + i * bandW}
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
                <text x={padL + i * bandW + bandW / 2} y={height - 8} textAnchor="middle" fontSize={9} fill={MUTED_TEXT}>
                  {format(new Date(d.weekStart), 'M/d')}
                </text>
              )}
            </g>
          )
        })}

        {hovered !== null && (
          <g pointerEvents="none">
            {(() => {
              const d = data[hovered]
              const cx = padL + hovered * bandW + bandW / 2
              const boxW = 128
              const boxH = 52
              const gapV = 8
              const gapH = 10
              const barH = (d.count / max) * plotH
              const barTopY = padT + plotH - barH
              const halfBar = barW / 2
              let boxX: number
              let boxY: number
              const preferredY = barTopY - boxH - gapV
              if (preferredY >= padT) {
                boxY = preferredY
                boxX = Math.min(Math.max(cx - boxW / 2, padL), width - padR - boxW)
              } else {
                boxY = padT
                const spaceRight = width - padR - (cx + halfBar + gapH)
                const spaceLeft = cx - halfBar - gapH - padL
                boxX = spaceRight >= boxW || spaceRight >= spaceLeft
                  ? Math.min(cx + halfBar + gapH, width - padR - boxW)
                  : Math.max(cx - halfBar - gapH - boxW, padL)
              }
              return (
                <g transform={`translate(${boxX}, ${boxY})`} style={{ transition: 'transform 150ms ease-out' }}>
                  <rect width={boxW} height={boxH} rx={6} fill="var(--tooltip-bg)" opacity={0.96} />
                  <text x={12} y={22} fontSize={14} fill="var(--tooltip-fg)" fontWeight={600}>
                    {d.count} completed
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
