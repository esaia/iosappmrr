'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'

/** Hero search. Submits to /apps, which owns filtering and pagination. */
export function HomeSearch() {
  const router = useRouter()
  const [query, setQuery] = useState('')

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        router.push(query.trim() ? `/apps?q=${encodeURIComponent(query.trim())}` : '/apps')
      }}
      className="mx-auto mt-7 flex max-w-xl items-center gap-2"
    >
      <div className="relative flex-1">
        <Search className="text-dim pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <label htmlFor="hero-search" className="sr-only">
          Search verified iOS apps
        </label>
        <input
          id="hero-search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder='"habit tracker over $10K/mo"'
          className="border-border bg-surface text-fg placeholder:text-dim focus:border-border-strong h-11 w-full rounded-[10px] border pr-3 pl-9 text-[13px] focus:outline-none"
        />
      </div>
      <Button type="submit" size="lg" className="shrink-0">
        <Plus className="size-4" />
        Add app
      </Button>
    </form>
  )
}
