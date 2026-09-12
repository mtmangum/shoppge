import { redirect } from 'next/navigation'
import { desc, sql } from 'drizzle-orm'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { jobs } from '@/lib/schema'
import { formatDateOnly } from '@/lib/dates'
import { StatusBadge } from '@/components/shared/StatusBadge'
import { PriorityBadge } from '@/components/shared/PriorityBadge'
import { InlineLoginForm } from '@/components/auth/InlineLoginForm'

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
            UT ShopTrack — PGE Instrumentation &amp; Machine Shop
          </h2>
          <p className="text-sm text-gray-600">
            Submit a work order, attach your drawings, and track it through to completion.
          </p>
        </div>
        <InlineLoginForm />
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">
          Recent Jobs
        </h3>

        <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-700 text-white">
              <tr>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Job #</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap hidden md:table-cell">Entry Date</th>
                <th className="px-4 py-3 text-left font-medium">Description</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Priority</th>
                <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Days in Queue</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {recentJobs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-gray-500">
                    No jobs yet.
                  </td>
                </tr>
              )}
              {recentJobs.map((job, i) => (
                <tr key={job.id} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-4 py-3 font-mono font-semibold text-[#BF5700]">{job.id}</td>
                  <td className="px-4 py-3 whitespace-nowrap hidden md:table-cell">{formatDateOnly(job.entryDate)}</td>
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
