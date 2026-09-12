import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { jobStatusHistory, jobs, users } from '@/lib/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import Link from 'next/link'
import { ChevronDown, ChevronUp, ChevronsUpDown } from 'lucide-react'
import { formatTimestamp } from '@/lib/dates'
import { daysInQueueSql, resolveSortKey, resolveSortDir, sortOrderFn } from '@/lib/query-helpers'
import { FIELD_CLASS, LABEL_CLASS, SELECT_CHEVRON_CLASS } from '@/lib/ui-classes'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { QueueAgeBadge } from '@/components/shared/QueueAgeBadge'
import { Pagination } from '@/components/shared/Pagination'
import { ActivityRow } from '@/components/jobs/ActivityRow'
import type { JobStatus } from '@/lib/types'

const DATE_CLASS = `${FIELD_CLASS} [&::-webkit-date-and-time-value]:min-h-5 [&::-webkit-date-and-time-value]:text-left`

const changedByUsers = alias(users, 'changed_by_users')

const PAGE_SIZE = 50
const SORT_COLUMNS = {
  jobId: jobStatusHistory.jobId,
  toStatus: sql<string>`${jobStatusHistory.toStatus}::text`,
  note: sql<string>`lower(coalesce(${jobStatusHistory.note}, ''))`,
  changedBy: sql<string>`lower(coalesce(${changedByUsers.name}, 'System'))`,
  changedAt: jobStatusHistory.changedAt,
  daysElapsed: daysInQueueSql,
} as const
type SortKey = keyof typeof SORT_COLUMNS

interface SearchParams {
  jobId?: string
  changedById?: string
  status?: string
  from?: string
  to?: string
  page?: string
  sort?: string
  dir?: string
}

