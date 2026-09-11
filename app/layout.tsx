import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import { Cog } from 'lucide-react'
import { Suspense } from 'react'
import './globals.css'
import { Navbar } from '@/components/Navbar'
import { Toaster } from '@/components/ui/Toaster'
import { auth } from '@/lib/auth'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'UT ShopTrack | PGE Instrumentation & Machine Shop',
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
              <div className="flex items-center gap-2">
                <Cog className="h-11 w-11 shrink-0" aria-hidden="true" />
                <div>
                  <h1 className="text-xl font-bold tracking-tight">
                    UT ShopTrack
                  </h1>
                  <p className="text-xs opacity-90">
                    Submit, track, and manage Instrumentation &amp; Machine Shop work orders
                  </p>
                </div>
              </div>
              <img
                src="/ut_logo.svg"
                alt="The University of Texas at Austin"
                className="h-[34px] shrink-0 hidden sm:block"
              />
            </div>
          </header>

          {session?.user && (
            <Suspense fallback={null}>
              <Navbar user={session.user} />
            </Suspense>
          )}

          <main className="max-w-7xl mx-auto px-4 py-6">
            {children}
          </main>

          <footer className="mt-12 border-t bg-white text-center text-xs text-gray-500 py-4">
            <p className="mb-2">
              <a href="https://cockrell.utexas.edu" className="hover:underline">Cockrell School of Engineering</a>
              {' · '}
              <a href="https://pge.utexas.edu" className="hover:underline">Petroleum &amp; Geosystems Engineering</a>
            </p>
            <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
              <a href="https://emergency.utexas.edu/" className="hover:underline">Emergency Information</a>
              <a href="https://www.utexas.edu/site-policies" className="hover:underline">Site Policies</a>
              <a href="http://www.utexas.edu/web-accessibility-policy" className="hover:underline">Web Accessibility Policy</a>
              <a href="http://www.utexas.edu/web-privacy-policy" className="hover:underline">Web Privacy Policy</a>
            </div>
            <p className="mt-2">&copy; {new Date().getFullYear()} <a href="https://www.utexas.edu" className="hover:underline">The University of Texas at Austin</a></p>
          </footer>
        </div>
        <Toaster />
      </body>
    </html>
  )
}
