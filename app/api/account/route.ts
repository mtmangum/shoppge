import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { profileSettingsSchema } from '@/lib/account-settings'
import { and, eq } from 'drizzle-orm'

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Send account settings as JSON.' }, { status: 415 })
  }
  const parsed = profileSettingsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Check your profile details.', fields: parsed.error.flatten().fieldErrors }, { status: 400 })

  try {
    const [profile] = await db.update(users).set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(users.id, Number(session.user.id)), eq(users.isActive, true)))
      .returning({ name: users.name, department: users.department, phone: users.phone, room: users.room })
    if (!profile) return NextResponse.json({ error: 'Account is no longer available.' }, { status: 404 })
    return NextResponse.json({ profile })
  } catch {
    return NextResponse.json({ error: 'Could not save your profile. Please try again.' }, { status: 500 })
  }
}
