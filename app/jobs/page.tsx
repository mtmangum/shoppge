import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { jobs, users } from '@/lib/schema'
import { eq, ne, and, or, ilike, sql, count } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { OpenJobsView } from '@/components/jobs/OpenJobsView'
import Link from 'next/link'
import { JobFilters } from '@/components/jobs/JobFilters'
import { daysInQueueSql, resolveSortKey, resolveSortDir, sortOrderFn } from '@/lib/query-helpers'
import type { JobStatus, JobPriority } from '@/lib/types'

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
  daysElapsed:   daysInQueueSql,
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
  const sortKey: SortKey = resolveSortKey(SORT_COLUMNS, searchParams.sort, 'id')
  const dir = resolveSortDir(searchParams.dir)
  const orderFn = sortOrderFn(dir)

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
        daysElapsed:   daysInQueueSql,
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
  const heading = mine ? 'My Jobs' : assigned ? 'Assigned to Me' : 'Open Jobs'

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

      <JobFilters search={search} status={status} priority={priority} total={total}>
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
      </JobFilters>
    </div>
  )
}
