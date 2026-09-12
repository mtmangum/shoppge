import type { ReactNode, HTMLAttributes } from 'react'

interface PillProps extends HTMLAttributes<HTMLSpanElement> {
  className: string
  nowrap?: boolean
  bold?: boolean
  children: ReactNode
}

/** Shared rounded-pill shell for status/priority/queue-age badges. */
export function Pill({ className, nowrap = false, bold = false, children, ...rest }: PillProps) {
  return (
    <span
      className={[
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs',
        bold ? 'font-semibold tabular-nums' : 'font-medium',
        nowrap ? 'whitespace-nowrap' : '',
        className,
      ].filter(Boolean).join(' ')}
      {...rest}
    >
      {children}
    </span>
  )
}
