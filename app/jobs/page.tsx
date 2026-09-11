import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { jobs, users } from '@/lib/schema'
import { eq, ne, and, ilike, sql, asc, desc, count } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { OpenJobsView } from '@/components/OpenJobsView'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { JobStatus, JobPriority } from '@/lib/types'

const FIELD_CLASS = 'border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#BF5700]'

const machinists = alias(users, 'machinists')

const PAGE_SIZE = 10

const SORT_COLUMNS = {
  id:            jobs.id,
  entryDate:     jobs.entryDate,
  dateRequired:  jobs.dateRequired,
  description:   jobs.description,
  requestorName: users.name,
  machinistName: machinists.name,
  status:        jobs.status,
  priority:      jobs.priority,
} as const

type SortKey = keyof typeof SORT_COLUMNS

interface SearchParams {
  page?: string
  search?: string
  status?: string
  priority?: string
  sort?: string
  dir?: string
}

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const page     = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const search   = searchParams.search?.trim() ?? ''
  const status   = (searchParams.status ?? 'all') as JobStatus | 'all'
  const priority = (searchParams.priority ?? 'all') as JobPriority | 'all'
  const sortKey: SortKey = searchParams.sort && searchParams.sort in SORT_COLUMNS
    ? searchParams.sort as SortKey
    : 'id'
  const dir = searchParams.dir === 'asc' ? 'asc' : 'desc'
  const orderFn = dir === 'asc' ? asc : desc

  // With no status filter, this page shows only open (non-completed,
  // non-cancelled) jobs. An explicit status filter overrides that default
  // so "Completed" and "Cancelled" are actually reachable.
  const conditions = status !== 'all'
    ? [eq(jobs.status, status)]
    : [ne(jobs.status, 'completed'), ne(jobs.status, 'cancelled')]
  if (priority !== 'all') conditions.push(eq(jobs.priority, priority))
  if (search) conditions.push(ilike(jobs.description, `%${search}%`))
  const where = and(...conditions)

  const [openJobs, [{ total }], { rows: [stats] }] = await Promise.all([
    db
      .select({
        id:            jobs.id,
        entryDate:     jobs.entryDate,
        dateRequired:  jobs.dateRequired,
        description:   jobs.description,
        status:        jobs.status,
        priority:      jobs.priority,
        requestorName: users.name,
        machinistName: machinists.name,
        daysElapsed:   sql<number>`CURRENT_DATE - ${jobs.entryDate}`,
      })
      .from(jobs)
      .leftJoin(users, eq(jobs.requestorId, users.id))
      .leftJoin(machinists, eq(jobs.machinistId, machinists.id))
      .where(where)
      .orderBy(orderFn(SORT_COLUMNS[sortKey]))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(jobs).where(where),
    db.execute(sql`SELECT * FROM job_stats_view`),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = Boolean(search || status !== 'all' || priority !== 'all')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Open Jobs</h2>
        <Link
          href="/jobs/new"
          className="bg-[#BF5700] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#a34800] transition-colors"
        >
          + New Job
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-3 items-center">
        <input
          type="text"
          name="search"
          placeholder="Search jobs…"
          defaultValue={search}
          className={`${FIELD_CLASS} w-64`}
        />
        <div className="relative">
          <select name="status" defaultValue={status} className={`${FIELD_CLASS} appearance-none pr-8`}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="inprogress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
        <div className="relative">
          <select name="priority" defaultValue={priority} className={`${FIELD_CLASS} appearance-none pr-8`}>
            <option value="all">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="normal">Normal</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
        <button
          type="submit"
          className="bg-gray-700 text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-gray-800 transition-colors"
        >
          Filter
        </button>
        {hasFilters && (
          <Link href="/jobs" className="text-sm text-gray-500 hover:underline">Clear</Link>
        )}
        <span className="text-sm text-gray-500 ml-auto">{total} jobs</span>
      </form>

      <OpenJobsView
        stats={stats as any}
        jobs={openJobs as any}
        page={page}
        totalPages={totalPages}
        search={search}
        status={status}
        priority={priority}
        sort={sortKey}
        dir={dir}
      />
    </div>
  )
}
