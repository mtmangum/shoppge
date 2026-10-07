import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { requireAdmin } from '@/lib/auth'
import { createUserSchema } from '@/lib/types'
import { asc } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { sendPasswordLinkEmail } from '@/lib/mail'
import { INVITE_TTL_MS, issuePasswordToken } from '@/lib/password-reset'

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

export async function GET() {
  try {
    await requireAdmin()
    const results = await db.select(SAFE_COLUMNS).from(users).orderBy(asc(users.name))
    return NextResponse.json({ users: results })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 401 })
  }
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin()
    const body = await req.json()
    const data = createUserSchema.parse(body)

    const passwordHash = data.password ? await bcrypt.hash(data.password, 12) : null

    const [user] = await db.insert(users).values({
      name: data.name,
      email: data.email,
      role: data.role,
      department: data.department,
      phone: data.phone,
      room: data.room,
      passwordHash,
    }).returning(SAFE_COLUMNS)

    // No password given: email the new user a link to set their own.
    let inviteSent: boolean | undefined
    if (!passwordHash) {
      try {
        const token = await issuePasswordToken(user.id, INVITE_TTL_MS)
        await sendPasswordLinkEmail({ to: user.email, name: user.name, token, kind: 'invite' })
        inviteSent = true
      } catch (err) {
        console.error('Set-password email failed:', err instanceof Error ? err.message : 'unknown error')
        inviteSent = false
      }
    }

    return NextResponse.json({ user, inviteSent }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 400 })
  }
}
