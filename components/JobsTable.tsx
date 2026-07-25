'use client'

import { useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from '@tanstack/react-table'
import { format } from 'date-fns'
import { StatusBadge } from './StatusBadge'
import { PriorityBadge } from './PriorityBadge'
import type { JobListItem, JobStatus, JobPriority } from '@/lib/types'
import Link from 'next/link'
import { ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import clsx from 'clsx'
import type { StatsFilterKey } from './StatsCards'

declare module '@tanstack/react-table' {
  interface ColumnMeta<TData, TValue> {
    hideOnMobile?: boolean
    sortKey?: string
  }
}

interface JobsTableProps {
  jobs: JobListItem[]
  highlightFilter?: StatsFilterKey | null
  page: number
  totalPages: number
  search: string
  status: JobStatus | 'all'
  priority: JobPriority | 'all'
  sort: string
  dir: 'asc' | 'desc'
}

const HIGHLIGHT_STYLES: Record<StatsFilterKey, { bg: string; border: string }> = {
  pending:    { bg: 'bg-yellow-50', border: 'border-yellow-400' },
  inprogress: { bg: 'bg-blue-50',   border: 'border-blue-400' },
  urgent:     { bg: 'bg-red-50',    border: 'border-red-400' },
}

function matchesHighlight(job: JobListItem, highlightFilter?: StatsFilterKey | null) {
  if (!highlightFilter) return false
  if (highlightFilter === 'urgent') return job.priority === 'urgent'
  return job.status === highlightFilter
}

export function JobsTable({ jobs, highlightFilter, page, totalPages, search, status, priority, sort, dir }: JobsTableProps) {
  function buildHref(overrides: Record<string, string>) {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (status !== 'all') params.set('status', status)
    if (priority !== 'all') params.set('priority', priority)
    params.set('sort', sort)
    params.set('dir', dir)
    params.set('page', String(page))
    for (const [key, value] of Object.entries(overrides)) {
      if (value) params.set(key, value)
      else params.delete(key)
    }
    return `/jobs?${params.toString()}`
  }

  function sortHref(sortKey: string) {
    const nextDir = sort === sortKey && dir === 'asc' ? 'desc' : 'asc'
    return buildHref({ sort: sortKey, dir: nextDir, page: '1' })
  }

  const columns = useMemo<ColumnDef<JobListItem>[]>(() => [
    {
      accessorKey: 'id',
      header: 'Job #',
      size: 80,
      meta: { sortKey: 'id' },
      cell: ({ row }) => (
        <Link href={`/jobs/${row.original.id}`} className="font-mono font-semibold text-[#BF5700] hover:underline">
          {row.original.id}
        </Link>
      ),
    },
    {
      accessorKey: 'entryDate',
      header: 'Entry Date',
      cell: ({ getValue }) => format(new Date(getValue() as string), 'MMM d, yyyy'),
      meta: { hideOnMobile: true, sortKey: 'entryDate' },
    },
    {
      accessorKey: 'dateRequired',
      header: 'Date Required',
      cell: ({ getValue }) => format(new Date(getValue() as string), 'MMM d, yyyy'),
      meta: { hideOnMobile: true, sortKey: 'dateRequired' },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => (
        <span className="line-clamp-2 max-w-xs">{getValue() as string}</span>
      ),
      meta: { sortKey: 'description' },
    },
    {
      accessorKey: 'requestorName',
      header: 'Requestor',
      meta: { hideOnMobile: true, sortKey: 'requestorName' },
    },
    {
      accessorKey: 'machinistName',
      header: 'Machinist',
      cell: ({ getValue }) => getValue() as string || <span className="text-gray-400 italic">unassigned</span>,
      meta: { hideOnMobile: true, sortKey: 'machinistName' },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as JobStatus} />,
      meta: { sortKey: 'status' },
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ getValue }) => <PriorityBadge priority={getValue() as JobPriority} />,
      meta: { sortKey: 'priority' },
    },
    {
      accessorKey: 'daysElapsed',
      header: 'Days in Queue',
      cell: ({ getValue }) => {
        const days = getValue() as number
        return (
          <span className={days > 14 ? 'text-red-600 font-semibold' : ''}>
            {days}
          </span>
        )
      },
    },
  ], [])

  const table = useReactTable({
    data: jobs,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="space-y-4">
      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700 text-white">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => {
                  const sortKey = header.column.columnDef.meta?.sortKey
                  return (
                    <th
                      key={header.id}
                      className={clsx(
                        'px-4 py-3 text-left font-medium select-none whitespace-nowrap',
                        header.column.columnDef.meta?.hideOnMobile && 'hidden md:table-cell'
                      )}
                    >
                      {sortKey ? (
                        <Link href={sortHref(sortKey)} className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sort === sortKey
                            ? (dir === 'asc' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />)
                            : <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                        </Link>
                      ) : (
                        <div className="flex items-center gap-1">
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </div>
                      )}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
            {table.getRowModel().rows.length === 0 && (
              <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">No jobs match these filters.</td></tr>
            )}
            {table.getRowModel().rows.map((row, i) => {
              const highlighted = matchesHighlight(row.original, highlightFilter)
              const style = highlighted && highlightFilter ? HIGHLIGHT_STYLES[highlightFilter] : null
              return (
                <tr
                  key={row.id}
                  className={clsx(
                    'transition-colors',
                    style ? style.bg : i % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                  )}
                >
                  {row.getVisibleCells().map((cell, cellIdx) => (
                    <td
                      key={cell.id}
                      className={clsx(
                        'px-4 py-3',
                        cellIdx === 0 && ['border-l-4', style ? style.border : 'border-transparent'],
                        cell.column.columnDef.meta?.hideOnMobile && 'hidden md:table-cell'
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Page {page} of {totalPages}</span>
        <div className="flex gap-2">
          <Link
            href={buildHref({ page: String(page - 1) })}
            className={clsx('px-3 py-1 border rounded', page <= 1 ? 'opacity-40 pointer-events-none' : 'hover:bg-gray-50')}
          >
            Previous
          </Link>
          <Link
            href={buildHref({ page: String(page + 1) })}
            className={clsx('px-3 py-1 border rounded', page >= totalPages ? 'opacity-40 pointer-events-none' : 'hover:bg-gray-50')}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  )
}
