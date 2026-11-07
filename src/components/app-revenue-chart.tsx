'use client'

import { useEffect, useState } from 'react'
import { RevenueChart, type RevenuePoint } from '@/components/revenue-chart'
import { useViewer } from '@/lib/use-viewer'

/**
 * The app page's chart. The cached page carries the free window; once the
 * browser knows the reader is signed in, it swaps in the full year.
 */
export function AppRevenueChart({ slug, initial }: { slug: string; initial: RevenuePoint[] }) {
  const viewer = useViewer()
  const [full, setFull] = useState<RevenuePoint[] | null>(null)

  useEffect(() => {
    if (!viewer) return
    let live = true
    void fetch(`/api/apps/${encodeURIComponent(slug)}/history`)
      .then((response) => (response.ok ? response.json() : null))
      .then((body: { history?: RevenuePoint[] } | null) => {
        if (live && body?.history) setFull(body.history)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [viewer, slug])

  return <RevenueChart data={full ?? initial} signedIn={Boolean(viewer)} />
}
