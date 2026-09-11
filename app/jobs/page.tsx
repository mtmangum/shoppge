import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { jobs, users } from '@/lib/schema'
import { eq, ne, and, or, ilike, sql, asc, desc, count } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { OpenJobsView } from '@/components/OpenJobsView'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import type { JobStatus, JobPriority } from '@/lib/types'

const FIELD_CLASS = 'border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#BF5700]'

// jobs.id is a Postgres `integer` column; a longer digit string (e.g. an
// all-numeric part number pasted into search) would overflow it and crash
// the query instead of just falling back to a description search.
const PG_INT4_MAX = 2147483647

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
  mine?: string
  assigned?: string
}

export default async function JobsPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const currentUserId = parseInt(session.user.id as string)

  const page     = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const search   = searchParams.search?.trim() ?? ''
  const status   = (searchParams.status ?? 'all') as JobStatus | 'all'
  const priority = (searchParams.priority ?? 'all') as JobPriority | 'all'
  const mine     = searchParams.mine === '1'
  const assigned = searchParams.assigned === '1'
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
  if (mine) conditions.push(eq(jobs.requestorId, currentUserId))
  if (assigned) conditions.push(eq(jobs.machinistId, currentUserId))
  if (search) {
    // Bare or "#"-prefixed numbers also match by job number, not just description text.
    const parsedId = /^#?\d+$/.test(search) ? parseInt(search.replace('#', ''), 10) : null
    const jobIdMatch = parsedId !== null && parsedId <= PG_INT4_MAX ? parsedId : null
    conditions.push(
      jobIdMatch !== null
        ? or(eq(jobs.id, jobIdMatch), ilike(jobs.description, `%${search}%`))!
        : ilike(jobs.description, `%${search}%`)
    )
  }
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
  const heading = mine ? 'My Jobs' : assigned ? 'Assigned to Me' : 'Open Jobs'
  const viewParam = mine ? '?mine=1' : assigned ? '?assigned=1' : ''

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">{heading}</h2>
        <Link
          href="/jobs/new"
          className="bg-[#BF5700] text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-[#a34800] transition-colors"
        >
          + New Job
        </Link>
      </div>

      <form method="get" className="flex flex-wrap gap-3 items-center">
        {mine && <input type="hidden" name="mine" value="1" />}
        {assigned && <input type="hidden" name="assigned" value="1" />}
        <input
          type="text"
          name="search"
          placeholder="Search jobs or #…"
          defaultValue={search}
          className={`${FIELD_CLASS} w-64`}
        />
        <div className="relative">
          <select name="status" aria-label="Filter by status" defaultValue={status} className={`${FIELD_CLASS} appearance-none pr-8`}>
            <option value="all">All Statuses</option>
            <option value="pending">Pending</option>
            <option value="inprogress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
        <div className="relative">
          <select name="priority" aria-label="Filter by priority" defaultValue={priority} className={`${FIELD_CLASS} appearance-none pr-8`}>
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
          <Link href={`/jobs${viewParam}`} className="text-sm text-gray-500 hover:underline">Clear</Link>
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
        mine={mine}
        assigned={assigned}
        sort={sortKey}
        dir={dir}
      />
    </div>
  )
}