export default async function ActivityLogPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'admin') redirect('/jobs')

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)
  const sortKey: SortKey = resolveSortKey(SORT_COLUMNS, searchParams.sort, 'changedAt')
  const dir = resolveSortDir(searchParams.dir)
  const orderFn = sortOrderFn(dir)

  const conditions = []
  if (searchParams.jobId) conditions.push(eq(jobStatusHistory.jobId, parseInt(searchParams.jobId)))
  if (searchParams.changedById) conditions.push(eq(jobStatusHistory.changedById, parseInt(searchParams.changedById)))
  if (searchParams.status) conditions.push(eq(jobStatusHistory.toStatus, searchParams.status as JobStatus))
  if (searchParams.from) conditions.push(gte(jobStatusHistory.changedAt, new Date(searchParams.from)))
  if (searchParams.to) conditions.push(lte(jobStatusHistory.changedAt, new Date(`${searchParams.to}T23:59:59`)))

  const where = conditions.length ? and(...conditions) : undefined

  const [{ count }] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(jobStatusHistory).where(where)
  const totalPages = Math.max(1, Math.ceil(count / PAGE_SIZE))

  const entries = await db
    .select({
      id: jobStatusHistory.id,
      jobId: jobStatusHistory.jobId,
      fromStatus: jobStatusHistory.fromStatus,
      toStatus: jobStatusHistory.toStatus,
      note: jobStatusHistory.note,
      changedAt: jobStatusHistory.changedAt,
      daysElapsed: daysInQueueSql,
      jobStatus: jobs.status,
      changedByName: changedByUsers.name,
    })
    .from(jobStatusHistory)
    .leftJoin(changedByUsers, eq(jobStatusHistory.changedById, changedByUsers.id))
    .innerJoin(jobs, eq(jobStatusHistory.jobId, jobs.id))
    .where(where)
    .orderBy(orderFn(SORT_COLUMNS[sortKey]), desc(jobStatusHistory.id))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)

  const allUsers = await db.select({ id: users.id, name: users.name }).from(users).orderBy(users.name)

  const hasFilters = Boolean(searchParams.jobId || searchParams.changedById || searchParams.status || searchParams.from || searchParams.to)

  function buildPageUrl(targetPage: number, key: SortKey = sortKey, direction: 'asc' | 'desc' = dir) {
    const params = new URLSearchParams()
    if (searchParams.jobId) params.set('jobId', searchParams.jobId)
    if (searchParams.changedById) params.set('changedById', searchParams.changedById)
    if (searchParams.status) params.set('status', searchParams.status)
    if (searchParams.from) params.set('from', searchParams.from)
    if (searchParams.to) params.set('to', searchParams.to)
    params.set('page', String(targetPage))
    params.set('sort', key)
    params.set('dir', direction)
    return `/admin/activity?${params.toString()}`
  }

  function sortHeader(key: SortKey, label: string, mobileHidden = false) {
    const active = key === sortKey
    const nextDir = active && dir === 'asc' ? 'desc' : 'asc'
    return (
      <th
        scope="col"
        aria-sort={active ? dir === 'asc' ? 'ascending' : 'descending' : 'none'}
        className={`px-4 py-3 text-left font-medium whitespace-nowrap${mobileHidden ? ' hidden md:table-cell' : ''}`}
      >
        <Link href={buildPageUrl(1, key, nextDir)} aria-label={`${label}: sort ${nextDir === 'asc' ? 'ascending' : 'descending'}${key === 'toStatus' ? ' by new status' : ''}`} className="flex items-center gap-1">
          {label}
          {active
            ? dir === 'asc'
              ? <ChevronUp aria-hidden="true" className="h-3 w-3" />
              : <ChevronDown aria-hidden="true" className="h-3 w-3" />
            : <ChevronsUpDown aria-hidden="true" className="h-3 w-3 opacity-60" />}
        </Link>
      </th>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Activity Log</h2>
        <Link href="/admin" className="text-sm text-[#BF5700] hover:underline">← Back to Dashboard</Link>
      </div>

      <form method="get" className="grid grid-cols-1 items-end gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[6rem_minmax(10rem,1fr)_9rem_10rem_10rem_auto]">
        <input type="hidden" name="sort" value={sortKey} />
        <input type="hidden" name="dir" value={dir} />
        <div>
          <label htmlFor="activity-job-id" className={LABEL_CLASS}>Job #</label>
          <input
            id="activity-job-id"
            type="number"
            name="jobId"
            defaultValue={searchParams.jobId}
            className={`${FIELD_CLASS} [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          />
        </div>
        <div>
          <label htmlFor="activity-changed-by" className={LABEL_CLASS}>Changed By</label>
          <div className="relative">
            <select id="activity-changed-by" name="changedById" defaultValue={searchParams.changedById ?? ''} className={`${FIELD_CLASS} pr-8`}>
              <option value="">Anyone</option>
              {allUsers.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
            <ChevronDown aria-hidden="true" className={SELECT_CHEVRON_CLASS} />
          </div>
        </div>
        <div>
          <label htmlFor="activity-new-status" className={LABEL_CLASS}>New Status</label>
          <div className="relative">
            <select id="activity-new-status" name="status" defaultValue={searchParams.status ?? ''} className={`${FIELD_CLASS} pr-8`}>
              <option value="">Any</option>
              <option value="pending">Pending</option>
              <option value="inprogress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown aria-hidden="true" className={SELECT_CHEVRON_CLASS} />
          </div>
        </div>
        <div>
          <label htmlFor="activity-from" className={LABEL_CLASS}>From</label>
          <input id="activity-from" type="date" name="from" defaultValue={searchParams.from} className={DATE_CLASS} />
        </div>
        <div>
          <label htmlFor="activity-to" className={LABEL_CLASS}>To</label>
          <input id="activity-to" type="date" name="to" defaultValue={searchParams.to} className={DATE_CLASS} />
        </div>
        <div className="flex h-10 items-center gap-3">
          <button type="submit" className="h-10 rounded-md bg-[#BF5700] px-4 py-2 text-sm font-medium leading-5 text-white transition-colors hover:bg-[#a34800]">
            Filter
          </button>
          {hasFilters && (
            <Link href="/admin/activity" className="inline-flex h-10 items-center text-sm text-gray-600 hover:underline">Clear</Link>
          )}
        </div>
      </form>

      <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-700 text-white">
            <tr>
              {sortHeader('jobId', 'Job')}
              {sortHeader('toStatus', 'Change')}
              {sortHeader('note', 'Note', true)}
              {sortHeader('changedBy', 'Changed By')}
              {sortHeader('daysElapsed', 'Days in Queue')}
              {sortHeader('changedAt', 'When')}
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-500">No activity matches these filters.</td></tr>
            )}
            {entries.map((entry, i) => (
              <ActivityRow key={entry.id} jobId={entry.jobId} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3">
                  <Link
                    href={`/jobs/${entry.jobId}`}
                    className="font-mono font-semibold text-[#BF5700] hover:underline"
                  >
                    #{entry.jobId}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-1.5 text-gray-500 whitespace-nowrap">
                    {entry.fromStatus ?? 'created'} → <StatusBadge status={entry.toStatus} />
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600 max-w-xs truncate hidden md:table-cell">{entry.note || '—'}</td>
                <td className="px-4 py-3 whitespace-nowrap">{entry.changedByName ?? 'System'}</td>
                <td className="px-4 py-3 whitespace-nowrap"><QueueAgeBadge days={entry.daysElapsed} status={entry.jobStatus} /></td>
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatTimestamp(entry.changedAt)}</td>
              </ActivityRow>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination page={page} totalPages={totalPages} total={count} getHref={p => buildPageUrl(p)} />
    </div>
  )
}
