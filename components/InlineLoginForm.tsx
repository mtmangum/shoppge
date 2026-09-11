'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export function InlineLoginForm() {
  const router = useRouter()
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
      setError('Invalid email or password')
      return
    }
    router.push('/jobs')
    router.refresh()
  }

  return (
    <div className="space-y-1.5">
      <form onSubmit={onSubmit} className="flex flex-col sm:flex-row sm:items-end gap-2">
        <div>
          <label htmlFor="inline-login-email" className="block text-xs text-gray-500 mb-1">Email</label>
          <input
            id="inline-login-email"
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="border rounded-md px-2 py-1.5 text-sm w-full sm:w-44 focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
          />
        </div>
        <div>
          <label htmlFor="inline-login-password" className="block text-xs text-gray-500 mb-1">Password</label>
          <input
            id="inline-login-password"
            type="password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="border rounded-md px-2 py-1.5 text-sm w-full sm:w-36 focus:outline-none focus:ring-2 focus:ring-[#BF5700]"
          />
        </div>
        <button
          type="submit"
          disabled={submitting}
          className="shrink-0 bg-[#BF5700] text-white px-5 py-2 rounded-md text-sm font-medium hover:bg-[#a34800] disabled:opacity-50 transition-colors"
        >
          {submitting ? 'Signing in…' : 'Sign In'}
        </button>
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </form>
      <p className="text-xs text-gray-500">
        Need an account?{' '}
        <Link href="/request-access" className="text-[#BF5700] underline">
          Request access
        </Link>
      </p>
    </div>
  )
}
