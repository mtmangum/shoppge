import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { jobs, users } from '@/lib/schema'
import { eq, ne, sql, desc } from 'drizzle-orm'
import { alias } from 'drizzle-orm/pg-core'
import { JobsTable } from '@/components/JobsTable'
import { StatsCards } from '@/components/StatsCards'
import Link from 'next/link'

const machinists = alias(users, 'machinists')

export default async function JobsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')

  // Fetch open jobs with requestor + machinist names
  const openJobs = await db
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
    .where(ne(jobs.status, 'completed'))
    .orderBy(desc(jobs.id))

  // Stats
  const { rows: [stats] } = await db.execute(
    sql`SELECT * FROM job_stats_view`
  )

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

      <StatsCards stats={stats as any} />

      <JobsTable jobs={openJobs as any} />
    </div>
  )
}
