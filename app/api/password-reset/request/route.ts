import { NextRequest, NextResponse } from 'next/server'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { sendPasswordLinkEmail } from '@/lib/mail'
import { issuePasswordToken, RESET_TTL_MS } from '@/lib/password-reset'
import { clientIp, createAttemptLimiter, normalizeEmail } from '@/lib/attempt-limiter'

const HOUR_MS = 60 * 60 * 1000
const byEmail = createAttemptLimiter(3, HOUR_MS)
const byIp = createAttemptLimiter(10, HOUR_MS)

const bodySchema = z.object({ email: z.string().trim().email().max(255) }).strict()

// Same answer whether or not the address has an account, is rate limited, or
// the mail fails, so this endpoint cannot be used to discover accounts.
const ACCEPTED = { ok: true }

async function sendLink(email: string) {
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email })
    .from(users)
    .where(and(eq(users.email, email), eq(users.isActive, true)))
    .limit(1)
  if (!user) return
  const token = await issuePasswordToken(user.id, RESET_TTL_MS)
  await sendPasswordLinkEmail({ to: user.email, name: user.name, token, kind: 'reset' })
}

export async function POST(req: NextRequest) {
  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })

  const email = parsed.data.email
  const key = normalizeEmail(email)
  const ip = clientIp(req.headers)

  const limited = byEmail.isBlocked(key) || byIp.isBlocked(ip)
  byEmail.record(key)
  byIp.record(ip)

  // Detached so response time does not depend on whether an account exists.
  if (!limited) {
    sendLink(email).catch(err => console.error('Password reset email failed:', err instanceof Error ? err.message : 'unknown error'))
  }
  return NextResponse.json(ACCEPTED)
}
