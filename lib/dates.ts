import { format, parseISO } from 'date-fns'

/**
 * Formats a date-only DB column (entry_date, date_required, date_completed).
 * Uses parseISO rather than `new Date()` since a bare 'YYYY-MM-DD' string
 * parses as UTC midnight under `new Date()`, which renders a day early in
 * any negative-UTC-offset timezone once date-fns formats it locally.
 */
export function formatDateOnly(value?: string | null): string {
  if (!value) return '—'
  return format(parseISO(value), 'MMM d, yyyy')
}

/** Formats a full timestamp column (e.g. job_status_history.changed_at). */
export function formatTimestamp(value: string | Date): string {
  return format(new Date(value), 'MMM d, yyyy h:mm a')
}
