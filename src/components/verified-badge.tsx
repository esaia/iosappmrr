import { BadgeCheck } from 'lucide-react'
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
 * The site's core claim, in one component. It always names its sources — a
 * badge that can't say where the number came from isn't worth showing.
 */
export function VerifiedBadge({
  providers,
  size = 'md',
  className,
}: {
  providers: string[]
  size?: 'sm' | 'md'
  className?: string
}) {
  if (providers.length === 0) return null
  const names = providers.map(providerLabel)

  return (
    <span
      title={`Revenue synced from ${names.join(' and ')}`}
      className={cn(
        'bg-blue-dim text-blue ring-blue/25 inline-flex items-center gap-1 rounded-md font-medium tracking-wider uppercase ring-1 ring-inset',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-[11px]',
        className,
      )}
    >
      <BadgeCheck className={size === 'sm' ? 'size-3' : 'size-3.5'} strokeWidth={2.5} />
      Verified
      {size === 'md' && (
        <span className="text-blue/60 tracking-normal normal-case">{names.join(' + ')}</span>
      )}
    </span>
  )
}
