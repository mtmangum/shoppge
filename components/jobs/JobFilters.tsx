'use client'

import { useEffect, useRef, useState, useTransition, type ReactNode } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Loader2 } from 'lucide-react'
import type { JobPriority, JobStatus } from '@/lib/types'

const FIELD_CLASS = 'border border-gray-300 rounded-md px-3 py-1.5 text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-[#BF5700]'

interface Filters {
  search: string
  status: JobStatus | 'all'
  priority: JobPriority | 'all'
}

interface JobFiltersProps extends Filters {
  total: number
  children: ReactNode
}

export function JobFilters({ search, status, priority, total, children }: JobFiltersProps) {
  const router = useRouter()
  const query = useSearchParams().toString()
  const [filters, setFilters] = useState<Filters>({ search, status, priority })
  const draft = useRef(filters)
  const searchInput = useRef<HTMLInputElement>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const composing = useRef(false)
  const ownNavigations = useRef<string[]>([])
  const [debouncing, setDebouncing] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Sync links and Back/Forward navigation, but don't let a response to an
  // earlier filter change replace text the user has typed since that request.
  useEffect(() => {
    const ownIndex = ownNavigations.current.lastIndexOf(query)
    if (ownIndex !== -1) {
      ownNavigations.current.splice(0, ownIndex + 1)
      return
    }
    ownNavigations.current = []
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setDebouncing(false)
    const next = { search, status, priority }
    draft.current = next
    setFilters(next)
  }, [query, search, status, priority])

  useEffect(() => () => {
    if (timer.current !== null) clearTimeout(timer.current)
  }, [])

  function cancelDebounce() {
    if (timer.current !== null) clearTimeout(timer.current)
    timer.current = null
    setDebouncing(false)
  }

  function updateDraft(next: Filters) {
    draft.current = next
    setFilters(next)
  }

  function apply(next: Filters) {
    cancelDebounce()
    const params = new URLSearchParams(query)
    const searchValue = next.search.trim()
    if (searchValue) params.set('search', searchValue)
    else params.delete('search')
    if (next.status !== 'all') params.set('status', next.status)
    else params.delete('status')
    if (next.priority !== 'all') params.set('priority', next.priority)
    else params.delete('priority')
    // Keep personal-view and sorting parameters; every filter starts on page 1.
    params.delete('page')
    const nextQuery = params.toString()
    if (nextQuery === query && !isPending) return
    ownNavigations.current.push(nextQuery)
    // Next's router coordinates overlapping navigations; no independent fetch
    // callbacks can install results from an older request over the latest one.
    startTransition(() => {
      router.replace(nextQuery ? `/jobs?${nextQuery}` : '/jobs', { scroll: false })
    })
  }

  function changeSearch(value: string) {
    const next = { ...draft.current, search: value }
    updateDraft(next)
    cancelDebounce()
    if (composing.current) return
    if (!value) {
      apply(next)
      return
    }
    setDebouncing(true)
    timer.current = setTimeout(() => apply(draft.current), 300)
  }

  function changeSelect(field: 'status' | 'priority', value: string) {
    const next = { ...draft.current, [field]: value } as Filters
    updateDraft(next)
    apply(next)
  }

  function clear() {
    const next: Filters = { search: '', status: 'all', priority: 'all' }
    updateDraft(next)
    apply(next)
    searchInput.current?.focus()
  }

  const updating = debouncing || isPending
  const hasFilters = Boolean(filters.search || filters.status !== 'all' || filters.priority !== 'all')

  return (
    <div className="space-y-6">
      <form
        role="search"
        aria-label="Filter jobs"
        className="flex flex-wrap gap-3 items-end"
        onSubmit={event => {
          event.preventDefault()
          if (!composing.current) apply(draft.current)
        }}
      >
        <div className="w-full sm:w-64">
          <label htmlFor="jobs-search" className="block text-xs font-medium text-gray-600 mb-1">Search jobs</label>
          <input
            ref={searchInput}
            id="jobs-search"
            type="search"
            name="search"
            placeholder="Description or job #…"
            value={filters.search}
            onChange={event => changeSearch(event.target.value)}
            onCompositionStart={() => { composing.current = true; cancelDebounce() }}
            onCompositionEnd={event => { composing.current = false; changeSearch(event.currentTarget.value) }}
            className={`${FIELD_CLASS} w-full`}
          />
        </div>
        <div>
          <label htmlFor="jobs-status" className="block text-xs font-medium text-gray-600 mb-1">Status</label>
          <div className="relative">
            <select id="jobs-status" name="status" value={filters.status} onChange={event => changeSelect('status', event.target.value)} className={`${FIELD_CLASS} appearance-none pr-8`}>
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="inprogress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          </div>
        </div>
        <div>
          <label htmlFor="jobs-priority" className="block text-xs font-medium text-gray-600 mb-1">Priority</label>
          <div className="relative">
            <select id="jobs-priority" name="priority" value={filters.priority} onChange={event => changeSelect('priority', event.target.value)} className={`${FIELD_CLASS} appearance-none pr-8`}>
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent</option>
              <option value="normal">Normal</option>
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
          </div>
        </div>
        <button type="button" onClick={clear} disabled={!hasFilters} className="text-sm text-gray-600 underline px-2 py-1.5 disabled:opacity-40 disabled:no-underline">
          Clear
        </button>
        <span role="status" aria-live="polite" aria-atomic="true" className="min-w-[9rem] text-sm text-gray-500 ml-auto py-1.5 flex items-center justify-end gap-2">
          {updating && <Loader2 aria-hidden="true" className="h-4 w-4 motion-safe:animate-spin" />}
          {updating ? 'Updating jobs…' : `${total} ${total === 1 ? 'job' : 'jobs'}`}
        </span>
      </form>
      <div aria-label="Job results" aria-busy={updating} className="space-y-6">
        {children}
      </div>
    </div>
  )
}
