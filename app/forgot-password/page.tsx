'use client'

import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/password-reset/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
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

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      {submitted ? (
        <div className="bg-white rounded-lg border p-8 w-full max-w-sm space-y-4 shadow-sm text-center">
          <h2 className="text-xl font-bold text-gray-900">Check your email</h2>
          <p className="text-sm text-gray-600">
            If an active account exists for that address, we&apos;ve sent a link to reset the password.
            The link works once and expires in 1 hour.
          </p>
          <Link href="/login" className="inline-block text-sm text-[#BF5700] underline">
            ← Back to sign in
          </Link>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="bg-white rounded-lg border p-8 w-full max-w-sm space-y-4 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">Forgot password</h2>
          <p className="text-sm text-gray-500">Enter your account email and we&apos;ll send you a reset link.</p>

          <div>
            <label htmlFor="forgot-email" className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              id="forgot-email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
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
            {submitting ? 'Sending…' : 'Send reset link'}
          </button>

          <p className="text-center text-sm text-gray-500">
            <Link href="/login" className="text-[#BF5700] underline">Back to sign in</Link>
          </p>
        </form>
      )}
    </div>
  )
}
