import { auth } from '@/lib/auth'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { AccountSettings } from '@/components/account/AccountSettings'
import { parseTheme, THEME_COOKIE } from '@/lib/account-settings'

export default async function SettingsPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  const [account] = await db.select({
    name: users.name, email: users.email, role: users.role,
    department: users.department, phone: users.phone, room: users.room,
  }).from(users).where(eq(users.id, Number(session.user.id))).limit(1)
  if (!account) redirect('/login')

  return <AccountSettings account={account} initialTheme={parseTheme(cookies().get(THEME_COOKIE)?.value)} />
}
