import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { jobStatusHistory, users } from '@/lib/schema'
import { eq, and, gte, lte, desc, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { format } from 'date-fns'
import Link from 'next/link'
import { ChevronDown } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import type { JobStatus } from '@/lib/types'

const FIELD_CLASS = 'block h-10 w-full min-w-0 appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 text-sm leading-5 text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#BF5700]'
const LABEL_CLASS = 'mb-1 block text-xs font-medium leading-4 text-gray-600'
const DATE_CLASS = `${FIELD_CLASS} [&::-webkit-date-and-time-value]:min-h-5 [&::-webkit-date-and-time-value]:text-left`

const changedByUsers = alias(users, 'changed_by_users')

const PAGE_SIZE = 50

interface SearchParams {
  jobId?: string
  changedById?: string
  status?: string
  from?: string
  to?: string
  page?: string
}

export default async function ActivityLogPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'admin') redirect('/jobs')

  const page = Math.max(1, parseInt(searchParams.page ?? '1') || 1)

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
      changedByName: changedByUsers.name,
    })
    .from(jobStatusHistory)
    .leftJoin(changedByUsers, eq(jobStatusHistory.changedById, changedByUsers.id))
    .where(where)
    .orderBy(desc(jobStatusHistory.changedAt))
    .limit(PAGE_SIZE)
    .offset((page - 1) * PAGE_SIZE)

  const allUsers = await db.select({ id: users.id, name: users.name }).from(users).orderBy(users.name)

  const hasFilters = Boolean(searchParams.jobId || searchParams.changedById || searchParams.status || searchParams.from || searchParams.to)

  function buildPageUrl(targetPage: number) {
    const params = new URLSearchParams()
    if (searchParams.jobId) params.set('jobId', searchParams.jobId)
    if (searchParams.changedById) params.set('changedById', searchParams.changedById)
    if (searchParams.status) params.set('status', searchParams.status)
    if (searchParams.from) params.set('from', searchParams.from)
    if (searchParams.to) params.set('to', searchParams.to)
    params.set('page', String(targetPage))
    return `/admin/activity?${params.toString()}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Activity Log</h2>
        <Link href="/admin" className="text-sm text-[#BF5700] hover:underline">← Back to Dashboard</Link>
      </div>

      <form method="get" className="grid grid-cols-1 items-end gap-3 rounded-lg border bg-white p-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-[6rem_minmax(10rem,1fr)_9rem_10rem_10rem_auto]">
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
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
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
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
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
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Job</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Change</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap hidden md:table-cell">Note</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Changed By</th>
              <th className="px-4 py-3 text-left font-medium whitespace-nowrap">When</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {entries.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-500">No activity matches these filters.</td></tr>
            )}
            {entries.map((entry, i) => (
              <tr key={entry.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="px-4 py-3">
                  <Link href={`/jobs/${entry.jobId}`} className="font-mono font-semibold text-[#BF5700] hover:underline">
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
                <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{format(new Date(entry.changedAt), 'MMM d, yyyy h:mm a')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-600">
        <span>Page {page} of {totalPages} · {count} total</span>
        <div className="flex gap-2">
          <Link
            href={buildPageUrl(page - 1)}
            className={`px-3 py-1 border rounded ${page <= 1 ? 'opacity-40 pointer-events-none' : 'hover:bg-gray-50'}`}
          >
            Previous
          </Link>
          <Link
            href={buildPageUrl(page + 1)}
            className={`px-3 py-1 border rounded ${page >= totalPages ? 'opacity-40 pointer-events-none' : 'hover:bg-gray-50'}`}
          >
            Next
          </Link>
        </div>
      </div>
    </div>
  )
}
