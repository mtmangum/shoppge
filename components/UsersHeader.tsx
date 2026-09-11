'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/types'
import { Plus, ChevronDown } from 'lucide-react'

const ROLES: UserRole[] = ['requestor', 'machinist', 'admin']

export function UsersHeader() {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Users</h2>
        <button
          onClick={() => setShowCreate(v => !v)}
          className="flex items-center gap-1 bg-[#BF5700] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#a34800] transition-colors"
        >
          <Plus className="h-4 w-4" /> {showCreate ? 'Cancel' : 'New User'}
        </button>
      </div>

      {showCreate && (
        <CreateUserForm onCreated={() => { setShowCreate(false); router.refresh() }} />
      )}
    </div>
  )
}

function CreateUserForm({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('requestor')
  const [department, setDepartment] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, role, department: department || undefined, password: password || undefined }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error ?? 'Request failed')
      }
      onCreated()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="bg-white rounded-lg border p-4 grid grid-cols-2 sm:grid-cols-5 gap-3 items-end">
      <div>
        <label htmlFor="new-user-name" className="block text-xs text-gray-500 mb-1">Name</label>
        <input id="new-user-name" required value={name} onChange={e => setName(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
      </div>
      <div>
        <label htmlFor="new-user-email" className="block text-xs text-gray-500 mb-1">Email</label>
        <input id="new-user-email" required type="email" value={email} onChange={e => setEmail(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
      </div>
      <div>
        <label htmlFor="new-user-role" className="block text-xs text-gray-500 mb-1">Role</label>
        <div className="relative w-full">
          <select id="new-user-role" value={role} onChange={e => setRole(e.target.value as UserRole)} className="border rounded-md px-2 py-1.5 text-sm w-full appearance-none pr-8">
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
        </div>
      </div>
      <div>
        <label htmlFor="new-user-department" className="block text-xs text-gray-500 mb-1">Department</label>
        <input id="new-user-department" value={department} onChange={e => setDepartment(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
      </div>
      <div>
        <label htmlFor="new-user-password" className="block text-xs text-gray-500 mb-1">Password (optional)</label>
        <input id="new-user-password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="leave blank for SSO-only" className="border rounded-md px-2 py-1.5 text-sm w-full" />
      </div>
      <div className="col-span-2 sm:col-span-5 flex items-center gap-3">
        <button type="submit" disabled={submitting} className="bg-[#BF5700] text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-[#a34800] disabled:opacity-50 transition-colors">
          {submitting ? 'Creating…' : 'Create User'}
        </button>
        {error && <p className="text-red-500 text-xs">{error}</p>}
      </div>
    </form>
  )
}
