/**
 * Creates the first admin user. schema.sql seeds no users.
 *
 * Usage:
 *   ADMIN_EMAIL=you@utexas.edu ADMIN_NAME="Your Name" ADMIN_PASSWORD='...' \
 *     npm run db:create-admin
 *
 * Refuses to touch an existing account. Reset an existing user's password
 * from the admin panel or the account settings page instead.
 */

import { db } from '../lib/db'
import { users } from '../lib/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'

const MIN_PASSWORD_LENGTH = 12

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase()
  const name = process.env.ADMIN_NAME?.trim() || 'Admin'
  const password = process.env.ADMIN_PASSWORD

  if (!email || !password) {
    throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (and optionally ADMIN_NAME).')
  }
  if (password.length < MIN_PASSWORD_LENGTH || password.length > 72) {
    throw new Error(`ADMIN_PASSWORD must be ${MIN_PASSWORD_LENGTH}-72 characters.`)
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1)
  if (existing) throw new Error(`An account for ${email} already exists; nothing changed.`)

  const passwordHash = await bcrypt.hash(password, 12)
  await db.insert(users).values({ email, name, role: 'admin', passwordHash })
  console.log(`Created admin ${email}`)
}

main()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err instanceof Error ? err.message : err)
    process.exit(1)
  })
