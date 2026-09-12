'use client'

import { useRouter } from 'next/navigation'
import type { ReactNode } from 'react'

// The parent page is a server component, so the click-to-navigate behavior
// (a convenience on top of the row's own "#id" link) needs its own small
// client boundary.
export function ActivityRow({ jobId, className, children }: { jobId: number; className?: string; children: ReactNode }) {
  const router = useRouter()
  return (
    <tr onClick={() => router.push(`/jobs/${jobId}`)} className={`cursor-pointer transition-colors hover:bg-gray-100 ${className ?? ''}`}>
      {children}
    </tr>
  )
}
