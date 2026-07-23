import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users, jobs, jobAttachments, jobStatusHistory } from '@/lib/schema'
import { requireAdmin } from '@/lib/auth'
import { updateUserSchema } from '@/lib/types'
import { eq, or, sql } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

const SAFE_COLUMNS = {
  id: users.id,
  email: users.email,
  name: users.name,
  role: users.role,
  department: users.department,
  phone: users.phone,
  room: users.room,
  isActive: users.isActive,
  createdAt: users.createdAt,
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin()
    const userId = parseInt(params.id)
    const body = await req.json()
    const data = updateUserSchema.parse(body)

    if (parseInt(admin.id as string) === userId) {
      if (data.isActive === false) {
        return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 })
      }
      if (data.role && data.role !== 'admin') {
        return NextResponse.json({ error: 'You cannot change your own role' }, { status: 400 })
      }
    }

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const { password, ...rest } = data
    const updates: Record<string, any> = { ...rest, updatedAt: new Date() }
    if (password) updates.passwordHash = await bcrypt.hash(password, 12)

    const [user] = await db.update(users).set(updates).where(eq(users.id, userId)).returning(SAFE_COLUMNS)

    return NextResponse.json({ user })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin()
    const userId = parseInt(params.id)

    if (parseInt(admin.id as string) === userId) {
      return NextResponse.json({ error: 'You cannot delete your own account' }, { status: 400 })
    }

    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1)
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 })

    const [jobCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(jobs)
      .where(or(eq(jobs.requestorId, userId), eq(jobs.machinistId, userId), eq(jobs.completedById, userId)))
    const [attachmentCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(jobAttachments)
      .where(eq(jobAttachments.uploadedById, userId))
    const [historyCount] = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(jobStatusHistory)
      .where(eq(jobStatusHistory.changedById, userId))

    const blockers: string[] = []
    if (jobCount.count > 0) blockers.push(`${jobCount.count} job(s)`)
    if (attachmentCount.count > 0) blockers.push(`${attachmentCount.count} attachment(s)`)
    if (historyCount.count > 0) blockers.push(`${historyCount.count} status-history entr${historyCount.count === 1 ? 'y' : 'ies'}`)

    if (blockers.length > 0) {
      return NextResponse.json({
        error: `Cannot delete: this user is linked to ${blockers.join(', ')}. Deactivate the account instead to preserve those records.`,
      }, { status: 400 })
    }

    await db.delete(users).where(eq(users.id, userId))

    return NextResponse.json({ ok: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
