import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { accessRequests, users } from '@/lib/schema'
import { requireAdmin } from '@/lib/auth'
import { reviewAccessRequestSchema } from '@/lib/types'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { sendPasswordLinkEmail } from '@/lib/mail'
import { INVITE_TTL_MS, issuePasswordToken } from '@/lib/password-reset'

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await requireAdmin()
    const requestId = parseInt(params.id)
    const body = await req.json()
    const data = reviewAccessRequestSchema.parse(body)

    const [existing] = await db.select().from(accessRequests).where(eq(accessRequests.id, requestId)).limit(1)
    if (!existing) return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    if (existing.status !== 'pending') {
      return NextResponse.json({ error: `This request was already ${existing.status}.` }, { status: 400 })
    }

    let inviteSent: boolean | undefined
    if (data.decision === 'approved') {
      const [existingUser] = await db.select({ id: users.id }).from(users).where(eq(users.email, existing.email)).limit(1)
      if (existingUser) {
        return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 400 })
      }

      const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null

      const [created] = await db.insert(users).values({
        name: existing.name,
        email: existing.email,
        role: data.role ?? 'requestor',
        department: existing.department,
        phone: existing.phone,
        passwordHash,
      }).returning({ id: users.id })

      // No admin-set password: email a set-password link. The account is only
      // usable by whoever controls the mailbox, which verifies the address.
      if (!passwordHash) {
        try {
          const token = await issuePasswordToken(created.id, INVITE_TTL_MS)
          await sendPasswordLinkEmail({ to: existing.email, name: existing.name, token, kind: 'invite' })
          inviteSent = true
        } catch (err) {
          console.error('Set-password email failed:', err instanceof Error ? err.message : 'unknown error')
          inviteSent = false
        }
      }
    }

    await db.update(accessRequests).set({
      status: data.decision,
      reviewedById: parseInt(admin.id as string),
      reviewedAt: new Date(),
      reviewNote: data.reviewNote,
    }).where(eq(accessRequests.id, requestId))

    return NextResponse.json({ ok: true, inviteSent })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
