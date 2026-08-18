import type { Metadata } from 'next'
import Link from 'next/link'
import { desc, eq } from 'drizzle-orm'
import { AlertTriangle, Plus } from 'lucide-react'
import { db } from '@/db'
import { appMetrics, appStoreMetadata, apps, revenueConnections } from '@/db/schema'
import { AppIcon } from '@/components/app-icon'
import { GrowthPill } from '@/components/growth-pill'
import { ButtonLink } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { requireUser } from '@/lib/auth'
import { formatMoney, timeAgo } from '@/lib/utils'

export const metadata: Metadata = { title: 'Dashboard', robots: { index: false } }

export default async function DashboardPage() {
  const user = await requireUser('/dashboard')
  const rows = await db
    .select({
      id: apps.id,
      slug: apps.slug,
      name: apps.name,
      status: apps.status,
      iconUrl: appStoreMetadata.iconUrl,
      mrrCents: appMetrics.mrrCents,
      growth30d: appMetrics.growth30d,
      updatedAt: appMetrics.updatedAt,
    })
    .from(apps)
    .leftJoin(appMetrics, eq(appMetrics.appId, apps.id))
    .leftJoin(appStoreMetadata, eq(appStoreMetadata.appId, apps.id))
    .where(eq(apps.founderId, user.id))
    .orderBy(desc(apps.createdAt))

  const connections = await db
    .select({
      appId: revenueConnections.appId,
      provider: revenueConnections.provider,
      status: revenueConnections.status,
      lastError: revenueConnections.lastError,
    })
    .from(revenueConnections)
    .innerJoin(apps, eq(apps.id, revenueConnections.appId))
    .where(eq(apps.founderId, user.id))

  const failing = connections.filter((c) => c.status === 'error')
  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 sm:py-14">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="display text-4xl font-semibold">Your apps</h1>
          <p className="text-muted mt-2">
            Signed in as{' '}
            <Link href={`/founders/${user.profile.handle}`} className="text-blue hover:underline">
              @{user.profile.handle}
            </Link>
          </p>
        </div>
        <ButtonLink href="/submit">
          <Plus className="size-4" />
          Submit an app
        </ButtonLink>
      </div>

      {failing.length > 0 && (
        <div className="border-red/40 bg-red-dim mt-6 rounded-[10px] border p-4">
          <div className="text-red flex items-center gap-2">
            <AlertTriangle className="size-4" />
            <h2 className="text-sm font-medium">
              {failing.length} connection{failing.length === 1 ? '' : 's'} stopped working{' '}
            </h2>
          </div>
          <p className="text-fg mt-1.5 text-sm">
            Revenue is no longer refreshing for the apps below. Reconnect to keep them verified.
          </p>
        </div>
      )}

      <ul className="mt-6 space-y-2">
        {rows.map((row) => {
          const appConnections = connections.filter((c) => c.appId === row.id)
          const hasError = appConnections.some((c) => c.status === 'error')
          return (
            <li
              key={row.id}
              className="border-border bg-surface flex flex-wrap items-center gap-4 rounded-[10px] border p-4"
            >
              <AppIcon src={row.iconUrl} name={row.name} size={44} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="text-fg truncate font-medium">{row.name}</h2>
                  <StatusBadge status={row.status} hasError={hasError} />
                </div>
                <p className="text-muted text-[11px]">
                  {appConnections.length === 0
                    ? 'No provider connected'
                    : `${appConnections.length} source${appConnections.length === 1 ? '' : 's'} · updated ${timeAgo(row.updatedAt)}`}{' '}
                </p>
              </div>

              <div className="text-right">
                <p className="tabular text-fg text-sm font-medium">
                  {formatMoney(Number(row.mrrCents ?? 0))}
                  <span className="text-muted text-[11px]">/mo</span>
                </p>
                <GrowthPill value={row.growth30d} className="justify-end" />
              </div>

              <div className="border-border flex w-full gap-3 border-t pt-3 sm:w-auto sm:border-0 sm:pt-0">
                <Link
                  href={`/dashboard/${row.id}/connect`}
                  className="text-blue text-sm hover:underline"
                >
                  {appConnections.length === 0 ? 'Connect revenue' : 'Manage sources'}{' '}
                </Link>
                <Link
                  href={`/dashboard/${row.id}/insights`}
                  className="text-muted hover:text-fg text-sm"
                >
                  Insights
                </Link>
                {row.status === 'live' && (
                  <Link href={`/apps/${row.slug}`} className="text-muted hover:text-fg text-sm">
                    View page
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ul>

      {rows.length === 0 && (
        <div className="border-border-strong mt-10 rounded-[10px] border border-dashed p-10 text-center">
          <h2 className="text-fg font-medium">No apps yet</h2>
          <p className="text-muted mx-auto mt-2 max-w-sm text-sm">
            Paste your App Store link, connect a read-only key, and your verified revenue goes on
            the leaderboard.
          </p>
          <ButtonLink href="/submit" className="mt-5">
            Submit your first app
          </ButtonLink>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status, hasError }: { status: string; hasError: boolean }) {
  if (hasError) return <Badge tone="down">Sync failing</Badge>
  if (status === 'live') return <Badge tone="verified">Live</Badge>
  if (status === 'draft') return <Badge tone="neutral">Draft — not verified</Badge>
  return <Badge tone="neutral">{status}</Badge>
}
