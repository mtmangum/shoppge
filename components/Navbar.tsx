'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut } from 'next-auth/react'
import type { UserRole } from '@/lib/types'
import clsx from 'clsx'

interface NavbarProps {
  user: { name?: string | null; email?: string | null; role?: string | null }
}

export function Navbar({ user }: NavbarProps) {
  const pathname = usePathname()
  const role = user.role as UserRole

  const links = [
    { href: '/admin',      label: 'Dashboard',       roles: ['admin'] },
    { href: '/jobs',       label: 'Open Jobs',      roles: ['requestor', 'machinist', 'admin'] },
    { href: '/jobs/new',   label: 'Submit Job',      roles: ['requestor', 'machinist', 'admin'] },
    { href: '/admin/users', label: 'Users',          roles: ['admin'] },
    { href: '/admin/activity', label: 'Activity',    roles: ['admin'] },
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
                pathname === link.href
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
