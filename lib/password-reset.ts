/**
 * Password reset / set-password links. A link carries a random 256-bit token;
 * only its SHA-256 is stored, so a database leak does not yield usable links.
 * Tokens are single-use and expire. Issuing a new token voids older ones.
 */

import { createHash, randomBytes } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { passwordResetTokens, users } from '@/lib/schema'

export const RESET_TTL_MS = 60 * 60 * 1000              // "forgot password" links
export const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000    // new-account "set your password" links

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** Creates a link token for `userId`, voiding any earlier unused ones. */
export async function issuePasswordToken(userId: number, ttlMs: number): Promise<string> {
  const token = randomBytes(32).toString('base64url')
  const now = new Date()
  await db.update(passwordResetTokens).set({ usedAt: now })
    .where(and(eq(passwordResetTokens.userId, userId), isNull(passwordResetTokens.usedAt)))
  await db.insert(passwordResetTokens).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt: new Date(now.getTime() + ttlMs),
  })
  return token
}

export type RedeemResult = { ok: true; email: string } | { ok: false }

/** Spends `token` and sets the account's password. Fails closed on any problem. */
export async function redeemPasswordToken(token: string, newPassword: string): Promise<RedeemResult> {
  const now = new Date()
  const passwordHash = await bcrypt.hash(newPassword, 12)

  // Claim the token atomically so two concurrent requests cannot both use it.
  const [claimed] = await db.update(passwordResetTokens).set({ usedAt: now })
    .where(and(
      eq(passwordResetTokens.tokenHash, hashToken(token)),
      isNull(passwordResetTokens.usedAt),
      gt(passwordResetTokens.expiresAt, now),
    ))
    .returning({ userId: passwordResetTokens.userId })
  if (!claimed) return { ok: false }

  const [user] = await db.update(users).set({ passwordHash, updatedAt: now })
    .where(and(eq(users.id, claimed.userId), eq(users.isActive, true)))
    .returning({ email: users.email })
  if (!user) return { ok: false }

  await db.update(passwordResetTokens).set({ usedAt: now })
    .where(and(eq(passwordResetTokens.userId, claimed.userId), isNull(passwordResetTokens.usedAt)))
  return { ok: true, email: user.email }
}
