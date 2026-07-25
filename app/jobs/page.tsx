import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { jobs, users } from '@/lib/schema'
import { eq, ne, and, ilike, sql, asc, desc, count } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { OpenJobsView } from '@/components/OpenJobsView'
import Link from 'next/link'
import type { JobStatus, JobPriority } from '@/lib/types'

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

  // This page only ever shows open (non-completed) jobs.
  const conditions = [ne(jobs.status, 'completed')]
  if (status !== 'all') conditions.push(eq(jobs.status, status))
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
          className="border rounded-md px-3 py-1.5 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
        />
        <select name="status" defaultValue={status} className="border rounded-md px-3 py-1.5 text-sm">
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="inprogress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select name="priority" defaultValue={priority} className="border rounded-md px-3 py-1.5 text-sm">
          <option value="all">All Priorities</option>
          <option value="urgent">Urgent</option>
          <option value="normal">Normal</option>
        </select>
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
