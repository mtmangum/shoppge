import { sql, asc, desc } from 'drizzle-orm'
import { jobs } from './schema'

/** Days since a job was entered — used for queue-age badges/sorting. */
export const daysInQueueSql = sql<number>`CURRENT_DATE - ${jobs.entryDate}`

/**
 * Days past a job's requested due date. Distinct from daysInQueueSql: a job
 * entered 20 days ago but not due for another month isn't overdue.
 */
export const daysOverdueSql = sql<number>`CURRENT_DATE - ${jobs.dateRequired}`

/**
 * Validates a `?sort=` search param against a page's column map, falling
 * back to a default when it's missing or not a recognized key.
 */
export function resolveSortKey<T extends Record<string, unknown>, F extends keyof T & string>(
  columns: T,
  requested: string | undefined,
  fallback: F
): keyof T & string {
  return requested !== undefined && Object.prototype.hasOwnProperty.call(columns, requested)
    ? (requested as keyof T & string)
    : fallback
}

/** Validates a `?dir=` search param, defaulting to descending. */
export function resolveSortDir(dir: string | undefined): 'asc' | 'desc' {
  return dir === 'asc' ? 'asc' : 'desc'
}

/** The Drizzle order-by function matching a resolved sort direction. */
export function sortOrderFn(dir: 'asc' | 'desc') {
  return dir === 'asc' ? asc : desc
}
