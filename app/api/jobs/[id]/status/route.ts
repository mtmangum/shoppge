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

    const [existing] = await db.select({ status: jobs.status }).from(jobs).where(eq(jobs.id, jobId)).limit(1)
    if (!existing) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const updates: Record<string, any> = { status, updatedAt: new Date() }
    if (status === 'completed') {
      updates.dateCompleted = new Date().toISOString().split('T')[0]
      updates.completedById = parseInt(user.id as string)
    }

    await db.update(jobs).set(updates).where(eq(jobs.id, jobId))

    await db.insert(jobStatusHistory).values({
      jobId,
      fromStatus: existing.status,
      toStatus: status,
      changedById: parseInt(user.id as string),
      note,
    })

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
