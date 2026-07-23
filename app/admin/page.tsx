import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { jobs, users, jobStatusHistory } from '@/lib/schema'
import { eq, ne, and, inArray, desc, sql } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { format } from 'date-fns'
import Link from 'next/link'
import { StatsCards } from '@/components/StatsCards'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'
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
      daysElapsed: sql<number>`CURRENT_DATE - ${jobs.entryDate}`,
    })
    .from(jobs)
    .leftJoin(users, eq(jobs.requestorId, users.id))
    .leftJoin(machinists, eq(jobs.machinistId, machinists.id))
    .where(and(
      ne(jobs.status, 'completed'),
      ne(jobs.status, 'cancelled'),
      sql`(${jobs.priority} = 'urgent' OR CURRENT_DATE - ${jobs.entryDate} > 14)`
    ))
    .orderBy(desc(sql`CURRENT_DATE - ${jobs.entryDate}`))
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

  const activity = await db
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
    .orderBy(desc(jobStatusHistory.changedAt))
    .limit(20)

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
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 text-xs uppercase tracking-wide">
                <th className="px-6 py-2">Machinist</th>
                <th className="px-6 py-2">Open</th>
                <th className="px-6 py-2">Urgent</th>
                <th className="px-6 py-2">Completed</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {workload.map(w => (
                <tr key={w.id}>
                  <td className="px-6 py-2">{w.name}</td>
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
          <div className="px-6 py-3 border-t">
            <Link href="/admin/users" className="text-sm text-[#BF5700] hover:underline">Manage users →</Link>
          </div>
        </section>

        <section className="bg-white rounded-lg border shadow-sm">
          <h3 className="font-semibold text-gray-700 px-6 pt-4 pb-2 border-b">Overdue / Urgent Jobs</h3>
          {overdueOrUrgent.length === 0 ? (
            <p className="text-sm text-gray-400 italic px-6 py-4">Nothing overdue or urgent right now.</p>
          ) : (
            <ul className="divide-y">
              {overdueOrUrgent.map(job => (
                <li key={job.id} className="px-6 py-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link href={`/jobs/${job.id}`} className="font-mono font-semibold text-[#BF5700] hover:underline">
                      #{job.id}
                    </Link>
                    <div className="flex items-center gap-2">
                      <PriorityBadge priority={job.priority} />
                      <StatusBadge status={job.status} />
                      <span className={job.daysElapsed > 14 ? 'text-red-600 font-semibold' : 'text-gray-500'}>
                        {job.daysElapsed}d
                      </span>
                    </div>
                  </div>
                  <p className="text-gray-700 line-clamp-1 mt-1">{job.description}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {job.requestorName} · {job.machinistName ?? 'unassigned'}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="bg-white rounded-lg border shadow-sm">
        <h3 className="font-semibold text-gray-700 px-6 pt-4 pb-2 border-b">Recent Activity</h3>
        {activity.length === 0 ? (
          <p className="text-sm text-gray-400 italic px-6 py-4">No status changes yet.</p>
        ) : (
          <ul className="divide-y">
            {activity.map(entry => (
              <li key={entry.id} className="px-6 py-2.5 text-sm flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link href={`/jobs/${entry.jobId}`} className="font-mono font-semibold text-[#BF5700] hover:underline">
                    #{entry.jobId}
                  </Link>
                  <span className="text-gray-500">
                    {entry.fromStatus ?? 'created'} → <StatusBadge status={entry.toStatus} />
                  </span>
                  {entry.note && <span className="text-gray-400 italic">"{entry.note}"</span>}
                </div>
                <div className="text-xs text-gray-400 shrink-0">
                  {entry.changedByName ?? 'System'} · {format(new Date(entry.changedAt), 'MMM d, h:mm a')}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
