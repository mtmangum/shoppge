'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { ChevronDown } from 'lucide-react'
import type { UserRole } from '@/lib/types'

interface AccessRequest {
  id: number
  name: string
  email: string
  department: string | null
  phone: string | null
  reason: string | null
  createdAt: string
}

const ROLES: UserRole[] = ['requestor', 'machinist', 'admin']

export function AccessRequestsQueue({ requests }: { requests: AccessRequest[] }) {
  if (requests.length === 0) return null

  return (
    <section className="bg-white rounded-lg border shadow-sm">
      <h3 className="font-semibold text-gray-700 px-6 pt-4 pb-2 border-b">
        Pending Access Requests ({requests.length})
      </h3>
      <ul className="divide-y">
        {requests.map(r => <RequestRow key={r.id} request={r} />)}
      </ul>
    </section>
  )
}

function RequestRow({ request }: { request: AccessRequest }) {
  const router = useRouter()
  const [showApprove, setShowApprove] = useState(false)
  const [role, setRole] = useState<UserRole>('requestor')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function review(decision: 'approved' | 'rejected', extra?: Record<string, unknown>) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/access-requests/${request.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, ...extra }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error ?? 'Request failed')
      }
      router.refresh()
    } catch (e: any) {
      setError(e.message)
      setSubmitting(false)
    }
  }

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault()
    await review('approved', { role, password: password || undefined })
  }

  function handleReject() {
    const confirmed = window.confirm(`Reject the access request from ${request.name} (${request.email})?`)
    if (!confirmed) return
    review('rejected')
  }

  return (
    <li className="px-6 py-4 text-sm space-y-2">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-semibold text-gray-900">{request.name}</p>
          <p className="text-gray-600">{request.email}</p>
          {(request.department || request.phone) && (
            <p className="text-xs text-gray-500 mt-0.5">
              {[request.department, request.phone].filter(Boolean).join(' · ')}
            </p>
          )}
        </div>
        <div className="text-xs text-gray-500 shrink-0">
          {format(new Date(request.createdAt), 'MMM d, yyyy')}
        </div>
      </div>

      {request.reason && (
        <p className="text-gray-700 bg-gray-50 rounded p-2 text-sm">{request.reason}</p>
      )}

      {showApprove ? (
        <form onSubmit={handleApprove} className="flex flex-wrap items-end gap-2 pt-1">
          <div>
            <label htmlFor={`access-role-${request.id}`} className="block text-xs text-gray-500 mb-1">Role</label>
            <div className="relative">
              <select
                id={`access-role-${request.id}`}
                value={role}
                onChange={e => setRole(e.target.value as UserRole)}
                className="border rounded-md px-2 py-1.5 text-sm appearance-none pr-8"
              >
                {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            </div>
          </div>
          <div>
            <label htmlFor={`access-password-${request.id}`} className="block text-xs text-gray-500 mb-1">Password (optional)</label>
            <input
              id={`access-password-${request.id}`}
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="leave blank for SSO-only"
              className="border rounded-md px-2 py-1.5 text-sm"
            />
          </div>
          <button
            type="submit"
            disabled={submitting}
            className="bg-[#BF5700] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#a34800] disabled:opacity-50 transition-colors"
          >
            {submitting ? 'Approving…' : 'Confirm Approval'}
          </button>
          <button
            type="button"
            onClick={() => setShowApprove(false)}
            className="text-sm text-gray-500 hover:underline"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex items-center gap-3 pt-1">
          <button
            onClick={() => setShowApprove(true)}
            disabled={submitting}
            className="bg-[#BF5700] text-white px-3 py-1.5 rounded-md text-sm font-medium hover:bg-[#a34800] disabled:opacity-50 transition-colors"
          >
            Approve
          </button>
          <button
            onClick={handleReject}
            disabled={submitting}
            className="px-3 py-1.5 rounded-md border text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      )}
      {error && <p role="alert" className="text-red-500 text-xs">{error}</p>}
    </li>
  )
}
