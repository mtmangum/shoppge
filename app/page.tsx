import { redirect } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { desc, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { jobs } from '@/lib/schema'
import { StatusBadge } from '@/components/StatusBadge'
import { PriorityBadge } from '@/components/PriorityBadge'

export default async function RootPage() {
  const session = await auth()
  if (session?.user) redirect('/jobs')

  const recentJobs = await db
    .select({
      id:           jobs.id,
      entryDate:    jobs.entryDate,
      description:  jobs.description,
      status:       jobs.status,
      priority:     jobs.priority,
      daysElapsed:  sql<number>`CURRENT_DATE - ${jobs.entryDate}`,
    })
    .from(jobs)
    .orderBy(desc(jobs.id))
    .limit(10)

  return (
    <div className="space-y-8 py-4">
      <section className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white rounded-lg border p-5 shadow-sm">
        <div>
          <h2 className="text-lg font-bold text-gray-900">
            PGE Instrumentation &amp; Machine Shop
          </h2>
          <p className="text-sm text-gray-600">
            Submit a work order, attach your drawings, and track it through to completion.
          </p>
        </div>
        <Link
          href="/login"
          className="shrink-0 bg-[#BF5700] text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-[#a34800] transition-colors text-center"
        >
          Sign In
        </Link>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Recent Jobs
        </h3>

        <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
          <table className="w-full text-sm">
            <thead className="bg-gray-700 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-medium">Job #</th>
                <th className="px-4 py-3 text-left font-medium">Entry Date</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium">Status</th>
                <th className="px-4 py-3 text-left font-medium">Priority</th>
                <th className="px-4 py-3 text-left font-medium">Days in Queue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-400">
                    No jobs yet.
                  </td>
                </tr>
              )}
              {recentJobs.map((job, i) => (
                <tr key={job.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-mono font-semibold text-[#BF5700]">{job.id}</td>
                  <td className="px-4 py-3">{format(new Date(job.entryDate), 'MMM d, yyyy')}</td>
                  <td className="px-4 py-3">
                    <span className="line-clamp-1 max-w-md block">{job.description}</span>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-4 py-3"><PriorityBadge priority={job.priority} /></td>
                  <td className="px-4 py-3">
                    <span className={job.daysElapsed > 14 ? 'text-red-600 font-semibold' : ''}>
                      {job.daysElapsed}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-gray-500">
          Sign in to see requestor and machinist details, submit a new job, or view attachments.
        </p>
      </section>
    </div>
  )
}
