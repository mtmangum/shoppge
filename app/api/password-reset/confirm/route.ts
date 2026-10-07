import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { newPasswordSchema } from '@/lib/password-policy'
import { redeemPasswordToken } from '@/lib/password-reset'
import { clearLoginFailures } from '@/lib/login-throttle'
import { clientIp, createAttemptLimiter } from '@/lib/attempt-limiter'

const byIp = createAttemptLimiter(20, 15 * 60 * 1000)

const bodySchema = z.object({
  token: z.string().min(20).max(200),
  password: newPasswordSchema,
}).strict()

export async function POST(req: NextRequest) {
  const ip = clientIp(req.headers)
  if (byIp.isBlocked(ip)) {
    return NextResponse.json({ error: 'Too many attempts. Wait a few minutes and try again.' }, { status: 429 })
  }
  byIp.record(ip)

  const parsed = bodySchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid request.' }, { status: 400 })
  }

  try {
    const result = await redeemPasswordToken(parsed.data.token, parsed.data.password)
    if (!result.ok) {
      return NextResponse.json({ error: 'This link is invalid or has expired. Request a new one.' }, { status: 400 })
    }
    // The owner just proved control of the mailbox; don't leave them throttled.
    clearLoginFailures(result.email)
    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Could not set your password. Please try again.' }, { status: 500 })
  }
}
