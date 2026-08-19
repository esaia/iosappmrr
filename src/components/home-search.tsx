'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState } from 'react'
import { Loader2, Search } from 'lucide-react'
import { AppIcon } from '@/components/app-icon'
import { Button } from '@/components/ui/button'
import { formatMrr } from '@/lib/utils'

type Suggestion = {
  slug: string
  name: string
  tagline: string | null
  iconUrl: string | null
  categoryName: string | null
  mrrCents: number
  verified: boolean
}

const DEBOUNCE_MS = 220
const MIN_QUERY = 2

/** Hero search. Suggests as you type; submitting hands off to /apps, which owns
 * filtering and pagination. */
export function HomeSearch() {
  const router = useRouter()
  const listId = useId()

  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Suggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)

  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const term = query.trim()
    if (term.length < MIN_QUERY) {
      setResults([])
      setLoading(false)
      return
    }

    setLoading(true)
    // Abort in flight on every keystroke, so a slow early response can never
    // overwrite the results for what the reader has since typed.
    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/search?q=${encodeURIComponent(term)}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Search failed')
        const data = (await response.json()) as { results: Suggestion[] }
        setResults(data.results)
        setActive(-1)
        setOpen(true)
      } catch (error) {
        if ((error as Error).name !== 'AbortError') setResults([])
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }, DEBOUNCE_MS)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [query])

  useEffect(() => {
    const onPointer = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    return () => document.removeEventListener('mousedown', onPointer)
  }, [])

  function go(term: string) {
    setOpen(false)
    router.push(term ? `/apps?q=${encodeURIComponent(term)}` : '/apps')
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Escape') return setOpen(false)
    if (!open || results.length === 0) return

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive((i) => (i + 1) % results.length)
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive((i) => (i <= 0 ? results.length - 1 : i - 1))
    } else if (event.key === 'Enter' && active >= 0) {
      event.preventDefault()
      setOpen(false)
      router.push(`/apps/${results[active].slug}`)
    }
  }

  // Only paint the panel when it has something in it. While the first request
  // for a term is in flight there are no results and no empty-state message,
  // which would otherwise render as a bare strip under the field.
  const showPanel = open && query.trim().length >= MIN_QUERY && (results.length > 0 || !loading)

  return (
    <div ref={rootRef} className="relative mx-auto mt-7 max-w-xl">
      <form
        onSubmit={(event) => {
          event.preventDefault()
          go(query.trim())
        }}
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="text-dim pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <label htmlFor="hero-search" className="sr-only">
            Search verified iOS apps
          </label>
          <input
            id="hero-search"
            role="combobox"
            aria-expanded={showPanel}
            aria-controls={listId}
            aria-autocomplete="list"
            aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
            autoComplete="off"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder='"habit tracker over $10K/mo"'
            className="glass border-border text-fg placeholder:text-dim focus:border-accent/60 focus:ring-accent/25 rounded-card h-11 w-full border pr-9 pl-9 text-[13px] transition-colors focus:ring-4 focus:outline-none"
          />
          {loading && (
            <Loader2 className="text-dim absolute top-1/2 right-3 size-4 -translate-y-1/2 animate-spin" />
          )}
        </div>
        <Button type="submit" size="lg" className="shrink-0">
          <Search className="size-4" />
          Search
        </Button>
      </form>

      {showPanel && (
        <div
          id={listId}
          role="listbox"
          className="glass-raised border-border rounded-card absolute top-full right-0 left-0 z-30 mt-2 max-h-[380px] overflow-y-auto border py-1 text-left"
        >
          {results.length === 0 && !loading && (
            <p className="text-muted px-3 py-6 text-center text-[13px]">
              No apps match “{query.trim()}”.
            </p>
          )}

          {results.map((item, index) => (
            <button
              key={item.slug}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              type="button"
              onMouseEnter={() => setActive(index)}
              onClick={() => {
                setOpen(false)
                router.push(`/apps/${item.slug}`)
              }}
              className={
                index === active
                  ? 'bg-surface-2 flex w-full items-center gap-3 px-3 py-2.5 text-left'
                  : 'hover:bg-surface-2 flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors'
              }
            >
              <AppIcon src={item.iconUrl} name={item.name} size={34} />
              <span className="min-w-0 flex-1">
                <span className="text-fg block truncate text-[13px] font-bold">{item.name}</span>
                <span className="text-muted block truncate text-[11px]">
                  {item.tagline ?? item.categoryName ?? 'iOS app'}
                </span>
              </span>
              {item.mrrCents > 0 && (
                <span className="tabular text-muted shrink-0 text-[11px]">
                  {formatMrr(item.mrrCents)}
                  <span className="text-dim">/mo</span>
                </span>
              )}
            </button>
          ))}

          {results.length > 0 && (
            <button
              type="button"
              onClick={() => go(query.trim())}
              className="text-muted hover:text-fg border-border mt-1 w-full border-t px-3 py-2.5 text-left text-[12px] transition-colors"
            >
              See all results for “{query.trim()}” →
            </button>
          )}
        </div>
      )}
    </div>
  )
}
