import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { accessRequests, users } from '@/lib/schema'
import { requireAdmin } from '@/lib/auth'
import { createAccessRequestSchema } from '@/lib/types'
import { eq, and, desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  try {
    await requireAdmin()
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status') ?? 'pending'

    const results = await db
      .select()
      .from(accessRequests)
      .where(status === 'all' ? undefined : eq(accessRequests.status, status as any))
      .orderBy(desc(accessRequests.createdAt))

    return NextResponse.json({ requests: results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const data = createAccessRequestSchema.parse(body)

    const [existingUser] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, data.email))
      .limit(1)
    // Answer exactly as for a new request so this public form cannot be used
    // to find out which emails already have accounts or pending requests.
    if (existingUser) return NextResponse.json({ ok: true }, { status: 201 })

    const [existingPending] = await db
      .select({ id: accessRequests.id })
      .from(accessRequests)
      .where(and(eq(accessRequests.email, data.email), eq(accessRequests.status, 'pending')))
      .limit(1)
    if (existingPending) return NextResponse.json({ ok: true }, { status: 201 })

    await db.insert(accessRequests).values({
      name: data.name,
      email: data.email,
      department: data.department,
      phone: data.phone,
      reason: data.reason,
    })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
