'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/types'
import { Plus } from 'lucide-react'

interface ManagedUser {
  id: number
  email: string
  name: string
  role: UserRole
  department: string | null
  phone: string | null
  room: string | null
  isActive: boolean
  createdAt: string
}

const ROLES: UserRole[] = ['requestor', 'machinist', 'admin']

export function UsersManager({ users, currentUserId }: { users: ManagedUser[]; currentUserId: number }) {
  const router = useRouter()
  const [showCreate, setShowCreate] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
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

      <div className="rounded-lg border bg-white overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-700 text-white">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Name</th>
              <th className="px-4 py-3 text-left font-medium">Email</th>
              <th className="px-4 py-3 text-left font-medium">Role</th>
              <th className="px-4 py-3 text-left font-medium">Department</th>
              <th className="px-4 py-3 text-left font-medium">Status</th>
              <th className="px-4 py-3 text-left font-medium">Password</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {users.map((u, i) => (
              <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} rowBg={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} />
            ))}
          </tbody>
        </table>
      </div>
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
        <label className="block text-xs text-gray-500 mb-1">Name</label>
        <input required value={name} onChange={e => setName(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Email</label>
        <input required type="email" value={email} onChange={e => setEmail(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Role</label>
        <select value={role} onChange={e => setRole(e.target.value as UserRole)} className="border rounded-md px-2 py-1.5 text-sm w-full">
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Department</label>
        <input value={department} onChange={e => setDepartment(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
      </div>
      <div>
        <label className="block text-xs text-gray-500 mb-1">Password (optional)</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="leave blank for SSO-only" className="border rounded-md px-2 py-1.5 text-sm w-full" />
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

function UserRow({ user, isSelf, rowBg }: { user: ManagedUser; isSelf: boolean; rowBg: string }) {
  const router = useRouter()
  const [role, setRole] = useState<UserRole>(user.role)
  const [isActive, setIsActive] = useState(user.isActive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [showPasswordField, setShowPasswordField] = useState(false)
  const [newPassword, setNewPassword] = useState('')
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordSaved, setPasswordSaved] = useState(false)

  async function patchUser(body: Record<string, unknown>) {
    const res = await fetch(`/api/users/${user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: 'Request failed' }))
      throw new Error(error ?? 'Request failed')
    }
  }

  async function handleRoleChange(nextRole: UserRole) {
    setRole(nextRole)
    setSaving(true)
    setError(null)
    try {
      await patchUser({ role: nextRole })
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      setRole(user.role)
    } finally {
      setSaving(false)
    }
  }

  async function handleActiveToggle() {
    const next = !isActive
    setIsActive(next)
    setSaving(true)
    setError(null)
    try {
      await patchUser({ isActive: next })
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      setIsActive(!next)
    } finally {
      setSaving(false)
    }
  }

  async function handleSetPassword(e: React.FormEvent) {
    e.preventDefault()
    setPasswordSaving(true)
    setError(null)
    setPasswordSaved(false)
    try {
      await patchUser({ password: newPassword })
      setPasswordSaved(true)
      setNewPassword('')
      router.refresh()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setPasswordSaving(false)
    }
  }

  return (
    <tr className={rowBg}>
      <td className="px-4 py-3">{user.name}{isSelf && <span className="text-gray-400 text-xs ml-1">(you)</span>}</td>
      <td className="px-4 py-3">{user.email}</td>
      <td className="px-4 py-3">
        <select
          value={role}
          disabled={saving || isSelf}
          onChange={e => handleRoleChange(e.target.value as UserRole)}
          className="border rounded px-2 py-1 text-sm disabled:opacity-50"
        >
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </td>
      <td className="px-4 py-3">{user.department || '—'}</td>
      <td className="px-4 py-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={isActive}
            disabled={saving || isSelf}
            onChange={handleActiveToggle}
            className="rounded disabled:opacity-50"
          />
          {isActive ? 'Active' : 'Inactive'}
        </label>
      </td>
      <td className="px-4 py-3">
        {showPasswordField ? (
          <form onSubmit={handleSetPassword} className="flex items-center gap-1">
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={e => { setNewPassword(e.target.value); setPasswordSaved(false) }}
              placeholder="new password"
              className="border rounded px-2 py-1 text-sm w-32"
            />
            <button type="submit" disabled={passwordSaving} className="text-xs text-[#BF5700] hover:underline disabled:opacity-50">
              {passwordSaving ? 'Saving…' : 'Save'}
            </button>
            <button type="button" onClick={() => setShowPasswordField(false)} className="text-xs text-gray-400 hover:underline">
              Cancel
            </button>
          </form>
        ) : (
          <button onClick={() => setShowPasswordField(true)} className="text-xs text-[#BF5700] hover:underline">
            {passwordSaved ? 'Saved ✓ — reset again' : 'Reset password'}
          </button>
        )}
        {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
      </td>
    </tr>
  )
}
