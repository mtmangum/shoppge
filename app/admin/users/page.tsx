import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { db } from '@/lib/db'
import { users } from '@/lib/schema'
import { asc } from 'drizzle-orm'
import { UsersManager } from '@/components/UsersManager'

export default async function AdminUsersPage() {
  const session = await auth()
  if (!session?.user) redirect('/login')
  if (session.user.role !== 'admin') redirect('/jobs')

  const allUsers = await db
    .select({
      id: users.id,
      email: users.email,
      name: users.name,
      role: users.role,
      department: users.department,
      phone: users.phone,
      room: users.room,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .orderBy(asc(users.name))

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Users</h2>
      <UsersManager
        users={allUsers.map(u => ({ ...u, createdAt: u.createdAt.toISOString() }))}
        currentUserId={parseInt(session.user.id as string)}
      />
    </div>
  )
}
