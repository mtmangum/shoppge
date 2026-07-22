import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { jobs } from '@/lib/schema'
import { requireMachinist } from '@/lib/auth'
import { updateJobSchema } from '@/lib/types'
import { eq } from 'drizzle-orm'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await requireMachinist()
    const body = await req.json()
    const data = updateJobSchema.parse(body)
    const jobId = parseInt(params.id)

    const [existing] = await db.select({ id: jobs.id }).from(jobs).where(eq(jobs.id, jobId)).limit(1)
    if (!existing) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    await db
      .update(jobs)
      .set({ ...data, updatedAt: new Date() })
      .where(eq(jobs.id, jobId))

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
