import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from './db'
import { users } from './schema'
import { eq } from 'drizzle-orm'
import type { UserRole } from './types'
import {
  clientIp,
  isLoginBlocked,
  recordLoginFailure,
  recordLoginSuccess,
} from './login-throttle'

// Compared against when no usable account exists, so a wrong email takes as
// long to reject as a wrong password and response time doesn't reveal which
// emails have accounts.
let dummyHash: string | undefined
function getDummyHash() {
  return (dummyHash ??= bcrypt.hashSync('timing-pad-not-a-password', 12))
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      credentials: {
        email:    { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials, request) {
        if (!credentials?.email || !credentials?.password) return null

        const email = credentials.email as string
        const ip = clientIp(request?.headers)

        // Blocked callers get the same generic failure as a bad password.
        if (isLoginBlocked(email, ip)) return null

        const [user] = await db
          .select()
          .from(users)
          .where(eq(users.email, email))
          .limit(1)

        const usable = !!user && !!user.passwordHash && user.isActive
        const valid = await bcrypt.compare(
          credentials.password as string,
          usable ? user.passwordHash! : getDummyHash()
        )
        if (!usable || !valid) {
          recordLoginFailure(email, ip)
          return null
        }

        recordLoginSuccess(email)
        return {
          id:    String(user.id),
          email: user.email,
          name:  user.name,
          role:  user.role,
        }
      },
    }),

    // --------------------------------------------------------
    // Phase 2: UT Shibboleth SSO
    // Uncomment and configure when ready:
    //
    // import { ShibbolethProfile } from '@auth/core/providers'
    // Shibboleth({
    //   issuer: 'https://idp.utexas.edu/idp/shibboleth',
    //   clientId: process.env.SAML_CLIENT_ID,
    //   clientSecret: process.env.SAML_CLIENT_SECRET,
    //   profile(profile: ShibbolethProfile) {
    //     return {
    //       id: profile.eid,
    //       email: profile.email,
    //       name: profile.displayName,
    //       role: 'requestor', // default; elevate via admin panel
    //     }
    //   },
    // }),
    // --------------------------------------------------------
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id   = user.id
        token.role = (user as any).role
      }
      // Re-read from the DB on every request (not just at sign-in) so a
      // profile edit, role change, or deactivation in the admin panel takes
      // effect immediately instead of waiting out the 8h session maxAge.
      if (token.id) {
        const [dbUser] = await db
          .select({ name: users.name, role: users.role, isActive: users.isActive })
          .from(users)
          .where(eq(users.id, parseInt(token.id as string)))
          .limit(1)

        if (!dbUser || !dbUser.isActive) {
          return { ...token, id: undefined }
        }

        token.name = dbUser.name
        token.role = dbUser.role
      }
      return token
    },
    async session({ session, token }) {
      if (!token.id) {
        // Deactivated (or deleted) since the token was issued — treat as signed out.
        return { ...session, user: undefined as any, expires: session.expires }
      }
      if (session.user) {
        session.user.id   = token.id as string
        session.user.name = token.name as string
        session.user.role = token.role as UserRole
      }
      return session
    },
  },

  pages: {
    signIn: '/login',
  },

  session: {
    strategy: 'jwt',
    maxAge: 8 * 60 * 60, // 8 hours — typical work day
  },
})

// ============================================================
// Role-based auth helpers
// ============================================================
export async function requireAuth() {
  const session = await auth()
  if (!session?.user) throw new Error('Unauthorized')
  return session.user
}

export async function requireMachinist() {
  const user = await requireAuth()
  if (!['machinist', 'admin'].includes(user.role as string)) {
    throw new Error('Forbidden: machinist role required')
  }
  return user
}

export async function requireAdmin() {
  const user = await requireAuth()
  if (user.role !== 'admin') throw new Error('Forbidden: admin role required')
  return user
}

/**
 * Requestors may only access jobs they submitted; machinists/admins can
 * access any job. A plain predicate rather than a throwing assertion since
 * callers respond differently on failure (notFound() on the job detail
 * page, a 403 JSON body from the API routes).
 */
export function isJobOwnerOrElevated(
  user: { id: string; role: string },
  job: { requestorId: number }
): boolean {
  return user.role !== 'requestor' || job.requestorId === parseInt(user.id, 10)
}
