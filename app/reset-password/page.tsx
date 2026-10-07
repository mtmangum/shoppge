'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'

export default function ResetPasswordPage() {
  const token = useSearchParams().get('token') ?? ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) {
      setError('The two passwords do not match.')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/password-reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })
      if (!res.ok) {
        const { error } = await res.json().catch(() => ({ error: 'Request failed' }))
        throw new Error(error ?? 'Request failed')
      }
      setDone(true)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="bg-white rounded-lg border p-8 w-full max-w-sm space-y-4 shadow-sm text-center">
          <h2 className="text-xl font-bold text-gray-900">Link not valid</h2>
          <p className="text-sm text-gray-600">This password link is missing its token. Request a new one.</p>
          <Link href="/forgot-password" className="inline-block text-sm text-[#BF5700] underline">Request a new link</Link>
        </div>
      </div>
    )
  }

  if (done) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="bg-white rounded-lg border p-8 w-full max-w-sm space-y-4 shadow-sm text-center">
          <h2 className="text-xl font-bold text-gray-900">Password set</h2>
          <p className="text-sm text-gray-600">You can now sign in with your new password.</p>
          <Link href="/login" className="inline-block text-sm text-[#BF5700] underline">Go to sign in</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form onSubmit={onSubmit} className="bg-white rounded-lg border p-8 w-full max-w-sm space-y-4 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Set your password</h2>
        <p className="text-sm text-gray-500">Use at least 12 characters.</p>

        <div>
          <label htmlFor="reset-password" className="block text-sm font-medium text-gray-700 mb-1">New password</label>
          <input
            id="reset-password"
            type="password"
            required
            minLength={12}
            autoComplete="new-password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
          />
        </div>

        <div>
          <label htmlFor="reset-confirm" className="block text-sm font-medium text-gray-700 mb-1">Confirm password</label>
          <input
            id="reset-confirm"
            type="password"
            required
            autoComplete="new-password"
            value={confirm}
            onChange={e => setConfirm(e.target.value)}
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
          {submitting ? 'Saving…' : 'Set password'}
        </button>
      </form>
    </div>
  )
}
