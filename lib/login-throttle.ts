/**
 * Caps failed sign-in attempts per email and per client IP within a sliding
 * window (see attempt-limiter.ts for the single-instance caveat).
 *
 * Locking an email also locks the real user out for the window if someone
 * else keeps guessing their address. That trade-off is intentional.
 */

import { createAttemptLimiter, normalizeEmail } from '@/lib/attempt-limiter'

export { clientIp } from '@/lib/attempt-limiter'

export const MAX_FAILURES_PER_EMAIL = 5
export const MAX_FAILURES_PER_IP = 30
export const WINDOW_MS = 15 * 60 * 1000

const byEmail = createAttemptLimiter(MAX_FAILURES_PER_EMAIL, WINDOW_MS)
const byIp = createAttemptLimiter(MAX_FAILURES_PER_IP, WINDOW_MS)

/** True when this email or IP has used up its failed attempts for the window. */
export function isLoginBlocked(email: string, ip: string, now = Date.now()): boolean {
  return byEmail.isBlocked(normalizeEmail(email), now) || byIp.isBlocked(ip, now)
}

export function recordLoginFailure(email: string, ip: string, now = Date.now()): void {
  byEmail.record(normalizeEmail(email), now)
  byIp.record(ip, now)
}

/** A good login clears the email's counter. The IP's counter keeps counting. */
export function recordLoginSuccess(email: string): void {
  byEmail.clear(normalizeEmail(email))
}

/** Used after a password reset so the owner isn't left locked out. */
export function clearLoginFailures(email: string): void {
  byEmail.clear(normalizeEmail(email))
}

/** Test helper: forget all recorded attempts. */
export function resetLoginThrottle(): void {
  byEmail.reset()
  byIp.reset()
}
