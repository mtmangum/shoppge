import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { jobs, users, jobStatusHistory } from '@/lib/schema'
import { eq, ne, and, inArray, isNull, asc, desc, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { format } from 'date-fns'
import Link from 'next/link'
import { StatsCards } from '@/components/jobs/StatsCards'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { QueueAgeBadge } from '@/components/shared/QueueAgeBadge'
import { ThroughputChart } from '@/components/ThroughputChart'
import { TurnaroundChart } from '@/components/TurnaroundChart'

const machinists = alias(users, 'machinists')
const changedByUsers = alias(users, 'changed_by_users')

export default async function AdminDashboardPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'admin') redirect('/jobs')

  const { rows: [stats] } = await db.execute(sql`SELECT * FROM job_stats_view`)

  const workload = await db
    .select({
      id: users.id,
      name: users.name,
      openCount: sql<number>`COUNT(*) FILTER (WHERE ${jobs.status} IN ('pending','inprogress'))`,
      urgentOpenCount: sql<number>`COUNT(*) FILTER (WHERE ${jobs.status} IN ('pending','inprogress') AND ${jobs.priority} = 'urgent')`,
      completedCount: sql<number>`COUNT(*) FILTER (WHERE ${jobs.status} = 'completed')`,
    })
    .from(users)
    .leftJoin(jobs, eq(jobs.machinistId, users.id))
    .where(and(inArray(users.role, ['machinist', 'admin']), eq(users.isActive, true)))
    .groupBy(users.id, users.name)
    .orderBy(desc(sql`COUNT(*) FILTER (WHERE ${jobs.status} IN ('pending','inprogress'))`))

  const overdueOrUrgent = await db
    .select({
      id: jobs.id,
      description: jobs.description,
      status: jobs.status,
      priority: jobs.priority,
      requestorName: users.name,
      machinistName: machinists.name,
      // Queue age (time since the job was entered) and lateness (time past
      // its requested due date) are different things — a job entered
      // 20 days ago but not due for another month isn't overdue.
      daysInQueue: sql<number>`CURRENT_DATE - ${jobs.entryDate}`,
      daysOverdue: sql<number>`CURRENT_DATE - ${jobs.dateRequired}`,
    })
    .from(jobs)
    .leftJoin(users, eq(jobs.requestorId, users.id))
    .leftJoin(machinists, eq(jobs.machinistId, machinists.id))
    .where(and(
      ne(jobs.status, 'completed'),
      ne(jobs.status, 'cancelled'),
      sql`(${jobs.priority} = 'urgent' OR ${jobs.dateRequired} < CURRENT_DATE)`
    ))
    .orderBy(desc(sql`${jobs.dateRequired} < CURRENT_DATE`), desc(sql`CURRENT_DATE - ${jobs.dateRequired}`))
    .limit(15)

  const { rows: weeklyRows } = await db.execute(sql`
    SELECT
      weeks.week_start AS week_start,
      COALESCE(COUNT(j.id), 0)::int AS completed_count,
      ROUND(AVG(j.date_completed - j.entry_date))::int AS avg_turnaround_days
    FROM generate_series(
      date_trunc('week', CURRENT_DATE) - interval '11 weeks',
      date_trunc('week', CURRENT_DATE),
      interval '1 week'
    ) AS weeks(week_start)
    LEFT JOIN jobs j
      ON j.status = 'completed'
      AND j.date_completed IS NOT NULL
      AND date_trunc('week', j.date_completed) = weeks.week_start
    GROUP BY weeks.week_start
    ORDER BY weeks.week_start
  `)
  const weekly = weeklyRows as { week_start: string; completed_count: number; avg_turnaround_days: number | null }[]

  const needsAssignment = and(isNull(jobs.machinistId), inArray(jobs.status, ['pending', 'inprogress']))
  const [activity, [assignmentStats], unassignedJobs] = await Promise.all([
    db
      .select({
        id: jobStatusHistory.id,
        jobId: jobStatusHistory.jobId,
        toStatus: jobStatusHistory.toStatus,
        note: jobStatusHistory.note,
        changedAt: jobStatusHistory.changedAt,
        changedByName: changedByUsers.name,
        jobDescription: jobs.description,
      })
      .from(jobStatusHistory)
      .leftJoin(changedByUsers, eq(jobStatusHistory.changedById, changedByUsers.id))
      .leftJoin(jobs, eq(jobStatusHistory.jobId, jobs.id))
      .orderBy(desc(jobStatusHistory.changedAt), desc(jobStatusHistory.id))
      .limit(8),
    db
      .select({
        openCount: sql<number>`COUNT(*)::int`,
        urgentCount: sql<number>`COUNT(*) FILTER (WHERE ${jobs.priority} = 'urgent')::int`,
      })
      .from(jobs)
      .where(needsAssignment),
    db
      .select({
        id: jobs.id,
        description: jobs.description,
        priority: jobs.priority,
        daysInQueue: sql<number>`CURRENT_DATE - ${jobs.entryDate}`,
      })
      .from(jobs)
      .where(needsAssignment)
      .orderBy(asc(jobs.entryDate), asc(jobs.id))
      .limit(5),
  ])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Admin Dashboard</h2>

      <StatsCards stats={stats as any} />

      <section className="bg-white rounded-lg border shadow-sm p-6">
        <h3 className="font-semibold text-gray-700 mb-4">Shop Trends (last 12 weeks)</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <ThroughputChart data={weekly.map(w => ({ weekStart: w.week_start, count: w.completed_count }))} />
          <TurnaroundChart data={weekly.map(w => ({ weekStart: w.week_start, avgDays: w.avg_turnaround_days }))} />
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg border shadow-sm">
          <h3 className="font-semibold text-gray-700 px-6 pt-4 pb-2 border-b">Machinist Workload</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-500 text-xs uppercase tracking-wide">
                  <th className="px-6 py-2 whitespace-nowrap">Machinist</th>
                  <th className="px-6 py-2 whitespace-nowrap">Open</th>
                  <th className="px-6 py-2 whitespace-nowrap">Urgent</th>
                  <th className="px-6 py-2 whitespace-nowrap">Completed</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {workload.map(w => (
                  <tr key={w.id}>
                    <td className="px-6 py-2 whitespace-nowrap">{w.name}</td>
                    <td className="px-6 py-2">{w.openCount}</td>
                    <td className="px-6 py-2">
                      {w.urgentOpenCount > 0
                        ? <span className="text-red-600 font-semibold">{w.urgentOpenCount}</span>
                        : w.urgentOpenCount}
                    </td>
                    <td className="px-6 py-2 text-gray-500">{w.completedCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 border-t">
            <Link href="/admin/users" className="text-sm text-[#BF5700] hover:underline">Manage users →</Link>
          </div>
        </section>

        <section className="bg-white rounded-lg border shadow-sm">
          <h3 className="font-semibold text-gray-700 px-6 pt-4 pb-2 border-b">Overdue / Urgent Jobs</h3>
          {overdueOrUrgent.length === 0 ? (
            <p className="text-sm text-gray-500 italic px-6 py-4">Nothing overdue or urgent right now.</p>
          ) : (
            <ul className="divide-y">
              {overdueOrUrgent.map(job => (
                <li key={job.id}>
                  <Link href={`/jobs/${job.id}`} className="block px-6 py-3 text-sm hover:bg-gray-50 focus-visible:ring-inset">
                    <div className="flex items-center flex-wrap justify-between gap-2">
                      <span className="font-mono font-semibold text-[#BF5700]">#{job.id}</span>
                      <div className="flex items-center flex-wrap gap-2">
                        <PriorityBadge priority={job.priority} />
                        <StatusBadge status={job.status} />
                        {job.daysOverdue > 0 ? (
                          <span className="text-red-600 font-semibold">{job.daysOverdue}d overdue</span>
                        ) : (
                          <span className="text-gray-500">{job.daysInQueue}d in queue</span>
                        )}
                      </div>
                    </div>
                    <p className="text-gray-700 line-clamp-1 mt-1">{job.description}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {job.requestorName} · {job.machinistName ?? 'unassigned'}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section aria-labelledby="recent-activity-heading" className="min-w-0 bg-white rounded-lg border shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-4 border-b">
            <h3 id="recent-activity-heading" className="font-semibold text-gray-700">Recent Activity</h3>
            <Link href="/admin/activity" className="text-sm text-[#BF5700] hover:underline">View full log →</Link>
          </div>
          {activity.length === 0 ? (
            <p className="text-sm text-gray-500 italic px-5 py-4">No status changes yet.</p>
          ) : (
            <ul className="divide-y">
              {activity.map(entry => {
                const deletedAuthor = entry.note?.match(/^\[Original author: (.*?) </)?.[1]
                const actor = entry.changedByName ?? (deletedAuthor ? `${deletedAuthor} (deleted)` : 'System')
                return (
                  <li key={entry.id}>
                    <Link href={`/jobs/${entry.jobId}`} className="block px-5 py-2.5 hover:bg-gray-50 focus-visible:ring-inset">
                      <div className="flex items-start justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center flex-wrap gap-2">
                          <span className="font-mono font-semibold text-[#BF5700]">#{entry.jobId}</span>
                          <StatusBadge status={entry.toStatus} />
                        </div>
                        <time
                          dateTime={new Date(entry.changedAt).toISOString()}
                          title={format(new Date(entry.changedAt), 'MMM d, yyyy h:mm a')}
                          className="shrink-0 text-right text-xs leading-5 text-gray-500"
                        >
                          {format(new Date(entry.changedAt), 'MMM d, h:mm a')}
                        </time>
                      </div>
                      <p className="mt-1 truncate text-xs text-gray-500" title={`${actor} · ${entry.jobDescription ?? ''}`}>
                        {actor}{entry.jobDescription && <> · {entry.jobDescription}</>}
                      </p>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <section aria-labelledby="needs-assignment-heading" className="min-w-0 bg-white rounded-lg border shadow-sm">
          <div className="px-5 py-4 border-b">
            <h3 id="needs-assignment-heading" className="font-semibold text-gray-700">Needs Assignment</h3>
            <p className="mt-1 text-xs text-gray-500">Open jobs without a machinist</p>
          </div>
          <dl className="grid grid-cols-2 gap-4 px-5 py-4 border-b">
            <div>
              <dt className="text-xs font-medium text-gray-500">Unassigned open jobs</dt>
              <dd className="mt-1 text-3xl font-bold tabular-nums text-[#BF5700]">{assignmentStats.openCount}</dd>
            </div>
            <div>
              <dt className="text-xs font-medium text-gray-500">Urgent among these</dt>
              <dd className={`mt-1 text-3xl font-bold tabular-nums ${assignmentStats.urgentCount > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                {assignmentStats.urgentCount}
              </dd>
            </div>
          </dl>
          {unassignedJobs.length === 0 ? (
            <p className="px-5 py-4 text-sm text-gray-500">All open jobs are assigned.</p>
          ) : (
            <>
              <p className="px-5 pt-4 pb-2 text-xs font-medium text-gray-500">Oldest unassigned jobs · select a job to assign it</p>
              <ul className="divide-y">
                {unassignedJobs.map(job => (
                  <li key={job.id}>
                    <Link href={`/jobs/${job.id}`} className="block px-5 py-3 hover:bg-gray-50 focus-visible:ring-inset">
                      <div className="flex items-center justify-between gap-3 text-sm">
                        <div className="flex min-w-0 items-center flex-wrap gap-2">
                          <span className="font-mono font-semibold text-[#BF5700]">#{job.id}</span>
                          {job.priority === 'urgent' && <PriorityBadge priority={job.priority} />}
                        </div>
                        <span className="flex shrink-0 items-center gap-1 text-right text-xs text-gray-500">
                          <QueueAgeBadge days={job.daysInQueue} showUnit />
                          <span>in queue</span>
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 text-sm text-gray-700">{job.description}</p>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
