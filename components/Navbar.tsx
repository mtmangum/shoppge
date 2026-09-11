'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { UserRole } from '@/lib/types'
import clsx from 'clsx'

interface NavbarProps {
  user: { name?: string | null; email?: string | null; role?: string | null }
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const role = user.role as UserRole
  const onJobs = pathname === '/jobs'
  const mine = onJobs && searchParams.get('mine') === '1'
  const assigned = onJobs && searchParams.get('assigned') === '1'

  const links = [
    { href: '/admin',      label: 'Dashboard',       roles: ['admin'], active: pathname === '/admin' },
    { href: '/jobs',       label: 'Open Jobs',      roles: ['requestor', 'machinist', 'admin'], active: onJobs && !mine && !assigned },
    { href: '/jobs?mine=1', label: 'My Jobs',        roles: ['requestor'], active: mine },
    { href: '/jobs?assigned=1', label: 'Assigned to Me', roles: ['machinist', 'admin'], active: assigned },
    { href: '/jobs/new',   label: 'Submit Job',      roles: ['requestor', 'machinist', 'admin'], active: pathname === '/jobs/new' },
    { href: '/admin/users', label: 'Users',          roles: ['admin'], active: pathname === '/admin/users' },
    { href: '/admin/activity', label: 'Activity',    roles: ['admin'], active: pathname === '/admin/activity' },
  ].filter(l => l.roles.includes(role))

  return (
    <nav className="bg-white border-b shadow-sm">
      <div className="max-w-7xl mx-auto px-4 py-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 overflow-x-auto">
          {links.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                'px-3 py-1.5 rounded text-sm font-medium transition-colors whitespace-nowrap shrink-0',
                link.active
                  ? 'bg-[#BF5700] text-white'
                  : 'text-gray-700 hover:bg-gray-100'
              )}
            >
              {link.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-3 text-sm text-gray-600 shrink-0">
          <span>{user.name}</span>
          <button
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="text-gray-500 hover:text-gray-800"
          >
            Sign out
          </button>
        </div>
      </div>
    </nav>
  )
}
