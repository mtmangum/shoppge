import { auth } from '@/lib/auth'
import { redirect, notFound } from 'next/navigation'
import { db } from '@/lib/db'
import { jobs, users } from '@/lib/schema'
import { eq, and, inArray, asc } from 'drizzle-orm'
import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
import { JobActions } from '@/components/JobActions'
import { AttachmentsPanel } from '@/components/AttachmentsPanel'
import { StatusHistoryTimeline } from '@/components/StatusHistoryTimeline'
import type { UserRole } from '@/lib/types'

function formatDate(value?: string | null) {
  if (!value) return '—'
  return format(parseISO(value), 'MMM d, yyyy')
}

export default async function JobDetailPage({ params }: { params: { id: string } }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  const jobId = parseInt(params.id)
  if (Number.isNaN(jobId)) notFound()

  const job = await db.query.jobs.findFirst({
    where: eq(jobs.id, jobId),
    with: {
      requestor:   true,
      machinist:   true,
      completedBy: true,
      items:       { orderBy: (item, { asc }) => [asc(item.itemNumber)] },
      attachments: { with: { uploadedBy: true }, orderBy: (a, { desc }) => [desc(a.uploadedAt)] },
      statusHistory: { with: { changedBy: true }, orderBy: (h, { asc }) => [asc(h.changedAt)] },
    },
  })

  if (!job) notFound()

  const role = session.user.role as UserRole
  const canManage = role === 'machinist' || role === 'admin'
  const currentUserId = parseInt(session.user.id as string)

  // Requestors can only see their own jobs — job detail includes billing/
  // sponsor account info that shouldn't be visible shop-wide. Machinists and
  // admins keep full access since they need to browse and pick up any job.
  if (role === 'requestor' && job.requestorId !== currentUserId) notFound()

  const machinists = canManage
    ? await db
        .select({ id: users.id, name: users.name })
        .from(users)
        .where(and(inArray(users.role, ['machinist', 'admin']), eq(users.isActive, true)))
    : []

  // Calendar-day difference, not a raw ms/24h division — the latter
  // undercounts by a day across a spring-forward DST transition, since
  // that day has fewer than 24 real hours in it.
  const daysElapsed = differenceInCalendarDays(new Date(), parseISO(job.entryDate))

  const hasBillingInfo = job.accountNumber || job.accountTitle || job.sponsorOrg || job.bookkeeperName

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/jobs" className="text-gray-500 hover:text-gray-800" aria-label="Back to jobs list">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <h2 className="text-2xl font-bold text-gray-900">
            Job #{job.id}
          </h2>
          <StatusBadge status={job.status} />
          <PriorityBadge priority={job.priority} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          <section className="bg-white rounded-lg border p-6 space-y-2">
            <h3 className="font-semibold text-gray-700 border-b pb-2 mb-2">Description</h3>
            <p className="text-sm text-gray-800 whitespace-pre-wrap">{job.description}</p>
          </section>

          <section className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-700 border-b pb-2 mb-4">Item List</h3>
            {job.items.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No line items.</p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 text-xs uppercase tracking-wide">
                    <th className="pb-2 pr-4">#</th>
                    <th className="pb-2 pr-4">Part #</th>
                    <th className="pb-2 pr-4">Qty</th>
                    <th className="pb-2">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {job.items.map(item => (
                    <tr key={item.id}>
                      <td className="py-2 pr-4 text-gray-500">{item.itemNumber}</td>
                      <td className="py-2 pr-4 font-mono">{item.partNumber || '—'}</td>
                      <td className="py-2 pr-4">{item.quantity || '—'}</td>
                      <td className="py-2">{item.description || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {hasBillingInfo && (
            <section className="bg-white rounded-lg border p-6">
              <h3 className="font-semibold text-gray-700 border-b pb-2 mb-4">Billing / Sponsor Information</h3>
              <dl className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <dt className="text-xs text-gray-500">Account Number</dt>
                  <dd>{job.accountNumber || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Account Title</dt>
                  <dd>{job.accountTitle || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Sponsoring Faculty/Organization</dt>
                  <dd>{job.sponsorOrg || '—'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-gray-500">Account Bookkeeper</dt>
                  <dd>{job.bookkeeperName || '—'}</dd>
                </div>
                <div className="col-span-2">
                  <dt className="text-xs text-gray-500">Bookkeeper Address</dt>
                  <dd className="whitespace-pre-wrap">{job.bookkeeperAddress || '—'}</dd>
                </div>
              </dl>
            </section>
          )}

          <section className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-700 border-b pb-2 mb-4">Attachments</h3>
            <AttachmentsPanel
              jobId={job.id}
              canDelete={canManage}
              attachments={job.attachments.map(a => ({
                id: a.id,
                originalName: a.originalName,
                fileSizeBytes: a.fileSizeBytes,
                mimeType: a.mimeType,
                uploadedAt: a.uploadedAt.toISOString(),
                uploadedByName: a.uploadedBy?.name,
              }))}
            />
          </section>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <section className="bg-white rounded-lg border p-6 space-y-3 text-sm">
            <h3 className="font-semibold text-gray-700 border-b pb-2 mb-2">Details</h3>
            <div className="flex justify-between">
              <span className="text-gray-500">Requestor</span>
              <span>{job.requestor?.name ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Machinist</span>
              <span>{job.machinist?.name ?? <span className="text-gray-500 italic">unassigned</span>}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Entry Date</span>
              <span>{formatDate(job.entryDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Date Required</span>
              <span>{formatDate(job.dateRequired)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Days in Queue</span>
              <span className={daysElapsed > 14 ? 'text-red-600 font-semibold' : ''}>{daysElapsed}</span>
            </div>
            {job.status === 'completed' && (
              <>
                <div className="flex justify-between">
                  <span className="text-gray-500">Date Completed</span>
                  <span>{formatDate(job.dateCompleted)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Completed By</span>
                  <span>{job.completedBy?.name ?? '—'}</span>
                </div>
              </>
            )}
            <div className="flex justify-between">
              <span className="text-gray-500">Materials Required</span>
              <span>{job.materialsRequired ? 'Yes' : 'No'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Materials Ordered</span>
              <span>{job.materialsOrdered ? 'Yes' : 'No'}</span>
            </div>
          </section>

          {canManage && (
            <JobActions
              jobId={job.id}
              status={job.status}
              machinistId={job.machinistId}
              currentUserId={currentUserId}
              materialsRequired={job.materialsRequired}
              materialsOrdered={job.materialsOrdered}
              machinistNotes={job.machinistNotes ?? ''}
              machinists={machinists}
              isAdmin={role === 'admin'}
            />
          )}

          {!canManage && job.machinistNotes && (
            <section className="bg-white rounded-lg border p-6 space-y-2 text-sm">
              <h3 className="font-semibold text-gray-700 border-b pb-2 mb-2">Machinist Notes</h3>
              <p className="whitespace-pre-wrap text-gray-800">{job.machinistNotes}</p>
            </section>
          )}

          <section className="bg-white rounded-lg border p-6">
            <h3 className="font-semibold text-gray-700 border-b pb-2 mb-4">Status History</h3>
            <StatusHistoryTimeline
              history={job.statusHistory.map(h => ({
                id: h.id,
                fromStatus: h.fromStatus,
                toStatus: h.toStatus,
                note: h.note,
                changedAt: h.changedAt.toISOString(),
                changedByName: h.changedBy?.name,
              }))}
            />
          </section>
        </div>
      </div>
    </div>
  )
}
