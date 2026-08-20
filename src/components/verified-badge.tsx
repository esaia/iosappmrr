import { BadgeAlert, BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/utils'

const PROVIDER_LABELS: Record<string, string> = {
  revenuecat: 'RevenueCat',
  app_store_connect: 'App Store Connect',
  superwall: 'Superwall',
  stripe: 'Stripe',
}

export function providerLabel(id: string) {
  return PROVIDER_LABELS[id] ?? id
}

/**
 * The site's core claim, in one component — and, now, its absence.
 *
 * Verified always names its sources: a badge that cannot say where the number
 * came from is not worth showing. Unverified says so in as many words rather
 * than rendering nothing, because on a site where every listing carried the
 * badge, an empty space was a state no reader had been taught to read.
 *
 * It takes the app's own `verified` flag as well as the sources, and needs
 * both. The flag is owned by the provider-connection flow — set when a key
 * verifies, cleared when it is disconnected — whereas the source list is
 * derived from whatever snapshot rows exist, which is a different question:
 * rows can be written by something other than a real connection, and a listing
 * seeded for a demo had them. Reading only the sources, the badge announced
 * that invented revenue had been verified by RevenueCat.
 *
 * Required rather than defaulted, so a new call site has to say which app it is
 * making the claim about instead of getting the claim for free.
 */
export function VerifiedBadge({
  verified,
  providers,
  size = 'md',
  className,
}: {
  /** `apps.is_verified` — whether a provider key actually verified this app. */
  verified: boolean
  providers: string[]
  size?: 'sm' | 'md'
  className?: string
}) {
  const shape = cn(
    'inline-flex items-center gap-1 rounded-md font-medium tracking-wider uppercase',
    size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
    className,
  )
  const icon = size === 'sm' ? 'size-3' : 'size-3.5'

  /*
   * Said out loud rather than left blank.
   *
   * Every listing on the site used to carry the badge, so its absence was never
   * a state a reader had seen — and an unverified app simply looked like a page
   * where the badge had failed to load. Naming it costs one chip and turns a
   * gap into a fact, which matters most on the listing where the figures are
   * there but nobody has stood behind them.
   *
   * Grey, and dashed like the site's other placeholders. Not red: this is the
   * ordinary state of a listing whose founder has not connected a key yet, and
   * an alarm on it would read as an accusation.
   */
  if (!verified || providers.length === 0) {
    return (
      <span
        title="No payment provider has verified the revenue on this listing."
        className={cn(shape, 'text-dim border-border border border-dashed')}
      >
        <BadgeAlert className={icon} strokeWidth={2.5} />
        Not verified
      </span>
    )
  }

  const names = providers.map(providerLabel)

  return (
    <span
      title={`Revenue synced from ${names.join(' and ')}`}
      className={cn(shape, 'bg-blue-dim text-blue ring-blue/25 ring-1 ring-inset')}
    >
      <BadgeCheck className={icon} strokeWidth={2.5} />
      Verified
      {size === 'md' && (
        <span className="text-blue/60 tracking-normal normal-case">{names.join(' + ')}</span>
      )}
    </span>
  )
}
