'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'

/**
 * Search box and filter chips for the admin lists.
 *
 * A plain GET form rather than a debounced fetch: the result is a URL you can
 * bookmark, reload, or paste to someone else, and a submit is a moment the
 * admin chose rather than a query fired on every keystroke against unindexed
 * ILIKE columns.
 */
export function AdminFilters({
  basePath,
  placeholder,
  filters,
  filterKey,
}: {
  basePath: string
  /** Omit to render filter chips only — a box that searches nothing is worse than none. */
  placeholder?: string
  filters?: { value: string; label: string }[]
  filterKey?: string
}) {
  const params = useSearchParams()
  const q = params.get('q') ?? ''
  const current = filterKey ? (params.get(filterKey) ?? '') : ''

  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      {placeholder && (
        <form action={basePath} className="flex gap-2">
          {/* Keeps the active filter when a new search is submitted. */}
          {filterKey && current && <input type="hidden" name={filterKey} value={current} />}
          <input
            name="q"
            defaultValue={q}
            placeholder={placeholder}
            autoComplete="off"
            className="border-border bg-surface-2 text-fg placeholder:text-dim focus:border-border-strong w-72 rounded-[10px] border px-3 py-1.5 text-[13px] focus:outline-none"
          />
          <button
            type="submit"
            className="border-border bg-surface text-fg hover:border-border-strong rounded-[10px] border px-3 py-1.5 text-[13px]"
          >
            Search
          </button>
        </form>
      )}

      {filters && filterKey && (
        <div className="flex flex-wrap gap-1">
          {filters.map((filter) => {
            const next = new URLSearchParams()
            if (q) next.set('q', q)
            if (filter.value) next.set(filterKey, filter.value)
            const href = next.toString() ? `${basePath}?${next}` : basePath

            return (
              <Link
                key={filter.value || 'all'}
                href={href}
                className={cn(
                  'rounded-md px-2.5 py-1 text-[12px] transition-colors',
                  current === filter.value
                    ? 'bg-surface-2 text-fg'
                    : 'text-muted hover:bg-surface-2 hover:text-fg',
                )}
              >
                {filter.label}
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
