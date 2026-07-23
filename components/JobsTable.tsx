'use client'

import { useState, useMemo } from 'react'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
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
  }
}

interface JobsTableProps {
  jobs: JobListItem[]
  highlightFilter?: StatsFilterKey | null
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

export function JobsTable({ jobs, highlightFilter }: JobsTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [globalFilter, setGlobalFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState<JobStatus | 'all'>('all')
  const [priorityFilter, setPriorityFilter] = useState<JobPriority | 'all'>('all')

  const filteredJobs = useMemo(() => {
    return jobs.filter(job => {
      if (statusFilter !== 'all' && job.status !== statusFilter) return false
      if (priorityFilter !== 'all' && job.priority !== priorityFilter) return false
      return true
    })
  }, [jobs, statusFilter, priorityFilter])

  const columns = useMemo<ColumnDef<JobListItem>[]>(() => [
    {
      accessorKey: 'id',
      header: 'Job #',
      size: 80,
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
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: 'dateRequired',
      header: 'Date Required',
      cell: ({ getValue }) => format(new Date(getValue() as string), 'MMM d, yyyy'),
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: 'description',
      header: 'Description',
      cell: ({ getValue }) => (
        <span className="line-clamp-2 max-w-xs">{getValue() as string}</span>
      ),
    },
    {
      accessorKey: 'requestorName',
      header: 'Requestor',
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: 'machinistName',
      header: 'Machinist',
      cell: ({ getValue }) => getValue() as string || <span className="text-gray-400 italic">unassigned</span>,
      meta: { hideOnMobile: true },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ getValue }) => <StatusBadge status={getValue() as JobStatus} />,
    },
    {
      accessorKey: 'priority',
      header: 'Priority',
      cell: ({ getValue }) => <PriorityBadge priority={getValue() as JobPriority} />,
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
    data: filteredJobs,
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  })

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="Search jobs…"
          value={globalFilter}
          onChange={e => setGlobalFilter(e.target.value)}
          className="border rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="inprogress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select
          value={priorityFilter}
          onChange={e => setPriorityFilter(e.target.value as any)}
          className="border rounded-md px-3 py-1.5 text-sm"
        >
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="normal">Normal</option>
        </select>
        <span className="text-sm text-gray-500 ml-auto">
          {table.getFilteredRowModel().rows.length} jobs
        </span>
      </div>

      {/* Table */}
      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700 text-white">
            {table.getHeaderGroups().map(hg => (
              <tr key={hg.id}>
                {hg.headers.map(header => (
                  <th
                    key={header.id}
                    className={clsx(
                      'px-4 py-3 text-left font-medium cursor-pointer select-none whitespace-nowrap',
                      header.column.columnDef.meta?.hideOnMobile && 'hidden md:table-cell'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getIsSorted() === 'asc'  && <ChevronUp className="h-3 w-3" />}
                      {header.column.getIsSorted() === 'desc' && <ChevronDown className="h-3 w-3" />}
                      {!header.column.getIsSorted()           && <ChevronsUpDown className="h-3 w-3 opacity-40" />}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y">
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
        <span>
          Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Previous
          </button>
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className="px-3 py-1 border rounded disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  )
}
