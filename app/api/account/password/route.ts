import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { passwordSettingsSchema } from '@/lib/account-settings'
import { and, eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (!req.headers.get('content-type')?.includes('application/json')) {
    return NextResponse.json({ error: 'Send password changes as JSON.' }, { status: 415 })
  }
  const parsed = passwordSettingsSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0].message }, { status: 400 })

  try {
    const userId = Number(session.user.id)
    const [account] = await db.select({ passwordHash: users.passwordHash }).from(users)
      .where(and(eq(users.id, userId), eq(users.isActive, true))).limit(1)
    if (!account) return NextResponse.json({ error: 'Account is no longer available.' }, { status: 404 })
    if (!account.passwordHash || !await bcrypt.compare(parsed.data.currentPassword, account.passwordHash)) {
      return NextResponse.json({ error: 'Current password is incorrect.' }, { status: 400 })
    }
    const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12)
    // Only replace the password we just verified; a concurrent change wins.
    const [updated] = await db.update(users).set({ passwordHash, updatedAt: new Date() })
      .where(and(eq(users.id, userId), eq(users.isActive, true), eq(users.passwordHash, account.passwordHash)))
      .returning({ id: users.id })
    if (!updated) return NextResponse.json({ error: 'Your account changed. Please sign in again and retry.' }, { status: 409 })
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not change your password. Please try again.' }, { status: 500 })
  }
}
