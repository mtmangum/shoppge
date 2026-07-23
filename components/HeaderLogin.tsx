'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export function HeaderLogin() {
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
    <form onSubmit={onSubmit} className="flex items-end gap-2">
      <div>
        <label className="block text-[10px] uppercase tracking-wide opacity-80 mb-0.5">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="bg-white/10 border border-white/30 placeholder-white/60 rounded px-2 py-1 text-sm w-40 focus:outline-none focus:ring-2 focus:ring-white/60"
        />
      </div>
      <div>
        <label className="block text-[10px] uppercase tracking-wide opacity-80 mb-0.5">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="bg-white/10 border border-white/30 placeholder-white/60 rounded px-2 py-1 text-sm w-32 focus:outline-none focus:ring-2 focus:ring-white/60"
        />
      </div>
      <button
        type="submit"
        disabled={submitting}
        className="bg-white text-[#BF5700] px-3 py-1 rounded text-sm font-semibold hover:bg-gray-100 disabled:opacity-50 transition-colors"
      >
        {submitting ? 'Signing in…' : 'Sign In'}
      </button>
      {error && <p className="text-xs text-white bg-red-600/80 rounded px-2 py-1">{error}</p>}
    </form>
  )
}
