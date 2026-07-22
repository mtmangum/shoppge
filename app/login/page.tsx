'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    const res = await signIn('credentials', { email, password, redirect: false })
    setSubmitting(false)
    if (res?.error) {
      setError('Invalid email or password.')
      return
    }
    router.push(searchParams.get('callbackUrl') || '/jobs')
    router.refresh()
  }

  return (
    <div className="min-h-[70vh] flex items-center justify-center">
      <form onSubmit={onSubmit} className="bg-white rounded-lg border p-8 w-full max-w-sm space-y-4 shadow-sm">
        <h2 className="text-xl font-bold text-gray-900">Sign In</h2>
        <p className="text-sm text-gray-500">PGE Instrumentation / Machine Shop</p>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="border rounded-md px-3 py-2 w-full text-sm focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
          />
        </div>

        {error && (
          <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded p-2">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full bg-[#BF5700] text-white px-4 py-2 rounded-md font-medium hover:bg-[#a34800] disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}
