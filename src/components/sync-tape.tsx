'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AppIcon } from '@/components/app-icon'
import { providerLabel } from '@/components/verified-badge'
import { formatMoney, timeAgo } from '@/lib/utils'

export type SyncEvent = {
  slug: string
  name: string
  iconUrl: string | null
  provider: string
  lastSyncedAt: string
  mrrCents: number
}

/**
 * The site's central claim is that these numbers are read, not typed. Saying so
 * is cheap; showing the reads happening is not. This is the audit log — the one
 * place the page is allowed to move.
 */
export function SyncTape({ events }: { events: SyncEvent[] }) {
  // Timestamps render on the server first, then stay honest on the client.
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = setInterval(() => setNow(Date.now()), 30_000)
    return () => clearInterval(timer)
  }, [])

  if (events.length === 0) return null

  return (
    <div className="border-border bg-surface overflow-hidden rounded-[10px] border">
      <div className="border-border flex items-center gap-2 border-b px-4 py-3">
        <span className="relative flex size-1.5">
          <span className="bg-green absolute inline-flex size-full animate-ping rounded-full opacity-60" />
          <span className="bg-green relative inline-flex size-1.5 rounded-full" />
        </span>
        <h2 className="text-fg text-[13px] font-bold">Revenue sync</h2>
        <span className="label ml-auto">last {events.length} reads</span>
      </div>

      <ul>
        {events.map((event) => (
          <li
            key={`${event.slug}-${event.provider}`}
            className="border-border border-b last:border-b-0"
          >
            <Link
              href={`/apps/${event.slug}`}
              className="hover:bg-surface-2 flex items-center gap-2.5 px-4 py-2 transition-colors"
            >
              <AppIcon src={event.iconUrl} name={event.name} size={20} />
              <span className="text-fg min-w-0 flex-1 truncate text-[12px]">{event.name}</span>
              <span className="text-dim hidden text-[11px] sm:inline">
                {providerLabel(event.provider)}
              </span>
              <span className="tabular text-fg w-20 text-right text-[12px]">
                {formatMoney(event.mrrCents)}
              </span>
              <span
                className="tabular text-green w-14 shrink-0 text-right text-[11px]"
                suppressHydrationWarning
              >
                {now === null ? '—' : timeAgo(event.lastSyncedAt)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
