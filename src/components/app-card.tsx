import Link from 'next/link'
import { AnonymousName } from '@/components/anonymous-name'
import { AppIcon } from '@/components/app-icon'
import { Stat } from '@/components/ui/card'
import type { AppListing } from '@/lib/data/apps'
import { cn, formatCount, formatMoney, formatGrowth } from '@/lib/utils'

/**
 * The card used in horizontal rails. Header identifies the app, footer carries
 * three figures under tiny uppercase keys — the same unit repeated everywhere,
 * so a reader learns to scan it once.
 */
export function AppCard({ app, className }: { app: AppListing; className?: string }) {
  const growth = formatGrowth(app.growth30d)

  return (
    <Link
      href={`/apps/${app.slug}`}
      className={cn(
        'group glass border-border hover:border-border-strong rounded-card relative flex w-[248px] shrink-0 flex-col justify-between border p-4 transition-colors hover:bg-white/8',
        className,
      )}
    >
      {/*
        Floating clear of the corner rather than notched into it: a
        corner-filling badge has to fake the panel's curve on two sides and gets
        it slightly wrong at every zoom level.
      */}
      {app.providers.length > 0 && (
        <span className="bg-blue-dim text-blue ring-blue/25 absolute top-2.5 right-2.5 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wider uppercase ring-1 ring-inset">
          Verified
        </span>
      )}

      <div className="flex items-start gap-2.5">
        <AppIcon src={app.iconUrl} name={app.name} size={34} />
        <div className="min-w-0 pr-14">
          <h3 className="text-fg truncate text-[13px] font-bold">
            {app.isAnonymous ? <AnonymousName tooltip>{app.name}</AnonymousName> : app.name}
          </h3>
          <p className="text-muted truncate text-[11px]">{app.categoryName ?? 'iOS app'}</p>
        </div>
      </div>

      <p className="text-muted mt-2.5 line-clamp-2 min-h-[30px] text-[11px] leading-relaxed">
        {app.isAnonymous ? <AnonymousName>{app.tagline}</AnonymousName> : app.tagline}
      </p>

      <div className="border-border mt-3.5 grid grid-cols-3 gap-2 border-t pt-3">
        <Stat label="MRR" value={formatMoney(app.mrrCents)} />
        <Stat
          label="MoM"
          value={growth ?? '—'}
          tone={growth === null ? undefined : (app.growth30d ?? 0) >= 0 ? 'up' : 'down'}
        />
        <Stat label="ARR" value={formatCompactMoney(app.mrrCents * 12)} />
      </div>
    </Link>
  )
}

function formatCompactMoney(cents: number) {
  const dollars = cents / 100
  if (dollars >= 1_000_000) return `$${formatCount(Math.round(dollars))}`
  return formatMoney(cents)
}

/** A horizontally scrolling rail of cards, with the section heading above it. */
export function AppRail({
  title,
  href,
  linkLabel,
  apps,
}: {
  title: string
  href: string
  linkLabel: string
  apps: AppListing[]
}) {
  if (apps.length === 0) return null

  return (
    <section className="mt-8">
      <div className="flex items-baseline justify-between gap-4">
        <h2 className="text-fg text-[13px] font-bold">{title}</h2>
        <Link href={href} className="text-muted hover:text-fg shrink-0 text-[12px]">
          {linkLabel} →
        </Link>
      </div>

      <div className="rail mt-3 flex gap-2.5 overflow-x-auto pb-1">
        {apps.map((app) => (
          <AppCard key={app.id} app={app} />
        ))}
      </div>
    </section>
  )
}
