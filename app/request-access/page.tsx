'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function RequestAccessPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [department, setDepartment] = useState('')
  const [phone, setPhone] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/access-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name, email,
          department: department || undefined,
          phone: phone || undefined,
          reason: reason || undefined,
        }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error ?? 'Request failed')
      }
      setSubmitted(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="bg-white rounded-lg border p-8 w-full max-w-sm space-y-4 shadow-sm text-center">
          <h2 className="text-xl font-bold text-gray-900">Request submitted</h2>
          <p className="text-sm text-gray-600">
            Thanks — an admin will review your request. You&apos;ll be able to sign in once it&apos;s approved.
          </p>
          <Link href="/login" className="inline-block text-sm text-[#BF5700] underline">
            ← Back to sign in
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center py-8">
      <form onSubmit={onSubmit} className="bg-white rounded-lg border p-8 w-full max-w-sm space-y-4 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Request Access</h2>
        <p className="text-sm text-gray-500">UT ShopTrack — PGE Instrumentation / Machine Shop</p>

        <div>
          <label htmlFor="access-name" className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            id="access-name"
            required
            value={name}
            onChange={e => setName(e.target.value)}
            className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
          />
        </div>

        <div>
          <label htmlFor="access-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            id="access-email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
          />
        </div>

        <div>
          <label htmlFor="access-department" className="block text-sm font-medium text-gray-700 mb-1">Department</label>
          <input
            id="access-department"
            value={department}
            onChange={e => setDepartment(e.target.value)}
            placeholder="e.g. PGE"
            className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
          />
        </div>

        <div>
          <label htmlFor="access-phone" className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
          <input
            id="access-phone"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
          />
        </div>

        <div>
          <label htmlFor="access-reason" className="block text-sm font-medium text-gray-700 mb-1">
            Why do you need access?
          </label>
          <textarea
            id="access-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            placeholder="e.g. I need to submit machine shop work orders for my research group."
            className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
          />
        </div>

        {error && (
          <p role="alert" className="text-red-500 text-sm bg-red-50 border border-red-200 rounded p-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#BF5700] text-white px-4 py-2 rounded-md font-medium hover:bg-[#a34800] disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Submitting…' : 'Submit Request'}
        </button>

        <p className="text-center text-sm text-gray-500">
          Already have an account?{' '}
          <Link href="/login" className="text-[#BF5700] underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  )
}
