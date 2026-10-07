/**
 * Sliding-window attempt counter, in memory. State lives in this process only,
 * which is enough for the single-container deployment; move it to the database
 * or Redis before running more than one app instance.
 */

export interface AttemptLimiter {
  /** True when `key` has used up its attempts for the current window. */
  isBlocked(key: string, now?: number): boolean
  record(key: string, now?: number): void
  clear(key: string): void
  reset(): void
}

export function createAttemptLimiter(limit: number, windowMs: number): AttemptLimiter {
  const attempts = new Map<string, number[]>()

  function recent(key: string, now: number): number[] {
    const kept = (attempts.get(key) ?? []).filter(t => now - t < windowMs)
    if (kept.length) attempts.set(key, kept)
    else attempts.delete(key)
    return kept
  }

  return {
    isBlocked: (key, now = Date.now()) => recent(key, now).length >= limit,
    record(key, now = Date.now()) {
      attempts.set(key, [...recent(key, now), now])
    },
    clear: key => { attempts.delete(key) },
    reset: () => attempts.clear(),
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

/** First hop of X-Forwarded-For (set by the reverse proxy), else 'unknown'. */
export function clientIp(headers: { get(name: string): string | null } | undefined): string {
  const forwarded = headers?.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers?.get('x-real-ip')?.trim() || 'unknown'
}
