'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { UserRole } from '@/lib/types'
import { Pencil, Trash2, ChevronDown } from 'lucide-react'

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
  return (
    <div className="rounded-lg border bg-white shadow-sm overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-700 text-white">
          <tr>
            <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Name</th>
            <th className="px-4 py-3 text-left font-medium whitespace-nowrap hidden md:table-cell">Email</th>
            <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Role</th>
            <th className="px-4 py-3 text-left font-medium whitespace-nowrap hidden md:table-cell">Department</th>
            <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Status</th>
            <th className="px-4 py-3 text-left font-medium whitespace-nowrap">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y">
          {users.map((u, i) => (
            <UserRow key={u.id} user={u} isSelf={u.id === currentUserId} rowBg={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function UserRow({ user, isSelf, rowBg }: { user: ManagedUser; isSelf: boolean; rowBg: string }) {
  const router = useRouter()
  const [role, setRole] = useState<UserRole>(user.role)
  const [isActive, setIsActive] = useState(user.isActive)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [editing, setEditing] = useState(false)
  const [editName, setEditName] = useState(user.name)
  const [editEmail, setEditEmail] = useState(user.email)
  const [editDepartment, setEditDepartment] = useState(user.department ?? '')
  const [editPhone, setEditPhone] = useState(user.phone ?? '')
  const [editRoom, setEditRoom] = useState(user.room ?? '')
  const [editPassword, setEditPassword] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [editSaved, setEditSaved] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState(user.name)
  const [displayEmail, setDisplayEmail] = useState(user.email)
  const [displayDepartment, setDisplayDepartment] = useState(user.department)

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

  async function handleEditSave(e: React.FormEvent) {
    e.preventDefault()
    setEditSaving(true)
    setEditError(null)
    setEditSaved(false)
    try {
      await patchUser({
        name: editName,
        email: editEmail,
        department: editDepartment,
        phone: editPhone,
        room: editRoom,
        ...(editPassword ? { password: editPassword } : {}),
      })
      setDisplayName(editName)
      setDisplayEmail(editEmail)
      setDisplayDepartment(editDepartment || null)
      setEditPassword('')
      setEditSaved(true)
      router.refresh()
    } catch (e: any) {
      setEditError(e.message)
    } finally {
      setEditSaving(false)
    }
  }

  async function handleDelete() {
    const confirmed = window.confirm(
      `Delete ${displayName} (${displayEmail}) permanently? This cannot be undone.`
    )
    if (!confirmed) return

    setDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(`/api/users/${user.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Delete failed' }))
        throw new Error(error ?? 'Delete failed')
      }
      router.refresh()
    } catch (e: any) {
      setDeleteError(e.message)
      setDeleting(false)
    }
  }

  return (
    <>
    <tr className={rowBg} style={deleting ? { opacity: 0.5 } : undefined}>
      <td className="px-4 py-3">{displayName}{isSelf && <span className="text-gray-500 text-xs ml-1">(you)</span>}</td>
      <td className="px-4 py-3 hidden md:table-cell">{displayEmail}</td>
      <td className="px-4 py-3">
        <div className="relative inline-block">
          <select
            value={role}
            disabled={saving || isSelf}
            onChange={e => handleRoleChange(e.target.value as UserRole)}
            aria-label={`Role for ${displayName}`}
            className="border rounded px-2 py-1 text-sm appearance-none pr-7 disabled:opacity-50"
          >
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <ChevronDown className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-500" />
        </div>
      </td>
      <td className="px-4 py-3 hidden md:table-cell">{displayDepartment || '—'}</td>
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
        {error && <p role="alert" className="text-red-500 text-xs mt-1">{error}</p>}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setEditing(v => !v)}
            className="text-gray-400 hover:text-[#BF5700]"
            aria-label={`Edit ${displayName}`}
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={handleDelete}
            disabled={isSelf || deleting}
            className="text-gray-400 hover:text-red-600 disabled:opacity-30 disabled:hover:text-gray-400"
            aria-label={`Delete ${displayName}`}
            title={isSelf ? "You can't delete your own account" : 'Delete user'}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        {deleteError && <p role="alert" className="text-red-500 text-xs mt-1 max-w-xs">{deleteError}</p>}
      </td>
    </tr>
    {editing && (
      <tr className={rowBg}>
        <td colSpan={6} className="px-4 py-4 border-t-0">
          <form onSubmit={handleEditSave} className="bg-gray-50 rounded-md border p-4 grid grid-cols-2 sm:grid-cols-6 gap-3 items-end">
            <div>
              <label htmlFor={`edit-name-${user.id}`} className="block text-xs text-gray-500 mb-1">Name</label>
              <input id={`edit-name-${user.id}`} required value={editName} onChange={e => setEditName(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
            </div>
            <div>
              <label htmlFor={`edit-email-${user.id}`} className="block text-xs text-gray-500 mb-1">Email</label>
              <input id={`edit-email-${user.id}`} required type="email" value={editEmail} onChange={e => setEditEmail(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
            </div>
            <div>
              <label htmlFor={`edit-department-${user.id}`} className="block text-xs text-gray-500 mb-1">Department</label>
              <input id={`edit-department-${user.id}`} value={editDepartment} onChange={e => setEditDepartment(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
            </div>
            <div>
              <label htmlFor={`edit-phone-${user.id}`} className="block text-xs text-gray-500 mb-1">Phone</label>
              <input id={`edit-phone-${user.id}`} value={editPhone} onChange={e => setEditPhone(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
            </div>
            <div>
              <label htmlFor={`edit-room-${user.id}`} className="block text-xs text-gray-500 mb-1">Room</label>
              <input id={`edit-room-${user.id}`} value={editRoom} onChange={e => setEditRoom(e.target.value)} className="border rounded-md px-2 py-1.5 text-sm w-full" />
            </div>
            <div>
              <label htmlFor={`edit-password-${user.id}`} className="block text-xs text-gray-500 mb-1">New Password</label>
              <input
                id={`edit-password-${user.id}`}
                type="password"
                value={editPassword}
                minLength={8}
                onChange={e => { setEditPassword(e.target.value); setEditSaved(false) }}
                placeholder="leave blank to keep"
                className="border rounded-md px-2 py-1.5 text-sm w-full"
              />
            </div>
            <div className="col-span-2 sm:col-span-6 flex items-center gap-3">
              <button type="submit" disabled={editSaving} className="bg-[#BF5700] text-white px-4 py-1.5 rounded-md text-sm font-medium hover:bg-[#a34800] disabled:opacity-50 transition-colors">
                {editSaving ? 'Saving…' : editSaved ? 'Saved ✓' : 'Save'}
              </button>
              <button type="button" onClick={() => setEditing(false)} className="text-sm text-gray-500 hover:underline">
                Cancel
              </button>
              {editError && <p role="alert" className="text-red-500 text-xs">{editError}</p>}
            </div>
          </form>
        </td>
      </tr>
    )}
    </>
  )
}
