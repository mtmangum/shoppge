import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { requireAdmin } from '@/lib/auth'
import { updateUserSchema } from '@/lib/types'
import { eq } from 'drizzle-orm'
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
