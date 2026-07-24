import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Toaster } from '@/components/ui/Toaster'
import { auth } from '@/lib/auth'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'ShopTrack | PGE Instrumentation & Machine Shop',
  description: 'Work order management for the UT Austin PGE Machine Shop',
}

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  return (
    <html lang="en">
      <body className={inter.className}>
        <div className="min-h-screen bg-gray-50 overflow-x-hidden">
          <header className="bg-[#BF5700] text-white">
            {/* UT Austin burnt orange header */}
            <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div>
                <p className="text-xs font-medium opacity-80">
                  Cockrell School of Engineering · Petroleum & Geosystems Engineering
                </p>
                <h1 className="text-xl font-bold tracking-tight">
                  ShopTrack
                </h1>
                <p className="text-xs opacity-90">
                  Submit, track, and manage Instrumentation &amp; Machine Shop work orders
                </p>
              </div>
              <img
                src="/ut_logo.svg"
                alt="The University of Texas at Austin"
                className="h-[34px] shrink-0"
              />
            </div>
          </header>

          {session?.user && <Navbar user={session.user} />}

          <main className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>

          <footer className="mt-12 border-t bg-white text-center text-xs text-gray-500 py-4 space-x-4">
            <a href="http://www.engr.utexas.edu/fic" className="hover:underline">Faculty Innovation Center</a>
            <a href="http://www.pge.utexas.edu/" className="hover:underline">PGE Department</a>
            <a href="http://www.utexas.edu/policies/privacy/" className="hover:underline">Privacy</a>
            <a href="http://www.utexas.edu/disability" className="hover:underline">Accessibility</a>
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  )
}
