import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jobs, jobStatusHistory } from '@/lib/schema'
import { requireMachinist } from '@/lib/auth'
import { updateStatusSchema } from '@/lib/types'
import { eq } from 'drizzle-orm'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await requireMachinist()
    const body = await req.json()
    const { status, note } = updateStatusSchema.parse(body)
    const jobId = parseInt(params.id)

    return await db.transaction(async tx => {
      // Serialize status changes for this job and keep the history entry atomic.
      const [existing] = await tx.select({ status: jobs.status })
        .from(jobs).where(eq(jobs.id, jobId)).limit(1).for('update')
      if (!existing) return NextResponse.json({ error: 'Job not found' }, { status: 404 })
      if (existing.status === status && !note?.trim()) {
        return NextResponse.json({ ok: true })
      }

      const updates: Partial<typeof jobs.$inferInsert> = { status, updatedAt: new Date() }
      if (status === 'completed' && existing.status !== 'completed') {
        updates.dateCompleted = new Date().toISOString().split('T')[0]
        updates.completedById = parseInt(user.id as string)
      } else if (status !== 'completed') {
        updates.dateCompleted = null
        updates.completedById = null
      }

      await tx.update(jobs).set(updates).where(eq(jobs.id, jobId))
      await tx.insert(jobStatusHistory).values({
        jobId,
        fromStatus: existing.status,
        toStatus: status,
        changedById: parseInt(user.id as string),
        note,
      })
      return NextResponse.json({ ok: true })
    })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
