import Link from 'next/link'

interface PaginationProps {
  page: number
  totalPages: number
  getHref: (targetPage: number) => string
  total?: number
}

/**
 * Prev/Next pager. Renders an inert <span> (not a <Link>) when a direction
 * is disabled — pointer-events-none alone still leaves a <Link> focusable
 * and announced as active by keyboard/screen readers despite looking
 * disabled, so a real element swap is needed, not just a style change.
 */
export function Pagination({ page, totalPages, getHref, total }: PaginationProps) {
  return (
    <div className="flex items-center justify-between text-sm text-gray-600">
      <span>Page {page} of {totalPages}{total !== undefined ? ` · ${total} total` : ''}</span>
      <div className="flex gap-2">
        {page <= 1 ? (
          <span className="px-3 py-1 border rounded opacity-40" aria-disabled="true">Previous</span>
        ) : (
          <Link href={getHref(page - 1)} className="px-3 py-1 border rounded hover:bg-gray-50">
            Previous
          </Link>
        )}
        {page >= totalPages ? (
          <span className="px-3 py-1 border rounded opacity-40" aria-disabled="true">Next</span>
        ) : (
          <Link href={getHref(page + 1)} className="px-3 py-1 border rounded hover:bg-gray-50">
            Next
          </Link>
        )}
      </div>
    </div>
  )
}
